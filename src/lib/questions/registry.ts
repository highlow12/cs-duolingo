import type {
  EvaluationResult,
  Question,
  QuestionType,
  UserAnswer,
  ValidationResult,
} from "./types";

export interface QuestionPlugin {
  type: QuestionType;
  evaluate(question: Question, answer: UserAnswer): EvaluationResult;
  validate(question: unknown): ValidationResult;
}

function valid(): ValidationResult {
  return { valid: true, errors: [] };
}

function invalid(...errors: string[]): ValidationResult {
  return { valid: false, errors };
}

const singleChoicePlugin: QuestionPlugin = {
  type: "single-choice",
  evaluate(question, answer) {
    if (question.type !== "single-choice" || !("optionId" in answer)) {
      return {
        correct: false,
        score: 0,
        feedback: "문제 또는 답안 형식이 올바르지 않습니다.",
      };
    }
    const correct = answer.optionId === question.correctOptionId;
    return {
      correct,
      score: correct ? 1 : 0,
      feedback: correct ? "정답입니다." : "다시 개념을 확인해 보세요.",
    };
  },
  validate(question) {
    if (!question || typeof question !== "object")
      return invalid("문제가 객체가 아닙니다.");
    const candidate = question as Record<string, unknown>;
    if (!Array.isArray(candidate.options) || candidate.options.length < 2) {
      return invalid(
        "single-choice 문제에는 두 개 이상의 선택지가 필요합니다.",
      );
    }
    if (typeof candidate.correctOptionId !== "string") {
      return invalid("정답 선택지가 필요합니다.");
    }
    return valid();
  },
};

function normalizeAnswer(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR");
}

const fillBlankPlugin: QuestionPlugin = {
  type: "fill-blank",
  evaluate(question, answer) {
    if (question.type !== "fill-blank" || !("value" in answer)) {
      return {
        correct: false,
        score: 0,
        feedback: "문제 또는 답안 형식이 올바르지 않습니다.",
      };
    }
    const accepted = [question.answer, ...(question.acceptedAnswers ?? [])].map(
      normalizeAnswer,
    );
    const correct = accepted.includes(normalizeAnswer(answer.value));
    return {
      correct,
      score: correct ? 1 : 0,
      feedback: correct ? "정답입니다." : "표현을 다시 확인해 보세요.",
    };
  },
  validate(question) {
    if (!question || typeof question !== "object")
      return invalid("문제가 객체가 아닙니다.");
    const candidate = question as Record<string, unknown>;
    return typeof candidate.answer === "string"
      ? valid()
      : invalid("정답 문자열이 필요합니다.");
  },
};

export const questionPlugins = new Map<QuestionType, QuestionPlugin>([
  ["single-choice", singleChoicePlugin],
  ["fill-blank", fillBlankPlugin],
]);

export function getQuestionPlugin(type: QuestionType): QuestionPlugin {
  const plugin = questionPlugins.get(type);
  if (!plugin) throw new Error(`등록되지 않은 문제 형식입니다: ${type}`);
  return plugin;
}

export function evaluateQuestion(
  question: Question,
  answer: UserAnswer,
): EvaluationResult {
  return getQuestionPlugin(question.type).evaluate(question, answer);
}
