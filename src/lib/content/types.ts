export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "markdown"; markdown: string; html?: string }
  | { type: "code"; language: string; code: string }
  | { type: "image"; src: string; alt: string }
  | { type: "diagram"; diagramType: string; data: unknown; alt: string };

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
  schemaVersion: 1;
  tracks: Track[];
  nodes: CurriculumNode[];
}

export type LessonFlowItem =
  | { type: "content"; blocks: ContentBlock[] }
  | { type: "question"; ref: string };

export interface Lesson {
  schemaVersion: 1;
  id: string;
  revision: number;
  track: string;
  title: string;
  description: string;
  flow: LessonFlowItem[];
}

export interface ContentManifest {
  schemaVersion: 1;
  buildId: string;
  generatedAt: string;
  tracks: string[];
  lessons: string[];
  questions: string[];
}
