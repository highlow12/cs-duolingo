import type { Lesson } from "$lib/content/types";
import {
  createLessonSession,
  type LessonSession,
} from "$lib/lesson/lesson-engine";
import type { Question } from "$lib/questions/types";
import {
  DEFAULT_DAILY_GOAL,
  DEFAULT_REVIEW_LIMIT,
  XP_PER_CORRECT_ANSWER,
  calendarDayDistance,
  localDateFor,
} from "$lib/learning/gamification/config";
import type {
  GameEvent,
  GameState,
  HeartState,
  LearningSettings,
  LessonSessionRecord,
  LessonState,
  QuestionState,
  SchedulerProfile,
  StudyEvent,
} from "$lib/learning/domain/states";
import {
  DEFAULT_SCHEDULER_PROFILE_ID,
  FsrsScheduler,
  createDefaultSchedulerProfile,
  type PersistedSchedulerState,
} from "$lib/learning/review/fsrs-scheduler";
import {
  db as defaultDatabase,
  type LearningDatabase,
  type OutboxItem,
} from "$lib/storage/db";

const BACKUP_SCHEMA_VERSION = 1;
const EVENT_SCHEMA_VERSION = 1;
const LOCAL_ID = "local" as const;
const DEFAULT_USER_ID = "local-user";
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const MIN_DAILY_GOAL = 1;
const MAX_DAILY_GOAL = 100;
const MIN_REVIEW_LIMIT = 1;
const MAX_REVIEW_LIMIT = 50;
export const MAX_HEARTS = 3;
export const HEART_REGENERATION_INTERVAL_MS = 8 * 60 * 60 * 1000;
export const HEARTS_CHANGED_EVENT = "cs-duolingo:hearts-changed";
export const NO_HEARTS_MESSAGE =
  "하트를 모두 사용했어요. 다음 하트가 생길 때까지 기다려 주세요.";

export class NoHeartsError extends Error {
  readonly code = "NO_HEARTS" as const;
  readonly nextRecoveryAt: number | null;

  constructor(nextRecoveryAt: number | null) {
    super(NO_HEARTS_MESSAGE);
    this.name = "NoHeartsError";
    this.nextRecoveryAt = nextRecoveryAt;
  }
}

export interface SaveAttemptInput {
  id: string;
  question: Question;
  correct: boolean;
  durationMs: number;
  mode: "lesson" | "review";
  /** Optional fields are accepted when a Question Host has them available. */
  attemptNumber?: 1 | 2;
  final?: boolean;
}

export interface LearningSnapshot {
  lessonStates: LessonState[];
  questionStates: QuestionState[];
  game: {
    xp: number;
    streak: number;
    longestStreak: number;
    todayXp: number;
  };
  settings: {
    dailyGoal: number;
    reviewLimit: number;
  };
  hearts: HeartStatus;
}

export interface HeartStatus {
  count: number;
  max: number;
  nextRecoveryAt: number | null;
  isFull: boolean;
}

export interface LearningBackup {
  schemaVersion: 1;
  exportedAt: number;
  userId: string;
  deviceId: string;
  studyEvents: StudyEvent[];
  schedulerProfiles: SchedulerProfile[];
  gameEvents: GameEvent[];
  settings: LearningSettings;
  /** Persisted allowance state used to keep recovery and reset deterministic. */
  heartState?: HeartState;
  /** Sessions are a convenience backup; all progress is replayed from events. */
  lessonSessions?: LessonSessionRecord[];
}

export interface LearningRepositoryOptions {
  database?: LearningDatabase;
  clock?: () => number;
  userId?: string;
  deviceId?: string;
  schedulerFactory?: (profile: SchedulerProfile) => FsrsScheduler;
}

type SessionWithRevision = LessonSession & { contentRevision?: number };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function id(prefix: string): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (randomUuid) return `${prefix}:${randomUuid.call(globalThis.crypto)}`;
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function finiteNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, name: string): number {
  const number = finiteNumber(value, name);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return number;
}

function boundedPositiveInteger(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const number = nonNegativeInteger(value, name);
  if (number < minimum || number > maximum) {
    throw new Error(`${name} is out of range`);
  }
  return number;
}

function timestamp(clock: () => number): number {
  const value = finiteNumber(clock(), "clock");
  if (value < 0 || value > MAX_SAFE)
    throw new Error("clock is outside safe range");
  return Math.round(value);
}

function assertId(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function assertLesson(lesson: Lesson): void {
  assertId(lesson?.id, "lesson.id");
  nonNegativeInteger(lesson?.revision, "lesson.revision");
  if (!Array.isArray(lesson?.flow))
    throw new Error("lesson.flow must be an array");
}

function assertQuestion(question: Question): void {
  assertId(question?.id, "question.id");
  assertId(question?.lessonId, "question.lessonId");
  nonNegativeInteger(question?.revision, "question.revision");
  assertId(question?.type, "question.type");
}

function assertSession(session: LessonSession): void {
  assertId(session?.lessonId, "session.lessonId");
  nonNegativeInteger(session?.currentIndex, "session.currentIndex");
  if (session.status !== "active" && session.status !== "completed") {
    throw new Error("session.status is invalid");
  }
  if (!Array.isArray(session.answers))
    throw new Error("session.answers must be an array");
  for (const answer of session.answers) {
    assertId(answer?.questionId, "session answer questionId");
    if (typeof answer.correct !== "boolean")
      throw new Error("session answer correctness is invalid");
    finiteNumber(answer.answeredAt, "session answer answeredAt");
  }
}

function defaultGame(now: number): GameState {
  return {
    id: LOCAL_ID,
    xp: 0,
    streak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    todayXp: 0,
    todayDate: null,
    updatedAt: now,
  };
}

function defaultSettings(now: number): LearningSettings {
  return {
    id: LOCAL_ID,
    dailyGoal: DEFAULT_DAILY_GOAL,
    reviewLimit: DEFAULT_REVIEW_LIMIT,
    updatedAt: now,
  };
}

function defaultHeartState(now: number): HeartState {
  return {
    id: LOCAL_ID,
    count: MAX_HEARTS,
    lastCalculatedAt: now,
    localDate: localDateFor(now),
    updatedAt: now,
  };
}

function heartStatus(state: HeartState): HeartStatus {
  return {
    count: state.count,
    max: MAX_HEARTS,
    nextRecoveryAt:
      state.count >= MAX_HEARTS
        ? null
        : state.lastCalculatedAt + HEART_REGENERATION_INTERVAL_MS,
    isFull: state.count >= MAX_HEARTS,
  };
}

function sameHeartState(left: HeartState, right: HeartState): boolean {
  return (
    left.id === right.id &&
    left.count === right.count &&
    left.lastCalculatedAt === right.lastCalculatedAt &&
    left.localDate === right.localDate &&
    left.updatedAt === right.updatedAt
  );
}

/**
 * Reconcile a persisted heart state against the current clock.  A later local
 * calendar date grants the daily reset before interval recovery is considered;
 * a backwards-moving clock leaves all allowance fields untouched.
 */
function reconcileHeartState(
  current: HeartState | undefined,
  now: number,
): HeartState {
  if (!current) return defaultHeartState(now);

  const today = localDateFor(now);
  const dayDistance = calendarDayDistance(current.localDate, today);
  if (dayDistance > 0) {
    return {
      ...current,
      count: MAX_HEARTS,
      lastCalculatedAt: now,
      localDate: today,
      updatedAt: now,
    };
  }

  // A device clock moving backwards must not manufacture recovery credits.  Do
  // not even replace localDate here: when the clock returns to the previously
  // observed date, it is still the same logical day for the allowance.
  if (dayDistance < 0 || now <= current.lastCalculatedAt) return current;

  if (current.count >= MAX_HEARTS) {
    // Once full, discard any accumulated interval.  Otherwise spending a
    // heart after a long idle period would immediately refill it again.
    return {
      ...current,
      count: MAX_HEARTS,
      lastCalculatedAt: now,
      localDate: today,
      updatedAt: now,
    };
  }

  const recovered = Math.floor(
    (now - current.lastCalculatedAt) / HEART_REGENERATION_INTERVAL_MS,
  );
  if (recovered <= 0) return current;

  const count = Math.min(MAX_HEARTS, current.count + recovered);
  return {
    ...current,
    count,
    // Preserve the unused fraction of an interval.  When the cap is reached,
    // anchor the next timer at this observation so the next spent heart starts
    // a fresh eight-hour wait.
    lastCalculatedAt:
      count >= MAX_HEARTS
        ? now
        : current.lastCalculatedAt + recovered * HEART_REGENERATION_INTERVAL_MS,
    localDate: today,
    updatedAt: now,
  };
}

function consumeHeart(state: HeartState, now: number): HeartState {
  if (state.count <= 0)
    throw new NoHeartsError(heartStatus(state).nextRecoveryAt);
  return {
    ...state,
    count: state.count - 1,
    updatedAt: now,
  };
}

function defaultLessonState(
  lessonId: string,
  contentRevision: number,
  now: number,
  status: LessonState["status"] = "in-progress",
): LessonState {
  return {
    lessonId,
    contentRevision,
    status,
    startedAt: status === "not-started" ? null : now,
    completedAt: null,
    lastStudiedAt: now,
    attemptedQuestions: 0,
    completedQuestions: 0,
    correctCount: 0,
    incorrectCount: 0,
    updatedAt: now,
  };
}

function defaultQuestionState(
  question: Pick<Question, "id" | "lessonId" | "revision">,
  profile: SchedulerProfile,
  scheduler: FsrsScheduler,
  now: number,
  stateVersion = 0,
): QuestionState {
  return {
    questionId: question.id,
    lessonId: question.lessonId,
    contentRevision: question.revision,
    status: "new",
    lastReviewAt: null,
    nextReviewAt: null,
    correctCount: 0,
    incorrectCount: 0,
    reps: 0,
    lapses: 0,
    schedulerProfileId: profile.id,
    schedulerState: scheduler.createInitialState(new Date(now)),
    stateVersion,
    updatedAt: now,
  };
}

/**
 * A revised question has been seen before, so it belongs in the review queue
 * immediately after its scheduler is reset.  Keep the persisted FSRS card
 * genuinely new; the application status and due timestamp are the queue
 * marker for this one reconciliation visit.
 */
function revisedQuestionState(
  question: Pick<Question, "id" | "lessonId" | "revision">,
  profile: SchedulerProfile,
  scheduler: FsrsScheduler,
  now: number,
  stateVersion: number,
  userId?: string,
): QuestionState {
  return {
    ...defaultQuestionState(question, profile, scheduler, now, stateVersion),
    userId,
    status: "learning",
    nextReviewAt: now,
  };
}

function eventSort(a: StudyEvent, b: StudyEvent): number {
  return (
    a.effectiveAt - b.effectiveAt ||
    a.clientSeq - b.clientSeq ||
    a.id.localeCompare(b.id)
  );
}

function outboxFor(event: StudyEvent, now: number): OutboxItem {
  return {
    id: `outbox:${event.id}`,
    eventId: event.id,
    createdAt: now,
    status: "pending",
  };
}

function gameEventSort(a: GameEvent, b: GameEvent): number {
  return a.createdAt - b.createdAt || a.id.localeCompare(b.id);
}

function validateGameEvent(value: unknown, index: number): GameEvent {
  const gameEvent = value as Partial<GameEvent>;
  assertId(gameEvent?.id, `gameEvents[${index}].id`);
  if (gameEvent.type !== "xp-earned" && gameEvent.type !== "streak-updated") {
    throw new Error(`gameEvents[${index}].type is invalid`);
  }
  const createdAt = finiteNumber(
    gameEvent.createdAt,
    `gameEvents[${index}].createdAt`,
  );
  if (createdAt < 0 || createdAt > MAX_SAFE)
    throw new Error("game event date is invalid");
  if (gameEvent.amount !== undefined) {
    const amount = finiteNumber(
      gameEvent.amount,
      `gameEvents[${index}].amount`,
    );
    if (amount < 0) throw new Error("game event amount is invalid");
  }
  if (gameEvent.localDate !== undefined) {
    if (
      typeof gameEvent.localDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(gameEvent.localDate)
    ) {
      throw new Error("game event localDate is invalid");
    }
  }
  for (const key of ["streak", "longestStreak", "todayXp"] as const) {
    if (gameEvent[key] !== undefined)
      nonNegativeInteger(gameEvent[key], `game event ${key}`);
  }
  return clone(gameEvent as GameEvent);
}

function validateProfile(value: unknown, index: number): SchedulerProfile {
  const profile = value as Partial<SchedulerProfile>;
  assertId(profile?.id, `schedulerProfiles[${index}].id`);
  if (profile.algorithm !== "ts-fsrs")
    throw new Error("unsupported scheduler algorithm");
  assertId(
    profile.algorithmVersion,
    `schedulerProfiles[${index}].algorithmVersion`,
  );
  const retention = finiteNumber(profile.requestRetention, "requestRetention");
  if (retention <= 0 || retention > 1)
    throw new Error("requestRetention is invalid");
  nonNegativeInteger(profile.maximumInterval, "maximumInterval");
  if (
    typeof profile.enableFuzz !== "boolean" ||
    typeof profile.enableShortTerm !== "boolean"
  ) {
    throw new Error("scheduler profile flags are invalid");
  }
  if (
    !Array.isArray(profile.learningSteps) ||
    !Array.isArray(profile.relearningSteps)
  ) {
    throw new Error("scheduler profile steps are invalid");
  }
  for (const step of [...profile.learningSteps, ...profile.relearningSteps]) {
    if (typeof step !== "string" || !/^\d+(?:\.\d+)?[mhd]$/.test(step)) {
      throw new Error("scheduler profile step is invalid");
    }
  }
  if (
    !Array.isArray(profile.parameters) ||
    ![17, 19, 21].includes(profile.parameters.length)
  ) {
    throw new Error("scheduler profile parameters are invalid");
  }
  profile.parameters.forEach((parameter, parameterIndex) =>
    finiteNumber(
      parameter,
      `schedulerProfiles[${index}].parameters[${parameterIndex}]`,
    ),
  );
  const createdAt = finiteNumber(
    profile.createdAt,
    "scheduler profile createdAt",
  );
  const updatedAt = finiteNumber(
    profile.updatedAt,
    "scheduler profile updatedAt",
  );
  if (createdAt < 0 || updatedAt < 0)
    throw new Error("scheduler profile date is invalid");
  const checked = clone(profile as SchedulerProfile);
  // This also verifies that ts-fsrs accepts the imported parameters.
  new FsrsScheduler(checked);
  return checked;
}

function validateStudyEvent(value: unknown, index: number): StudyEvent {
  const event = value as Partial<StudyEvent>;
  assertId(event?.id, `studyEvents[${index}].id`);
  if (event.schemaVersion !== EVENT_SCHEMA_VERSION)
    throw new Error("unsupported event schemaVersion");
  if (
    !event.eventType ||
    !["review-attempt", "lesson-completed", "content-revision"].includes(
      event.eventType,
    )
  ) {
    throw new Error(`studyEvents[${index}].eventType is invalid`);
  }
  assertId(event.userId, `studyEvents[${index}].userId`);
  assertId(event.deviceId, `studyEvents[${index}].deviceId`);
  nonNegativeInteger(event.clientSeq, `studyEvents[${index}].clientSeq`);
  assertId(event.lessonId, `studyEvents[${index}].lessonId`);
  nonNegativeInteger(
    event.contentRevision,
    `studyEvents[${index}].contentRevision`,
  );
  const effectiveAt = finiteNumber(
    event.effectiveAt,
    `studyEvents[${index}].effectiveAt`,
  );
  if (effectiveAt < 0 || effectiveAt > MAX_SAFE)
    throw new Error("study event date is invalid");

  if (event.eventType === "review-attempt") {
    assertId(event.questionId, `studyEvents[${index}].questionId`);
    if (event.result !== "correct" && event.result !== "incorrect")
      throw new Error("review event result is invalid");
    if (
      !event.rating ||
      !["again", "hard", "good", "easy"].includes(event.rating)
    )
      throw new Error("review event rating is invalid");
    const duration = finiteNumber(event.durationMs, "review event durationMs");
    if (duration < 0 || duration > MAX_SAFE)
      throw new Error("review event durationMs is invalid");
    nonNegativeInteger(event.hintsUsed ?? 0, "review event hintsUsed");
    assertId(event.schedulerProfileId, "review event schedulerProfileId");
    nonNegativeInteger(
      event.baseStateVersion ?? 0,
      "review event baseStateVersion",
    );
    if (
      event.mode !== undefined &&
      event.mode !== "lesson" &&
      event.mode !== "review"
    )
      throw new Error("review event mode is invalid");
    if (
      event.attemptNumber !== undefined &&
      event.attemptNumber !== 1 &&
      event.attemptNumber !== 2
    )
      throw new Error("review event attemptNumber is invalid");
    if (event.final !== undefined && typeof event.final !== "boolean")
      throw new Error("review event final is invalid");
  } else if (event.eventType === "content-revision") {
    assertId(event.questionId, "revision event questionId");
    assertId(event.schedulerProfileId, "revision event schedulerProfileId");
    nonNegativeInteger(
      event.baseStateVersion ?? 0,
      "revision event baseStateVersion",
    );
  } else {
    if (event.questionId !== undefined)
      throw new Error("lesson completion cannot have questionId");
  }
  return clone(event as StudyEvent);
}

function validateSettings(value: unknown): LearningSettings {
  const settings = value as Partial<LearningSettings>;
  if (settings.id !== LOCAL_ID) throw new Error("settings.id is invalid");
  const dailyGoal = boundedPositiveInteger(
    settings.dailyGoal,
    "settings.dailyGoal",
    MIN_DAILY_GOAL,
    MAX_DAILY_GOAL,
  );
  const reviewLimit = boundedPositiveInteger(
    settings.reviewLimit,
    "settings.reviewLimit",
    MIN_REVIEW_LIMIT,
    MAX_REVIEW_LIMIT,
  );
  const updatedAt = finiteNumber(settings.updatedAt, "settings.updatedAt");
  if (updatedAt < 0) throw new Error("settings.updatedAt is invalid");
  return clone(settings as LearningSettings);
}

function validateHeartState(value: unknown): HeartState {
  const state = value as Partial<HeartState>;
  if (state.id !== LOCAL_ID) throw new Error("heartState.id is invalid");
  boundedPositiveInteger(state.count, "heartState.count", 0, MAX_HEARTS);
  const lastCalculatedAt = finiteNumber(
    state.lastCalculatedAt,
    "heartState.lastCalculatedAt",
  );
  const updatedAt = finiteNumber(state.updatedAt, "heartState.updatedAt");
  if (lastCalculatedAt < 0 || updatedAt < 0)
    throw new Error("heartState date is invalid");
  if (
    typeof state.localDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(state.localDate)
  ) {
    throw new Error("heartState.localDate is invalid");
  }
  return clone(state as HeartState);
}

function validateSessionRecord(
  value: unknown,
  index: number,
): LessonSessionRecord {
  const record = value as Partial<LessonSessionRecord>;
  assertId(record?.lessonId, `lessonSessions[${index}].lessonId`);
  nonNegativeInteger(
    record.contentRevision,
    `lessonSessions[${index}].contentRevision`,
  );
  assertSession(record.session as LessonSession);
  if ((record.session as LessonSession).lessonId !== record.lessonId)
    throw new Error("lesson session id mismatch");
  const updatedAt = finiteNumber(
    record.updatedAt,
    `lessonSessions[${index}].updatedAt`,
  );
  if (updatedAt < 0) throw new Error("lesson session updatedAt is invalid");
  return clone(record as LessonSessionRecord);
}

function validateBackup(value: unknown): LearningBackup {
  const backup = value as Partial<LearningBackup>;
  if (!backup || typeof backup !== "object")
    throw new Error("Backup must be an object");
  if (backup.schemaVersion !== BACKUP_SCHEMA_VERSION)
    throw new Error("Unsupported backup schemaVersion");
  const exportedAt = finiteNumber(backup.exportedAt, "backup.exportedAt");
  if (exportedAt < 0 || exportedAt > MAX_SAFE)
    throw new Error("backup.exportedAt is invalid");
  const userId = assertId(backup.userId, "backup.userId");
  const deviceId = assertId(backup.deviceId, "backup.deviceId");
  if (!Array.isArray(backup.studyEvents))
    throw new Error("backup.studyEvents must be an array");
  if (!Array.isArray(backup.schedulerProfiles))
    throw new Error("backup.schedulerProfiles must be an array");
  if (!Array.isArray(backup.gameEvents))
    throw new Error("backup.gameEvents must be an array");
  const studyEvents = backup.studyEvents.map(validateStudyEvent);
  const schedulerProfiles = backup.schedulerProfiles.map(validateProfile);
  const gameEvents = backup.gameEvents.map(validateGameEvent);
  const settings = validateSettings(backup.settings);
  const heartState =
    backup.heartState === undefined
      ? undefined
      : validateHeartState(backup.heartState);
  const lessonSessions = backup.lessonSessions?.map(validateSessionRecord);
  const ids = new Set<string>();
  for (const event of studyEvents) {
    if (ids.has(event.id)) throw new Error("duplicate study event id");
    ids.add(event.id);
    if (event.userId !== userId)
      throw new Error("backup contains multiple users");
  }
  const profileIds = new Set<string>();
  for (const profile of schedulerProfiles) {
    if (profileIds.has(profile.id))
      throw new Error("duplicate scheduler profile id");
    profileIds.add(profile.id);
  }
  for (const event of studyEvents) {
    if (event.schedulerProfileId && !profileIds.has(event.schedulerProfileId)) {
      throw new Error("study event refers to a missing scheduler profile");
    }
  }
  const gameIds = new Set<string>();
  for (const gameEvent of gameEvents) {
    if (gameIds.has(gameEvent.id)) throw new Error("duplicate game event id");
    gameIds.add(gameEvent.id);
  }
  const sessionIds = new Set<string>();
  for (const session of lessonSessions ?? []) {
    if (sessionIds.has(session.lessonId))
      throw new Error("duplicate lesson session id");
    sessionIds.add(session.lessonId);
  }
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    userId,
    deviceId,
    studyEvents,
    schedulerProfiles,
    gameEvents,
    settings,
    heartState,
    lessonSessions,
  };
}

function gameFromEvents(events: GameEvent[], now: number): GameState {
  let game = defaultGame(now);
  for (const event of [...events].sort(gameEventSort)) {
    const date = event.localDate ?? localDateFor(event.createdAt);
    if (event.type === "xp-earned") {
      game.xp += event.amount ?? 0;
      if (game.todayDate !== date) game.todayXp = 0;
      game.todayDate = date;
      // Current events carry a post-write daily XP snapshot.  Using it avoids
      // counting the same XP twice when the streak event for that visit is
      // replayed immediately before its xp-earned event.  Older events may
      // omit the snapshot, so retain additive replay as the fallback.
      game.todayXp = event.todayXp ?? game.todayXp + (event.amount ?? 0);
    } else {
      game.streak = event.streak ?? game.streak;
      game.longestStreak = Math.max(
        game.longestStreak,
        event.longestStreak ?? game.streak,
      );
      game.lastStudyDate = date;
      game.todayDate = date;
      game.todayXp = event.todayXp ?? game.todayXp;
    }
    game.updatedAt = event.createdAt;
  }
  return game;
}

export class LearningRepository {
  readonly database: LearningDatabase;
  private readonly clock: () => number;
  private readonly configuredUserId?: string;
  private readonly configuredDeviceId?: string;
  private readonly schedulerFactory: (
    profile: SchedulerProfile,
  ) => FsrsScheduler;

  constructor(options: LearningRepositoryOptions = {}) {
    this.database = options.database ?? defaultDatabase;
    this.clock = options.clock ?? (() => Date.now());
    this.configuredUserId = options.userId;
    this.configuredDeviceId = options.deviceId;
    this.schedulerFactory =
      options.schedulerFactory ?? ((profile) => new FsrsScheduler(profile));
  }

  private async open(): Promise<void> {
    if (!this.database.isOpen()) await this.database.open();
  }

  private async transaction<T>(
    mode: "r" | "rw",
    callback: () => Promise<T>,
  ): Promise<T> {
    await this.open();
    return (this.database.transaction as any)(
      mode,
      this.database.studyEvents,
      this.database.questionStates,
      this.database.lessonStates,
      this.database.schedulerProfiles,
      this.database.gameEvents,
      this.database.gameState,
      this.database.heartState,
      this.database.settings,
      this.database.lessonSessions,
      this.database.outbox,
      this.database.syncMeta,
      callback,
    );
  }

  private async identity(): Promise<{
    userId: string;
    deviceId: string;
    clientSeq: number;
  }> {
    const current = await this.database.syncMeta.get(LOCAL_ID);
    const userId = current?.userId ?? this.configuredUserId ?? DEFAULT_USER_ID;
    const deviceId =
      current?.deviceId ?? this.configuredDeviceId ?? id("device");
    const clientSeq = current?.clientSeq ?? 0;
    if (
      !current ||
      current.userId !== userId ||
      current.deviceId !== deviceId
    ) {
      await this.database.syncMeta.put({
        id: LOCAL_ID,
        lastSyncedAt: current?.lastSyncedAt ?? null,
        clientSeq,
        userId,
        deviceId,
      });
    }
    return { userId, deviceId, clientSeq };
  }

  private async profile(now: number): Promise<SchedulerProfile> {
    const current = await this.database.schedulerProfiles.get(
      DEFAULT_SCHEDULER_PROFILE_ID,
    );
    if (current) return current;
    const created = createDefaultSchedulerProfile(now);
    await this.database.schedulerProfiles.add(created);
    return created;
  }

  private scheduler(profile: SchedulerProfile): FsrsScheduler {
    return this.schedulerFactory(profile);
  }

  /** Must be called from inside a repository transaction. */
  private async refreshHeartState(now: number): Promise<HeartState> {
    const current = await this.database.heartState.get(LOCAL_ID);
    const next = reconcileHeartState(current, now);
    if (!current || !sameHeartState(current, next))
      await this.database.heartState.put(next);
    return next;
  }

  private notifyHeartsChanged(): void {
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent(HEARTS_CHANGED_EVENT));
  }

  async getHeartStatus(): Promise<HeartStatus> {
    const now = timestamp(this.clock);
    return this.transaction("rw", async () => {
      const state = await this.refreshHeartState(now);
      return heartStatus(state);
    });
  }

  async getSnapshot(): Promise<LearningSnapshot> {
    const now = timestamp(this.clock);
    const snapshot = await this.transaction("rw", async () => {
      const [lessonStates, questionStates, savedGame, savedSettings, state] =
        await Promise.all([
          this.database.lessonStates.toArray(),
          this.database.questionStates.toArray(),
          this.database.gameState.get(LOCAL_ID),
          this.database.settings.get(LOCAL_ID),
          this.refreshHeartState(now),
        ]);
      const game = savedGame ?? defaultGame(now);
      const today = localDateFor(now);
      return {
        lessonStates: clone(lessonStates),
        questionStates: clone(questionStates),
        game: {
          xp: game.xp,
          streak:
            game.lastStudyDate &&
            calendarDayDistance(game.lastStudyDate, today) > 1
              ? 0
              : game.streak,
          longestStreak: game.longestStreak,
          todayXp: game.todayDate === today ? game.todayXp : 0,
        },
        settings: {
          dailyGoal: savedSettings?.dailyGoal ?? DEFAULT_DAILY_GOAL,
          reviewLimit: savedSettings?.reviewLimit ?? DEFAULT_REVIEW_LIMIT,
        },
        hearts: heartStatus(state),
      };
    });
    this.notifyHeartsChanged();
    return snapshot;
  }

  async startLesson(lesson: Lesson): Promise<LessonSession> {
    assertLesson(lesson);
    const now = timestamp(this.clock);
    const result = await this.transaction("rw", async () => {
      let hearts = await this.refreshHeartState(now);
      const existingState = await this.database.lessonStates.get(lesson.id);
      const existingSession = await this.database.lessonSessions.get(lesson.id);
      if (
        existingSession?.contentRevision === lesson.revision &&
        existingSession.session.status === "active" &&
        existingSession.session.currentIndex < lesson.flow.length &&
        existingSession.session.answers.every((answer) =>
          lesson.flow.some(
            (step) =>
              step.type === "question" && step.ref === answer.questionId,
          ),
        ) &&
        (!existingState || existingState.contentRevision === lesson.revision)
      ) {
        return clone(existingSession.session) as LessonSession;
      }

      if (hearts.count <= 0)
        throw new NoHeartsError(heartStatus(hearts).nextRecoveryAt);

      const fresh = createLessonSession(lesson);
      hearts = consumeHeart(hearts, now);
      await this.database.heartState.put(hearts);
      await this.database.lessonSessions.put({
        lessonId: lesson.id,
        contentRevision: lesson.revision,
        session: clone(fresh),
        updatedAt: now,
      });

      if (existingState?.status === "completed") {
        await this.database.lessonStates.put({
          ...existingState,
          contentRevision: lesson.revision,
          status: "completed",
          lastStudiedAt: now,
          updatedAt: now,
        });
      } else {
        const next =
          existingState && existingState.contentRevision === lesson.revision
            ? {
                ...existingState,
                status: "in-progress" as const,
                startedAt: existingState.startedAt ?? now,
                lastStudiedAt: now,
                updatedAt: now,
              }
            : defaultLessonState(lesson.id, lesson.revision, now);
        await this.database.lessonStates.put(next);
      }
      return clone(fresh);
    });
    this.notifyHeartsChanged();
    return result;
  }

  async saveSession(session: LessonSession): Promise<void> {
    assertSession(session);
    const decorated = session as SessionWithRevision;
    await this.transaction("rw", async () => {
      const current = await this.database.lessonSessions.get(session.lessonId);
      const lessonState = await this.database.lessonStates.get(
        session.lessonId,
      );
      if (!current && !lessonState)
        throw new Error("Lesson session has not been started");
      const revision = current?.contentRevision ?? lessonState?.contentRevision;
      if (revision === undefined)
        throw new Error("Lesson session revision is unavailable");
      if (
        decorated.contentRevision !== undefined &&
        decorated.contentRevision !== revision
      ) {
        throw new Error("Lesson session belongs to an older content revision");
      }
      await this.database.lessonSessions.put({
        lessonId: session.lessonId,
        contentRevision: revision,
        session: clone(session),
        updatedAt: timestamp(this.clock),
      });
    });
  }

  async completeLesson(lesson: Lesson, session: LessonSession): Promise<void> {
    assertLesson(lesson);
    assertSession(session);
    if (session.lessonId !== lesson.id)
      throw new Error("Lesson and session IDs do not match");
    if (
      session.status !== "completed" ||
      session.currentIndex < lesson.flow.length
    ) {
      throw new Error("Cannot complete an active lesson session");
    }
    const questionRefs = lesson.flow
      .filter((item) => item.type === "question")
      .map((item) => item.ref);
    const answeredQuestionIds = new Set(
      session.answers.map((answer) => answer.questionId),
    );
    if (
      questionRefs.some((questionId) => !answeredQuestionIds.has(questionId))
    ) {
      throw new Error("Cannot complete a lesson with unanswered questions");
    }
    const now = timestamp(this.clock);
    await this.transaction("rw", async () => {
      const record = await this.database.lessonSessions.get(lesson.id);
      if (record && record.contentRevision !== lesson.revision)
        throw new Error("Lesson session revision mismatch");
      const decorated = session as SessionWithRevision;
      if (
        decorated.contentRevision !== undefined &&
        decorated.contentRevision !== lesson.revision
      ) {
        throw new Error("Lesson session belongs to an older content revision");
      }
      const eventId = `lesson-completed:${lesson.id}:${lesson.revision}`;
      const previousEvent = await this.database.studyEvents.get(eventId);
      if (!previousEvent) {
        const identity = await this.identity();
        const event: StudyEvent = {
          id: eventId,
          schemaVersion: EVENT_SCHEMA_VERSION,
          eventType: "lesson-completed",
          userId: identity.userId,
          deviceId: identity.deviceId,
          clientSeq: identity.clientSeq + 1,
          lessonId: lesson.id,
          contentRevision: lesson.revision,
          effectiveAt: now,
        };
        await this.database.studyEvents.add(event);
        await this.database.outbox.add(outboxFor(event, now));
        await this.database.syncMeta.put({
          id: LOCAL_ID,
          lastSyncedAt: null,
          clientSeq: event.clientSeq,
          userId: identity.userId,
          deviceId: identity.deviceId,
        });
      }
      const existing = await this.database.lessonStates.get(lesson.id);
      const answers = session.answers;
      const completedQuestions = new Set(
        answers.map((answer) => answer.questionId),
      ).size;
      const next: LessonState = {
        ...(existing ?? defaultLessonState(lesson.id, lesson.revision, now)),
        contentRevision: lesson.revision,
        status: "completed",
        startedAt: existing?.startedAt ?? now,
        completedAt: existing?.completedAt ?? now,
        lastStudiedAt: now,
        attemptedQuestions: Math.max(
          existing?.attemptedQuestions ?? 0,
          answers.length,
        ),
        completedQuestions: Math.max(
          existing?.completedQuestions ?? 0,
          completedQuestions,
        ),
        correctCount: Math.max(
          existing?.correctCount ?? 0,
          answers.filter((answer) => answer.correct).length,
        ),
        incorrectCount: Math.max(
          existing?.incorrectCount ?? 0,
          answers.filter((answer) => !answer.correct).length,
        ),
        updatedAt: now,
      };
      await this.database.lessonStates.put(next);
      await this.database.lessonSessions.put({
        lessonId: lesson.id,
        contentRevision: lesson.revision,
        session: clone(session),
        updatedAt: now,
      });
    });
  }

  private async updateGameForStudy(
    event: StudyEvent,
    correct: boolean,
    finalAttempt: boolean,
    now: number,
  ): Promise<void> {
    const today = localDateFor(now);
    const old = await this.database.gameState.get(LOCAL_ID);
    const game = old ? { ...old } : defaultGame(now);
    if (game.todayDate !== today) game.todayXp = 0;
    game.todayDate = today;

    let streakChanged = false;
    if (game.lastStudyDate !== today) {
      const distance = game.lastStudyDate
        ? calendarDayDistance(game.lastStudyDate, today)
        : null;
      if (distance === 1) game.streak += 1;
      else if (distance === null || (distance !== undefined && distance > 1))
        game.streak = 1;
      // A clock moved backwards should not erase an already-earned streak.
      if (game.streak === 0) game.streak = 1;
      game.longestStreak = Math.max(game.longestStreak, game.streak);
      game.lastStudyDate = today;
      streakChanged = true;
    }

    const earned = finalAttempt && correct ? XP_PER_CORRECT_ANSWER : 0;
    game.xp += earned;
    game.todayXp += earned;
    game.updatedAt = now;
    await this.database.gameState.put(game);

    if (streakChanged) {
      const streakEvent: GameEvent = {
        id: `game:streak:${today}`,
        type: "streak-updated",
        createdAt: now,
        eventId: event.id,
        localDate: today,
        streak: game.streak,
        longestStreak: game.longestStreak,
        todayXp: game.todayXp,
      };
      if (!(await this.database.gameEvents.get(streakEvent.id)))
        await this.database.gameEvents.add(streakEvent);
    }
    if (earned > 0) {
      const xpEvent: GameEvent = {
        id: `game:xp:${event.id}`,
        type: "xp-earned",
        amount: earned,
        createdAt: now,
        eventId: event.id,
        localDate: today,
        todayXp: game.todayXp,
      };
      await this.database.gameEvents.add(xpEvent);
    }
  }

  async saveAttempt(input: SaveAttemptInput): Promise<void> {
    assertId(input?.id, "attempt id");
    assertQuestion(input.question);
    if (typeof input.correct !== "boolean")
      throw new Error("attempt correctness is invalid");
    const durationMs = finiteNumber(input.durationMs, "attempt durationMs");
    if (durationMs < 0 || durationMs > MAX_SAFE)
      throw new Error("attempt durationMs is invalid");
    if (input.mode !== "lesson" && input.mode !== "review")
      throw new Error("attempt mode is invalid");
    const now = timestamp(this.clock);
    await this.transaction("rw", async () => {
      const duplicate = await this.database.studyEvents.get(input.id);
      if (duplicate) {
        if (
          duplicate.eventType !== "review-attempt" ||
          duplicate.questionId !== input.question.id ||
          duplicate.lessonId !== input.question.lessonId ||
          duplicate.contentRevision !== input.question.revision ||
          duplicate.result !== (input.correct ? "correct" : "incorrect") ||
          duplicate.durationMs !== durationMs ||
          (duplicate.mode ?? "lesson") !== input.mode
        ) {
          throw new Error("Attempt ID is already used for a different attempt");
        }
        return;
      }

      // Question Host sends one final summary per lifecycle.  `correct` is
      // first-try-correct, so a retry that eventually succeeds is deliberately
      // stored as an Again outcome as required by the learning policy.
      const finalAttempt = input.final ?? true;
      const attemptNumber = input.attemptNumber ?? 1;
      const rating = input.correct ? "good" : "again";
      const profile = await this.profile(now);
      const scheduler = this.scheduler(profile);
      let state = await this.database.questionStates.get(input.question.id);
      if (!state || state.contentRevision !== input.question.revision) {
        state = defaultQuestionState(
          input.question,
          profile,
          scheduler,
          now,
          state?.stateVersion ?? 0,
        );
      }
      const applied = scheduler.apply(
        scheduler.validateState(state.schedulerState),
        rating,
        new Date(now),
      );
      const eventIdentity = await this.identity();
      const event: StudyEvent = {
        id: input.id,
        schemaVersion: EVENT_SCHEMA_VERSION,
        eventType: "review-attempt",
        userId: eventIdentity.userId,
        deviceId: eventIdentity.deviceId,
        clientSeq: eventIdentity.clientSeq + 1,
        questionId: input.question.id,
        lessonId: input.question.lessonId,
        contentRevision: input.question.revision,
        effectiveAt: now,
        result: input.correct ? "correct" : "incorrect",
        rating,
        durationMs,
        hintsUsed: 0,
        schedulerProfileId: profile.id,
        baseStateVersion: state.stateVersion,
        mode: input.mode,
        attemptNumber,
        final: finalAttempt,
      };
      const nextState: QuestionState = {
        ...state,
        userId: eventIdentity.userId,
        contentRevision: input.question.revision,
        status: scheduler.status(applied.state),
        lastReviewAt: now,
        nextReviewAt: applied.nextReviewAt,
        correctCount: state.correctCount + (input.correct ? 1 : 0),
        incorrectCount: state.incorrectCount + (input.correct ? 0 : 1),
        reps: applied.state.reps,
        lapses: applied.state.lapses,
        schedulerProfileId: profile.id,
        schedulerState: applied.state,
        stateVersion: state.stateVersion + 1,
        updatedAt: now,
      };

      await this.database.studyEvents.add(event);
      await this.database.questionStates.put(nextState);
      if (input.mode === "lesson") {
        // Persist the answer together with the attempt.  The lesson player
        // advances the session in a follow-up saveSession call; keeping the
        // answer in this transaction closes the crash window between those
        // two calls, so a reload can skip a question whose result was already
        // recorded.
        const currentSession = await this.database.lessonSessions.get(
          input.question.lessonId,
        );
        if (currentSession && currentSession.session.status === "active") {
          const answer = {
            questionId: input.question.id,
            correct: input.correct,
            answeredAt: now,
          };
          const answerIndex = currentSession.session.answers.findIndex(
            (existingAnswer) => existingAnswer.questionId === answer.questionId,
          );
          const answers = [...currentSession.session.answers];
          if (answerIndex >= 0) answers[answerIndex] = answer;
          else answers.push(answer);
          await this.database.lessonSessions.put({
            ...currentSession,
            session: {
              ...currentSession.session,
              answers,
            },
            updatedAt: now,
          });
        }
        const existingLesson = await this.database.lessonStates.get(
          input.question.lessonId,
        );
        const lesson =
          existingLesson ??
          defaultLessonState(
            input.question.lessonId,
            input.question.revision,
            now,
          );
        const lessonCompleted = finalAttempt;
        await this.database.lessonStates.put({
          ...lesson,
          userId: eventIdentity.userId,
          status: lesson.status === "completed" ? "completed" : "in-progress",
          startedAt: lesson.startedAt ?? now,
          lastStudiedAt: now,
          attemptedQuestions: lesson.attemptedQuestions + 1,
          completedQuestions:
            lesson.completedQuestions + (lessonCompleted ? 1 : 0),
          correctCount: lesson.correctCount + (input.correct ? 1 : 0),
          incorrectCount: lesson.incorrectCount + (input.correct ? 0 : 1),
          updatedAt: now,
        });
      }
      await this.database.outbox.add(outboxFor(event, now));
      await this.database.syncMeta.put({
        id: LOCAL_ID,
        lastSyncedAt: null,
        clientSeq: event.clientSeq,
        userId: eventIdentity.userId,
        deviceId: eventIdentity.deviceId,
      });
      await this.updateGameForStudy(event, input.correct, finalAttempt, now);
    });
  }

  async getReviewQueue(
    questions: Question[],
    nowInput?: Date,
  ): Promise<Question[]> {
    if (!Array.isArray(questions))
      throw new Error("questions must be an array");
    for (const question of questions) assertQuestion(question);
    const now =
      nowInput === undefined
        ? timestamp(this.clock)
        : finiteNumber(nowInput.getTime(), "review queue date");
    const unique = new Map(
      questions.map((question) => [question.id, question]),
    );
    await this.transaction("rw", async () => {
      const profile = await this.profile(now);
      const scheduler = this.scheduler(profile);
      const states = await this.database.questionStates.toArray();
      const byId = new Map(states.map((state) => [state.questionId, state]));
      for (const question of unique.values()) {
        const state = byId.get(question.id);
        if (!state || state.contentRevision === question.revision) continue;
        const eventId = `content-revision:${question.id}:${question.revision}`;
        if (!(await this.database.studyEvents.get(eventId))) {
          const identity = await this.identity();
          const event: StudyEvent = {
            id: eventId,
            schemaVersion: EVENT_SCHEMA_VERSION,
            eventType: "content-revision",
            userId: identity.userId,
            deviceId: identity.deviceId,
            clientSeq: identity.clientSeq + 1,
            questionId: question.id,
            lessonId: question.lessonId,
            contentRevision: question.revision,
            effectiveAt: now,
            schedulerProfileId: profile.id,
            baseStateVersion: state.stateVersion,
          };
          await this.database.studyEvents.add(event);
          await this.database.outbox.add(outboxFor(event, now));
          await this.database.syncMeta.put({
            id: LOCAL_ID,
            lastSyncedAt: null,
            clientSeq: event.clientSeq,
            userId: identity.userId,
            deviceId: identity.deviceId,
          });
        }
        const resetIdentity = await this.identity();
        const reset = revisedQuestionState(
          question,
          profile,
          scheduler,
          now,
          state.stateVersion + 1,
          resetIdentity.userId,
        );
        await this.database.questionStates.put(reset);
        byId.set(question.id, reset);
      }
    });

    return this.transaction("r", async () => {
      const states = await this.database.questionStates.toArray();
      const byId = new Map(states.map((state) => [state.questionId, state]));
      const profile = await this.database.schedulerProfiles.get(
        DEFAULT_SCHEDULER_PROFILE_ID,
      );
      const scheduler = profile ? this.scheduler(profile) : null;
      const rank: Record<QuestionState["status"], number> = {
        relearning: 0,
        review: 1,
        learning: 2,
        new: 3,
        suspended: 4,
      };
      return [...unique.values()]
        .filter((question) => {
          const state = byId.get(question.id);
          return Boolean(
            state &&
            state.contentRevision === question.revision &&
            state.status !== "new" &&
            state.status !== "suspended" &&
            state.nextReviewAt !== null &&
            state.nextReviewAt <= now,
          );
        })
        .sort((a, b) => {
          const left = byId.get(a.id)!;
          const right = byId.get(b.id)!;
          const statusOrder = rank[left.status] - rank[right.status];
          if (statusOrder !== 0) return statusOrder;
          const dueOrder =
            (left.nextReviewAt ?? MAX_SAFE) - (right.nextReviewAt ?? MAX_SAFE);
          if (dueOrder !== 0) return dueOrder;
          const leftR = scheduler
            ? (scheduler.retrievability(
                left.schedulerState as PersistedSchedulerState,
                new Date(now),
              ) ?? 1)
            : 1;
          const rightR = scheduler
            ? (scheduler.retrievability(
                right.schedulerState as PersistedSchedulerState,
                new Date(now),
              ) ?? 1)
            : 1;
          return leftR - rightR;
        });
    });
  }

  async updateSettings(input: {
    dailyGoal?: number;
    reviewLimit?: number;
  }): Promise<void> {
    if (!input || typeof input !== "object")
      throw new Error("settings update must be an object");
    const now = timestamp(this.clock);
    await this.transaction("rw", async () => {
      const current =
        (await this.database.settings.get(LOCAL_ID)) ?? defaultSettings(now);
      const next: LearningSettings = {
        ...current,
        dailyGoal:
          input.dailyGoal === undefined
            ? current.dailyGoal
            : boundedPositiveInteger(
                input.dailyGoal,
                "dailyGoal",
                MIN_DAILY_GOAL,
                MAX_DAILY_GOAL,
              ),
        reviewLimit:
          input.reviewLimit === undefined
            ? current.reviewLimit
            : boundedPositiveInteger(
                input.reviewLimit,
                "reviewLimit",
                MIN_REVIEW_LIMIT,
                MAX_REVIEW_LIMIT,
              ),
        updatedAt: now,
      };
      await this.database.settings.put(next);
    });
  }

  async exportBackup(): Promise<string> {
    const now = timestamp(this.clock);
    const backup = await this.transaction("rw", async () => {
      const [events, profiles, gameEvents, settings, identity, heartState] =
        await Promise.all([
          this.database.studyEvents.toArray(),
          this.database.schedulerProfiles.toArray(),
          this.database.gameEvents.toArray(),
          this.database.settings.get(LOCAL_ID),
          this.database.syncMeta.get(LOCAL_ID),
          this.refreshHeartState(now),
        ]);
      const fallbackUser =
        events[0]?.userId ?? this.configuredUserId ?? DEFAULT_USER_ID;
      const fallbackDevice =
        events[0]?.deviceId ?? this.configuredDeviceId ?? "local-device";
      const backup: LearningBackup = {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: now,
        userId: identity?.userId ?? fallbackUser,
        deviceId: identity?.deviceId ?? fallbackDevice,
        studyEvents: [...events].sort(eventSort),
        schedulerProfiles: clone(profiles),
        gameEvents: [...gameEvents].sort(gameEventSort),
        settings: settings ?? defaultSettings(now),
        heartState,
        lessonSessions: await this.database.lessonSessions.toArray(),
      };
      return JSON.stringify(backup);
    });
    this.notifyHeartsChanged();
    return backup;
  }

  async importBackup(json: string): Promise<void> {
    if (typeof json !== "string") throw new Error("Backup must be JSON text");
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Backup is not valid JSON");
    }
    const backup = validateBackup(parsed);
    const now = timestamp(this.clock);
    await this.transaction("rw", async () => {
      await Promise.all([
        this.database.studyEvents.clear(),
        this.database.questionStates.clear(),
        this.database.lessonStates.clear(),
        this.database.schedulerProfiles.clear(),
        this.database.gameEvents.clear(),
        this.database.gameState.clear(),
        this.database.heartState.clear(),
        this.database.settings.clear(),
        this.database.lessonSessions.clear(),
        this.database.outbox.clear(),
        this.database.syncMeta.clear(),
      ]);
      if (backup.schedulerProfiles.length > 0)
        await this.database.schedulerProfiles.bulkAdd(backup.schedulerProfiles);
      const profiles = new Map(
        backup.schedulerProfiles.map((profile) => [profile.id, profile]),
      );
      if (!profiles.has(DEFAULT_SCHEDULER_PROFILE_ID)) {
        const fallback = createDefaultSchedulerProfile(now);
        await this.database.schedulerProfiles.add(fallback);
        profiles.set(fallback.id, fallback);
      }
      const events = [...backup.studyEvents].sort(eventSort);
      if (events.length > 0) await this.database.studyEvents.bulkAdd(events);
      for (const gameEvent of backup.gameEvents)
        await this.database.gameEvents.add(gameEvent);
      await this.database.settings.put(backup.settings);
      await this.database.heartState.put(
        backup.heartState ?? defaultHeartState(now),
      );
      for (const event of events) {
        if (event.eventType === "content-revision") {
          const profile = profiles.get(event.schedulerProfileId!);
          if (!profile) throw new Error("Revision event profile is missing");
          const scheduler = this.scheduler(profile);
          const previous = await this.database.questionStates.get(
            event.questionId!,
          );
          const question = {
            id: event.questionId!,
            lessonId: event.lessonId,
            revision: event.contentRevision,
          } as Pick<Question, "id" | "lessonId" | "revision">;
          const reset = revisedQuestionState(
            question,
            profile,
            scheduler,
            event.effectiveAt,
            (previous?.stateVersion ?? 0) + 1,
            event.userId,
          );
          await this.database.questionStates.put(reset);
          continue;
        }
        if (event.eventType === "lesson-completed") {
          const previous = await this.database.lessonStates.get(event.lessonId);
          await this.database.lessonStates.put({
            ...(previous ??
              defaultLessonState(
                event.lessonId,
                event.contentRevision,
                event.effectiveAt,
                "not-started",
              )),
            userId: event.userId,
            contentRevision: event.contentRevision,
            status: "completed",
            startedAt: previous?.startedAt ?? event.effectiveAt,
            completedAt: previous?.completedAt ?? event.effectiveAt,
            lastStudiedAt: event.effectiveAt,
            updatedAt: event.effectiveAt,
          });
          continue;
        }
        const profile = profiles.get(event.schedulerProfileId!);
        if (!profile) throw new Error("Review event profile is missing");
        const scheduler = this.scheduler(profile);
        const previous = await this.database.questionStates.get(
          event.questionId!,
        );
        const question = {
          id: event.questionId!,
          lessonId: event.lessonId,
          revision: event.contentRevision,
        } as Pick<Question, "id" | "lessonId" | "revision">;
        const current =
          !previous || previous.contentRevision !== event.contentRevision
            ? defaultQuestionState(
                question,
                profile,
                scheduler,
                event.effectiveAt,
                previous?.stateVersion ?? 0,
              )
            : previous;
        const applied = scheduler.apply(
          scheduler.validateState(current.schedulerState),
          event.rating!,
          new Date(event.effectiveAt),
        );
        const next: QuestionState = {
          ...current,
          userId: event.userId,
          status: scheduler.status(applied.state),
          lastReviewAt: event.effectiveAt,
          nextReviewAt: applied.nextReviewAt,
          correctCount:
            current.correctCount + (event.result === "correct" ? 1 : 0),
          incorrectCount:
            current.incorrectCount + (event.result === "incorrect" ? 1 : 0),
          reps: applied.state.reps,
          lapses: applied.state.lapses,
          schedulerProfileId: profile.id,
          schedulerState: applied.state,
          stateVersion: current.stateVersion + 1,
          updatedAt: event.effectiveAt,
        };
        await this.database.questionStates.put(next);
        if (event.mode === "lesson") {
          const previousLesson = await this.database.lessonStates.get(
            event.lessonId,
          );
          const finalAttempt = event.final ?? true;
          const lesson =
            previousLesson ??
            defaultLessonState(
              event.lessonId,
              event.contentRevision,
              event.effectiveAt,
            );
          await this.database.lessonStates.put({
            ...lesson,
            userId: event.userId,
            status: lesson.status === "completed" ? "completed" : "in-progress",
            startedAt: lesson.startedAt ?? event.effectiveAt,
            lastStudiedAt: event.effectiveAt,
            attemptedQuestions: lesson.attemptedQuestions + 1,
            completedQuestions:
              lesson.completedQuestions + (finalAttempt ? 1 : 0),
            correctCount:
              lesson.correctCount + (event.result === "correct" ? 1 : 0),
            incorrectCount:
              lesson.incorrectCount + (event.result === "incorrect" ? 1 : 0),
            updatedAt: event.effectiveAt,
          });
        }
      }
      const derivedGame =
        backup.gameEvents.length > 0
          ? gameFromEvents(backup.gameEvents, now)
          : defaultGame(now);
      await this.database.gameState.put(derivedGame);
      if (backup.lessonSessions)
        await this.database.lessonSessions.bulkAdd(backup.lessonSessions);
      for (const event of events)
        await this.database.outbox.add(outboxFor(event, now));
      const maxSeq = events.reduce(
        (max, event) => Math.max(max, event.clientSeq),
        0,
      );
      await this.database.syncMeta.put({
        id: LOCAL_ID,
        lastSyncedAt: null,
        clientSeq: maxSeq,
        userId: backup.userId,
        deviceId: backup.deviceId,
      });
    });
    this.notifyHeartsChanged();
  }

  async resetProgress(): Promise<void> {
    const now = timestamp(this.clock);
    await this.transaction("rw", async () => {
      await Promise.all([
        this.database.studyEvents.clear(),
        this.database.questionStates.clear(),
        this.database.lessonStates.clear(),
        this.database.gameEvents.clear(),
        this.database.gameState.clear(),
        this.database.heartState.clear(),
        this.database.lessonSessions.clear(),
        this.database.outbox.clear(),
      ]);
      const current = await this.database.syncMeta.get(LOCAL_ID);
      await this.database.syncMeta.put({
        id: LOCAL_ID,
        lastSyncedAt: null,
        clientSeq: 0,
        userId: current?.userId ?? this.configuredUserId ?? DEFAULT_USER_ID,
        deviceId: current?.deviceId ?? this.configuredDeviceId ?? id("device"),
      });
      if (!(await this.database.settings.get(LOCAL_ID)))
        await this.database.settings.put(defaultSettings(now));
      await this.database.heartState.put(defaultHeartState(now));
    });
    this.notifyHeartsChanged();
  }
}

export const learningRepository = new LearningRepository();
