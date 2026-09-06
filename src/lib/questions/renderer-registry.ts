import CodeCompletionQuestion from "./plugins/CodeCompletionQuestion.svelte";
import CodeOutputQuestion from "./plugins/CodeOutputQuestion.svelte";
import FillBlankQuestion from "./plugins/FillBlankQuestion.svelte";
import MatchingQuestion from "./plugins/MatchingQuestion.svelte";
import MultiSelectQuestion from "./plugins/MultiSelectQuestion.svelte";
import OrderingQuestion from "./plugins/OrderingQuestion.svelte";
import SingleChoiceQuestion from "./plugins/SingleChoiceQuestion.svelte";
import { getQuestionPlugin } from "./registry";
import type { QuestionType } from "./types";
import type {
  AnyQuestionRenderer,
  QuestionRendererComponent,
} from "./renderer-contract";
import type { QuestionDefinition } from "./registry";

/**
 * UI descriptors are kept in a browser/Svelte-facing module.  The pure
 * evaluator registry remains importable by content tooling without loading
 * Svelte components.
 */
export const questionRenderers = new Map<QuestionType, AnyQuestionRenderer>([
  ["single-choice", SingleChoiceQuestion as AnyQuestionRenderer],
  ["multi-select", MultiSelectQuestion as AnyQuestionRenderer],
  ["fill-blank", FillBlankQuestion as AnyQuestionRenderer],
  ["ordering", OrderingQuestion as AnyQuestionRenderer],
  ["matching", MatchingQuestion as AnyQuestionRenderer],
  ["code-output", CodeOutputQuestion as AnyQuestionRenderer],
  ["code-completion", CodeCompletionQuestion as AnyQuestionRenderer],
]);

export interface QuestionPluginDescriptor<T extends QuestionType = QuestionType> {
  type: T;
  definition: QuestionDefinition<T>;
  renderer: QuestionRendererComponent<T>;
}

export type AnyQuestionPluginDescriptor = {
  [T in QuestionType]: QuestionPluginDescriptor<T>;
}[QuestionType];

export interface QuestionRendererRegistry {
  register<T extends QuestionType>(
    type: T,
    renderer: QuestionRendererComponent<T>,
  ): void;
  get<T extends QuestionType>(type: T): QuestionRendererComponent<T> | null;
  require<T extends QuestionType>(type: T): QuestionRendererComponent<T>;
}

class DefaultQuestionRendererRegistry implements QuestionRendererRegistry {
  register<T extends QuestionType>(
    type: T,
    renderer: QuestionRendererComponent<T>,
  ): void {
    if (questionRenderers.has(type))
      throw new Error(`이미 등록된 문제 renderer입니다: ${type}`);
    questionRenderers.set(type, renderer as unknown as AnyQuestionRenderer);
  }

  get<T extends QuestionType>(type: T): QuestionRendererComponent<T> | null {
    return (questionRenderers.get(type) as QuestionRendererComponent<T> | undefined) ?? null;
  }

  require<T extends QuestionType>(type: T): QuestionRendererComponent<T> {
    const renderer = this.get(type);
    if (!renderer) throw new Error(`등록되지 않은 문제 renderer입니다: ${type}`);
    return renderer;
  }
}

export const rendererRegistry: QuestionRendererRegistry =
  new DefaultQuestionRendererRegistry();

export function getQuestionRenderer(
  type: QuestionType,
): AnyQuestionRenderer | null {
  return questionRenderers.get(type) ?? null;
}

export function requireQuestionRenderer(type: QuestionType): AnyQuestionRenderer {
  return rendererRegistry.require(type) as AnyQuestionRenderer;
}

/** Full descriptors used by the host when it needs both halves of a plugin. */
export const questionPluginDescriptors = new Map<
  QuestionType,
  AnyQuestionPluginDescriptor
>(
  [...questionRenderers.keys()].map((type) => {
    const plugin = getQuestionPlugin(type);
    const renderer = questionRenderers.get(type);
    if (!plugin || !renderer) throw new Error(`불완전한 문제 plugin입니다: ${type}`);
    return [
      type,
      {
        type,
        definition: plugin.definition as never,
        renderer,
      } as AnyQuestionPluginDescriptor,
    ];
  }),
);
