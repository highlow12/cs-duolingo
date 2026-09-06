<script lang="ts">
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import { evaluateQuestion } from "$lib/questions/registry";
  import type {
    CodeOutputQuestion,
    EvaluationResult,
  } from "$lib/questions/types";

  let {
    question,
    onEvaluated = () => {},
  }: {
    question: CodeOutputQuestion;
    onEvaluated?: (result: EvaluationResult) => void;
  } = $props();

  let value = $state<string | null>(null);
  let result = $state<EvaluationResult | null>(null);
  let error = $state<string | null>(null);

  function selectChoice(choice: string) {
    if (result) return;
    value = choice;
    error = null;
  }

  function submit() {
    if (result || value === null) return;
    const outcome = evaluateQuestion(question, {
      type: "code-output",
      value,
    });
    if (outcome.status === "error") {
      error = outcome.error.message;
      return;
    }
    result = outcome.result;
    onEvaluated(result);
  }
</script>

<div class="question-body">
  {#each question.prompt as block}
    <ContentBlockRenderer {block} />
  {/each}

  <pre class="code"><code>{question.code}</code></pre>
  <div class="choices" role="group" aria-label="출력 결과를 고르세요">
    {#each question.choices as choice}
      <button
        type="button"
        class:selected={value === choice}
        class="choice"
        aria-pressed={value === choice}
        disabled={result !== null}
        onclick={() => selectChoice(choice)}
      >
        <span class="choice-output">{choice === "" ? "출력 없음" : choice}</span
        >
      </button>
    {/each}
  </div>

  <button
    class="button"
    type="button"
    disabled={value === null || result !== null}
    onclick={submit}>정답 확인</button
  >

  {#if error}
    <p class="feedback incorrect" role="alert">{error}</p>
  {:else if result}
    <p
      class:correct={result.correct}
      class:incorrect={!result.correct}
      class="feedback"
      role="status"
    >
      {result.correct ? "정답입니다." : "출력을 다시 확인해 보세요."}
    </p>
  {/if}
</div>

<style>
  .question-body {
    display: grid;
    gap: 1rem;
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

  .code code {
    display: block;
    background: transparent;
    padding: 0;
    font-size: inherit;
    white-space: inherit;
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    gap: 0.6rem;
  }

  .choice {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 3.25rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.6rem;
    background: white;
    padding: 0.7rem 0.85rem;
    text-align: left;
    cursor: pointer;
  }

  .choice.selected {
    border-color: #2563eb;
    background: #eff6ff;
  }

  .choice:disabled {
    cursor: default;
  }

  .choice:focus-visible {
    outline: 3px solid rgb(37 99 235 / 35%);
    outline-offset: 2px;
  }

  .choice-output {
    display: block;
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

  .feedback {
    margin: 0;
    font-weight: 700;
  }

  .correct {
    color: #15803d;
  }

  .incorrect {
    color: #b91c1c;
  }

  @media (max-width: 640px) {
    .choices {
      grid-template-columns: 1fr;
    }
  }
</style>
