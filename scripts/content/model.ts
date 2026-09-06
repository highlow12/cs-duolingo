import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { parse } from "yaml";

export const CONTENT_SCHEMA_VERSION = 1 as const;
export const CONTENT_BUILDER_VERSION = "1";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "markdown"; markdown: string }
  | { type: "code"; language: string; code: string }
  | { type: "image"; src: string; alt: string }
  | { type: "diagram"; diagramType: string; data: unknown; alt: string };

export interface SourceTrack {
  id: string;
  revision: number;
  title: string;
  description: string;
  order: number;
}
export interface SourceGraphNode {
  lesson: string;
  requires: string[];
}
export interface SourceLesson {
  schemaVersion: 1;
  id: string;
  revision: number;
  track: string;
  title: string;
  description: string;
  flow: Array<{ type: "content" | "question"; ref: string }>;
}
export interface SourceQuestion {
  schemaVersion: 1;
  id: string;
  revision: number;
  type: string;
  prompt: ContentBlock[];
  explanation?: ContentBlock[];
  tags?: string[];
  difficulty?: number;
  [key: string]: unknown;
}
export interface SourceFile<T = unknown> {
  path: string;
  relativePath: string;
  value: T;
}
export interface MarkdownSourceFile {
  path: string;
  relativePath: string;
  ref: string;
  markdown: string;
}
export interface SourceLessonEntry {
  directory: string;
  directoryPath: string;
  lessonFile: SourceFile<SourceLesson>;
  questions: SourceFile<SourceQuestion>[];
  content: MarkdownSourceFile[];
}
export interface SourceContentBundle {
  projectRoot: string;
  contentRoot: string;
  tracksFile: SourceFile<{ schemaVersion: 1; tracks: SourceTrack[] }>;
  graphFile: SourceFile<{ schemaVersion: 1; nodes: SourceGraphNode[] }>;
  lessons: SourceLessonEntry[];
  files: Map<string, Buffer>;
  loadErrors: string[];
}

const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const ITEM_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const QUESTION_TYPES = new Set([
  "single-choice",
  "multi-select",
  "fill-blank",
  "ordering",
  "matching",
  "code-output",
  "code-completion",
]);
const IMAGE_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);
const REGISTERED_DIAGRAM_TYPES = new Set<string>();

const posix = (path: string) => path.split(sep).join("/");
const shown = (root: string, path: string) =>
  `content/${posix(relative(root, path))}`;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

async function walk(
  root: string,
  directory: string,
  files: Map<string, Buffer>,
  errors: string[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    errors.push(
      `${shown(root, directory)}: 디렉터리를 읽을 수 없습니다: ${String(error)}`,
    );
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    const path = posix(relative(root, absolute));
    if (entry.isSymbolicLink())
      errors.push(`content/${path}: symlink는 허용하지 않습니다.`);
    else if (entry.isDirectory()) await walk(root, absolute, files, errors);
    else if (entry.isFile()) files.set(path, await readFile(absolute));
  }
}

function yaml<T>(
  root: string,
  path: string,
  files: Map<string, Buffer>,
  errors: string[],
): SourceFile<T> {
  const relativePath = posix(relative(root, path));
  const bytes = files.get(relativePath);
  if (!bytes) {
    errors.push(`content/${relativePath}: 필수 파일이 없습니다.`);
    return { path, relativePath, value: {} as T };
  }
  try {
    return { path, relativePath, value: parse(bytes.toString("utf8")) as T };
  } catch (error) {
    errors.push(`content/${relativePath}: YAML 문법 오류: ${String(error)}`);
    return { path, relativePath, value: {} as T };
  }
}

export async function loadSourceContent(
  projectRoot = process.cwd(),
): Promise<SourceContentBundle> {
  const root = resolve(projectRoot);
  const contentRoot = join(root, "content");
  const files = new Map<string, Buffer>();
  const loadErrors: string[] = [];
  await walk(contentRoot, contentRoot, files, loadErrors);
  const tracksFile = yaml<{ schemaVersion: 1; tracks: SourceTrack[] }>(
    contentRoot,
    join(contentRoot, "curriculum", "tracks.yaml"),
    files,
    loadErrors,
  );
  const graphFile = yaml<{ schemaVersion: 1; nodes: SourceGraphNode[] }>(
    contentRoot,
    join(contentRoot, "curriculum", "graph.yaml"),
    files,
    loadErrors,
  );
  const directories = new Set<string>();
  for (const file of files.keys()) {
    const match = /^lessons\/([^/]+)\/lesson\.yaml$/.exec(file);
    if (match) directories.add(match[1]);
  }
  const lessons: SourceLessonEntry[] = [];
  for (const directory of [...directories].sort()) {
    const directoryPath = join(contentRoot, "lessons", directory);
    const lessonFile = yaml<SourceLesson>(
      contentRoot,
      join(directoryPath, "lesson.yaml"),
      files,
      loadErrors,
    );
    const questionPrefix = `lessons/${directory}/questions/`;
    const questions = [...files.keys()]
      .filter(
        (file) => file.startsWith(questionPrefix) && file.endsWith(".yaml"),
      )
      .sort()
      .map((file) =>
        yaml<SourceQuestion>(
          contentRoot,
          join(contentRoot, ...file.split("/")),
          files,
          loadErrors,
        ),
      );
    const contentPrefix = `lessons/${directory}/content/`;
    const content = [...files.entries()]
      .filter(
        ([file]) => file.startsWith(contentPrefix) && file.endsWith(".md"),
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, bytes]) => ({
        path: join(contentRoot, ...file.split("/")),
        relativePath: file,
        ref: file.slice(`lessons/${directory}/`.length),
        markdown: bytes.toString("utf8"),
      }));
    lessons.push({ directory, directoryPath, lessonFile, questions, content });
  }
  for (const file of files.keys()) {
    if (/^lessons\/[^/]+\/questions\.yaml$/.test(file))
      loadErrors.push(
        `content/${file}: questions/*.yaml 개별 파일을 사용해야 합니다.`,
      );
    const match =
      /^lessons\/([^/]+)\/(?:questions\/.*\.yaml|content\/.*\.md)$/.exec(file);
    if (match && !directories.has(match[1]))
      loadErrors.push(
        `content/${file}: 같은 디렉터리에 lesson.yaml이 없습니다.`,
      );
  }
  return {
    projectRoot: root,
    contentRoot,
    tracksFile,
    graphFile,
    lessons,
    files,
    loadErrors,
  };
}

function fields(
  value: Record<string, unknown>,
  allowed: string[],
  required: string[],
  at: string,
  errors: string[],
): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      errors.push(`${at}.${key}: 정의되지 않은 필드입니다.`);
  for (const key of required)
    if (!(key in value)) errors.push(`${at}.${key}: 필수 필드가 없습니다.`);
}
function id(
  value: unknown,
  at: string,
  errors: string[],
  item = false,
): value is string {
  if (!text(value) || !(item ? ITEM_ID : ID).test(value)) {
    errors.push(`${at}: 올바른 ID 형식이 아닙니다.`);
    return false;
  }
  return true;
}
function revision(value: unknown, at: string, errors: string[]): void {
  if (!Number.isInteger(value) || (value as number) < 1)
    errors.push(`${at}: 1 이상의 정수여야 합니다.`);
}
function schema(value: unknown, at: string, errors: string[]): void {
  if (value !== CONTENT_SCHEMA_VERSION)
    errors.push(
      `${at}: 지원하는 schemaVersion은 ${CONTENT_SCHEMA_VERSION}입니다.`,
    );
}
function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  return [
    ...new Set(values.filter((value) => seen.has(value) || !seen.add(value))),
  ];
}
function strings(
  value: unknown,
  at: string,
  errors: string[],
  options: { required?: boolean; ids?: boolean; empty?: boolean } = {},
): value is string[] {
  if (!Array.isArray(value) || (options.required && value.length === 0)) {
    errors.push(
      `${at}: ${options.required ? "하나 이상의 값을 가진 " : ""}배열이어야 합니다.`,
    );
    return false;
  }
  let valid = true;
  value.forEach((entry, index) => {
    if (
      typeof entry !== "string" ||
      (!options.empty && entry.trim().length === 0)
    ) {
      errors.push(`${at}[${index}]: 문자열이어야 합니다.`);
      valid = false;
    } else if (options.ids && !ITEM_ID.test(entry)) {
      errors.push(`${at}[${index}]: 올바른 항목 ID가 아닙니다.`);
      valid = false;
    }
  });
  for (const duplicate of duplicateValues(
    value.filter((entry): entry is string => typeof entry === "string"),
  )) {
    errors.push(`${at}: 중복 값 ${duplicate}`);
    valid = false;
  }
  return valid;
}
function reference(from: string, target: string): string | null {
  if (
    !text(target) ||
    target.includes("\\") ||
    target.startsWith("/") ||
    /^[a-z]+:/i.test(target)
  )
    return null;
  const output: string[] = [];
  for (const part of [...from.split("/").slice(0, -1), ...target.split("/")]) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!output.length) return null;
      output.pop();
    } else output.push(part);
  }
  return output.join("/");
}
function asset(
  value: unknown,
  source: string,
  at: string,
  bundle: SourceContentBundle,
  errors: string[],
): void {
  if (!text(value))
    return void errors.push(`${at}: asset 상대 경로가 필요합니다.`);
  const resolved = reference(source, value);
  if (!resolved || !bundle.files.has(resolved))
    return void errors.push(
      `${at}: 존재하지 않거나 허용되지 않은 asset 참조 ${value}`,
    );
  const extension = extname(resolved).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension))
    errors.push(`${at}: 지원하지 않는 image 형식 ${extension}`);
  if (extension === ".svg") {
    const svg = bundle.files.get(resolved)?.toString("utf8") ?? "";
    if (
      /<script\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:|\/\/)/i.test(
        svg,
      )
    )
      errors.push(`${at}: 안전하지 않은 SVG입니다.`);
  }
}

function blocks(
  value: unknown,
  source: string,
  at: string,
  bundle: SourceContentBundle,
  errors: string[],
): value is ContentBlock[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${at}: 하나 이상의 Content Block이 필요합니다.`);
    return false;
  }
  value.forEach((block, index) => {
    const here = `${at}[${index}]`;
    if (!object(block) || typeof block.type !== "string")
      return void errors.push(
        `${here}: Content Block 객체와 type이 필요합니다.`,
      );
    if (block.type === "text") {
      fields(block, ["type", "text"], ["type", "text"], here, errors);
      if (!text(block.text))
        errors.push(`${here}.text: 비어 있지 않은 문자열이어야 합니다.`);
    } else if (block.type === "markdown") {
      fields(block, ["type", "markdown"], ["type", "markdown"], here, errors);
      if (!text(block.markdown))
        errors.push(`${here}.markdown: 비어 있지 않은 문자열이어야 합니다.`);
      if (
        typeof block.markdown === "string" &&
        /<\/?[a-z][^>]*>/i.test(block.markdown)
      )
        errors.push(`${here}.markdown: raw HTML은 허용하지 않습니다.`);
      if (typeof block.markdown === "string") {
        for (const link of getMarkdownReferences(block.markdown)) {
          if (/^javascript:/i.test(link.target))
            errors.push(
              `${here}.markdown: javascript URL은 허용하지 않습니다.`,
            );
          if (link.image) {
            if (/^(?:https?:)?\/\//i.test(link.target))
              errors.push(`${here}.markdown: 외부 image는 허용하지 않습니다.`);
            else asset(link.target, source, `${here}.markdown`, bundle, errors);
          }
        }
      }
    } else if (block.type === "code") {
      fields(
        block,
        ["type", "language", "code"],
        ["type", "language", "code"],
        here,
        errors,
      );
      if (!text(block.language) || !/^[a-z0-9-]+$/.test(block.language))
        errors.push(`${here}.language: 올바른 language ID가 아닙니다.`);
      if (!text(block.code))
        errors.push(`${here}.code: 비어 있지 않은 문자열이어야 합니다.`);
    } else if (block.type === "image") {
      fields(
        block,
        ["type", "src", "alt"],
        ["type", "src", "alt"],
        here,
        errors,
      );
      if (!text(block.alt))
        errors.push(`${here}.alt: 대체 텍스트가 필요합니다.`);
      asset(block.src, source, `${here}.src`, bundle, errors);
    } else if (block.type === "diagram") {
      fields(
        block,
        ["type", "diagramType", "data", "alt"],
        ["type", "diagramType", "data", "alt"],
        here,
        errors,
      );
      if (!text(block.alt))
        errors.push(`${here}.alt: 대체 텍스트가 필요합니다.`);
      if (
        !text(block.diagramType) ||
        !REGISTERED_DIAGRAM_TYPES.has(block.diagramType)
      )
        errors.push(`${here}.diagramType: 등록되지 않은 diagram type입니다.`);
    } else
      errors.push(`${here}.type: 알 수 없는 Content Block type ${block.type}`);
  });
  return true;
}
function items(
  value: unknown,
  source: string,
  at: string,
  bundle: SourceContentBundle,
  errors: string[],
): string[] {
  if (!Array.isArray(value) || value.length < 2) {
    errors.push(`${at}: 두 개 이상의 항목이 필요합니다.`);
    return [];
  }
  const ids: string[] = [];
  value.forEach((entry, index) => {
    const here = `${at}[${index}]`;
    if (!object(entry)) return void errors.push(`${here}: 객체여야 합니다.`);
    fields(entry, ["id", "content"], ["id", "content"], here, errors);
    if (id(entry.id, `${here}.id`, errors, true)) ids.push(entry.id);
    blocks(entry.content, source, `${here}.content`, bundle, errors);
  });
  for (const duplicate of duplicateValues(ids))
    errors.push(`${at}: 중복 ID ${duplicate}`);
  return ids;
}
const normalizeAnswer = (value: string) =>
  value.replace(/\r\n?/g, "\n").trim().replace(/\s+/gu, " ").normalize("NFC");
const normalizeOutput = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "")
    .normalize("NFC");
function choices(
  value: unknown,
  at: string,
  errors: string[],
  empty: boolean,
  normalize: (value: string) => string,
): string[] {
  if (!Array.isArray(value) || value.length < 2) {
    errors.push(`${at}: 정규화 가능한 선택지가 최소 2개 필요합니다.`);
    return [];
  }
  const normalized: string[] = [];
  value.forEach((choice, index) => {
    if (typeof choice !== "string") {
      errors.push(`${at}[${index}]: 문자열이어야 합니다.`);
      return;
    }
    const answer = normalize(choice);
    if (!empty && !answer)
      errors.push(`${at}[${index}]: 정규화 후 빈 선택지는 허용하지 않습니다.`);
    normalized.push(answer);
  });
  for (const duplicate of duplicateValues(normalized)) {
    errors.push(`${at}: 정규화 후 중복 선택지 ${JSON.stringify(duplicate)}`);
  }
  return normalized;
}
function accepted(
  value: unknown,
  at: string,
  errors: string[],
  empty: boolean,
  normalize: (value: string) => string,
): string[] {
  if (!strings(value, at, errors, { required: true, empty })) return [];
  const values = (value as string[]).map(normalize);
  if (!empty && values.some((answer) => !answer))
    errors.push(`${at}: 정규화 후 빈 답안은 허용하지 않습니다.`);
  for (const duplicate of duplicateValues(values))
    errors.push(`${at}: 정규화 후 중복 답안 ${JSON.stringify(duplicate)}`);
  return values;
}

const commonFields = [
  "schemaVersion",
  "id",
  "revision",
  "type",
  "prompt",
  "explanation",
  "tags",
  "difficulty",
];
const fieldsByType: Record<string, string[]> = {
  "single-choice": ["options", "correctOptionId", "shuffleOptions"],
  "multi-select": ["options", "correctOptionIds", "shuffleOptions"],
  "fill-blank": ["choices", "acceptedAnswers"],
  ordering: ["items", "correctOrder"],
  matching: ["leftItems", "rightItems", "correctPairs"],
  "code-output": ["language", "code", "choices", "acceptedOutputs"],
  "code-completion": ["language", "template", "blanks"],
};
const requiredByType: Record<string, string[]> = {
  "single-choice": ["options", "correctOptionId"],
  "multi-select": ["options", "correctOptionIds"],
  "fill-blank": ["choices", "acceptedAnswers"],
  ordering: ["items", "correctOrder"],
  matching: ["leftItems", "rightItems", "correctPairs"],
  "code-output": ["language", "code", "choices", "acceptedOutputs"],
  "code-completion": ["language", "template", "blanks"],
};

function question(
  file: SourceFile<SourceQuestion>,
  lessonId: string,
  bundle: SourceContentBundle,
  errors: string[],
): void {
  const value = file.value;
  const at = `content/${file.relativePath}`;
  if (!object(value))
    return void errors.push(`${at}: question은 객체여야 합니다.`);
  const type = typeof value.type === "string" ? value.type : "";
  fields(
    value,
    [...commonFields, ...(fieldsByType[type] ?? [])],
    [
      "schemaVersion",
      "id",
      "revision",
      "type",
      "prompt",
      ...(requiredByType[type] ?? []),
    ],
    at,
    errors,
  );
  schema(value.schemaVersion, `${at}.schemaVersion`, errors);
  if (id(value.id, `${at}.id`, errors)) {
    if (!value.id.startsWith(`${lessonId}.`))
      errors.push(`${at}.id: ${lessonId}. prefix가 필요합니다.`);
    if (file.relativePath.split("/").at(-1) !== `${value.id}.yaml`)
      errors.push(`${at}: 파일명은 ${value.id}.yaml이어야 합니다.`);
  }
  revision(value.revision, `${at}.revision`, errors);
  if (!QUESTION_TYPES.has(type))
    errors.push(`${at}.type: 알 수 없는 question type ${String(value.type)}`);
  blocks(value.prompt, file.relativePath, `${at}.prompt`, bundle, errors);
  if (value.explanation !== undefined)
    blocks(
      value.explanation,
      file.relativePath,
      `${at}.explanation`,
      bundle,
      errors,
    );
  if (value.tags !== undefined)
    strings(value.tags, `${at}.tags`, errors, { ids: true });
  if (
    value.difficulty !== undefined &&
    (!Number.isInteger(value.difficulty) ||
      (value.difficulty as number) < 1 ||
      (value.difficulty as number) > 5)
  )
    errors.push(`${at}.difficulty: 1 ~ 5 정수여야 합니다.`);

  if (type === "single-choice" || type === "multi-select") {
    const optionIds = items(
      value.options,
      file.relativePath,
      `${at}.options`,
      bundle,
      errors,
    );
    if (
      value.shuffleOptions !== undefined &&
      typeof value.shuffleOptions !== "boolean"
    )
      errors.push(`${at}.shuffleOptions: boolean이어야 합니다.`);
    if (type === "single-choice") {
      if (
        typeof value.correctOptionId !== "string" ||
        !optionIds.includes(value.correctOptionId)
      )
        errors.push(`${at}.correctOptionId: 존재하는 option ID여야 합니다.`);
    } else if (
      strings(value.correctOptionIds, `${at}.correctOptionIds`, errors, {
        required: true,
        ids: true,
      })
    ) {
      const correct = value.correctOptionIds as string[];
      for (const optionId of correct)
        if (!optionIds.includes(optionId))
          errors.push(
            `${at}.correctOptionIds: 존재하지 않는 option ID ${optionId}`,
          );
      if (correct.length === optionIds.length)
        errors.push(
          `${at}.correctOptionIds: 모든 option을 정답으로 지정할 수 없습니다.`,
        );
    }
  } else if (type === "fill-blank") {
    const choicesAt = `${at}.choices`;
    const normalizedChoices = choices(
      value.choices,
      choicesAt,
      errors,
      false,
      normalizeAnswer,
    );
    const normalizedAnswers = accepted(
      value.acceptedAnswers,
      `${at}.acceptedAnswers`,
      errors,
      false,
      normalizeAnswer,
    );
    for (const answer of normalizedAnswers)
      if (!normalizedChoices.includes(answer))
        errors.push(
          `${at}.acceptedAnswers: 모든 값이 choices에 포함되어야 합니다.`,
        );
  } else if (type === "ordering") {
    const itemIds = items(
      value.items,
      file.relativePath,
      `${at}.items`,
      bundle,
      errors,
    );
    if (
      strings(value.correctOrder, `${at}.correctOrder`, errors, {
        required: true,
        ids: true,
      })
    ) {
      const order = value.correctOrder as string[];
      if (
        order.length !== itemIds.length ||
        order.some((entry) => !itemIds.includes(entry))
      )
        errors.push(
          `${at}.correctOrder: 모든 item ID를 정확히 한 번 포함해야 합니다.`,
        );
    }
  } else if (type === "matching") {
    const left = items(
      value.leftItems,
      file.relativePath,
      `${at}.leftItems`,
      bundle,
      errors,
    );
    const right = items(
      value.rightItems,
      file.relativePath,
      `${at}.rightItems`,
      bundle,
      errors,
    );
    if (left.length !== right.length)
      errors.push(`${at}: leftItems와 rightItems 크기가 같아야 합니다.`);
    const overlap = left.filter((entry) => right.includes(entry));
    if (overlap.length)
      errors.push(`${at}: left/right item ID 중복 ${overlap.join(", ")}`);
    if (!Array.isArray(value.correctPairs))
      errors.push(`${at}.correctPairs: 배열이어야 합니다.`);
    else {
      const usedLeft: string[] = [],
        usedRight: string[] = [];
      value.correctPairs.forEach((pair, index) => {
        const here = `${at}.correctPairs[${index}]`;
        if (!object(pair)) return void errors.push(`${here}: 객체여야 합니다.`);
        fields(
          pair,
          ["leftId", "rightId"],
          ["leftId", "rightId"],
          here,
          errors,
        );
        if (typeof pair.leftId === "string") usedLeft.push(pair.leftId);
        if (typeof pair.rightId === "string") usedRight.push(pair.rightId);
      });
      if (
        usedLeft.length !== left.length ||
        duplicateValues(usedLeft).length ||
        usedLeft.some((entry) => !left.includes(entry))
      )
        errors.push(
          `${at}.correctPairs: 모든 left ID를 정확히 한 번 사용해야 합니다.`,
        );
      if (
        usedRight.length !== right.length ||
        duplicateValues(usedRight).length ||
        usedRight.some((entry) => !right.includes(entry))
      )
        errors.push(
          `${at}.correctPairs: 모든 right ID를 정확히 한 번 사용해야 합니다.`,
        );
    }
  } else if (type === "code-output") {
    if (value.language !== "python")
      errors.push(`${at}.language: v1은 python만 허용합니다.`);
    if (!text(value.code)) errors.push(`${at}.code: 문자열이어야 합니다.`);
    const normalizedChoices = choices(
      value.choices,
      `${at}.choices`,
      errors,
      true,
      normalizeOutput,
    );
    const normalizedOutputs = accepted(
      value.acceptedOutputs,
      `${at}.acceptedOutputs`,
      errors,
      true,
      normalizeOutput,
    );
    for (const output of normalizedOutputs)
      if (!normalizedChoices.includes(output))
        errors.push(
          `${at}.acceptedOutputs: 모든 값이 choices에 포함되어야 합니다.`,
        );
  } else if (type === "code-completion") {
    if (value.language !== "python")
      errors.push(`${at}.language: v1은 python만 허용합니다.`);
    if (!text(value.template))
      errors.push(`${at}.template: 문자열이어야 합니다.`);
    const placeholders =
      typeof value.template === "string"
        ? [
            ...value.template.matchAll(
              /\{\{blank:([a-z0-9]+(?:-[a-z0-9]+)*)\}\}/g,
            ),
          ].map((match) => match[1])
        : [];
    const blankIds: string[] = [];
    if (!Array.isArray(value.blanks) || !value.blanks.length)
      errors.push(`${at}.blanks: 하나 이상의 blank가 필요합니다.`);
    else
      value.blanks.forEach((blank, index) => {
        const here = `${at}.blanks[${index}]`;
        if (!object(blank))
          return void errors.push(`${here}: 객체여야 합니다.`);
        fields(
          blank,
          ["id", "choices", "acceptedAnswers"],
          ["id", "choices", "acceptedAnswers"],
          here,
          errors,
        );
        if (id(blank.id, `${here}.id`, errors, true)) blankIds.push(blank.id);
        const normalizedChoices = choices(
          blank.choices,
          `${here}.choices`,
          errors,
          false,
          normalizeAnswer,
        );
        const normalizedAnswers = accepted(
          blank.acceptedAnswers,
          `${here}.acceptedAnswers`,
          errors,
          false,
          normalizeAnswer,
        );
        for (const answer of normalizedAnswers)
          if (!normalizedChoices.includes(answer))
            errors.push(
              `${here}.acceptedAnswers: 모든 값이 choices에 포함되어야 합니다.`,
            );
      });
    if (
      !placeholders.length ||
      duplicateValues(blankIds).length ||
      placeholders.length !== blankIds.length ||
      placeholders.some((entry) => !blankIds.includes(entry)) ||
      blankIds.some((entry) => !placeholders.includes(entry))
    )
      errors.push(
        `${at}: placeholder와 blanks가 ID별로 정확히 한 번 대응해야 합니다.`,
      );
  }
}

export function getMarkdownReferences(
  markdown: string,
): Array<{ image: boolean; target: string }> {
  const output: Array<{ image: boolean; target: string }> = [];
  let fenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const match of line.matchAll(
      /(!?)\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g,
    ))
      output.push({ image: match[1] === "!", target: match[2] });
  }
  return output;
}
function markdown(
  file: MarkdownSourceFile,
  bundle: SourceContentBundle,
  errors: string[],
): void {
  const at = `content/${file.relativePath}`;
  if (/^---\r?\n/.test(file.markdown))
    errors.push(`${at}: YAML front matter는 허용하지 않습니다.`);
  let fenced = false;
  file.markdown.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (!fenced && /<\/?[a-z][^>]*>/i.test(line))
      errors.push(`${at}:${index + 1}: raw HTML은 허용하지 않습니다.`);
  });
  for (const link of getMarkdownReferences(file.markdown)) {
    if (/^javascript:/i.test(link.target))
      errors.push(`${at}: javascript URL은 허용하지 않습니다.`);
    if (link.image) {
      if (/^(?:https?:)?\/\//i.test(link.target))
        errors.push(`${at}: 외부 image는 허용하지 않습니다.`);
      else asset(link.target, file.relativePath, at, bundle, errors);
    }
  }
}

export function getValidationErrors(bundle: SourceContentBundle): string[] {
  const errors = [...bundle.loadErrors];
  const tracks = bundle.tracksFile.value,
    tracksAt = `content/${bundle.tracksFile.relativePath}`,
    trackIds: string[] = [];
  if (!object(tracks)) errors.push(`${tracksAt}: 객체여야 합니다.`);
  else {
    fields(
      tracks,
      ["schemaVersion", "tracks"],
      ["schemaVersion", "tracks"],
      tracksAt,
      errors,
    );
    schema(tracks.schemaVersion, `${tracksAt}.schemaVersion`, errors);
    if (!Array.isArray(tracks.tracks) || !tracks.tracks.length)
      errors.push(`${tracksAt}.tracks: 하나 이상의 track이 필요합니다.`);
    else
      tracks.tracks.forEach((track, index) => {
        const at = `${tracksAt}.tracks[${index}]`;
        if (!object(track)) return void errors.push(`${at}: 객체여야 합니다.`);
        fields(
          track,
          ["id", "revision", "title", "description", "order"],
          ["id", "revision", "title", "description", "order"],
          at,
          errors,
        );
        if (id(track.id, `${at}.id`, errors)) trackIds.push(track.id);
        revision(track.revision, `${at}.revision`, errors);
        if (!text(track.title))
          errors.push(`${at}.title: 문자열이어야 합니다.`);
        if (!text(track.description))
          errors.push(`${at}.description: 문자열이어야 합니다.`);
        if (!Number.isInteger(track.order) || (track.order as number) < 0)
          errors.push(`${at}.order: 0 이상의 정수여야 합니다.`);
      });
  }
  for (const duplicate of duplicateValues(trackIds))
    errors.push(`${tracksAt}: 중복 track ID ${duplicate}`);

  const lessonIds: string[] = [],
    questionIds: string[] = [];
  for (const entry of bundle.lessons) {
    const lesson = entry.lessonFile.value,
      at = `content/${entry.lessonFile.relativePath}`;
    if (!object(lesson)) {
      errors.push(`${at}: lesson은 객체여야 합니다.`);
      continue;
    }
    fields(
      lesson,
      [
        "schemaVersion",
        "id",
        "revision",
        "track",
        "title",
        "description",
        "flow",
      ],
      [
        "schemaVersion",
        "id",
        "revision",
        "track",
        "title",
        "description",
        "flow",
      ],
      at,
      errors,
    );
    schema(lesson.schemaVersion, `${at}.schemaVersion`, errors);
    if (id(lesson.id, `${at}.id`, errors)) {
      lessonIds.push(lesson.id);
      if (lesson.id !== entry.directory)
        errors.push(
          `${at}.id: 디렉터리 이름 ${entry.directory}와 같아야 합니다.`,
        );
    }
    revision(lesson.revision, `${at}.revision`, errors);
    if (typeof lesson.track !== "string" || !trackIds.includes(lesson.track))
      errors.push(`${at}.track: 존재하는 track ID여야 합니다.`);
    if (!text(lesson.title)) errors.push(`${at}.title: 문자열이어야 합니다.`);
    if (!text(lesson.description))
      errors.push(`${at}.description: 문자열이어야 합니다.`);
    const contentRefs = new Set(entry.content.map((file) => file.ref));
    const localQuestions = entry.questions
      .map((file) =>
        object(file.value) && typeof file.value.id === "string"
          ? file.value.id
          : "",
      )
      .filter(Boolean);
    const seen = new Set<string>(),
      flowQuestions: string[] = [];
    if (!Array.isArray(lesson.flow) || !lesson.flow.length)
      errors.push(`${at}.flow: 하나 이상의 항목이 필요합니다.`);
    else
      lesson.flow.forEach((flow, index) => {
        const here = `${at}.flow[${index}]`;
        if (!object(flow)) return void errors.push(`${here}: 객체여야 합니다.`);
        fields(flow, ["type", "ref"], ["type", "ref"], here, errors);
        if (
          (flow.type !== "content" && flow.type !== "question") ||
          !text(flow.ref)
        )
          return void errors.push(`${here}: 올바른 type과 ref가 필요합니다.`);
        const key = `${flow.type}:${flow.ref}`;
        if (seen.has(key)) errors.push(`${here}: 중복 flow 참조입니다.`);
        seen.add(key);
        if (flow.type === "content") {
          if (
            !/^content\/[^/]+\.md$/.test(flow.ref) ||
            !contentRefs.has(flow.ref)
          )
            errors.push(
              `${here}.ref: 같은 lesson의 content/*.md 파일이어야 합니다.`,
            );
        } else {
          flowQuestions.push(flow.ref);
          if (!localQuestions.includes(flow.ref))
            errors.push(`${here}.ref: 같은 lesson의 question ID여야 합니다.`);
        }
      });
    for (const questionId of localQuestions)
      if (!flowQuestions.includes(questionId))
        errors.push(
          `${at}.flow: question ${questionId}을 정확히 한 번 참조해야 합니다.`,
        );
    for (const file of entry.questions) {
      question(
        file,
        typeof lesson.id === "string" ? lesson.id : entry.directory,
        bundle,
        errors,
      );
      if (object(file.value) && typeof file.value.id === "string")
        questionIds.push(file.value.id);
    }
    for (const file of entry.content) markdown(file, bundle, errors);
  }
  for (const duplicate of duplicateValues(lessonIds))
    errors.push(`중복 lesson ID ${duplicate}`);
  for (const duplicate of duplicateValues(questionIds))
    errors.push(`중복 question ID ${duplicate}`);

  const graph = bundle.graphFile.value,
    graphAt = `content/${bundle.graphFile.relativePath}`,
    nodes = new Map<string, string[]>();
  if (!object(graph)) errors.push(`${graphAt}: 객체여야 합니다.`);
  else {
    fields(
      graph,
      ["schemaVersion", "nodes"],
      ["schemaVersion", "nodes"],
      graphAt,
      errors,
    );
    schema(graph.schemaVersion, `${graphAt}.schemaVersion`, errors);
    if (!Array.isArray(graph.nodes))
      errors.push(`${graphAt}.nodes: 배열이어야 합니다.`);
    else
      graph.nodes.forEach((node, index) => {
        const at = `${graphAt}.nodes[${index}]`;
        if (!object(node)) return void errors.push(`${at}: 객체여야 합니다.`);
        fields(
          node,
          ["lesson", "requires"],
          ["lesson", "requires"],
          at,
          errors,
        );
        if (typeof node.lesson !== "string" || !lessonIds.includes(node.lesson))
          errors.push(`${at}.lesson: 존재하는 lesson ID여야 합니다.`);
        if (typeof node.lesson === "string") {
          if (nodes.has(node.lesson))
            errors.push(`${at}.lesson: graph node가 중복되었습니다.`);
          const requires = strings(node.requires, `${at}.requires`, errors)
            ? (node.requires as string[])
            : [];
          nodes.set(node.lesson, requires);
          for (const required of requires) {
            if (!lessonIds.includes(required))
              errors.push(`${at}.requires: 존재하지 않는 lesson ${required}`);
            if (required === node.lesson)
              errors.push(`${at}.requires: 자기 자신을 참조할 수 없습니다.`);
          }
        }
      });
  }
  for (const lessonId of lessonIds)
    if (!nodes.has(lessonId))
      errors.push(`${graphAt}: lesson ${lessonId}의 node가 없습니다.`);
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (lessonId: string): void => {
    if (visiting.has(lessonId)) {
      errors.push(`${graphAt}: curriculum graph cycle ${lessonId}`);
      return;
    }
    if (visited.has(lessonId)) return;
    visiting.add(lessonId);
    for (const required of nodes.get(lessonId) ?? []) visit(required);
    visiting.delete(lessonId);
    visited.add(lessonId);
  };
  for (const lessonId of lessonIds) visit(lessonId);
  return [...new Set(errors)];
}

export function computeBuildId(bundle: SourceContentBundle): string {
  const hash = createHash("sha256");
  hash.update(
    `content-schema:${CONTENT_SCHEMA_VERSION}\nbuilder:${CONTENT_BUILDER_VERSION}\n`,
  );
  for (const [path, bytes] of [...bundle.files.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    hash.update(`${path}\0`);
    hash.update(bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}
export const sourceAssetPath = (source: string, target: string) =>
  reference(source, target);
