import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lesson } from "$lib/content/types";
import {
  createLessonSession,
  type LessonSession,
} from "$lib/lesson/lesson-engine";
import type { SingleChoiceQuestion } from "$lib/questions/types";
import { LearningDatabase } from "$lib/storage/db";
import { LearningRepository } from "$lib/storage/repositories/learning-repository";

let database: LearningDatabase | undefined;
let currentTime = Date.UTC(2026, 0, 1, 12);
let databaseCounter = 0;

const prompt = [{ type: "text" as const, text: "문제" }];

function question(
  id: string,
  revision = 1,
  lessonId = "lesson.one",
): SingleChoiceQuestion {
  return {
    schemaVersion: 1,
    id,
    lessonId,
    revision,
    type: "single-choice",
    prompt,
    options: [
      { id: "yes", content: prompt },
      { id: "no", content: prompt },
    ],
    correctOptionId: "yes",
    shuffleOptions: false,
  };
}

function lesson(id = "lesson.one", revision = 1): Lesson {
  return {
    schemaVersion: 1,
    id,
    revision,
    track: "python",
    title: "레슨",
    description: "테스트 레슨",
    flow: [
      { type: "content", blocks: prompt },
      { type: "question", ref: `${id}.q1` },
      { type: "question", ref: `${id}.q2` },
    ],
  };
}

function repository(
  name = `learning-test-${databaseCounter++}`,
): LearningRepository {
  database = new LearningDatabase(name);
  return new LearningRepository({
    database,
    clock: () => currentTime,
    userId: "test-user",
    deviceId: "test-device",
  });
}

async function closeDatabase(): Promise<void> {
  if (!database) return;
  const current = database;
  database = undefined;
  current.close();
  await current.delete();
}

afterEach(async () => {
  vi.restoreAllMocks();
  await closeDatabase();
  currentTime = Date.UTC(2026, 0, 1, 12);
});

describe("LearningRepository", () => {
  it("persists attempts when reopened with a new database instance", async () => {
    const first = repository();
    const q = question("lesson.one.q1");
    await first.saveAttempt({
      id: "attempt:persist",
      question: q,
      correct: true,
      durationMs: 250,
      mode: "lesson",
    });
    const before = await first.getSnapshot();
    const name = first.database.name;
    first.database.close();
    database = undefined;

    const reopenedDatabase = new LearningDatabase(name);
    database = reopenedDatabase;
    const reopened = new LearningRepository({
      database: reopenedDatabase,
      clock: () => currentTime,
      userId: "different-user-is-ignored-after-open",
      deviceId: "different-device-is-ignored-after-open",
    });
    await expect(reopened.getSnapshot()).resolves.toMatchObject(before);
    await expect(reopenedDatabase.studyEvents.count()).resolves.toBe(1);
    await expect(reopenedDatabase.questionStates.count()).resolves.toBe(1);
  });

  it("persists a lesson answer in the attempt transaction before session advancement", async () => {
    const first = repository();
    const currentLesson = lesson();
    await first.startLesson(currentLesson);
    const q = question(`${currentLesson.id}.q1`);
    await first.saveAttempt({
      id: "attempt:crash-window",
      question: q,
      correct: true,
      durationMs: 100,
      mode: "lesson",
    });
    const name = first.database.name;
    first.database.close();
    database = undefined;

    const reopenedDatabase = new LearningDatabase(name);
    database = reopenedDatabase;
    const reopened = new LearningRepository({
      database: reopenedDatabase,
      clock: () => currentTime,
    });
    await expect(reopened.startLesson(currentLesson)).resolves.toMatchObject({
      currentIndex: 0,
      status: "active",
      answers: [{ questionId: q.id, correct: true }],
    });
  });

  it("makes saveAttempt idempotent for the same event id", async () => {
    const repo = repository();
    const q = question("lesson.one.q1");
    const input = {
      id: "attempt:idempotent",
      question: q,
      correct: true,
      durationMs: 50,
      mode: "review" as const,
    };

    await repo.saveAttempt(input);
    await repo.saveAttempt(input);

    const events = await repo.database.studyEvents.toArray();
    const state = await repo.database.questionStates.get(q.id);
    expect(events).toHaveLength(1);
    expect(state?.stateVersion).toBe(1);
    expect((await repo.getSnapshot()).game.xp).toBe(10);
  });

  it("rolls back every write when an attempt transaction fails", async () => {
    const repo = repository();
    const q = question("lesson.one.q1");
    vi.spyOn(repo.database.questionStates, "put").mockRejectedValue(
      new Error("injected state write failure"),
    );

    await expect(
      repo.saveAttempt({
        id: "attempt:rollback",
        question: q,
        correct: true,
        durationMs: 50,
        mode: "lesson",
      }),
    ).rejects.toThrow("injected state write failure");

    expect(await repo.database.studyEvents.count()).toBe(0);
    expect(await repo.database.questionStates.count()).toBe(0);
    expect(await repo.database.lessonStates.count()).toBe(0);
    expect(await repo.database.gameState.count()).toBe(0);
    expect(await repo.database.gameEvents.count()).toBe(0);
    expect(await repo.database.outbox.count()).toBe(0);
    expect(await repo.database.syncMeta.count()).toBe(0);
  });

  it("stores a final wrong visit as Again and a later new visit as Good", async () => {
    const repo = repository();
    const q = question("lesson.one.q1");

    await repo.saveAttempt({
      id: "attempt:again",
      question: q,
      correct: false,
      durationMs: 100,
      mode: "lesson",
    });
    currentTime += 24 * 60 * 60 * 1000;
    await repo.saveAttempt({
      id: "attempt:good",
      question: q,
      correct: true,
      durationMs: 100,
      mode: "review",
    });

    const events = (
      await repo.database.studyEvents.orderBy("clientSeq").toArray()
    ).filter((event) => event.eventType === "review-attempt");
    expect(
      events.map((event) => ({
        result: event.result,
        rating: event.rating,
        final: event.final,
      })),
    ).toEqual([
      { result: "incorrect", rating: "again", final: true },
      { result: "correct", rating: "good", final: true },
    ]);
    const state = await repo.database.questionStates.get(q.id);
    expect(state?.correctCount).toBe(1);
    expect(state?.incorrectCount).toBe(1);
  });

  it("expires the current streak after a missed local calendar day", async () => {
    const repo = repository();
    const q = question("lesson.one.q1");
    await repo.saveAttempt({
      id: "attempt:streak",
      question: q,
      correct: true,
      durationMs: 100,
      mode: "review",
    });
    currentTime += 2 * 24 * 60 * 60 * 1000;

    await expect(repo.getSnapshot()).resolves.toMatchObject({
      game: { streak: 0, longestStreak: 1, xp: 10 },
    });
  });

  it("reconciles a learned revision as due now while excluding never-studied questions", async () => {
    const repo = repository();
    const learned = question("lesson.one.q1", 1);
    const revised = question(learned.id, 2);
    const neverStudied = question("lesson.one.never", 1);
    await repo.saveAttempt({
      id: "attempt:revision",
      question: learned,
      correct: true,
      durationMs: 100,
      mode: "review",
    });

    const queue = await repo.getReviewQueue([revised, neverStudied]);
    expect(queue.map((item) => item.id)).toEqual([learned.id]);
    const state = await repo.database.questionStates.get(learned.id);
    expect(state).toMatchObject({
      contentRevision: 2,
      status: "learning",
      nextReviewAt: currentTime,
    });
    expect(
      await repo.database.studyEvents
        .where("eventType")
        .equals("content-revision")
        .count(),
    ).toBe(1);
  });

  it("replays a backup, and rejects an invalid backup without changing current data", async () => {
    const repo = repository();
    const q = question("lesson.one.q1");
    await repo.saveAttempt({
      id: "attempt:backup",
      question: q,
      correct: true,
      durationMs: 100,
      mode: "lesson",
    });
    await repo.updateSettings({ dailyGoal: 100, reviewLimit: 50 });
    const originalSnapshot = await repo.getSnapshot();
    const backup = await repo.exportBackup();

    await repo.resetProgress();
    await repo.importBackup(backup);
    expect(await repo.getSnapshot()).toEqual(originalSnapshot);

    const beforeReject = await repo.exportBackup();
    const malformed = JSON.parse(beforeReject) as {
      settings: { dailyGoal: number };
    };
    malformed.settings.dailyGoal = 0;
    await expect(
      repo.importBackup(JSON.stringify(malformed)),
    ).rejects.toThrow();
    expect(await repo.exportBackup()).toBe(beforeReject);
  });

  it("restores an in-progress lesson before its first question is answered", async () => {
    const repo = repository();
    const currentLesson = lesson();
    const started = await repo.startLesson(currentLesson);
    const contentOnlyProgress = { ...started, currentIndex: 1 };
    await repo.saveSession(contentOnlyProgress);
    const backup = await repo.exportBackup();

    await repo.resetProgress();
    await repo.importBackup(backup);

    await expect(repo.getSnapshot()).resolves.toMatchObject({
      lessonStates: [
        expect.objectContaining({
          lessonId: currentLesson.id,
          status: "in-progress",
          contentRevision: currentLesson.revision,
        }),
      ],
    });
    await expect(repo.startLesson(currentLesson)).resolves.toEqual(
      contentOnlyProgress,
    );
  });

  it("resumes sessions and reopens a completed lesson with a fresh active session", async () => {
    const repo = repository();
    const currentLesson = lesson();
    const started = await repo.startLesson(currentLesson);
    expect(started).toEqual(createLessonSession(currentLesson));

    const partial: LessonSession = {
      ...started,
      currentIndex: 2,
      answers: [
        {
          questionId: `${currentLesson.id}.q1`,
          correct: true,
          answeredAt: currentTime,
        },
      ],
    };
    await repo.saveSession(partial);
    const resumed = await repo.startLesson(currentLesson);
    expect(resumed).toEqual(partial);

    const completed: LessonSession = {
      ...partial,
      currentIndex: currentLesson.flow.length,
      status: "completed",
      answers: [
        ...partial.answers,
        {
          questionId: `${currentLesson.id}.q2`,
          correct: false,
          answeredAt: currentTime,
        },
      ],
    };
    await repo.completeLesson(currentLesson, completed);
    await expect(repo.startLesson(currentLesson)).resolves.toEqual(
      createLessonSession(currentLesson),
    );
    await expect(repo.getSnapshot()).resolves.toMatchObject({
      lessonStates: [
        expect.objectContaining({
          lessonId: currentLesson.id,
          status: "completed",
        }),
      ],
    });
  });

  it("resumes an active same-revision session even when its lesson is completed", async () => {
    const repo = repository();
    const currentLesson = lesson();
    await repo.startLesson(currentLesson);
    const state = await repo.database.lessonStates.get(currentLesson.id);
    if (!state) throw new Error("expected lesson state");
    await repo.database.lessonStates.put({ ...state, status: "completed" });
    const saved: LessonSession = {
      lessonId: currentLesson.id,
      currentIndex: 1,
      status: "active",
      answers: [],
    };
    await repo.saveSession(saved);

    await expect(repo.startLesson(currentLesson)).resolves.toEqual(saved);
    await expect(
      repo.database.lessonStates.get(currentLesson.id),
    ).resolves.toMatchObject({ status: "completed" });
  });

  it("requires every question answer before completing a lesson", async () => {
    const repo = repository();
    const currentLesson = lesson();
    await repo.startLesson(currentLesson);
    await expect(
      repo.completeLesson(currentLesson, {
        lessonId: currentLesson.id,
        currentIndex: currentLesson.flow.length,
        status: "completed",
        answers: [
          {
            questionId: `${currentLesson.id}.q1`,
            correct: true,
            answeredAt: currentTime,
          },
        ],
      }),
    ).rejects.toThrow("unanswered");
  });

  it("accepts UI setting limits and rejects non-positive or excessive values", async () => {
    const repo = repository();
    await repo.updateSettings({ dailyGoal: 10, reviewLimit: 5 });
    await repo.updateSettings({ dailyGoal: 20, reviewLimit: 10 });
    await repo.updateSettings({ dailyGoal: 30, reviewLimit: 20 });
    await repo.updateSettings({ dailyGoal: 50, reviewLimit: 30 });
    await repo.updateSettings({ dailyGoal: 100, reviewLimit: 50 });
    await expect(repo.getSnapshot()).resolves.toMatchObject({
      settings: { dailyGoal: 100, reviewLimit: 50 },
    });
    await expect(repo.updateSettings({ dailyGoal: 0 })).rejects.toThrow();
    await expect(repo.updateSettings({ reviewLimit: 51 })).rejects.toThrow();
    await expect(repo.updateSettings({ dailyGoal: 101 })).rejects.toThrow();
  });
});

describe('independent content revisions', () => {
  it('persists question revision 2 in lesson revision 1 and rejects a stale session', async () => {
    const repo=repository();const currentLesson=lesson();
    const original=await repo.startLesson(currentLesson);
    await repo.saveAttempt({id:'different-revisions',question:question('lesson.one.q1',2),correct:true,durationMs:30,mode:'lesson'});
    expect((await repo.startLesson(currentLesson)).answers).toHaveLength(1);
    await repo.startLesson({...currentLesson,revision:2});
    await expect(repo.saveSession(original)).rejects.toThrow('older content revision');
  });
  it('restarts a saved session whose index is outside the authored flow', async () => {
    const repo=repository();const currentLesson=lesson();
    const started=await repo.startLesson(currentLesson);
    await repo.saveSession({...started,currentIndex:999});
    expect((await repo.startLesson(currentLesson)).currentIndex).toBe(0);
  });
});
