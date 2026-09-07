import Dexie, { type Table } from "dexie";
import type {
  GameEvent,
  GameState,
  HeartState,
  LessonState,
  LessonSessionRecord,
  QuestionState,
  LearningSettings,
  SchedulerProfile,
  StudyEvent,
} from "$lib/learning/domain/states";

export interface SyncMeta {
  id: "local";
  lastSyncedAt: number | null;
  clientSeq: number;
  /** Stable identifiers used by local StudyEvents and retained across resets. */
  userId?: string;
  deviceId?: string;
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
  gameState!: Table<GameState, string>;
  heartState!: Table<HeartState, string>;
  schedulerProfiles!: Table<SchedulerProfile, string>;
  settings!: Table<LearningSettings, string>;
  lessonSessions!: Table<LessonSessionRecord, string>;
  outbox!: Table<OutboxItem, string>;
  syncMeta!: Table<SyncMeta, string>;

  constructor(name = "cs-duolingo") {
    super(name);
    this.version(1).stores({
      studyEvents: "id, eventType, lessonId, questionId, effectiveAt",
      questionStates: "questionId, lessonId, status, nextReviewAt",
      lessonStates: "lessonId, status, lastStudiedAt",
      gameEvents: "id, type, createdAt",
      outbox: "id, eventId, status, createdAt",
      syncMeta: "id",
    });
    this.version(2).stores({
      studyEvents:
        "id, eventType, lessonId, questionId, effectiveAt, clientSeq",
      questionStates:
        "questionId, lessonId, status, nextReviewAt, contentRevision",
      lessonStates: "lessonId, status, lastStudiedAt, contentRevision",
      schedulerProfiles: "id, algorithmVersion, updatedAt",
      gameEvents: "id, type, createdAt, eventId, localDate",
      gameState: "id",
      settings: "id",
      lessonSessions: "lessonId, contentRevision, updatedAt",
      outbox: "id, eventId, status, createdAt",
      syncMeta: "id",
    });
    this.version(3).stores({
      heartState: "id",
    });
  }
}

export const db = new LearningDatabase();
