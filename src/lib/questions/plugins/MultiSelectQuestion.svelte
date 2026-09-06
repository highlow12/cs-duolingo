<script lang="ts">
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import { evaluateQuestion } from "$lib/questions/registry";
  import type {
    EvaluationResult,
    MultiSelectQuestion,
  } from "$lib/questions/types";

  let {
    question,
    onEvaluated = () => {},
  }: {
    question: MultiSelectQuestion;
    onEvaluated?: (result: EvaluationResult) => void;
  } = $props();

  let selectedIds = $state<string[]>([]);
  let result = $state<EvaluationResult | null>(null);
  let error = $state<string | null>(null);

  function toggleOption(optionId: string) {
    if (result) return;
    selectedIds = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    error = null;
  }

  function submit() {
    if (selectedIds.length === 0 || result) return;
    const outcome = evaluateQuestion(question, {
      type: "multi-select",
      optionIds: [...selectedIds],
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

  <div class="options" role="group" aria-label="정답을 모두 선택하세요.">
    {#each question.options as option}
      <button
        type="button"
        class:selected={selectedIds.includes(option.id)}
        class="option"
        aria-pressed={selectedIds.includes(option.id)}
        disabled={result !== null}
        onclick={() => toggleOption(option.id)}
      >
        {#each option.content as block}
          <ContentBlockRenderer {block} />
        {/each}
      </button>
    {/each}
  </div>

  <button
    class="button"
    type="button"
    disabled={selectedIds.length === 0 || result !== null}
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
      {result.correct ? "정답입니다." : "선택한 항목을 다시 확인해 보세요."}
    </p>
  {/if}
</div>

<style>
  .question-body {
    display: grid;
    gap: 1rem;
  }

  .options {
    display: grid;
    gap: 0.75rem;
  }

  .option {
    border: 1px solid #dce3ef;
    border-radius: 0.75rem;
    background: white;
    padding: 0.8rem 1rem;
    text-align: left;
    cursor: pointer;
  }

  .option.selected {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgb(37 99 235 / 15%);
  }

  .option :global(p),
  .option :global(pre) {
    margin: 0;
  }

  .option:disabled {
    cursor: default;
  }

  .option:focus-visible {
    outline: 3px solid rgb(37 99 235 / 35%);
    outline-offset: 2px;
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
</style>
