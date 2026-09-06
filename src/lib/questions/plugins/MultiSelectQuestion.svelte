<script lang="ts">
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import { contentLabel } from "$lib/questions/presentation";
  import type { QuestionRendererProps } from "$lib/questions/renderer-contract";
  import { shuffleDistinct } from "$lib/questions/shuffle";

  type Props = QuestionRendererProps<"multi-select">;
  let {
    question,
    disabled,
    attemptKey,
    reveal,
    submittedAnswer = null,
    random = Math.random,
    onAnswerChange,
  }: Props = $props();

  let selectedIds = $state<string[]>([]);
  let displayedOptions = $state<typeof question.options>([]);
  let renderedKey = $state("");
  let renderedIdentity = $state("");
  let previousOrder = $state<typeof question.options | null>(null);

  $effect(() => {
    const key = `${question.id}:${question.revision}:${attemptKey}`;
    if (renderedKey === key) return;
    const identity = `${question.id}:${question.revision}`;
    if (renderedIdentity !== identity) previousOrder = null;
    renderedIdentity = identity;
    renderedKey = key;
    displayedOptions = question.shuffleOptions
      ? shuffleDistinct(question.options, random, previousOrder)
      : [...question.options];
    previousOrder = [...displayedOptions];
    selectedIds = [];
    onAnswerChange(null);
  });

  function toggleOption(optionId: string) {
    if (disabled) return;
    selectedIds = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    onAnswerChange(
      selectedIds.length === 0
        ? null
        : { type: "multi-select", optionIds: [...selectedIds] },
    );
  }

  function isSubmitted(optionId: string): boolean {
    return submittedAnswer?.type === "multi-select" && submittedAnswer.optionIds.includes(optionId);
  }

  function isCanonical(optionId: string): boolean {
    return reveal?.type === "multi-select" && reveal.optionIds.includes(optionId);
  }
</script>

<div class="question-body">
  {#each question.prompt as block}
    <ContentBlockRenderer {block} />
  {/each}

  <div class="options" role="group" aria-label="정답을 모두 선택하세요.">
    {#each displayedOptions as option}
      {@const selected = selectedIds.includes(option.id)}
      {@const submitted = isSubmitted(option.id)}
      {@const canonical = isCanonical(option.id)}
      <button
        type="button"
        class:selected
        class:submitted
        class:canonical
        class="option"
        aria-pressed={selected}
        aria-label={`${contentLabel(option.content)}${selected ? ", 선택됨" : ""}${submitted ? ", 내 답" : ""}${canonical ? ", 정답" : ""}`}
        disabled={disabled}
        onclick={() => toggleOption(option.id)}
      >
        <span class="option-content">
          {#each option.content as block}
            <ContentBlockRenderer {block} />
          {/each}
        </span>
        {#if submitted}<span class="answer-marker">내 답</span>{/if}
        {#if canonical}<span class="answer-marker">정답</span>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .question-body { display: grid; gap: 1rem; }
  .options { display: grid; gap: 0.75rem; }
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
  .option.selected { border-color: #2563eb; box-shadow: 0 0 0 2px rgb(37 99 235 / 15%); }
  .option.submitted { border-color: #b45309; }
  .option.canonical { border-color: #15803d; }
  .option-content { flex: 1; min-width: 0; }
  .option-content :global(p), .option-content :global(pre) { margin: 0; }
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
</style>
