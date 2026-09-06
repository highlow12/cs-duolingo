import { contentRepository } from '$lib/content/repository/static-content-repository';
import { learningRepository } from '$lib/storage/repositories/learning-repository';
import { lessonStatus } from '$lib/curriculum/progress';

export async function loadDashboard() {
  const [curriculum, manifest, snapshot] = await Promise.all([
    contentRepository.getCurriculum(), contentRepository.getManifest(), learningRepository.getSnapshot()
  ]);
  const [lessons, questions] = await Promise.all([
    Promise.all(curriculum.nodes.map((n) => contentRepository.getLesson(n.lesson))),
    Promise.all(manifest.questions.map((id) => contentRepository.getQuestion(id)))
  ]);
  const queue = await learningRepository.getReviewQueue(questions);
  const nextLesson = lessons.find((l) => lessonStatus(l, curriculum, snapshot.lessonStates) === 'in-progress')
    ?? lessons.find((l) => lessonStatus(l, curriculum, snapshot.lessonStates) === 'available');
  return { curriculum, manifest, snapshot, lessons, questions, queue, nextLesson };
}
export type Dashboard = Awaited<ReturnType<typeof loadDashboard>>;
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '데이터를 불러오지 못했습니다. 다시 시도해 주세요.';
}
