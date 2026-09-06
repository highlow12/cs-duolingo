import type { Lesson } from "$lib/content/types";

export interface SessionAnswer {
  questionId: string;
  correct: boolean;
  answeredAt: number;
}

export interface LessonSession {
  lessonId: string;
  contentRevision?: number;
  currentIndex: number;
  status: "active" | "completed";
  answers: SessionAnswer[];
}

export function createLessonSession(lesson: Lesson): LessonSession {
  return {
    lessonId: lesson.id,
    contentRevision: lesson.revision,
    currentIndex: 0,
    status: lesson.flow.length === 0 ? "completed" : "active",
    answers: [],
  };
}

export function advanceLesson(
  session: LessonSession,
  lesson: Lesson,
): LessonSession {
  const nextIndex = session.currentIndex + 1;
  return {
    ...session,
    currentIndex: nextIndex,
    status: nextIndex >= lesson.flow.length ? "completed" : "active",
  };
}

export function recordAnswer(
  session: LessonSession,
  questionId: string,
  correct: boolean,
): LessonSession {
  return {
    ...session,
    answers: [
      ...session.answers,
      { questionId, correct, answeredAt: Date.now() },
    ],
  };
}
