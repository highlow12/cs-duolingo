import type { ContentBlock } from "$lib/content/types";
import type {
  CanonicalAnswer,
  CodeCompletionAnswer,
  CodeCompletionQuestion,
  CodeOutputAnswer,
  CodeOutputQuestion,
  FillBlankAnswer,
  FillBlankQuestion,
  GraphPathAnswer,
  GraphPathQuestion,
  InteractiveSimulationAnswer,
  InteractiveSimulationQuestion,
  MatchingAnswer,
  MatchingQuestion,
  MultiSelectAnswer,
  MultiSelectQuestion,
  OrderingAnswer,
  OrderingQuestion,
  Question,
  SingleChoiceAnswer,
  SingleChoiceQuestion,
  UserAnswer,
} from "./types";

/** A short, human-readable label used in final feedback and accessible text. */
export function contentLabel(blocks: ContentBlock[]): string {
  const parts = blocks
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "markdown") return block.markdown;
      if (block.type === "code") return block.code;
      if (block.type === "image") return block.alt;
      return block.alt;
    })
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.join(" ") || "내용 없음";
}

function optionLabel(
  question: SingleChoiceQuestion | MultiSelectQuestion,
  id: string,
): string {
  const option = question.options.find((candidate) => candidate.id === id);
  return option ? contentLabel(option.content) : "알 수 없는 선택지";
}

function orderingLabel(question: OrderingQuestion, id: string): string {
  const item = question.items.find((candidate) => candidate.id === id);
  return item ? contentLabel(item.content) : "알 수 없는 항목";
}

function matchingLabel(
  question: MatchingQuestion,
  side: "left" | "right",
  id: string,
): string {
  const items = side === "left" ? question.leftItems : question.rightItems;
  const item = items.find((candidate) => candidate.id === id);
  return item ? contentLabel(item.content) : "알 수 없는 항목";
}

function graphNodeLabel(question: GraphPathQuestion, id: string): string {
  return question.nodes.find((node) => node.id === id)?.label ?? "알 수 없는 노드";
}

function simulationActionLabel(
  question: InteractiveSimulationQuestion,
  id: string,
): string {
  return (
    question.actions.find((action) => action.id === id)?.label ?? "알 수 없는 동작"
  );
}

function valueLabel(value: string, emptyLabel = "출력 없음"): string {
  return value === "" ? emptyLabel : value;
}

export interface AnswerDisplay {
  kind: "single" | "list" | "pairs" | "blanks" | "value";
  title: string;
  values?: string[];
  pairs?: Array<{ left: string; right: string }>;
  blanks?: Array<{ id: string; label: string; value: string }>;
  value?: string;
}

export function describeAnswer(
  question: Question,
  answer: UserAnswer,
): AnswerDisplay {
  switch (question.type) {
    case "single-choice": {
      const candidate = answer as SingleChoiceAnswer;
      return {
        kind: "single",
        title: "선택한 답",
        values: [optionLabel(question, candidate.optionId)],
      };
    }
    case "multi-select": {
      const candidate = answer as MultiSelectAnswer;
      return {
        kind: "list",
        title: "선택한 답",
        values: candidate.optionIds.map((id) => optionLabel(question, id)),
      };
    }
    case "fill-blank": {
      const candidate = answer as FillBlankAnswer;
      return { kind: "value", title: "선택한 답", value: candidate.value };
    }
    case "ordering": {
      const candidate = answer as OrderingAnswer;
      return {
        kind: "list",
        title: "제출한 순서",
        values: candidate.orderedItemIds.map((id) => orderingLabel(question, id)),
      };
    }
    case "matching": {
      const candidate = answer as MatchingAnswer;
      return {
        kind: "pairs",
        title: "제출한 짝",
        pairs: candidate.pairs.map((pair) => ({
          left: matchingLabel(question, "left", pair.leftId),
          right: matchingLabel(question, "right", pair.rightId),
        })),
      };
    }
    case "code-output": {
      const candidate = answer as CodeOutputAnswer;
      return {
        kind: "value",
        title: "선택한 출력",
        value: valueLabel(candidate.value),
      };
    }
    case "code-completion": {
      const candidate = answer as CodeCompletionAnswer;
      return {
        kind: "blanks",
        title: "제출한 빈칸 답",
        blanks: question.blanks.map((blank, index) => ({
          id: blank.id,
          label: `빈칸 ${index + 1}`,
          value: candidate.values[blank.id] ?? "선택하지 않음",
        })),
      };
    }
    case "graph-path": {
      const candidate = answer as GraphPathAnswer;
      return {
        kind: "list",
        title: "제출한 경로",
        values: candidate.nodeIds.map((id) => graphNodeLabel(question, id)),
      };
    }
    case "interactive-simulation": {
      const candidate = answer as InteractiveSimulationAnswer;
      return {
        kind: "list",
        title: "실행한 동작",
        values: candidate.actionIds.map((id) => simulationActionLabel(question, id)),
      };
    }
  }
}

export function describeCanonicalAnswer(
  question: Question,
  answer: CanonicalAnswer,
): AnswerDisplay {
  switch (question.type) {
    case "single-choice": {
      const candidate = answer as Extract<
        CanonicalAnswer,
        { type: "single-choice" }
      >;
      return {
        kind: "single",
        title: "정답",
        values: [optionLabel(question, candidate.optionId)],
      };
    }
    case "multi-select": {
      const candidate = answer as Extract<
        CanonicalAnswer,
        { type: "multi-select" }
      >;
      return {
        kind: "list",
        title: "정답",
        values: candidate.optionIds.map((id) => optionLabel(question, id)),
      };
    }
    case "fill-blank": {
      const candidate = answer as Extract<
        CanonicalAnswer,
        { type: "fill-blank" }
      >;
      return { kind: "value", title: "정답", value: candidate.value };
    }
    case "ordering": {
      const candidate = answer as Extract<
        CanonicalAnswer,
        { type: "ordering" }
      >;
      return {
        kind: "list",
        title: "정답 순서",
        values: candidate.orderedItemIds.map((id) => orderingLabel(question, id)),
      };
    }
    case "matching": {
      const candidate = answer as Extract<
        CanonicalAnswer,
        { type: "matching" }
      >;
      return {
        kind: "pairs",
        title: "정답 짝",
        pairs: candidate.pairs.map((pair) => ({
          left: matchingLabel(question, "left", pair.leftId),
          right: matchingLabel(question, "right", pair.rightId),
        })),
      };
    }
    case "code-output": {
      const candidate = answer as Extract<
        CanonicalAnswer,
        { type: "code-output" }
      >;
      return {
        kind: "value",
        title: "정답 출력",
        value: valueLabel(candidate.value),
      };
    }
    case "code-completion": {
      const candidate = answer as Extract<
        CanonicalAnswer,
        { type: "code-completion" }
      >;
      return {
        kind: "blanks",
        title: "정답 빈칸",
        blanks: question.blanks.map((blank, index) => ({
          id: blank.id,
          label: `빈칸 ${index + 1}`,
          value: candidate.values[blank.id] ?? "선택하지 않음",
        })),
      };
    }
    case "graph-path": {
      const candidate = answer as Extract<CanonicalAnswer, { type: "graph-path" }>;
      return {
        kind: "list",
        title: "정답 경로",
        values: candidate.nodeIds.map((id) => graphNodeLabel(question, id)),
      };
    }
    case "interactive-simulation": {
      const candidate = answer as Extract<
        CanonicalAnswer,
        { type: "interactive-simulation" }
      >;
      return {
        kind: "list",
        title: "정답 동작 예시",
        values: candidate.actionIds.map((id) => simulationActionLabel(question, id)),
      };
    }
  }
}
