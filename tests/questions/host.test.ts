import { describe, expect, it } from "vitest";
import { createQuestionHost, type QuestionAttempt, type QuestionHostClock } from "../../src/lib/questions/host";
import type { Question, SingleChoiceQuestion, UserAnswer } from "../../src/lib/questions/types";

const prompt = [{ type: "text" as const, text: "test" }];

function choice(id: string, text = id) {
  return { id, content: [{ type: "text" as const, text }] };
}

function singleQuestion(id = "host.question", revision = 1): SingleChoiceQuestion {
  return {
    schemaVersion: 1,
    id,
    lessonId: "host-lesson",
    revision,
    type: "single-choice",
    prompt,
    options: [choice("wrong", "Wrong"), choice("right", "Right")],
    correctOptionId: "right",
    shuffleOptions: false,
  };
}

function answer(optionId: string): UserAnswer {
  return { type: "single-choice", optionId };
}

class TestClock {
  nowValue = 0;
  visible = true;
  private listeners = new Set<(visible: boolean) => void>();

  readonly clock: QuestionHostClock = {
    now: () => this.nowValue,
    isVisible: () => this.visible,
    subscribeVisibility: (listener) => {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    },
  };

  advance(milliseconds: number): void {
    this.nowValue += milliseconds;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const listener of this.listeners) listener(visible);
  }
}

function ids(attempts: QuestionAttempt[]): string[] {
  return attempts.map((attempt) => attempt.attemptId);
}

describe("QuestionHost lifecycle", () => {
  it("requires an answer and leaves the attempt available after an invalid answer", async () => {
    const host = createQuestionHost(singleQuestion(), { autoStart: false });
    host.start();

    expect(await host.submit()).toEqual({ status: "ignored", reason: "incomplete" });

    host.setAnswer({ type: "fill-blank", value: "right" } as unknown as UserAnswer);
    const invalid = await host.submit();
    expect(invalid).toMatchObject({
      status: "error",
      error: { code: "answer-type-mismatch", source: "evaluation" },
    });
    expect(host.state).toMatchObject({
      phase: "error",
      attemptNumber: 1,
      attempts: [],
    });

    host.recover();
    expect(host.state).toMatchObject({ phase: "answering", attemptNumber: 1, attempts: [] });
    host.setAnswer(answer("right"));
    const completed = await host.submit();
    expect(completed).toMatchObject({
      status: "evaluated",
      attempt: { attemptNumber: 1, final: true, result: { correct: true } },
    });
  });

  it("requires a retry after the first wrong answer and reveals the answer only at the end", async () => {
    const delivered: QuestionAttempt[] = [];
    const host = createQuestionHost(singleQuestion(), {
      autoStart: false,
      createAttemptId: (() => {
        let index = 0;
        return () => `attempt-${++index}`;
      })(),
      onAttempt: (attempt) => {
        delivered.push(attempt);
      },
    });
    host.start();
    host.setAnswer(answer("wrong"));

    const first = await host.submit();
    expect(first).toMatchObject({
      status: "evaluated",
      attempt: { attemptId: "attempt-1", attemptNumber: 1, final: false, result: { correct: false } },
    });
    expect(host.state).toMatchObject({ phase: "retry-feedback", attemptNumber: 1, canonicalAnswer: null });
    expect(host.state.submittedAnswer).toEqual(answer("wrong"));

    host.retry();
    expect(host.state).toMatchObject({ phase: "answering", attemptNumber: 2, attemptKey: 1, currentAnswer: null });
    host.setAnswer(answer("right"));
    const second = await host.submit();
    expect(second).toMatchObject({
      status: "evaluated",
      attempt: { attemptId: "attempt-2", attemptNumber: 2, final: true, result: { correct: true } },
    });
    expect(host.state.phase).toBe("final-feedback");
    expect(host.state.canonicalAnswer).toEqual({ type: "single-choice", optionId: "right" });
    expect(ids(delivered)).toEqual(["attempt-1", "attempt-2"]);
  });

  it("ignores double submits while the persistence callback is pending", async () => {
    let release!: () => void;
    const callback = new Promise<void>((resolve) => (release = resolve));
    const delivered: QuestionAttempt[] = [];
    const host = createQuestionHost(singleQuestion(), {
      autoStart: false,
      onAttempt: async (attempt) => {
        delivered.push(attempt);
        await callback;
      },
    });
    host.start();
    host.setAnswer(answer("right"));

    const firstSubmit = host.submit();
    await Promise.resolve();
    expect(host.state.phase).toBe("evaluating");
    expect(await host.submit()).toEqual({ status: "ignored", reason: "not-answering" });
    release();
    await firstSubmit;

    expect(delivered).toHaveLength(1);
    expect(host.state.phase).toBe("final-feedback");
  });

  it("retries a failed persistence callback with the same attempt ID", async () => {
    let calls = 0;
    const delivered: QuestionAttempt[] = [];
    const host = createQuestionHost(singleQuestion(), {
      autoStart: false,
      createAttemptId: () => "stable-attempt-id",
      onAttempt: async (attempt) => {
        delivered.push(attempt);
        calls += 1;
        if (calls === 1) throw new Error("temporarily unavailable");
      },
    });
    host.start();
    host.setAnswer(answer("right"));

    const failed = await host.submit();
    expect(failed).toMatchObject({ status: "error", error: { source: "persistence" } });
    expect(host.state.phase).toBe("error");
    expect(host.hasPendingAttempt).toBe(true);

    const retried = await host.retryPending();
    expect(retried).toMatchObject({
      status: "evaluated",
      attempt: { attemptId: "stable-attempt-id", final: true },
    });
    expect(delivered.map((attempt) => attempt.attemptId)).toEqual([
      "stable-attempt-id",
      "stable-attempt-id",
    ]);
    expect(host.state.phase).toBe("final-feedback");
  });

  it("measures visible solving time per attempt and excludes evaluator and callback time", async () => {
    const clock = new TestClock();
    let release!: () => void;
    const callback = new Promise<void>((resolve) => (release = resolve));
    const delivered: QuestionAttempt[] = [];
    const host = createQuestionHost(singleQuestion(), {
      autoStart: false,
      clock: clock.clock,
      createAttemptId: (() => {
        let index = 0;
        return () => `attempt-${++index}`;
      })(),
      onAttempt: async (attempt) => {
        delivered.push(attempt);
        if (delivered.length === 1) await callback;
      },
    });
    host.start();

    clock.advance(100);
    clock.setVisible(false);
    clock.advance(1_000);
    clock.setVisible(true);
    clock.advance(40);
    host.setAnswer(answer("wrong"));
    const firstSubmit = host.submit();
    // This interval is callback time and must not be part of durationMs.
    clock.advance(5_000);
    release();
    const first = await firstSubmit;
    expect(first).toMatchObject({ status: "evaluated", attempt: { durationMs: 140 } });

    host.retry();
    clock.advance(60);
    host.setAnswer(answer("right"));
    const second = await host.submit();
    expect(second).toMatchObject({ status: "evaluated", attempt: { durationMs: 60 } });
    expect(delivered.map((attempt) => attempt.durationMs)).toEqual([140, 60]);
  });

  it("resets state for a new question and suppresses a stale callback", async () => {
    let release!: () => void;
    const callback = new Promise<void>((resolve) => (release = resolve));
    const host = createQuestionHost(singleQuestion("first"), {
      autoStart: false,
      onAttempt: () => callback,
    });
    host.start();
    host.setAnswer(answer("right"));
    const pending = host.submit();
    await Promise.resolve();
    expect(host.state.phase).toBe("evaluating");

    host.setQuestion(singleQuestion("second", 2));
    expect(host.state).toMatchObject({
      questionId: "second",
      questionRevision: 2,
      phase: "answering",
      attemptNumber: 1,
      attempts: [],
    });
    release();
    expect(await pending).toEqual({ status: "ignored", reason: "not-answering" });
    expect(host.state.questionId).toBe("second");
    expect(host.state.attempts).toEqual([]);
  });

  it("suppresses a callback that settles after lifecycle cleanup", async () => {
    let release!: () => void;
    const callback = new Promise<void>((resolve) => (release = resolve));
    const host = createQuestionHost(singleQuestion(), {
      autoStart: false,
      onAttempt: () => callback,
    });
    host.start();
    host.setAnswer(answer("right"));
    const pending = host.submit();
    await Promise.resolve();
    host.stop();
    release();

    expect(await pending).toEqual({ status: "ignored", reason: "not-answering" });
    expect(host.state.phase).toBe("evaluating");
    expect(host.hasPendingAttempt).toBe(false);
  });

  it("does not crash when a malformed question is passed at runtime", () => {
    const host = createQuestionHost(null as unknown as Question, { autoStart: false });
    expect(host.state).toMatchObject({ phase: "error", error: { code: "invalid-question" } });
  });
});
