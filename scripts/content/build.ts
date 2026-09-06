import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getValidationErrors, loadSourceContent } from "./model";

const projectRoot = process.cwd();
const bundle = await loadSourceContent(projectRoot);
const errors = getValidationErrors(bundle);

if (errors.length > 0) {
  console.error(`콘텐츠 빌드 중단: 검증 실패 (${errors.length}건)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const generatedRoot = join(projectRoot, "generated");
const publicRoot = join(projectRoot, "static", "generated");
await rm(generatedRoot, { recursive: true, force: true });
await rm(publicRoot, { recursive: true, force: true });
await mkdir(join(generatedRoot, "lessons"), { recursive: true });
await mkdir(join(generatedRoot, "questions"), { recursive: true });

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const questionIds: string[] = [];
const lessonIds: string[] = [];

await writeJson(join(generatedRoot, "curriculum.json"), {
  tracks: bundle.tracks,
  nodes: bundle.graph,
});

for (const entry of bundle.lessons) {
  const lessonIdsForManifest = entry.lesson.id;
  lessonIds.push(lessonIdsForManifest);
  const compiledLesson = {
    ...entry.lesson,
    content: Object.fromEntries(
      Object.entries(entry.content).map(([id, markdown]) => [
        id,
        [{ type: "markdown", markdown }],
      ]),
    ),
  };
  await writeJson(
    join(generatedRoot, "lessons", `${entry.lesson.id}.json`),
    compiledLesson,
  );

  for (const question of entry.questions) {
    questionIds.push(question.id);
    await writeJson(
      join(generatedRoot, "questions", `${question.id}.json`),
      question,
    );
  }
}

await writeJson(join(generatedRoot, "manifest.json"), {
  schemaVersion: 1,
  buildId: new Date().toISOString(),
  generatedAt: new Date().toISOString(),
  tracks: bundle.tracks.map((track) => track.id),
  lessons: lessonIds,
  questions: questionIds,
});

await cp(generatedRoot, publicRoot, { recursive: true });
console.log(
  `콘텐츠 빌드 완료: ${lessonIds.length} lessons, ${questionIds.length} questions`,
);
