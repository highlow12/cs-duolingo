import { buildContent } from "./compiler";

const result = await buildContent(process.cwd());
console.log(
  `콘텐츠 빌드 완료: ${result.lessonCount} lessons, ${result.questionCount} questions (${result.buildId})`,
);
