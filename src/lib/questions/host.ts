import {
  evaluateQuestion,
  getQuestionPlugin,
} from "./registry";
import type {
  CanonicalAnswer,
  EvaluationError,
  EvaluationOutcome,
  EvaluationResult,
  Question,
  QuestionType,
  UserAnswer,
} from "./types";

export type QuestionPhase =
  | "answering"
  | "evaluating"
  | "retry-feedback"
  | "final-feedback"
  | "error";

export interface QuestionAttempt {
  attemptId: string;
  questionId: string;
  questionRevision: number;
  attemptNumber: 1 | 2;
  result: EvaluationResult;
  durationMs: number;
  final: boolean;
}

export interface QuestionHostError extends EvaluationError {
  source?: "validation" | "evaluation" | "persistence" | "runtime";
}

export interface QuestionHostState {
  questionId: string;
  questionRevision: number;
  phase: QuestionPhase;
  attemptNumber: 1 | 2;
  attemptKey: number;
  currentAnswer: UserAnswer | null;
  attempts: EvaluationResult[];
  error: QuestionHostError | null;
  canonicalAnswer: CanonicalAnswer | null;
  submittedAnswer: UserAnswer | null;
}

export interface QuestionHostClock {
  now: () => number;
  isVisible?: () => boolean;
  subscribeVisibility?: (listener: (visible: boolean) => void) => () => void;
}

export interface QuestionHostOptions {
  onAttempt?: (attempt: QuestionAttempt) => void | Promise<void>;
  clock?: QuestionHostClock | (() => number);
  random?: () => number;
  createAttemptId?: () => string;
  /** SSR can construct a host and start the active timer after client mount. */
  autoStart?: boolean;
}

export type HostSubmitOutcome =
  | { status: "ignored"; reason: "not-answering" | "incomplete" }
  | { status: "error"; error: QuestionHostError }
  | { status: "evaluated"; attempt: QuestionAttempt };

type StateListener = (state: QuestionHostState) => void;

const QUESTION_TYPES = new Set<QuestionType>([
  "single-choice",
  "multi-select",
  "fill-blank",
  "ordering",
  "matching",
  "code-output",
  "code-completion",
  "graph-path",
  "interactive-simulation",
]);

function defaultNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function")
    return performance.now();
  return Date.now();
}

function clone<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // The answer union is JSON-shaped; use its small fallback below.
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function uuidV4(random: () => number = Math.random): string {
  const bytes = Array.from({ length: 16 }, () => {
    const value = random();
    const normalized = Number.isFinite(value)
      ? Math.max(0, Math.min(0.9999999999999999, value))
      : 0;
    return Math.floor(normalized * 256);
  });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

function getClock(clock: QuestionHostOptions["clock"]): QuestionHostClock {
  if (typeof clock === "function") return { now: clock };
  return clock ?? { now: defaultNow };
}

function isQuestionShape(value: unknown): value is Question {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function questionIdentity(value: unknown): { id: unknown; revision: unknown } {
  if (typeof value !== "object" || value === null)
    return { id: undefined, revision: undefined };
  const candidate = value as { id?: unknown; revision?: unknown };
  return { id: candidate.id, revision: candidate.revision };
}

function hostError(
  code: EvaluationError["code"],
  message: string,
  details?: string[],
  source: QuestionHostError["source"] = "runtime",
): QuestionHostError {
  return { code, message, details, source };
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "저장에 실패했습니다.";
}

export class QuestionHost {
  readonly random: () => number;

  private question: Question;
  private options: QuestionHostOptions;
  private clock: QuestionHostClock;
  private createAttemptId: () => string;
  private listeners = new Set<StateListener>();
  private unsubscribeVisibility: (() => void) | null = null;
  private lifecycle = 0;
  private timerStarted = false;
  private timerVisible = true;
  private lastTick = 0;
  private elapsed = 0;
  private pendingAttempt: QuestionAttempt | null = null;
  private pendingToken: number | null = null;
  private disposed = false;
  private stateValue: QuestionHostState;

  constructor(question: Question, options: QuestionHostOptions = {}) {
    this.question = question;
    this.options = options;
    this.clock = getClock(options.clock);
    this.random = options.random ?? Math.random;
    this.createAttemptId = options.createAttemptId ?? (() => uuidV4(this.random));
    this.stateValue = this.initialState(question);
    this.validateQuestion();
    if (options.autoStart !== false && this.stateValue.phase === "answering") this.start();
  }

  get state(): QuestionHostState {
    return clone(this.stateValue);
  }

  get questionValue(): Question {
    return this.question;
  }

  get hasPendingAttempt(): boolean {
    return this.pendingAttempt !== null;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = this.state;
    for (const listener of this.listeners) listener(snapshot);
  }

  private initialState(question: unknown): QuestionHostState {
    const candidate =
      typeof question === "object" && question !== null
        ? (question as Partial<Question>)
        : {};
    return {
      questionId: typeof candidate.id === "string" ? candidate.id : "",
      questionRevision:
        typeof candidate.revision === "number" ? candidate.revision : 0,
      phase: "answering",
      attemptNumber: 1,
      attemptKey: 0,
      currentAnswer: null,
      attempts: [],
      error: null,
      canonicalAnswer: null,
      submittedAnswer: null,
    };
  }

  private validateQuestion(): boolean {
    if (!isQuestionShape(this.question) || !QUESTION_TYPES.has(this.question.type)) {
      this.stateValue.phase = "error";
      this.stateValue.error = hostError(
        !isQuestionShape(this.question) || typeof this.question.type !== "string"
          ? "invalid-question"
          : "unregistered-question-type",
        "문제를 표시할 수 없습니다.",
        undefined,
        "validation",
      );
      return false;
    }
    const plugin = getQuestionPlugin(this.question.type);
    if (!plugin) {
      this.stateValue.phase = "error";
      this.stateValue.error = hostError(
        "unregistered-question-type",
        "문제를 표시할 수 없습니다.",
        undefined,
        "validation",
      );
      return false;
    }
    const result = plugin.definition.validateQuestion(this.question);
    if (!result.valid) {
      this.stateValue.phase = "error";
      this.stateValue.error = hostError(
        "invalid-question",
        "문제를 표시할 수 없습니다.",
        result.errors,
        "validation",
      );
      return false;
    }
    return true;
  }

  start(): void {
    if (this.disposed || this.stateValue.phase !== "answering" || this.timerStarted)
      return;
    this.timerStarted = true;
    this.elapsed = 0;
    this.lastTick = this.readNow();
    this.timerVisible = this.readVisible();
    this.bindVisibility();
  }

  stop(): void {
    if (this.disposed) return;
    // stop() is the lifecycle cleanup boundary used by the Svelte host.  A
    // pending callback may still settle, but its lifecycle token is stale and
    // therefore cannot update state or deliver a result to a replaced host.
    this.lifecycle += 1;
    this.pendingAttempt = null;
    this.pendingToken = null;
    this.stopTimer();
    this.disposed = true;
  }

  dispose(): void {
    this.stop();
  }

  private stopTimer(): void {
    this.updateTimer();
    this.timerStarted = false;
    this.unsubscribeVisibility?.();
    this.unsubscribeVisibility = null;
  }

  private bindVisibility(): void {
    this.unsubscribeVisibility?.();
    this.unsubscribeVisibility =
      this.clock.subscribeVisibility?.((visible) => this.setVisibility(visible)) ?? null;
  }

  private readNow(): number {
    const value = this.clock.now();
    return Number.isFinite(value) ? value : this.lastTick;
  }

  private readVisible(): boolean {
    return this.clock.isVisible ? this.clock.isVisible() : true;
  }

  setVisibility(visible: boolean): void {
    if (!this.timerStarted) return;
    const now = this.readNow();
    if (this.timerVisible === visible) {
      if (visible) this.addElapsed(now - this.lastTick);
      this.lastTick = now;
      return;
    }
    if (this.timerVisible) this.addElapsed(now - this.lastTick);
    this.lastTick = now;
    this.timerVisible = visible;
  }

  private updateTimer(): void {
    if (!this.timerStarted) return;
    const now = this.readNow();
    const visible = this.readVisible();
    if (this.timerVisible === visible) {
      if (visible) this.addElapsed(now - this.lastTick);
    } else if (this.timerVisible) {
      this.addElapsed(now - this.lastTick);
    }
    this.lastTick = now;
    this.timerVisible = visible;
  }

  private addElapsed(delta: number): void {
    if (delta <= 0 || Number.isNaN(delta)) return;
    const safeDelta = Number.isFinite(delta) ? delta : Number.MAX_SAFE_INTEGER;
    this.elapsed = Math.min(Number.MAX_SAFE_INTEGER, this.elapsed + safeDelta);
  }

  durationMs(): number {
    this.updateTimer();
    if (!Number.isFinite(this.elapsed) || this.elapsed < 0) return 0;
    return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(this.elapsed)));
  }

  setAnswer(answer: UserAnswer | null): void {
    if (this.disposed || this.stateValue.phase !== "answering") return;
    this.stateValue.currentAnswer = answer === null ? null : clone(answer);
    this.stateValue.error = null;
    this.notify();
  }

  private setError(error: QuestionHostError): void {
    this.stopTimer();
    this.stateValue.phase = "error";
    this.stateValue.error = error;
    this.notify();
  }

  private canonicalForFinal(): CanonicalAnswer | null {
    const plugin = getQuestionPlugin(this.question.type);
    if (!plugin) return null;
    try {
      return clone(plugin.definition.canonicalAnswer(this.question as never));
    } catch (caught) {
      this.setError(
        hostError(
          "invalid-question",
          "문제를 표시할 수 없습니다.",
          [errorMessage(caught)],
          "runtime",
        ),
      );
      return null;
    }
  }

  async submit(): Promise<HostSubmitOutcome> {
    if (this.disposed || this.stateValue.phase !== "answering")
      return { status: "ignored", reason: "not-answering" };
    if (this.stateValue.currentAnswer === null)
      return { status: "ignored", reason: "incomplete" };

    // Snapshot and stop the active timer before invoking the evaluator.  The
    // evaluator and persistence callback are outside the user's solve time.
    this.updateTimer();
    const durationMs = this.durationMs();
    this.stopTimer();
    this.stateValue.phase = "evaluating";
    this.stateValue.error = null;
    const answer = clone(this.stateValue.currentAnswer);
    const token = this.lifecycle;
    this.notify();

    let outcome: EvaluationOutcome;
    try {
      outcome = evaluateQuestion(this.question, answer);
    } catch (caught) {
      const error = hostError(
        "invalid-question",
        "문제를 평가할 수 없습니다.",
        [errorMessage(caught)],
        "evaluation",
      );
      if (token === this.lifecycle) this.setError(error);
      return { status: "error", error };
    }
    if (outcome.status === "error") {
      const evaluationError: QuestionHostError = {
        ...outcome.error,
        source: "evaluation",
      };
      if (token === this.lifecycle) this.setError(evaluationError);
      return { status: "error", error: evaluationError };
    }
    if (token !== this.lifecycle) return { status: "ignored", reason: "not-answering" };

    const result = outcome.result;
    const final = result.correct || this.stateValue.attemptNumber === 2;
    let attemptId: string;
    try {
      attemptId = this.createAttemptId();
    } catch (caught) {
      const error = hostError(
        "invalid-question",
        "제출 ID를 만들 수 없습니다.",
        [errorMessage(caught)],
        "runtime",
      );
      if (token === this.lifecycle) this.setError(error);
      return { status: "error", error };
    }
    const attempt: QuestionAttempt = {
      attemptId,
      questionId: this.stateValue.questionId,
      questionRevision: this.stateValue.questionRevision,
      attemptNumber: this.stateValue.attemptNumber,
      result: clone(result),
      durationMs,
      final,
    };
    if (final) {
      const canonical = this.canonicalForFinal();
      if (!canonical || this.stateValue.error) {
        const error =
          this.stateValue.error ??
          hostError("invalid-question", "문제를 표시할 수 없습니다.", undefined, "runtime");
        if (!this.stateValue.error) this.setError(error);
        return { status: "error", error };
      }
      this.stateValue.canonicalAnswer = canonical;
    }
    this.stateValue.attempts = [...this.stateValue.attempts, clone(result)];
    this.stateValue.submittedAnswer = answer;
    this.pendingAttempt = attempt;
    this.pendingToken = token;
    this.notify();
    return this.dispatchPending(token);
  }

  private async dispatchPending(token: number): Promise<HostSubmitOutcome> {
    const attempt = this.pendingAttempt;
    if (!attempt || token !== this.lifecycle)
      return { status: "ignored", reason: "not-answering" };
    try {
      await this.options.onAttempt?.(clone(attempt));
    } catch (caught) {
      if (token !== this.lifecycle)
        return { status: "ignored", reason: "not-answering" };
      const error = hostError(
        "invalid-answer",
        "답안을 저장하지 못했습니다. 다시 시도해 주세요.",
        [errorMessage(caught)],
        "persistence",
      );
      this.setError(error);
      return { status: "error", error };
    }
    if (token !== this.lifecycle)
      return { status: "ignored", reason: "not-answering" };
    this.pendingAttempt = null;
    this.pendingToken = null;
    this.stopTimer();
    this.stateValue.phase = attempt.final ? "final-feedback" : "retry-feedback";
    this.stateValue.error = null;
    this.notify();
    return { status: "evaluated", attempt: clone(attempt) };
  }

  /** Retry persistence of the same evaluated attempt; no new evaluation/ID. */
  async retryPending(): Promise<HostSubmitOutcome> {
    if (this.stateValue.phase !== "error" || !this.pendingAttempt || this.pendingToken === null)
      return { status: "ignored", reason: "not-answering" };
    this.stateValue.phase = "evaluating";
    this.stateValue.error = null;
    this.notify();
    return this.dispatchPending(this.pendingToken);
  }

  retrySave(): Promise<HostSubmitOutcome> {
    return this.retryPending();
  }

  retryCallback(): Promise<HostSubmitOutcome> {
    return this.retryPending();
  }

  /** Start the required second attempt after the first answer was wrong. */
  retry(): void {
    if (this.disposed || this.stateValue.phase !== "retry-feedback") return;
    this.stateValue.attemptNumber = 2;
    this.stateValue.attemptKey += 1;
    this.stateValue.phase = "answering";
    this.stateValue.currentAnswer = null;
    this.stateValue.submittedAnswer = null;
    this.stateValue.canonicalAnswer = null;
    this.stateValue.error = null;
    this.start();
    this.notify();
  }

  /** Recover from an evaluator/validation error without consuming an attempt. */
  recover(): void {
    if (this.pendingAttempt) return;
    if (
      this.disposed ||
      this.stateValue.phase !== "error" ||
      this.stateValue.error?.source !== "evaluation"
    )
      return;
    this.stateValue.phase = "answering";
    this.stateValue.attemptKey += 1;
    this.stateValue.currentAnswer = null;
    this.stateValue.submittedAnswer = null;
    this.stateValue.canonicalAnswer = null;
    this.stateValue.error = null;
    // Keep active time already spent on this attempt while excluding the
    // transient evaluator error card from the measurement.
    this.resumeTimer();
    this.notify();
  }

  private resumeTimer(): void {
    if (this.disposed || this.stateValue.phase !== "answering" || this.timerStarted)
      return;
    this.timerStarted = true;
    this.lastTick = this.readNow();
    this.timerVisible = this.readVisible();
    this.bindVisibility();
  }

  setQuestion(question: Question): void {
    if (this.disposed) return;
    const currentIdentity = questionIdentity(this.question);
    const nextIdentity = questionIdentity(question);
    const changed =
      currentIdentity.id !== nextIdentity.id ||
      currentIdentity.revision !== nextIdentity.revision;
    if (!changed) return;
    this.lifecycle += 1;
    this.stopTimer();
    this.pendingAttempt = null;
    this.pendingToken = null;
    this.question = question;
    this.stateValue = this.initialState(question);
    this.validateQuestion();
    if (this.options.autoStart !== false && this.stateValue.phase === "answering") this.start();
    this.notify();
  }

  reset(question: Question = this.question): void {
    if (this.disposed) return;
    this.lifecycle += 1;
    this.stopTimer();
    this.pendingAttempt = null;
    this.pendingToken = null;
    this.question = question;
    this.stateValue = this.initialState(question);
    this.validateQuestion();
    if (this.options.autoStart !== false && this.stateValue.phase === "answering") this.start();
    this.notify();
  }
}

export function createQuestionHost(
  question: Question,
  options: QuestionHostOptions = {},
): QuestionHost {
  return new QuestionHost(question, options);
}

export { uuidV4 as createAttemptId };
