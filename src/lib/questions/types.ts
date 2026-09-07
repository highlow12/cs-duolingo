import type { ContentBlock } from "$lib/content/types";

export type QuestionType =
  | "single-choice"
  | "multi-select"
  | "fill-blank"
  | "ordering"
  | "matching"
  | "code-output"
  | "code-completion"
  | "graph-path"
  | "interactive-simulation";

export interface QuestionBase {
  schemaVersion: 1;
  id: string;
  lessonId: string;
  revision: number;
  type: QuestionType;
  prompt: ContentBlock[];
  explanation?: ContentBlock[];
  tags?: string[];
  difficulty?: 1 | 2 | 3 | 4 | 5;
}

export interface ChoiceOption {
  id: string;
  content: ContentBlock[];
}

export interface SingleChoiceQuestion extends QuestionBase {
  type: "single-choice";
  options: ChoiceOption[];
  correctOptionId: string;
  shuffleOptions: boolean;
}

export interface MultiSelectQuestion extends QuestionBase {
  type: "multi-select";
  options: ChoiceOption[];
  correctOptionIds: string[];
  shuffleOptions: boolean;
}

export interface FillBlankQuestion extends QuestionBase {
  type: "fill-blank";
  choices: string[];
  acceptedAnswers: string[];
}

export interface OrderingQuestion extends QuestionBase {
  type: "ordering";
  items: ChoiceOption[];
  correctOrder: string[];
}

export interface MatchingPair {
  leftId: string;
  rightId: string;
}

export interface MatchingQuestion extends QuestionBase {
  type: "matching";
  leftItems: ChoiceOption[];
  rightItems: ChoiceOption[];
  correctPairs: MatchingPair[];
}

export interface CodeOutputQuestion extends QuestionBase {
  type: "code-output";
  language: "python";
  code: string;
  choices: string[];
  acceptedOutputs: string[];
}

export interface CodeBlank {
  id: string;
  choices: string[];
  acceptedAnswers: string[];
}

export interface CodeCompletionQuestion extends QuestionBase {
  type: "code-completion";
  language: "python";
  template: string;
  blanks: CodeBlank[];
}

export interface GraphPathNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphPathEdge {
  fromId: string;
  toId: string;
}

export interface GraphPathQuestion extends QuestionBase {
  type: "graph-path";
  nodes: GraphPathNode[];
  edges: GraphPathEdge[];
  directed: boolean;
  startNodeId: string;
  goalNodeId: string;
  acceptedPaths: string[][];
}

export interface SimulationState {
  id: string;
  label: string;
}

export interface SimulationAction {
  id: string;
  label: string;
}

export interface SimulationTransition {
  fromStateId: string;
  actionId: string;
  toStateId: string;
}

export interface InteractiveSimulationQuestion extends QuestionBase {
  type: "interactive-simulation";
  states: SimulationState[];
  actions: SimulationAction[];
  transitions: SimulationTransition[];
  initialStateId: string;
  goalStateIds: string[];
  maxSteps: number;
  canonicalActionIds: string[];
}

export type Question =
  | SingleChoiceQuestion
  | MultiSelectQuestion
  | FillBlankQuestion
  | OrderingQuestion
  | MatchingQuestion
  | CodeOutputQuestion
  | CodeCompletionQuestion
  | GraphPathQuestion
  | InteractiveSimulationQuestion;

export interface SingleChoiceAnswer {
  type: "single-choice";
  optionId: string;
}

export interface MultiSelectAnswer {
  type: "multi-select";
  optionIds: string[];
}

export interface FillBlankAnswer {
  type: "fill-blank";
  value: string;
}

export interface OrderingAnswer {
  type: "ordering";
  orderedItemIds: string[];
}

export interface MatchingAnswer {
  type: "matching";
  pairs: MatchingPair[];
}

export interface CodeOutputAnswer {
  type: "code-output";
  value: string;
}

export interface CodeCompletionAnswer {
  type: "code-completion";
  values: Record<string, string>;
}

export interface GraphPathAnswer {
  type: "graph-path";
  nodeIds: string[];
}

export interface InteractiveSimulationAnswer {
  type: "interactive-simulation";
  actionIds: string[];
}

export type UserAnswer =
  | SingleChoiceAnswer
  | MultiSelectAnswer
  | FillBlankAnswer
  | OrderingAnswer
  | MatchingAnswer
  | CodeOutputAnswer
  | CodeCompletionAnswer
  | GraphPathAnswer
  | InteractiveSimulationAnswer;

export interface EvaluationResult {
  correct: boolean;
  score: 0 | 1;
}

export type EvaluationErrorCode =
  | "unregistered-question-type"
  | "invalid-question"
  | "answer-type-mismatch"
  | "invalid-answer";

export interface EvaluationError {
  code: EvaluationErrorCode;
  message: string;
  details?: string[];
}

export type EvaluationOutcome =
  | { status: "evaluated"; result: EvaluationResult }
  | { status: "error"; error: EvaluationError };

export interface ValidationSuccess<T> {
  valid: true;
  value: T;
}

export interface ValidationFailure {
  valid: false;
  errors: string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export type CanonicalAnswer =
  | { type: "single-choice"; optionId: string }
  | { type: "multi-select"; optionIds: string[] }
  | { type: "fill-blank"; value: string }
  | { type: "ordering"; orderedItemIds: string[] }
  | { type: "matching"; pairs: MatchingPair[] }
  | { type: "code-output"; value: string }
  | { type: "code-completion"; values: Record<string, string> }
  | { type: "graph-path"; nodeIds: string[] }
  | { type: "interactive-simulation"; actionIds: string[] };

export interface QuestionByType {
  "single-choice": SingleChoiceQuestion;
  "multi-select": MultiSelectQuestion;
  "fill-blank": FillBlankQuestion;
  ordering: OrderingQuestion;
  matching: MatchingQuestion;
  "code-output": CodeOutputQuestion;
  "code-completion": CodeCompletionQuestion;
  "graph-path": GraphPathQuestion;
  "interactive-simulation": InteractiveSimulationQuestion;
}

export interface AnswerByType {
  "single-choice": SingleChoiceAnswer;
  "multi-select": MultiSelectAnswer;
  "fill-blank": FillBlankAnswer;
  ordering: OrderingAnswer;
  matching: MatchingAnswer;
  "code-output": CodeOutputAnswer;
  "code-completion": CodeCompletionAnswer;
  "graph-path": GraphPathAnswer;
  "interactive-simulation": InteractiveSimulationAnswer;
}

export type QuestionOf<T extends QuestionType> = QuestionByType[T];
export type AnswerOf<T extends QuestionType> = AnswerByType[T];

export type CanonicalAnswerOf<T extends QuestionType> = Extract<
  CanonicalAnswer,
  { type: T }
>;
