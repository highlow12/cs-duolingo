import { getValidationErrors, loadSourceContent } from "./model";

const bundle = await loadSourceContent();
const errors = getValidationErrors(bundle);

if (errors.length > 0) {
  console.error(`콘텐츠 검증 실패 (${errors.length}건)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `콘텐츠 검증 통과: tracks=${bundle.tracks.length}, lessons=${bundle.lessons.length}, questions=${bundle.lessons.reduce((total, lesson) => total + lesson.questions.length, 0)}`,
  );
}
