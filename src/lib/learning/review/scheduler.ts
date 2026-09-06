export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface Scheduler<TState> {
  createInitialState(now: Date): TState;
  apply(
    state: TState,
    rating: ReviewRating,
    now: Date,
  ): { state: TState; nextReviewAt: number };
  retrievability(state: TState, now: Date): number | null;
}
