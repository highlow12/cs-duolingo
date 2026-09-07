import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lesson } from "$lib/content/types";
import { LearningDatabase } from "$lib/storage/db";
import {
  HEART_REGENERATION_INTERVAL_MS,
  LearningRepository,
  NoHeartsError,
  NO_HEARTS_MESSAGE,
} from "$lib/storage/repositories/learning-repository";

let database: LearningDatabase | undefined;
let databaseCounter = 0;
let currentTime = Date.UTC(2026, 0, 1, 12);

function lesson(id: string): Lesson {
  return {
    schemaVersion: 1,
    id,
    revision: 1,
    track: "python",
    title: id,
    description: id,
    flow: [{ type: "content", blocks: [{ type: "text", text: "내용" }] }],
  };
}

function repository(): LearningRepository {
  database = new LearningDatabase(`heart-test-${databaseCounter++}`);
  return new LearningRepository({
    database,
    clock: () => currentTime,
    userId: "heart-test-user",
    deviceId: "heart-test-device",
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  if (database) {
    const current = database;
    database = undefined;
    current.close();
    await current.delete();
  }
  currentTime = Date.UTC(2026, 0, 1, 12);
});

describe("lesson hearts", () => {
  it("charges a fresh lesson, resumes an active session for free, and charges a restart", async () => {
    const repo = repository();
    const currentLesson = lesson("lesson.one");

    await repo.startLesson(currentLesson);
    expect((await repo.getHeartStatus()).count).toBe(2);

    await repo.startLesson(currentLesson);
    expect((await repo.getHeartStatus()).count).toBe(2);

    await repo.completeLesson(currentLesson, {
      lessonId: currentLesson.id,
      contentRevision: currentLesson.revision,
      currentIndex: currentLesson.flow.length,
      status: "completed",
      answers: [],
    });
    await repo.startLesson(currentLesson);
    expect((await repo.getHeartStatus()).count).toBe(1);
  });

  it("rejects a new lesson at zero hearts without creating its session", async () => {
    const repo = repository();
    await repo.startLesson(lesson("lesson.one"));
    await repo.startLesson(lesson("lesson.two"));
    await repo.startLesson(lesson("lesson.three"));
    expect((await repo.getHeartStatus()).count).toBe(0);

    await expect(repo.startLesson(lesson("lesson.one"))).resolves.toMatchObject(
      {
        lessonId: "lesson.one",
        status: "active",
      },
    );
    expect((await repo.getHeartStatus()).count).toBe(0);

    let thrown: unknown;
    try {
      await repo.startLesson(lesson("lesson.four"));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(NoHeartsError);
    expect((thrown as NoHeartsError).message).toBe(NO_HEARTS_MESSAGE);
    expect(typeof (thrown as NoHeartsError).nextRecoveryAt).toBe("number");
    expect(
      await repo.database.lessonSessions.get("lesson.four"),
    ).toBeUndefined();
    expect((await repo.getHeartStatus()).count).toBe(0);
  });

  it("replenishes one heart every eight hours and caps at three", async () => {
    const repo = repository();
    await repo.startLesson(lesson("lesson.one"));
    expect((await repo.getHeartStatus()).count).toBe(2);

    currentTime += HEART_REGENERATION_INTERVAL_MS - 1;
    expect((await repo.getHeartStatus()).count).toBe(2);
    currentTime += 1;
    expect((await repo.getHeartStatus()).count).toBe(3);
    expect((await repo.getHeartStatus()).nextRecoveryAt).toBeNull();

    currentTime += 24 * 60 * 60 * 1000;
    expect((await repo.getHeartStatus()).count).toBe(3);
    await repo.startLesson(lesson("lesson.two"));
    currentTime += 2 * HEART_REGENERATION_INTERVAL_MS;
    expect((await repo.getHeartStatus()).count).toBe(3);
  });

  it("does not grant an extra heart when the clock moves backwards", async () => {
    const repo = repository();
    await repo.startLesson(lesson("lesson.one"));
    await repo.startLesson(lesson("lesson.two"));
    await repo.startLesson(lesson("lesson.three"));
    currentTime += HEART_REGENERATION_INTERVAL_MS;
    expect((await repo.getHeartStatus()).count).toBe(1);

    currentTime -= HEART_REGENERATION_INTERVAL_MS / 2;
    expect((await repo.getHeartStatus()).count).toBe(1);
  });

  it("resets to three at a later local calendar date", async () => {
    const repo = repository();
    await repo.startLesson(lesson("lesson.one"));
    await repo.startLesson(lesson("lesson.two"));
    await repo.startLesson(lesson("lesson.three"));
    expect((await repo.getHeartStatus()).count).toBe(0);

    // The test runner's local timezone is not assumed to be UTC.
    currentTime = Date.UTC(2026, 0, 2, 5, 1);
    expect((await repo.getHeartStatus()).count).toBe(3);
  });

  it("keeps heart state in backups and restores a full allowance on reset", async () => {
    const repo = repository();
    await repo.startLesson(lesson("lesson.one"));
    const backup = JSON.parse(await repo.exportBackup()) as {
      heartState: { count: number };
    };
    expect(backup.heartState.count).toBe(2);

    await repo.resetProgress();
    expect((await repo.getHeartStatus()).count).toBe(3);
    await repo.importBackup(JSON.stringify(backup));
    expect((await repo.getHeartStatus()).count).toBe(2);
  });

  it("rolls back the heart charge when session creation fails", async () => {
    const repo = repository();
    vi.spyOn(repo.database.lessonSessions, "put").mockRejectedValue(
      new Error("injected session write failure"),
    );

    await expect(repo.startLesson(lesson("lesson.one"))).rejects.toThrow(
      "injected session write failure",
    );
    expect(await repo.database.heartState.get("local")).toBeUndefined();
    expect(
      await repo.database.lessonSessions.get("lesson.one"),
    ).toBeUndefined();
  });
});
