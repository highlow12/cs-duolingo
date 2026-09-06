import { base } from "$app/paths";
import type { ContentManifest, Curriculum, Lesson } from "$lib/content/types";
import type { Question } from "$lib/questions/types";
import type { ContentRepository } from "./content-repository";

function contentPath(path: string): string {
  return `${base}/generated/${path}`;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(
      `콘텐츠를 불러오지 못했습니다: ${path} (${response.status})`,
    );
  }
  return (await response.json()) as T;
}

export class StaticContentRepository implements ContentRepository {
  async getManifest(): Promise<ContentManifest> {
    return getJson<ContentManifest>(contentPath("manifest.json"));
  }

  async getCurriculum(): Promise<Curriculum> {
    return getJson<Curriculum>(contentPath("curriculum.json"));
  }

  async getLesson(id: string): Promise<Lesson> {
    return getJson<Lesson>(
      contentPath(`lessons/${encodeURIComponent(id)}.json`),
    );
  }

  async getQuestion(id: string): Promise<Question> {
    return getJson<Question>(
      contentPath(`questions/${encodeURIComponent(id)}.json`),
    );
  }

  async getPrerequisites(lessonId: string): Promise<string[]> {
    const curriculum = await this.getCurriculum();
    return (
      curriculum.nodes.find((node) => node.lesson === lessonId)?.requires ?? []
    );
  }
}

export const contentRepository = new StaticContentRepository();
