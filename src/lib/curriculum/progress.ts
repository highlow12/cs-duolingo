import type { Curriculum, Lesson } from '$lib/content/types';
import type { LessonState } from '$lib/learning/domain/states';

export function missingPrerequisites(id: string, curriculum: Curriculum, states: LessonState[]): string[] {
  const completed = new Set(states.filter((s) => s.status === 'completed').map((s) => s.lessonId));
  const node = curriculum.nodes.find((n) => n.lesson === id);
  return node ? node.requires.filter((required) => !completed.has(required)) : [id];
}
export function lessonStatus(lesson: Lesson, curriculum: Curriculum, states: LessonState[]) {
  const state = states.find((s) => s.lessonId === lesson.id);
  if (state?.status === 'completed') return 'completed';
  if (missingPrerequisites(lesson.id, curriculum, states).length) return 'locked';
  return state?.status === 'in-progress' ? 'in-progress' : 'available';
}
export const statusLabels = { completed: '학습 완료', locked: '선행 학습 필요', 'in-progress': '학습 중', available: '시작 가능' };
