import { compileMarkdown } from "./markdown";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  computeBuildId,
  getMarkdownReferences,
  getValidationErrors,
  loadSourceContent,
  sourceAssetPath,
  type ContentBlock,
  type SourceContentBundle,
} from "./model";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, stable(entry)]),
    );
  }
  return value;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(stable(value), null, 2)}\n`, "utf8");
}

const publicAssetPath = (path: string) => `/generated/assets/${path}`;

function transformMarkdown(
  markdown: string,
  source: string,
  assets: Set<string>,
): string {
  let result = markdown;
  for (const reference of getMarkdownReferences(markdown)) {
    if (!reference.image) continue;
    const resolved = sourceAssetPath(source, reference.target);
    if (!resolved) continue;
    assets.add(resolved);
    result = result.replaceAll(
      `](${reference.target})`,
      `](${publicAssetPath(resolved)})`,
    );
  }
  return result;
}

function transformBlocks(
  blocks: ContentBlock[],
  source: string,
  assets: Set<string>,
): ContentBlock[] {
  return blocks.map((block) => {
    if (block.type === "image") {
      const resolved = sourceAssetPath(source, block.src)!;
      assets.add(resolved);
      return { ...block, src: publicAssetPath(resolved) };
    }
    if (block.type === "markdown")
      return {
        ...block,
        markdown: transformMarkdown(block.markdown, source, assets),
        html: compileMarkdown(transformMarkdown(block.markdown, source, assets)),
      };
    return block;
  });
}

function transformQuestion(
  question: Record<string, unknown>,
  source: string,
  lessonId: string,
  assets: Set<string>,
): Record<string, unknown> {
  const result = structuredClone(question);
  result.lessonId = lessonId;
  if (result.type === "single-choice" || result.type === "multi-select")
    result.shuffleOptions ??= false;
  for (const field of ["prompt", "explanation"] as const) {
    if (Array.isArray(result[field]))
      result[field] = transformBlocks(
        result[field] as ContentBlock[],
        source,
        assets,
      );
  }
  for (const field of [
    "options",
    "items",
    "leftItems",
    "rightItems",
  ] as const) {
    if (!Array.isArray(result[field])) continue;
    result[field] = (result[field] as Array<Record<string, unknown>>).map(
      (item) => ({
        ...item,
        content: transformBlocks(
          item.content as ContentBlock[],
          source,
          assets,
        ),
      }),
    );
  }
  return result;
}

export function compileContent(bundle: SourceContentBundle) {
  const errors = getValidationErrors(bundle);
  if (errors.length)
    throw new Error(
      `콘텐츠 검증 실패 (${errors.length}건)\n${errors.join("\n")}`,
    );
  const assets = new Set<string>();
  const lessons = new Map<string, unknown>();
  const questions = new Map<string, unknown>();
  for (const entry of bundle.lessons) {
    const lesson = entry.lessonFile.value;
    const markdownByRef = new Map(
      entry.content.map((file) => [file.ref, file]),
    );
    lessons.set(lesson.id, {
      ...lesson,
      flow: lesson.flow.map((item) => {
        if (item.type === "question") return item;
        const file = markdownByRef.get(item.ref)!;
        return {
          type: "content",
          blocks: [
            {
              type: "markdown",
              html: compileMarkdown(transformMarkdown(file.markdown, file.relativePath, assets)),
              markdown: transformMarkdown(
                file.markdown,
                file.relativePath,
                assets,
              ),
            },
          ],
        };
      }),
    });
    for (const file of entry.questions)
      questions.set(
        file.value.id,
        transformQuestion(file.value, file.relativePath, lesson.id, assets),
      );
  }
  const manifest = {
    schemaVersion: 1,
    buildId: computeBuildId(bundle),
    generatedAt: new Date().toISOString(),
    tracks: bundle.tracksFile.value.tracks.map((track) => track.id).sort(),
    lessons: [...lessons.keys()].sort(),
    questions: [...questions.keys()].sort(),
  };
  return {
    curriculum: {
      schemaVersion: 1,
      tracks: bundle.tracksFile.value.tracks,
      nodes: bundle.graphFile.value.nodes,
    },
    lessons,
    questions,
    manifest,
    assets,
  };
}

export async function buildContent(
  projectRoot: string,
): Promise<{ buildId: string; lessonCount: number; questionCount: number }> {
  const bundle = await loadSourceContent(projectRoot);
  const compiled = compileContent(bundle);
  const output = join(projectRoot, "generated");
  const publicOutput = join(projectRoot, "static", "generated");
  await rm(output, { recursive: true, force: true });
  await rm(publicOutput, { recursive: true, force: true });
  await writeJson(join(output, "curriculum.json"), compiled.curriculum);
  for (const [id, lesson] of compiled.lessons)
    await writeJson(join(output, "lessons", `${id}.json`), lesson);
  for (const [id, question] of compiled.questions)
    await writeJson(join(output, "questions", `${id}.json`), question);
  await writeJson(join(output, "manifest.json"), compiled.manifest);
  for (const asset of [...compiled.assets].sort()) {
    const destination = join(output, "assets", ...asset.split("/"));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bundle.files.get(asset)!);
  }
  await cp(output, publicOutput, { recursive: true });
  return {
    buildId: compiled.manifest.buildId,
    lessonCount: compiled.lessons.size,
    questionCount: compiled.questions.size,
  };
}
