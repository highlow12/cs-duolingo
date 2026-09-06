import type { Component } from "svelte";
import type {
  AnswerOf,
  CanonicalAnswerOf,
  QuestionOf,
  QuestionType,
  UserAnswer,
} from "./types";

/**
 * The only contract a question renderer needs from the host.  Renderers build
 * an answer snapshot and report it through `onAnswerChange`; they never call
 * an evaluator or persist anything themselves.
 */
export interface QuestionRendererProps<T extends QuestionType> {
  question: QuestionOf<T>;
  disabled: boolean;
  attemptKey: number;
  reveal: CanonicalAnswerOf<T> | null;
  onAnswerChange: (answer: AnswerOf<T> | null) => void;
  /** The final answer is supplied for accessible final-state annotations. */
  submittedAnswer?: UserAnswer | null;
  /** Injected by the host so shuffle behaviour is deterministic in tests. */
  random?: () => number;
}

export type QuestionRendererComponent<T extends QuestionType> = Component<
  QuestionRendererProps<T>
>;

// A union of generic Svelte components is represented as an intersection by
// the compiler when used as a dynamic component. Keep the public generic
// contract above while using an erased type at the registry boundary.
export type AnyQuestionRenderer = Component<any>;
