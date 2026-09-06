/**
 * The event log is the source of truth for all learning progress.  Keep this
 * type deliberately serialisable: a backup is just a JSON representation of
 * these records and can be replayed on a device without any UI code.
 */
export type StudyEventType =
  "review-attempt" | "lesson-completed" | "content-revision";

export interface StudyEvent {
  id: string;
  schemaVersion: number;
  eventType: StudyEventType;
  userId: string;
  deviceId: string;
  clientSeq: number;
  questionId?: string;
  lessonId: string;
  contentRevision: number;
  effectiveAt: number;
  result?: "correct" | "incorrect";
  rating?: "again" | "hard" | "good" | "easy";
  durationMs?: number;
  hintsUsed?: number;
  schedulerProfileId?: string;
  baseStateVersion?: number;
  /** `lesson` and `review` let the replay layer identify retry attempts. */
  mode?: "lesson" | "review";
  attemptNumber?: 1 | 2;
  final?: boolean;
}

export interface QuestionState {
  userId?: string;
  questionId: string;
  lessonId: string;
  contentRevision: number;
  status: "new" | "learning" | "review" | "relearning" | "suspended";
  lastReviewAt: number | null;
  nextReviewAt: number | null;
  correctCount: number;
  incorrectCount: number;
  reps: number;
  lapses: number;
  schedulerProfileId: string;
  schedulerState: unknown;
  stateVersion: number;
  updatedAt: number;
}

export interface LessonState {
  userId?: string;
  lessonId: string;
  contentRevision: number;
  status: "not-started" | "in-progress" | "completed";
  startedAt: number | null;
  completedAt: number | null;
  lastStudiedAt: number | null;
  attemptedQuestions: number;
  completedQuestions: number;
  correctCount: number;
  incorrectCount: number;
  updatedAt: number;
}

export interface GameEvent {
  id: string;
  type: "xp-earned" | "streak-updated";
  amount?: number;
  createdAt: number;
  /** The study event which caused this game event, when known. */
  eventId?: string;
  /** Local calendar day used for streak and daily XP calculations. */
  localDate?: string;
  /** Snapshot fields make game events replayable on their own. */
  streak?: number;
  longestStreak?: number;
  todayXp?: number;
}

export interface SchedulerProfile {
  id: string;
  algorithm: "ts-fsrs";
  algorithmVersion: string;
  requestRetention: number;
  maximumInterval: number;
  enableFuzz: boolean;
  enableShortTerm: boolean;
  learningSteps: string[];
  relearningSteps: string[];
  parameters: number[];
  createdAt: number;
  updatedAt: number;
}

export interface GameState {
  id: "local";
  xp: number;
  streak: number;
  longestStreak: number;
  lastStudyDate: string | null;
  todayXp: number;
  todayDate: string | null;
  updatedAt: number;
}

export interface LearningSettings {
  id: "local";
  dailyGoal: number;
  reviewLimit: number;
  updatedAt: number;
}

export interface LessonSessionRecord {
  lessonId: string;
  contentRevision: number;
  session: import("$lib/lesson/lesson-engine").LessonSession;
  updatedAt: number;
}
