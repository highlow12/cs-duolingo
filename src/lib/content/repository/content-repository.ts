import type { ContentManifest, Curriculum, Lesson } from "$lib/content/types";
import type { Question } from "$lib/questions/types";

export interface ContentRepository {
  getManifest(): Promise<ContentManifest>;
  getCurriculum(): Promise<Curriculum>;
  getLesson(id: string): Promise<Lesson>;
  getQuestion(id: string): Promise<Question>;
  getPrerequisites(lessonId: string): Promise<string[]>;
}
