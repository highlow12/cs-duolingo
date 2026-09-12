<script lang="ts">
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import { contentLabel } from "$lib/questions/presentation";
  import type { QuestionRendererProps } from "$lib/questions/renderer-contract";
  import { shuffleDistinct } from "$lib/questions/shuffle";
  import type { ChoiceOption } from "$lib/questions/types";
  import type { ContentBlock } from "$lib/content/types";

  type SelectionQuestionType =
    | "single-choice"
    | "multi-select"
    | "fill-blank"
    | "code-output";
  type Props = QuestionRendererProps<SelectionQuestionType>;

  interface DisplayChoice {
    key: string;
    content?: ContentBlock[];
    text?: string;
  }

  let {
    question,
    disabled,
    attemptKey,
    reveal,
    submittedAnswer = null,
    random = Math.random,
    onAnswerChange,
  }: Props = $props();

  let selectedKeys = $state<string[]>([]);
  let displayedChoices = $state<DisplayChoice[]>([]);
  let previousRichOrder = $state<ChoiceOption[] | null>(null);
  let previousTextOrder = $state<string[] | null>(null);
  let renderedKey = $state("");
  let renderedIdentity = $state("");

  $effect(() => {
    const key = `${question.id}:${question.revision}:${attemptKey}`;
    if (renderedKey === key) return;

    const identity = `${question.id}:${question.revision}`;
    if (renderedIdentity !== identity) {
      previousRichOrder = null;
      previousTextOrder = null;
    }
    renderedIdentity = identity;
    renderedKey = key;

    if (question.type === "single-choice" || question.type === "multi-select") {
      const options = question.shuffleOptions
        ? shuffleDistinct(question.options, random, previousRichOrder)
        : [...question.options];
      previousRichOrder = [...options];
      previousTextOrder = null;
      displayedChoices = options.map((option) => ({
        key: option.id,
        content: option.content,
      }));
    } else {
      previousRichOrder = null;
      const choices = shuffleDistinct(question.choices, random, previousTextOrder);
      previousTextOrder = [...choices];
      displayedChoices = choices.map((choice) => ({
        key: choice,
        text: choice,
      }));
    }

    selectedKeys = [];
    onAnswerChange(null);
  });

  function selectChoice(key: string) {
    if (disabled) return;

    switch (question.type) {
      case "single-choice":
        selectedKeys = [key];
        onAnswerChange({ type: "single-choice", optionId: key });
        break;
      case "multi-select": {
        selectedKeys = selectedKeys.includes(key)
          ? selectedKeys.filter((id) => id !== key)
          : [...selectedKeys, key];
        onAnswerChange(
          selectedKeys.length === 0
            ? null
            : { type: "multi-select", optionIds: [...selectedKeys] },
        );
        break;
      }
      case "fill-blank":
        selectedKeys = [key];
        onAnswerChange({ type: "fill-blank", value: key });
        break;
      case "code-output":
        selectedKeys = [key];
        onAnswerChange({ type: "code-output", value: key });
        break;
    }
  }

  function isSubmitted(key: string): boolean {
    switch (submittedAnswer?.type) {
      case "single-choice":
        return submittedAnswer.optionId === key;
      case "multi-select":
        return submittedAnswer.optionIds.includes(key);
      case "fill-blank":
      case "code-output":
        return submittedAnswer.value === key;
      default:
        return false;
    }
  }

  function isCanonical(key: string): boolean {
    switch (reveal?.type) {
      case "single-choice":
        return reveal.optionId === key;
      case "multi-select":
        return reveal.optionIds.includes(key);
      case "fill-blank":
      case "code-output":
        return reveal.value === key;
      default:
        return false;
    }
  }

  function choiceLabel(choice: DisplayChoice): string {
    if (choice.content) return contentLabel(choice.content);
    if (question.type === "code-output" && choice.text === "") return "출력 없음";
    return choice.text ?? "";
  }

  function groupLabel(): string {
    switch (question.type) {
      case "multi-select":
        return "정답을 모두 선택하세요.";
      case "code-output":
        return "출력 결과를 고르세요";
      default:
        return "답을 고르세요";
    }
  }
</script>

<div class="question-body">
  {#each question.prompt as block}
    <ContentBlockRenderer {block} />
  {/each}

  {#if question.type === "code-output"}
    <pre class="code" aria-label="실행할 Python 코드"><code>{question.code}</code></pre>
  {/if}

  <div
    class="options"
    class:compact={question.type === "fill-blank" || question.type === "code-output"}
    class:output={question.type === "code-output"}
    role={question.type === "multi-select" ? "group" : "radiogroup"}
    aria-label={groupLabel()}
  >
    {#each displayedChoices as choice}
      {@const selected = selectedKeys.includes(choice.key)}
      {@const submitted = isSubmitted(choice.key)}
      {@const canonical = isCanonical(choice.key)}
      <button
        type="button"
        class="option"
        class:selected
        class:submitted
        class:canonical
        class:compact={question.type === "fill-blank" || question.type === "code-output"}
        class:output={question.type === "code-output"}
        role={question.type === "multi-select" ? undefined : "radio"}
        aria-checked={question.type === "multi-select" ? undefined : selected}
        aria-pressed={question.type === "multi-select" ? selected : undefined}
        aria-label={`${choiceLabel(choice)}${selected && question.type === "multi-select" ? ", 선택됨" : ""}${submitted ? ", 내 답" : ""}${canonical ? ", 정답" : ""}`}
        disabled={disabled}
        onclick={() => selectChoice(choice.key)}
      >
        {#if choice.content}
          <span class="option-content">
            {#each choice.content as block}
              <ContentBlockRenderer {block} />
            {/each}
          </span>
        {:else}
          <span class:choice-output={question.type === "code-output"}>
            {question.type === "code-output" && choice.text === "" ? "출력 없음" : choice.text}
          </span>
        {/if}
        {#if submitted}<span class="answer-marker">내 답</span>{/if}
        {#if canonical}<span class="answer-marker">정답</span>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .question-body { display: grid; gap: 1rem; }
  .options { display: grid; gap: 0.75rem; }
  .options.compact { grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); gap: 0.6rem; }
  .options.output { grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); }
  .option {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    border: 1px solid #dce3ef;
    border-radius: 0.75rem;
    background: white;
    padding: 0.8rem 1rem;
    text-align: left;
    cursor: pointer;
  }
  .option.compact {
    justify-content: center;
    min-height: 3rem;
    border-color: #cbd5e1;
    border-radius: 0.6rem;
    padding: 0.65rem 0.85rem;
    color: #1e3a8a;
    font: inherit;
    line-height: 1.35;
    overflow-wrap: anywhere;
    text-align: center;
  }
  .option.output {
    justify-content: flex-start;
    min-height: 3.25rem;
    padding: 0.7rem 0.85rem;
    color: inherit;
    text-align: left;
  }
  .option.selected { border-color: #2563eb; box-shadow: 0 0 0 2px rgb(37 99 235 / 15%); }
  .option.compact.selected { background: #eff6ff; box-shadow: none; }
  .option.submitted { border-color: #b45309; }
  .option.canonical { border-color: #15803d; }
  .option-content { flex: 1; min-width: 0; }
  .option-content :global(p), .option-content :global(pre) { margin: 0; }
  .choice-output {
    display: block;
    flex: 1;
    width: 100%;
    margin: 0;
    padding: 0;
    background: transparent;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 0.95rem;
    line-height: 1.4;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .code {
    margin: 0;
    overflow-x: auto;
    border: 1px solid #dce3ef;
    border-radius: 0.7rem;
    background: #f1f5fb;
    padding: 1rem;
    font-family: "SFMono-Regular", Consolas, monospace;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  .code code { display: block; background: transparent; padding: 0; font-size: inherit; white-space: inherit; }
  .answer-marker {
    flex: 0 0 auto;
    border-radius: 999px;
    background: #eef2ff;
    padding: 0.2rem 0.45rem;
    color: #3730a3;
    font-size: 0.78rem;
    font-weight: 700;
    white-space: nowrap;
  }
  .option:disabled { cursor: default; }
  .option:focus-visible { outline: 3px solid rgb(37 99 235 / 35%); outline-offset: 2px; }
  @media (max-width: 640px) { .options.compact { grid-template-columns: 1fr; } }
</style>
