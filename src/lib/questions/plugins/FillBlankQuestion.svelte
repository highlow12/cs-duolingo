<script lang="ts">
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import type { QuestionRendererProps } from "$lib/questions/renderer-contract";

  type Props = QuestionRendererProps<"fill-blank">;
  let {
    question,
    disabled,
    attemptKey,
    reveal,
    submittedAnswer = null,
    onAnswerChange,
  }: Props = $props();

  let value = $state<string | null>(null);
  let renderedKey = $state("");

  $effect(() => {
    const key = `${question.id}:${question.revision}:${attemptKey}`;
    if (renderedKey === key) return;
    renderedKey = key;
    value = null;
    onAnswerChange(null);
  });

  function selectChoice(choice: string) {
    if (disabled) return;
    value = choice;
    onAnswerChange({ type: "fill-blank", value: choice });
  }

  function isSubmitted(choice: string): boolean {
    return submittedAnswer?.type === "fill-blank" && submittedAnswer.value === choice;
  }

  function isCanonical(choice: string): boolean {
    return reveal?.type === "fill-blank" && reveal.value === choice;
  }
</script>

<div class="question-body">
  {#each question.prompt as block}
    <ContentBlockRenderer {block} />
  {/each}

  <div class="choices" role="radiogroup" aria-label="답을 고르세요">
    {#each question.choices as choice}
      {@const selected = value === choice}
      {@const submitted = isSubmitted(choice)}
      {@const canonical = isCanonical(choice)}
      <button
        type="button"
        class:selected
        class:submitted
        class:canonical
        class="choice"
        role="radio"
        aria-checked={selected}
        aria-label={`${choice}${submitted ? ", 내 답" : ""}${canonical ? ", 정답" : ""}`}
        disabled={disabled}
        onclick={() => selectChoice(choice)}
      >
        <span>{choice}</span>
        {#if submitted}<span class="answer-marker">내 답</span>{/if}
        {#if canonical}<span class="answer-marker">정답</span>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .question-body { display: grid; gap: 1rem; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); gap: 0.6rem; }
  .choice {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 3rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.6rem;
    background: white;
    padding: 0.65rem 0.85rem;
    color: #1e3a8a;
    font: inherit;
    line-height: 1.35;
    overflow-wrap: anywhere;
    text-align: center;
    cursor: pointer;
  }
  .choice.selected { border-color: #2563eb; background: #eff6ff; }
  .choice.submitted { border-color: #b45309; }
  .choice.canonical { border-color: #15803d; }
  .answer-marker { border-radius: 999px; background: #eef2ff; padding: 0.2rem 0.45rem; color: #3730a3; font-size: 0.78rem; font-weight: 700; white-space: nowrap; }
  .choice:disabled { cursor: default; }
  .choice:focus-visible { outline: 3px solid rgb(37 99 235 / 35%); outline-offset: 2px; }
  @media (max-width: 640px) { .choices { grid-template-columns: 1fr; } }
</style>
