import Dexie, { type Table } from "dexie";
import type {
  GameEvent,
  LessonState,
  QuestionState,
  StudyEvent,
} from "$lib/learning/domain/states";

export interface SyncMeta {
  id: "local";
  lastSyncedAt: number | null;
  clientSeq: number;
}

export interface OutboxItem {
  id: string;
  eventId: string;
  createdAt: number;
  status: "pending" | "sent" | "failed";
}

export class LearningDatabase extends Dexie {
  studyEvents!: Table<StudyEvent, string>;
  questionStates!: Table<QuestionState, string>;
  lessonStates!: Table<LessonState, string>;
  gameEvents!: Table<GameEvent, string>;
  outbox!: Table<OutboxItem, string>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super("cs-duolingo");
    this.version(1).stores({
      studyEvents: "id, eventType, lessonId, questionId, effectiveAt",
      questionStates: "questionId, lessonId, status, nextReviewAt",
      lessonStates: "lessonId, status, lastStudiedAt",
      gameEvents: "id, type, createdAt",
      outbox: "id, eventId, status, createdAt",
      syncMeta: "id",
    });
  }
}

export const db = new LearningDatabase();
