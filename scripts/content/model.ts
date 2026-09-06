import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parse } from "yaml";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "markdown"; markdown: string }
  | { type: "code"; language: string; code: string }
  | { type: "image"; src: string; alt: string }
  | { type: "diagram"; diagramType: string; data: unknown };

export interface SourceTrack {
  id: string;
  revision: number;
  title: string;
  description?: string;
  order: number;
}

export interface SourceGraphNode {
  lesson: string;
  requires: string[];
}

export interface SourceLesson {
  id: string;
  revision: number;
  track: string;
  title: string;
  description: string;
  flow: Array<{ type: "content" | "question"; ref: string }>;
}

export interface SourceQuestion {
  id: string;
  revision: number;
  type: string;
  prompt: ContentBlock[];
  [key: string]: unknown;
}

export interface SourceLessonEntry {
  directory: string;
  lesson: SourceLesson;
  questions: SourceQuestion[];
  content: Record<string, string>;
}

export interface SourceContentBundle {
  tracks: SourceTrack[];
  graph: SourceGraphNode[];
  lessons: SourceLessonEntry[];
}

async function readYaml<T>(path: string): Promise<T> {
  return parse(await readFile(path, "utf8")) as T;
}

async function readMarkdownFiles(
  directory: string,
): Promise<Record<string, string>> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const markdownFiles = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith(".md"),
    );
    const content: Record<string, string> = {};
    for (const entry of markdownFiles) {
      content[basename(entry.name, ".md")] = await readFile(
        join(directory, entry.name),
        "utf8",
      );
    }
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export async function loadSourceContent(
  projectRoot = process.cwd(),
): Promise<SourceContentBundle> {
  const root = resolve(projectRoot);
  const contentRoot = join(root, "content");
  const tracksDocument = await readYaml<{ tracks?: SourceTrack[] }>(
    join(contentRoot, "curriculum", "tracks.yaml"),
  );
  const graphDocument = await readYaml<{ nodes?: SourceGraphNode[] }>(
    join(contentRoot, "curriculum", "graph.yaml"),
  );
  const lessonsRoot = join(contentRoot, "lessons");
  const lessonDirectories = (
    await readdir(lessonsRoot, { withFileTypes: true })
  ).filter((entry) => entry.isDirectory());

  const lessons: SourceLessonEntry[] = [];
  for (const directory of lessonDirectories) {
    const lessonDirectory = join(lessonsRoot, directory.name);
    const lesson = await readYaml<SourceLesson>(
      join(lessonDirectory, "lesson.yaml"),
    );
    const questionDocument = await readYaml<{ questions?: SourceQuestion[] }>(
      join(lessonDirectory, "questions.yaml"),
    );
    lessons.push({
      directory: directory.name,
      lesson,
      questions: questionDocument.questions ?? [],
      content: await readMarkdownFiles(join(lessonDirectory, "content")),
    });
  }

  return {
    tracks: tracksDocument.tracks ?? [],
    graph: graphDocument.nodes ?? [],
    lessons,
  };
}

const questionTypes = new Set([
  "single-choice",
  "multi-select",
  "fill-blank",
  "ordering",
  "matching",
  "code-output",
  "code-completion",
]);

export function getValidationErrors(bundle: SourceContentBundle): string[] {
  const errors: string[] = [];
  const trackIds = new Set<string>();
  const lessonIds = new Set<string>();
  const questionIds = new Set<string>();

  for (const track of bundle.tracks) {
    if (!track.id) errors.push("track id가 없습니다.");
    if (trackIds.has(track.id)) errors.push(`중복된 track id: ${track.id}`);
    trackIds.add(track.id);
    if (!Number.isInteger(track.revision) || track.revision < 1) {
      errors.push(`잘못된 track revision: ${track.id}`);
    }
  }

  for (const entry of bundle.lessons) {
    const lesson = entry.lesson;
    if (!lesson.id) errors.push(`${entry.directory}: lesson id가 없습니다.`);
    if (lessonIds.has(lesson.id)) errors.push(`중복된 lesson id: ${lesson.id}`);
    lessonIds.add(lesson.id);
    if (!trackIds.has(lesson.track))
      errors.push(`${lesson.id}: 존재하지 않는 track: ${lesson.track}`);
    if (!Number.isInteger(lesson.revision) || lesson.revision < 1) {
      errors.push(`잘못된 lesson revision: ${lesson.id}`);
    }

    for (const question of entry.questions) {
      if (questionIds.has(question.id))
        errors.push(`중복된 question id: ${question.id}`);
      questionIds.add(question.id);
      if (!questionTypes.has(question.type))
        errors.push(
          `${question.id}: 알 수 없는 question type: ${question.type}`,
        );
      if (!Number.isInteger(question.revision) || question.revision < 1) {
        errors.push(`잘못된 question revision: ${question.id}`);
      }
    }

    for (const item of lesson.flow) {
      if (item.type === "content" && !(item.ref in entry.content)) {
        errors.push(`${lesson.id}: 존재하지 않는 content 참조: ${item.ref}`);
      }
      if (
        item.type === "question" &&
        !entry.questions.some((question) => question.id === item.ref)
      ) {
        errors.push(`${lesson.id}: 존재하지 않는 question 참조: ${item.ref}`);
      }
    }
  }

  const graphLessonIds = new Set(bundle.graph.map((node) => node.lesson));
  for (const node of bundle.graph) {
    if (!lessonIds.has(node.lesson))
      errors.push(`graph에 존재하지 않는 lesson: ${node.lesson}`);
    if (graphLessonIds.has(node.lesson)) {
      for (const prerequisite of node.requires) {
        if (!lessonIds.has(prerequisite)) {
          errors.push(
            `${node.lesson}: 존재하지 않는 prerequisite: ${prerequisite}`,
          );
        }
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const requires = new Map(
    bundle.graph.map((node) => [node.lesson, node.requires]),
  );
  function visit(lessonId: string): void {
    if (visiting.has(lessonId)) {
      errors.push(`curriculum graph cycle: ${lessonId}`);
      return;
    }
    if (visited.has(lessonId)) return;
    visiting.add(lessonId);
    for (const prerequisite of requires.get(lessonId) ?? [])
      visit(prerequisite);
    visiting.delete(lessonId);
    visited.add(lessonId);
  }
  for (const lessonId of lessonIds) visit(lessonId);

  return errors;
}
