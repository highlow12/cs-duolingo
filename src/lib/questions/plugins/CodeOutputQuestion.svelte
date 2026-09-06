<script lang="ts">
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import type { QuestionRendererProps } from "$lib/questions/renderer-contract";

  type Props = QuestionRendererProps<"code-output">;
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
    onAnswerChange({ type: "code-output", value: choice });
  }

  function isSubmitted(choice: string): boolean {
    return submittedAnswer?.type === "code-output" && submittedAnswer.value === choice;
  }

  function isCanonical(choice: string): boolean {
    return reveal?.type === "code-output" && reveal.value === choice;
  }
</script>

<div class="question-body">
  {#each question.prompt as block}
    <ContentBlockRenderer {block} />
  {/each}

  <pre class="code" aria-label="실행할 Python 코드"><code>{question.code}</code></pre>
  <div class="choices" role="radiogroup" aria-label="출력 결과를 고르세요">
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
        aria-label={`${choice === "" ? "출력 없음" : choice}${submitted ? ", 내 답" : ""}${canonical ? ", 정답" : ""}`}
        disabled={disabled}
        onclick={() => selectChoice(choice)}
      >
        <span class="choice-output">{choice === "" ? "출력 없음" : choice}</span>
        {#if submitted}<span class="answer-marker">내 답</span>{/if}
        {#if canonical}<span class="answer-marker">정답</span>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .question-body { display: grid; gap: 1rem; }
  .code { margin: 0; overflow-x: auto; border: 1px solid #dce3ef; border-radius: 0.7rem; background: #f1f5fb; padding: 1rem; font-family: "SFMono-Regular", Consolas, monospace; line-height: 1.6; white-space: pre-wrap; }
  .code code { display: block; background: transparent; padding: 0; font-size: inherit; white-space: inherit; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: 0.6rem; }
  .choice { display: flex; align-items: center; gap: 0.55rem; width: 100%; min-height: 3.25rem; border: 1px solid #cbd5e1; border-radius: 0.6rem; background: white; padding: 0.7rem 0.85rem; text-align: left; cursor: pointer; }
  .choice.selected { border-color: #2563eb; background: #eff6ff; }
  .choice.submitted { border-color: #b45309; }
  .choice.canonical { border-color: #15803d; }
  .choice-output { display: block; flex: 1; width: 100%; margin: 0; padding: 0; background: transparent; font-family: "SFMono-Regular", Consolas, monospace; font-size: 0.95rem; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
  .answer-marker { flex: 0 0 auto; border-radius: 999px; background: #eef2ff; padding: 0.2rem 0.45rem; color: #3730a3; font-size: 0.78rem; font-weight: 700; white-space: nowrap; }
  .choice:disabled { cursor: default; }
  .choice:focus-visible { outline: 3px solid rgb(37 99 235 / 35%); outline-offset: 2px; }
  @media (max-width: 640px) { .choices { grid-template-columns: 1fr; } }
</style>
