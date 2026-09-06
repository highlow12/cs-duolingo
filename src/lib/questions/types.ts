import type { ContentBlock } from "$lib/content/types";

export type QuestionType =
  | "single-choice"
  | "multi-select"
  | "fill-blank"
  | "ordering"
  | "matching"
  | "code-output"
  | "code-completion";

export interface QuestionBase {
  id: string;
  revision: number;
  type: QuestionType;
  prompt: ContentBlock[];
  explanation?: ContentBlock[];
  tags?: string[];
  difficulty?: number;
}

export interface ChoiceOption {
  id: string;
  content: ContentBlock[];
}

export interface SingleChoiceQuestion extends QuestionBase {
  type: "single-choice";
  options: ChoiceOption[];
  correctOptionId: string;
}

export interface MultiSelectQuestion extends QuestionBase {
  type: "multi-select";
  options: ChoiceOption[];
  correctOptionIds: string[];
}

export interface FillBlankQuestion extends QuestionBase {
  type: "fill-blank";
  answer: string;
  acceptedAnswers?: string[];
}

export interface OrderingQuestion extends QuestionBase {
  type: "ordering";
  items: ChoiceOption[];
  correctOrder: string[];
}

export interface MatchingQuestion extends QuestionBase {
  type: "matching";
  pairs: Array<{ left: ChoiceOption; right: ChoiceOption }>;
}

export interface CodeOutputQuestion extends QuestionBase {
  type: "code-output";
  code: string;
  language: string;
  answer: string;
}

export interface CodeCompletionQuestion extends QuestionBase {
  type: "code-completion";
  code: string;
  answer: string;
  acceptedAnswers?: string[];
}

export type Question =
  | SingleChoiceQuestion
  | MultiSelectQuestion
  | FillBlankQuestion
  | OrderingQuestion
  | MatchingQuestion
  | CodeOutputQuestion
  | CodeCompletionQuestion;

export type UserAnswer =
  { optionId: string } | { optionIds: string[] } | { value: string };

export interface EvaluationResult {
  correct: boolean;
  score: number;
  feedback?: string;
  hintsUsed?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
