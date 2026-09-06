export interface StudyEvent {
  id: string;
  schemaVersion: number;
  eventType: "review-attempt" | "lesson-completed";
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
}

export interface QuestionState {
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
}
