export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "markdown"; markdown: string }
  | { type: "code"; language: string; code: string }
  | { type: "image"; src: string; alt: string }
  | { type: "diagram"; diagramType: string; data: unknown };

export interface Track {
  id: string;
  revision: number;
  title: string;
  description?: string;
  order: number;
}

export interface CurriculumNode {
  lesson: string;
  requires: string[];
}

export interface Curriculum {
  tracks: Track[];
  nodes: CurriculumNode[];
}

export type LessonFlowItem =
  { type: "content"; ref: string } | { type: "question"; ref: string };

export interface Lesson {
  id: string;
  revision: number;
  track: string;
  title: string;
  description: string;
  flow: LessonFlowItem[];
  content: Record<string, ContentBlock[]>;
}

export interface ContentManifest {
  schemaVersion: number;
  buildId: string;
  generatedAt: string;
  tracks: string[];
  lessons: string[];
  questions: string[];
}
