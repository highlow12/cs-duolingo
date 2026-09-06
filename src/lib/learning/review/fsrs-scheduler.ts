import {
  FSRSVersion,
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type Grade,
} from "ts-fsrs";
import type { SchedulerProfile } from "$lib/learning/domain/states";
import type { ReviewRating, Scheduler } from "./scheduler";

/** A JSON-safe representation of the card used by ts-fsrs. */
export interface PersistedSchedulerState {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;
  last_review: number | null;
}

export const DEFAULT_SCHEDULER_PROFILE_ID = "default";
export const DEFAULT_REQUEST_RETENTION = 0.9;
export const DEFAULT_MAXIMUM_INTERVAL = 36500;

const stateValues = new Set([
  State.New,
  State.Learning,
  State.Review,
  State.Relearning,
]);

function finite(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid scheduler state: ${name}`);
  }
  return value;
}

function serialiseCard(card: Card, lapses = 0): PersistedSchedulerState {
  return {
    due: finite(card.due.getTime(), "due"),
    stability: finite(card.stability, "stability"),
    difficulty: finite(card.difficulty, "difficulty"),
    elapsed_days: finite(card.elapsed_days, "elapsed_days"),
    scheduled_days: finite(card.scheduled_days, "scheduled_days"),
    learning_steps: finite(card.learning_steps, "learning_steps"),
    reps: finite(card.reps, "reps"),
    lapses: finite(lapses, "lapses"),
    state: card.state as 0 | 1 | 2 | 3,
    last_review: card.last_review
      ? finite(card.last_review.getTime(), "last_review")
      : null,
  };
}

function cardFromState(state: PersistedSchedulerState): Card {
  if (!state || typeof state !== "object") {
    throw new Error("Invalid scheduler state");
  }
  if (!stateValues.has(state.state)) {
    throw new Error("Invalid scheduler state: state");
  }
  const due = finite(state.due, "due");
  const lastReview =
    state.last_review === null
      ? undefined
      : new Date(finite(state.last_review, "last_review"));
  if (
    !Number.isFinite(due) ||
    (lastReview && !Number.isFinite(lastReview.getTime()))
  ) {
    throw new Error("Invalid scheduler state date");
  }
  return {
    due: new Date(due),
    stability: finite(state.stability, "stability"),
    difficulty: finite(state.difficulty, "difficulty"),
    elapsed_days: finite(state.elapsed_days, "elapsed_days"),
    scheduled_days: finite(state.scheduled_days, "scheduled_days"),
    learning_steps: finite(state.learning_steps, "learning_steps"),
    reps: finite(state.reps, "reps"),
    lapses: finite(state.lapses, "lapses"),
    state: state.state as State,
    last_review: lastReview,
  };
}

function ratingValue(rating: ReviewRating): Grade {
  switch (rating) {
    case "again":
      return Rating.Again as Grade;
    case "hard":
      return Rating.Hard as Grade;
    case "good":
      return Rating.Good as Grade;
    case "easy":
      return Rating.Easy as Grade;
    default:
      throw new Error("Invalid review rating");
  }
}

function profileParameters(profile: SchedulerProfile) {
  return {
    request_retention: profile.requestRetention,
    maximum_interval: profile.maximumInterval,
    w: profile.parameters,
    enable_fuzz: profile.enableFuzz,
    enable_short_term: profile.enableShortTerm,
    learning_steps: profile.learningSteps as `${number}${"m" | "h" | "d"}`[],
    relearning_steps:
      profile.relearningSteps as `${number}${"m" | "h" | "d"}`[],
  };
}

/** Build the persisted profile used by a fresh local database. */
export function createDefaultSchedulerProfile(
  now = Date.now(),
): SchedulerProfile {
  const params = generatorParameters({
    request_retention: DEFAULT_REQUEST_RETENTION,
    maximum_interval: DEFAULT_MAXIMUM_INTERVAL,
    enable_fuzz: false,
  });
  return {
    id: DEFAULT_SCHEDULER_PROFILE_ID,
    algorithm: "ts-fsrs",
    algorithmVersion: FSRSVersion,
    requestRetention: params.request_retention,
    maximumInterval: params.maximum_interval,
    enableFuzz: params.enable_fuzz,
    enableShortTerm: params.enable_short_term,
    learningSteps: [...params.learning_steps],
    relearningSteps: [...params.relearning_steps],
    parameters: [...params.w],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Adapter around ts-fsrs.  Nothing outside this module needs to know about
 * ts-fsrs' enums, Date fields, or card shape.
 */
export class FsrsScheduler implements Scheduler<PersistedSchedulerState> {
  readonly profile: SchedulerProfile;
  private readonly engine;

  constructor(profile?: SchedulerProfile) {
    this.profile = profile ?? createDefaultSchedulerProfile();
    this.engine = fsrs(profileParameters(this.profile));
  }

  createInitialState(now: Date): PersistedSchedulerState {
    return serialiseCard(createEmptyCard(now));
  }

  apply(
    state: PersistedSchedulerState,
    rating: ReviewRating,
    now: Date,
  ): { state: PersistedSchedulerState; nextReviewAt: number } {
    const card = cardFromState(state);
    const next = this.engine.next(card, now, ratingValue(rating));
    const lapses =
      state.lapses +
      (rating === "again" && card.state === State.Review ? 1 : 0);
    const nextState = serialiseCard(next.card, lapses);
    return { state: nextState, nextReviewAt: nextState.due };
  }

  retrievability(state: PersistedSchedulerState, now: Date): number | null {
    if (state.state === State.New || state.last_review === null) return null;
    const value = this.engine.get_retrievability(
      cardFromState(state),
      now,
      false,
    );
    return Number.isFinite(value) ? value : null;
  }

  /** Convert a persisted card state to the public progress status. */
  status(
    state: PersistedSchedulerState,
  ): "new" | "learning" | "review" | "relearning" {
    switch (state.state) {
      case State.New:
        return "new";
      case State.Learning:
        return "learning";
      case State.Review:
        return "review";
      case State.Relearning:
        return "relearning";
      default:
        throw new Error("Invalid scheduler state: state");
    }
  }

  /** Validate and copy an untrusted backup card. */
  validateState(value: unknown): PersistedSchedulerState {
    const candidate = value as Partial<PersistedSchedulerState>;
    if (!candidate || typeof candidate !== "object") {
      throw new Error("Invalid scheduler state");
    }
    const state = {
      due: candidate.due,
      stability: candidate.stability,
      difficulty: candidate.difficulty,
      elapsed_days: candidate.elapsed_days,
      scheduled_days: candidate.scheduled_days,
      learning_steps: candidate.learning_steps,
      reps: candidate.reps,
      lapses: candidate.lapses,
      state: candidate.state,
      last_review: candidate.last_review,
    } as PersistedSchedulerState;
    // cardFromState performs all finite/date/state checks.
    cardFromState(state);
    finite(state.lapses, "lapses");
    return { ...state };
  }
}

export const fsrsScheduler = new FsrsScheduler();

export function statusFromSchedulerState(
  state: PersistedSchedulerState,
): "new" | "learning" | "review" | "relearning" {
  return fsrsScheduler.status(state);
}
