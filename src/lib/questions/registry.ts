import type {
  AnswerOf,
  CanonicalAnswerOf,
  CodeCompletionQuestion,
  CodeOutputQuestion,
  EvaluationError,
  EvaluationOutcome,
  EvaluationResult,
  FillBlankQuestion,
  MatchingQuestion,
  MultiSelectQuestion,
  OrderingQuestion,
  Question,
  QuestionByType,
  QuestionOf,
  QuestionType,
  SingleChoiceQuestion,
  UserAnswer,
  ValidationFailure,
  ValidationResult,
} from "./types";

type AnyQuestionDefinition = {
  [T in QuestionType]: QuestionDefinition<T>;
}[QuestionType];

export interface QuestionDefinition<T extends QuestionType> {
  type: T;
  validateQuestion(value: unknown): ValidationResult<QuestionOf<T>>;
  validateAnswer(
    question: QuestionOf<T>,
    value: unknown,
  ): ValidationResult<AnswerOf<T>>;
  evaluate(question: QuestionOf<T>, answer: AnswerOf<T>): EvaluationResult;
  canonicalAnswer(question: QuestionOf<T>): CanonicalAnswerOf<T>;
}

export interface QuestionPlugin<T extends QuestionType = QuestionType> {
  type: T;
  definition: QuestionDefinition<T>;
}

export type AnyQuestionPlugin = {
  [T in QuestionType]: QuestionPlugin<T>;
}[QuestionType];

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const ITEM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const QUESTION_TYPES = new Set<QuestionType>([
  "single-choice",
  "multi-select",
  "fill-blank",
  "ordering",
  "matching",
  "code-output",
  "code-completion",
]);

const BASE_FIELDS = [
  "schemaVersion",
  "id",
  "lessonId",
  "revision",
  "type",
  "prompt",
  "explanation",
  "tags",
  "difficulty",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function invalid(...errors: string[]): ValidationFailure {
  return { valid: false, errors };
}

function valid<T>(value: T): ValidationResult<T> {
  return { valid: true, value };
}

function unknownFields(
  candidate: Record<string, unknown>,
  allowed: string[],
  path: string,
): string[] {
  return Object.keys(candidate)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${path}.${key}: 정의되지 않은 필드입니다.`);
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function sameMembers(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  );
}

function samePairSet(
  left: Array<{ leftId: string; rightId: string }>,
  right: Array<{ leftId: string; rightId: string }>,
): boolean {
  if (left.length !== right.length) return false;
  const toKey = (pair: { leftId: string; rightId: string }) =>
    `${pair.leftId}\u0000${pair.rightId}`;
  const expected = new Set(right.map(toKey));
  return (
    new Set(left.map(toKey)).size === left.length &&
    left.every((pair) => expected.has(toKey(pair)))
  );
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "")
    .replace(/\p{White_Space}+/gu, " ")
    .normalize("NFC");
}

export function normalizeOutput(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+(?=\n|$)/g, "")
    .replace(/\n+$/g, "")
    .normalize("NFC");
}

export function normalizeAnswer(value: string): string {
  return normalizeWhitespace(value);
}

function validateBlocks(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length === 0)
    return [`${path}: 하나 이상의 Content Block이 필요합니다.`];

  const errors: string[] = [];
  value.forEach((block, index) => {
    const at = `${path}[${index}]`;
    if (!isObject(block)) {
      errors.push(`${at}: 객체여야 합니다.`);
      return;
    }
    if (typeof block.type !== "string") {
      errors.push(`${at}.type: 문자열이어야 합니다.`);
      return;
    }
    if (block.type === "text") {
      errors.push(...unknownFields(block, ["type", "text"], at));
      if (!isNonEmptyString(block.text))
        errors.push(`${at}.text: 비어 있을 수 없습니다.`);
    } else if (block.type === "markdown") {
      errors.push(...unknownFields(block, ["type", "markdown"], at));
      if (!isNonEmptyString(block.markdown))
        errors.push(`${at}.markdown: 비어 있을 수 없습니다.`);
    } else if (block.type === "code") {
      errors.push(...unknownFields(block, ["type", "language", "code"], at));
      if (!isNonEmptyString(block.language) || !/^[a-z]+$/.test(block.language))
        errors.push(`${at}.language: 소문자 식별자여야 합니다.`);
      if (!isNonEmptyString(block.code))
        errors.push(`${at}.code: 비어 있을 수 없습니다.`);
    } else if (block.type === "image") {
      errors.push(...unknownFields(block, ["type", "src", "alt"], at));
      if (!isNonEmptyString(block.src))
        errors.push(`${at}.src: 비어 있을 수 없습니다.`);
      if (!isNonEmptyString(block.alt))
        errors.push(`${at}.alt: 비어 있을 수 없습니다.`);
    } else if (block.type === "diagram") {
      errors.push(
        ...unknownFields(block, ["type", "diagramType", "data", "alt"], at),
      );
      if (!isNonEmptyString(block.diagramType))
        errors.push(`${at}.diagramType: 비어 있을 수 없습니다.`);
      if (!isNonEmptyString(block.alt))
        errors.push(`${at}.alt: 비어 있을 수 없습니다.`);
    } else {
      errors.push(`${at}.type: 지원하지 않는 Content Block입니다.`);
    }
  });
  return errors;
}

function validateBase(
  value: unknown,
  type: QuestionType,
  fields: string[],
): string[] {
  if (!isObject(value)) return ["문제가 객체가 아닙니다."];
  const candidate = value;
  const errors = unknownFields(
    candidate,
    [...BASE_FIELDS, ...fields],
    "question",
  );
  if (candidate.schemaVersion !== 1)
    errors.push("question.schemaVersion: 1이어야 합니다.");
  if (typeof candidate.id !== "string" || !ID_PATTERN.test(candidate.id))
    errors.push("question.id: 올바른 ID 형식이 아닙니다.");
  if (
    typeof candidate.lessonId !== "string" ||
    !ID_PATTERN.test(candidate.lessonId)
  )
    errors.push("question.lessonId: 올바른 ID 형식이 아닙니다.");
  if (
    !Number.isInteger(candidate.revision) ||
    (candidate.revision as number) < 1
  )
    errors.push("question.revision: 1 이상의 정수여야 합니다.");
  if (candidate.type !== type)
    errors.push(`question.type: ${type}이어야 합니다.`);
  errors.push(...validateBlocks(candidate.prompt, "question.prompt"));
  if ("explanation" in candidate && candidate.explanation !== undefined)
    errors.push(
      ...validateBlocks(candidate.explanation, "question.explanation"),
    );
  if ("tags" in candidate) {
    if (!Array.isArray(candidate.tags))
      errors.push("question.tags: 배열이어야 합니다.");
    else {
      const tags = candidate.tags as unknown[];
      tags.forEach((tag, index) => {
        if (typeof tag !== "string" || !ID_PATTERN.test(tag))
          errors.push(`question.tags[${index}]: 올바른 ID여야 합니다.`);
      });
      if (
        duplicateValues(
          tags.filter((tag): tag is string => typeof tag === "string"),
        ).length
      )
        errors.push("question.tags: 중복 값이 있습니다.");
    }
  }
  if (
    "difficulty" in candidate &&
    (!Number.isInteger(candidate.difficulty) ||
      (candidate.difficulty as number) < 1 ||
      (candidate.difficulty as number) > 5)
  )
    errors.push("question.difficulty: 1에서 5 사이의 정수여야 합니다.");
  return errors;
}

function validateChoiceOptions(
  value: unknown,
  path: string,
): { errors: string[]; ids: string[] } {
  if (!Array.isArray(value) || value.length < 2)
    return { errors: [`${path}: 두 개 이상의 항목이 필요합니다.`], ids: [] };
  const errors: string[] = [];
  const ids: string[] = [];
  value.forEach((item, index) => {
    const at = `${path}[${index}]`;
    if (!isObject(item)) {
      errors.push(`${at}: 객체여야 합니다.`);
      return;
    }
    errors.push(...unknownFields(item, ["id", "content"], at));
    if (typeof item.id !== "string" || !ITEM_ID_PATTERN.test(item.id))
      errors.push(`${at}.id: 올바른 항목 ID가 아닙니다.`);
    else ids.push(item.id);
    errors.push(...validateBlocks(item.content, `${at}.content`));
  });
  for (const duplicate of duplicateValues(ids))
    errors.push(`${path}: 중복 ID ${duplicate}`);
  return { errors, ids };
}

function validateStringList(
  value: unknown,
  path: string,
  options: { allowEmpty?: boolean } = {},
): { errors: string[]; values: string[] } {
  if (!Array.isArray(value) || value.length === 0)
    return {
      errors: [`${path}: 하나 이상의 문자열이 필요합니다.`],
      values: [],
    };
  const errors: string[] = [];
  const values: string[] = [];
  value.forEach((item, index) => {
    if (
      typeof item !== "string" ||
      (!options.allowEmpty && normalizeAnswer(item).length === 0)
    )
      errors.push(`${path}[${index}]: 유효한 문자열이어야 합니다.`);
    else values.push(item);
  });
  return { errors, values };
}

function validateChoiceList(
  value: unknown,
  path: string,
  normalize: (value: string) => string,
  options: { allowEmpty?: boolean } = {},
): { errors: string[]; values: string[] } {
  if (!Array.isArray(value) || value.length < 2)
    return {
      errors: [`${path}: 정규화 가능한 선택지가 최소 2개 필요합니다.`],
      values: [],
    };
  const errors: string[] = [];
  const values: string[] = [];
  value.forEach((choice, index) => {
    if (typeof choice !== "string") {
      errors.push(`${path}[${index}]: 문자열이어야 합니다.`);
      return;
    }
    const normalized = normalize(choice);
    if (!options.allowEmpty && normalized.length === 0)
      errors.push(
        `${path}[${index}]: 정규화 후 빈 선택지는 허용하지 않습니다.`,
      );
    values.push(normalized);
  });
  if (duplicateValues(values).length)
    errors.push(`${path}: 정규화 후 중복 선택지가 있습니다.`);
  return { errors, values };
}

function validateSingleChoiceQuestion(
  value: unknown,
): ValidationResult<SingleChoiceQuestion> {
  const errors = validateBase(value, "single-choice", [
    "options",
    "correctOptionId",
    "shuffleOptions",
  ]);
  if (!isObject(value)) return invalid(...errors);
  const options = validateChoiceOptions(value.options, "question.options");
  errors.push(...options.errors);
  if (
    typeof value.correctOptionId !== "string" ||
    !options.ids.includes(value.correctOptionId)
  )
    errors.push("question.correctOptionId: 존재하는 option ID여야 합니다.");
  if (typeof value.shuffleOptions !== "boolean")
    errors.push("question.shuffleOptions: boolean이어야 합니다.");
  return errors.length
    ? invalid(...errors)
    : valid(value as unknown as SingleChoiceQuestion);
}

function validateMultiSelectQuestion(
  value: unknown,
): ValidationResult<MultiSelectQuestion> {
  const errors = validateBase(value, "multi-select", [
    "options",
    "correctOptionIds",
    "shuffleOptions",
  ]);
  if (!isObject(value)) return invalid(...errors);
  const options = validateChoiceOptions(value.options, "question.options");
  errors.push(...options.errors);
  const ids = Array.isArray(value.correctOptionIds)
    ? value.correctOptionIds.filter(
        (id): id is string => typeof id === "string",
      )
    : [];
  if (!Array.isArray(value.correctOptionIds) || ids.length === 0)
    errors.push("question.correctOptionIds: 하나 이상의 ID가 필요합니다.");
  if (duplicateValues(ids).length)
    errors.push("question.correctOptionIds: 중복 ID가 있습니다.");
  if (ids.some((id) => !options.ids.includes(id)))
    errors.push(
      "question.correctOptionIds: 존재하지 않는 option ID가 있습니다.",
    );
  if (ids.length === options.ids.length && options.ids.length > 0)
    errors.push(
      "question.correctOptionIds: 모든 option을 정답으로 지정할 수 없습니다.",
    );
  if (typeof value.shuffleOptions !== "boolean")
    errors.push("question.shuffleOptions: boolean이어야 합니다.");
  return errors.length
    ? invalid(...errors)
    : valid(value as unknown as MultiSelectQuestion);
}

function validateFillBlankQuestion(
  value: unknown,
): ValidationResult<FillBlankQuestion> {
  const errors = validateBase(value, "fill-blank", [
    "choices",
    "acceptedAnswers",
  ]);
  if (!isObject(value)) return invalid(...errors);
  const choices = validateChoiceList(
    value.choices,
    "question.choices",
    normalizeAnswer,
  );
  errors.push(...choices.errors);
  const answers = validateStringList(
    value.acceptedAnswers,
    "question.acceptedAnswers",
  );
  errors.push(...answers.errors);
  const normalized = answers.values.map(normalizeAnswer);
  if (duplicateValues(normalized).length)
    errors.push(
      "question.acceptedAnswers: 정규화 후 중복되는 답안이 있습니다.",
    );
  if (normalized.some((answer) => !choices.values.includes(answer)))
    errors.push(
      "question.acceptedAnswers: 모든 값이 choices에 포함되어야 합니다.",
    );
  return errors.length
    ? invalid(...errors)
    : valid(value as unknown as FillBlankQuestion);
}

function validateOrderingQuestion(
  value: unknown,
): ValidationResult<OrderingQuestion> {
  const errors = validateBase(value, "ordering", ["items", "correctOrder"]);
  if (!isObject(value)) return invalid(...errors);
  const items = validateChoiceOptions(value.items, "question.items");
  errors.push(...items.errors);
  const order = Array.isArray(value.correctOrder)
    ? value.correctOrder.filter((id): id is string => typeof id === "string")
    : [];
  if (!Array.isArray(value.correctOrder) || !sameMembers(order, items.ids))
    errors.push(
      "question.correctOrder: 모든 item ID를 정확히 한 번 포함해야 합니다.",
    );
  return errors.length
    ? invalid(...errors)
    : valid(value as unknown as OrderingQuestion);
}

function validateMatchingQuestion(
  value: unknown,
): ValidationResult<MatchingQuestion> {
  const errors = validateBase(value, "matching", [
    "leftItems",
    "rightItems",
    "correctPairs",
  ]);
  if (!isObject(value)) return invalid(...errors);
  const left = validateChoiceOptions(value.leftItems, "question.leftItems");
  const right = validateChoiceOptions(value.rightItems, "question.rightItems");
  errors.push(...left.errors, ...right.errors);
  if (left.ids.length !== right.ids.length)
    errors.push("question.leftItems와 rightItems: 항목 수가 같아야 합니다.");
  if (
    new Set([...left.ids, ...right.ids]).size !==
    left.ids.length + right.ids.length
  )
    errors.push(
      "question.leftItems와 rightItems: ID가 서로 중복될 수 없습니다.",
    );
  const pairs = Array.isArray(value.correctPairs) ? value.correctPairs : [];
  if (!Array.isArray(value.correctPairs) || pairs.length !== left.ids.length)
    errors.push("question.correctPairs: 모든 항목을 포함해야 합니다.");
  const pairValues: Array<{ leftId: string; rightId: string }> = [];
  pairs.forEach((pair, index) => {
    const at = `question.correctPairs[${index}]`;
    if (!isObject(pair)) {
      errors.push(`${at}: 객체여야 합니다.`);
      return;
    }
    errors.push(...unknownFields(pair, ["leftId", "rightId"], at));
    if (typeof pair.leftId !== "string" || !left.ids.includes(pair.leftId))
      errors.push(`${at}.leftId: 존재하는 left ID여야 합니다.`);
    if (typeof pair.rightId !== "string" || !right.ids.includes(pair.rightId))
      errors.push(`${at}.rightId: 존재하는 right ID여야 합니다.`);
    if (typeof pair.leftId === "string" && typeof pair.rightId === "string")
      pairValues.push({ leftId: pair.leftId, rightId: pair.rightId });
  });
  if (
    !sameMembers(
      pairValues.map((pair) => pair.leftId),
      left.ids,
    )
  )
    errors.push(
      "question.correctPairs: 모든 left ID를 정확히 한 번 포함해야 합니다.",
    );
  if (
    !sameMembers(
      pairValues.map((pair) => pair.rightId),
      right.ids,
    )
  )
    errors.push(
      "question.correctPairs: 모든 right ID를 정확히 한 번 포함해야 합니다.",
    );
  return errors.length
    ? invalid(...errors)
    : valid(value as unknown as MatchingQuestion);
}

function validateCodeOutputQuestion(
  value: unknown,
): ValidationResult<CodeOutputQuestion> {
  const errors = validateBase(value, "code-output", [
    "language",
    "code",
    "choices",
    "acceptedOutputs",
  ]);
  if (!isObject(value)) return invalid(...errors);
  if (value.language !== "python")
    errors.push("question.language: python만 지원합니다.");
  if (!isNonEmptyString(value.code))
    errors.push("question.code: 비어 있을 수 없습니다.");
  const choices = validateChoiceList(
    value.choices,
    "question.choices",
    normalizeOutput,
    { allowEmpty: true },
  );
  errors.push(...choices.errors);
  const outputs = validateStringList(
    value.acceptedOutputs,
    "question.acceptedOutputs",
    { allowEmpty: true },
  );
  errors.push(...outputs.errors);
  const normalizedOutputs = outputs.values.map(normalizeOutput);
  if (normalizedOutputs.some((output) => !choices.values.includes(output)))
    errors.push(
      "question.acceptedOutputs: 모든 값이 choices에 포함되어야 합니다.",
    );
  return errors.length
    ? invalid(...errors)
    : valid(value as unknown as CodeOutputQuestion);
}

const BLANK_PATTERN = /\{\{blank:([a-z0-9]+(?:-[a-z0-9]+)*)\}\}/g;

function validateCodeCompletionQuestion(
  value: unknown,
): ValidationResult<CodeCompletionQuestion> {
  const errors = validateBase(value, "code-completion", [
    "language",
    "template",
    "blanks",
  ]);
  if (!isObject(value)) return invalid(...errors);
  if (value.language !== "python")
    errors.push("question.language: python만 지원합니다.");
  if (!isNonEmptyString(value.template))
    errors.push("question.template: 비어 있을 수 없습니다.");
  if (!Array.isArray(value.blanks) || value.blanks.length === 0)
    errors.push("question.blanks: 하나 이상의 blank가 필요합니다.");
  const blankIds: string[] = [];
  if (Array.isArray(value.blanks)) {
    value.blanks.forEach((blank, index) => {
      const at = `question.blanks[${index}]`;
      if (!isObject(blank)) {
        errors.push(`${at}: 객체여야 합니다.`);
        return;
      }
      errors.push(
        ...unknownFields(blank, ["id", "choices", "acceptedAnswers"], at),
      );
      if (typeof blank.id !== "string" || !ITEM_ID_PATTERN.test(blank.id))
        errors.push(`${at}.id: 올바른 blank ID가 아닙니다.`);
      else blankIds.push(blank.id);
      const choices = validateChoiceList(
        blank.choices,
        `${at}.choices`,
        normalizeAnswer,
      );
      errors.push(...choices.errors);
      const answers = validateStringList(
        blank.acceptedAnswers,
        `${at}.acceptedAnswers`,
      );
      errors.push(...answers.errors);
      if (duplicateValues(answers.values.map(normalizeAnswer)).length)
        errors.push(
          `${at}.acceptedAnswers: 정규화 후 중복되는 답안이 있습니다.`,
        );
      if (
        answers.values.some(
          (answer) => !choices.values.includes(normalizeAnswer(answer)),
        )
      )
        errors.push(
          `${at}.acceptedAnswers: 모든 값이 choices에 포함되어야 합니다.`,
        );
    });
  }
  if (duplicateValues(blankIds).length)
    errors.push("question.blanks: 중복 ID가 있습니다.");
  const occurrences = new Map<string, number>();
  if (typeof value.template === "string") {
    for (const match of value.template.matchAll(BLANK_PATTERN))
      occurrences.set(match[1], (occurrences.get(match[1]) ?? 0) + 1);
    if (/\{\{blank:/.test(value.template)) {
      const recognizedLength = [
        ...value.template.matchAll(BLANK_PATTERN),
      ].reduce((length, match) => length + match[0].length, 0);
      const markerLength = (value.template.match(/\{\{blank:/g) ?? []).length;
      if (markerLength !== [...value.template.matchAll(BLANK_PATTERN)].length)
        errors.push(
          "question.template: blank placeholder 문법이 올바르지 않습니다.",
        );
      void recognizedLength;
    }
  }
  for (const id of blankIds) {
    if (occurrences.get(id) !== 1)
      errors.push(
        `question.template: blank ${id}는 정확히 한 번 사용해야 합니다.`,
      );
  }
  for (const id of occurrences.keys()) {
    if (!blankIds.includes(id))
      errors.push(`question.template: 정의되지 않은 blank ${id}입니다.`);
  }
  return errors.length
    ? invalid(...errors)
    : valid(value as unknown as CodeCompletionQuestion);
}

function singleChoiceDefinition(): QuestionDefinition<"single-choice"> {
  return {
    type: "single-choice",
    validateQuestion: validateSingleChoiceQuestion,
    validateAnswer(question, value) {
      if (!isObject(value) || value.type !== "single-choice")
        return invalid("answer.type: single-choice여야 합니다.");
      if (
        typeof value.optionId !== "string" ||
        !question.options.some((option) => option.id === value.optionId)
      )
        return invalid("answer.optionId: 존재하는 option ID여야 합니다.");
      return valid(value as never);
    },
    evaluate(question, answer) {
      const correct = answer.optionId === question.correctOptionId;
      return { correct, score: correct ? 1 : 0 };
    },
    canonicalAnswer(question) {
      return { type: "single-choice", optionId: question.correctOptionId };
    },
  };
}

function multiSelectDefinition(): QuestionDefinition<"multi-select"> {
  return {
    type: "multi-select",
    validateQuestion: validateMultiSelectQuestion,
    validateAnswer(question, value) {
      if (!isObject(value) || value.type !== "multi-select")
        return invalid("answer.type: multi-select여야 합니다.");
      if (!Array.isArray(value.optionIds) || value.optionIds.length === 0)
        return invalid("answer.optionIds: 하나 이상의 option ID가 필요합니다.");
      if (value.optionIds.some((id) => typeof id !== "string"))
        return invalid("answer.optionIds: 문자열 배열이어야 합니다.");
      const ids = value.optionIds as string[];
      if (duplicateValues(ids).length)
        return invalid("answer.optionIds: 중복 ID가 있습니다.");
      if (
        ids.some((id) => !question.options.some((option) => option.id === id))
      )
        return invalid("answer.optionIds: 존재하지 않는 option ID가 있습니다.");
      return valid(value as never);
    },
    evaluate(question, answer) {
      const correct = sameMembers(answer.optionIds, question.correctOptionIds);
      return { correct, score: correct ? 1 : 0 };
    },
    canonicalAnswer(question) {
      return {
        type: "multi-select",
        optionIds: [...question.correctOptionIds],
      };
    },
  };
}

function fillBlankDefinition(): QuestionDefinition<"fill-blank"> {
  return {
    type: "fill-blank",
    validateQuestion: validateFillBlankQuestion,
    validateAnswer(question, value) {
      if (!isObject(value) || value.type !== "fill-blank")
        return invalid("answer.type: fill-blank여야 합니다.");
      if (
        typeof value.value !== "string" ||
        normalizeAnswer(value.value).length === 0
      )
        return invalid("answer.value: 정규화 후 비어 있을 수 없습니다.");
      const answer = value.value;
      if (
        !question.choices.some(
          (choice) => normalizeAnswer(choice) === normalizeAnswer(answer),
        )
      )
        return invalid("answer.value: choices 중 하나를 선택해야 합니다.");
      return valid(value as never);
    },
    evaluate(question, answer) {
      const normalized = normalizeAnswer(answer.value);
      const correct = question.acceptedAnswers.some(
        (accepted) => normalizeAnswer(accepted) === normalized,
      );
      return { correct, score: correct ? 1 : 0 };
    },
    canonicalAnswer(question) {
      return { type: "fill-blank", value: question.acceptedAnswers[0] };
    },
  };
}

function orderingDefinition(): QuestionDefinition<"ordering"> {
  return {
    type: "ordering",
    validateQuestion: validateOrderingQuestion,
    validateAnswer(question, value) {
      if (!isObject(value) || value.type !== "ordering")
        return invalid("answer.type: ordering이어야 합니다.");
      if (
        !Array.isArray(value.orderedItemIds) ||
        !sameMembers(
          value.orderedItemIds.filter(
            (id): id is string => typeof id === "string",
          ),
          question.items.map((item) => item.id),
        )
      )
        return invalid(
          "answer.orderedItemIds: 모든 item ID를 정확히 한 번 포함해야 합니다.",
        );
      if (value.orderedItemIds.some((id) => typeof id !== "string"))
        return invalid("answer.orderedItemIds: 문자열 배열이어야 합니다.");
      return valid(value as never);
    },
    evaluate(question, answer) {
      const correct = answer.orderedItemIds.every(
        (id, index) => id === question.correctOrder[index],
      );
      return { correct, score: correct ? 1 : 0 };
    },
    canonicalAnswer(question) {
      return { type: "ordering", orderedItemIds: [...question.correctOrder] };
    },
  };
}

function matchingDefinition(): QuestionDefinition<"matching"> {
  return {
    type: "matching",
    validateQuestion: validateMatchingQuestion,
    validateAnswer(question, value) {
      if (!isObject(value) || value.type !== "matching")
        return invalid("answer.type: matching이어야 합니다.");
      if (
        !Array.isArray(value.pairs) ||
        value.pairs.length !== question.leftItems.length
      )
        return invalid(
          "answer.pairs: 모든 항목을 정확히 한 번 연결해야 합니다.",
        );
      const pairs: Array<{ leftId: string; rightId: string }> = [];
      for (const pair of value.pairs) {
        if (
          !isObject(pair) ||
          typeof pair.leftId !== "string" ||
          typeof pair.rightId !== "string"
        )
          return invalid("answer.pairs: leftId와 rightId가 필요합니다.");
        pairs.push({ leftId: pair.leftId, rightId: pair.rightId });
      }
      if (
        !sameMembers(
          pairs.map((pair) => pair.leftId),
          question.leftItems.map((item) => item.id),
        )
      )
        return invalid(
          "answer.pairs: 모든 left ID를 정확히 한 번 사용해야 합니다.",
        );
      if (
        !sameMembers(
          pairs.map((pair) => pair.rightId),
          question.rightItems.map((item) => item.id),
        )
      )
        return invalid(
          "answer.pairs: 모든 right ID를 정확히 한 번 사용해야 합니다.",
        );
      return valid(value as never);
    },
    evaluate(question, answer) {
      const correct = samePairSet(answer.pairs, question.correctPairs);
      return { correct, score: correct ? 1 : 0 };
    },
    canonicalAnswer(question) {
      return {
        type: "matching",
        pairs: question.correctPairs.map((pair) => ({ ...pair })),
      };
    },
  };
}

function codeOutputDefinition(): QuestionDefinition<"code-output"> {
  return {
    type: "code-output",
    validateQuestion: validateCodeOutputQuestion,
    validateAnswer(question, value) {
      if (!isObject(value) || value.type !== "code-output")
        return invalid("answer.type: code-output이어야 합니다.");
      if (typeof value.value !== "string")
        return invalid("answer.value: 문자열이어야 합니다.");
      const answer = value.value;
      if (
        !question.choices.some(
          (choice) => normalizeOutput(choice) === normalizeOutput(answer),
        )
      )
        return invalid("answer.value: choices 중 하나를 선택해야 합니다.");
      return valid(value as never);
    },
    evaluate(question, answer) {
      const normalized = normalizeOutput(answer.value);
      const correct = question.acceptedOutputs.some(
        (accepted) => normalizeOutput(accepted) === normalized,
      );
      return { correct, score: correct ? 1 : 0 };
    },
    canonicalAnswer(question) {
      return { type: "code-output", value: question.acceptedOutputs[0] };
    },
  };
}

function codeCompletionDefinition(): QuestionDefinition<"code-completion"> {
  return {
    type: "code-completion",
    validateQuestion: validateCodeCompletionQuestion,
    validateAnswer(question, value) {
      if (!isObject(value) || value.type !== "code-completion")
        return invalid("answer.type: code-completion이어야 합니다.");
      if (!isObject(value.values))
        return invalid("answer.values: 객체여야 합니다.");
      const expectedIds = question.blanks.map((blank) => blank.id);
      const actualIds = Object.keys(value.values);
      if (!sameMembers(actualIds, expectedIds))
        return invalid(
          "answer.values: 모든 blank ID를 정확히 포함해야 합니다.",
        );
      for (const blank of question.blanks) {
        const answer = value.values[blank.id];
        if (typeof answer !== "string" || normalizeAnswer(answer).length === 0)
          return invalid(
            `answer.values.${blank.id}: 정규화 후 비어 있을 수 없습니다.`,
          );
        if (
          !blank.choices.some(
            (choice) => normalizeAnswer(choice) === normalizeAnswer(answer),
          )
        )
          return invalid(
            `answer.values.${blank.id}: choices 중 하나를 선택해야 합니다.`,
          );
      }
      return valid(value as never);
    },
    evaluate(question, answer) {
      const correct = question.blanks.every((blank) => {
        const value = normalizeAnswer(answer.values[blank.id]);
        return blank.acceptedAnswers.some(
          (accepted) => normalizeAnswer(accepted) === value,
        );
      });
      return { correct, score: correct ? 1 : 0 };
    },
    canonicalAnswer(question) {
      return {
        type: "code-completion",
        values: Object.fromEntries(
          question.blanks.map((blank) => [blank.id, blank.acceptedAnswers[0]]),
        ),
      };
    },
  };
}

const definitions: {
  [T in QuestionType]: QuestionDefinition<T>;
} = {
  "single-choice": singleChoiceDefinition(),
  "multi-select": multiSelectDefinition(),
  "fill-blank": fillBlankDefinition(),
  ordering: orderingDefinition(),
  matching: matchingDefinition(),
  "code-output": codeOutputDefinition(),
  "code-completion": codeCompletionDefinition(),
};

export const questionPlugins = new Map<QuestionType, AnyQuestionPlugin>([
  [
    "single-choice",
    { type: "single-choice", definition: definitions["single-choice"] },
  ],
  [
    "multi-select",
    { type: "multi-select", definition: definitions["multi-select"] },
  ],
  ["fill-blank", { type: "fill-blank", definition: definitions["fill-blank"] }],
  ["ordering", { type: "ordering", definition: definitions.ordering }],
  ["matching", { type: "matching", definition: definitions.matching }],
  [
    "code-output",
    { type: "code-output", definition: definitions["code-output"] },
  ],
  [
    "code-completion",
    { type: "code-completion", definition: definitions["code-completion"] },
  ],
]);

export function getQuestionPlugin(
  type: QuestionType,
): AnyQuestionPlugin | null {
  return questionPlugins.get(type) ?? null;
}

export function requireQuestionPlugin(type: QuestionType): AnyQuestionPlugin {
  const plugin = getQuestionPlugin(type);
  if (!plugin) throw new Error(`등록되지 않은 문제 형식입니다: ${type}`);
  return plugin;
}

function outcomeError(
  code: EvaluationError["code"],
  message: string,
  details?: string[],
): EvaluationOutcome {
  return { status: "error", error: { code, message, details } };
}

export function evaluateQuestion(
  question: unknown,
  answer: unknown,
): EvaluationOutcome {
  if (!isObject(question) || typeof question.type !== "string")
    return outcomeError("invalid-question", "문제 형식이 올바르지 않습니다.");
  if (!QUESTION_TYPES.has(question.type as QuestionType))
    return outcomeError(
      "unregistered-question-type",
      `등록되지 않은 문제 형식입니다: ${question.type}`,
    );
  const plugin = getQuestionPlugin(question.type as QuestionType);
  if (!plugin)
    return outcomeError(
      "unregistered-question-type",
      `등록되지 않은 문제 형식입니다: ${question.type}`,
    );
  const questionResult = plugin.definition.validateQuestion(question);
  if (!questionResult.valid)
    return outcomeError(
      "invalid-question",
      "문제 데이터가 올바르지 않습니다.",
      questionResult.errors,
    );
  if (!isObject(answer) || answer.type !== question.type)
    return outcomeError(
      "answer-type-mismatch",
      "문제와 답안의 type이 일치하지 않습니다.",
    );
  const answerResult = plugin.definition.validateAnswer(
    questionResult.value as never,
    answer,
  );
  if (!answerResult.valid)
    return outcomeError(
      "invalid-answer",
      "답안 형식이 올바르지 않습니다.",
      answerResult.errors,
    );
  const result = plugin.definition.evaluate(
    questionResult.value as never,
    answerResult.value as never,
  );
  return { status: "evaluated", result };
}

export function canonicalAnswer(
  question: Question,
): Question["type"] extends never
  ? never
  : ReturnType<AnyQuestionDefinition["canonicalAnswer"]> {
  const plugin = requireQuestionPlugin(question.type);
  return plugin.definition.canonicalAnswer(question as never) as ReturnType<
    AnyQuestionDefinition["canonicalAnswer"]
  >;
}

export type { UserAnswer };
