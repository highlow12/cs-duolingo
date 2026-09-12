import type { Curriculum, Lesson, Track } from "$lib/content/types";
import type { LessonState } from "$lib/learning/domain/states";

export function missingPrerequisites(
  id: string,
  curriculum: Curriculum,
  states: readonly LessonState[],
): string[] {
  const completed = new Set(
    states.filter((s) => s.status === "completed").map((s) => s.lessonId),
  );
  const node = curriculum.nodes.find((n) => n.lesson === id);
  return node
    ? node.requires.filter((required) => !completed.has(required))
    : [id];
}
export function lessonStatus(
  lesson: Lesson,
  curriculum: Curriculum,
  states: readonly LessonState[],
) {
  const state = states.find((s) => s.lessonId === lesson.id);
  if (state?.status === "completed") return "completed";
  if (missingPrerequisites(lesson.id, curriculum, states).length)
    return "locked";
  return state?.status === "in-progress" ? "in-progress" : "available";
}

/**
 * Return tracks that contain at least one lesson the learner can currently
 * reach. A track with only locked lessons is intentionally omitted from the
 * learning navigator so a learner cannot enter a dead end from that surface.
 *
 * Track order is presentation metadata, not a prerequisite relationship. The
 * lesson status remains the source of truth for whether a track is visible.
 */
export function visibleTracks(
  curriculum: Curriculum,
  lessons: readonly Lesson[],
  states: readonly LessonState[],
): Track[] {
  return [...curriculum.tracks]
    .filter((track) =>
      lessons.some(
        (lesson) =>
          lesson.track === track.id &&
          lessonStatus(lesson, curriculum, states) !== "locked",
      ),
    )
    .sort(
      (left, right) =>
        left.order - right.order || left.id.localeCompare(right.id),
    );
}

export const statusLabels = {
  completed: "학습 완료",
  locked: "선행 학습 필요",
  "in-progress": "학습 중",
  available: "시작 가능",
};
