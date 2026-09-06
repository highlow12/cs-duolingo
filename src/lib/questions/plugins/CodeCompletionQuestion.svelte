<script lang="ts">
  import { onMount } from "svelte";
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import { evaluateQuestion } from "$lib/questions/registry";
  import type {
    CodeCompletionQuestion,
    EvaluationResult,
  } from "$lib/questions/types";

  let {
    question,
    onEvaluated = () => {},
  }: {
    question: CodeCompletionQuestion;
    onEvaluated?: (result: EvaluationResult) => void;
  } = $props();

  let values = $state<Record<string, string>>({});
  let result = $state<EvaluationResult | null>(null);
  let error = $state<string | null>(null);

  onMount(() => {
    values = Object.fromEntries(question.blanks.map((blank) => [blank.id, ""]));
  });

  function previewTemplate(): string {
    return question.template.replace(
      /\{\{blank:([^}]+)\}\}/g,
      (_match, id: string) => values[id] || "___",
    );
  }

  function selectValue(id: string, value: string) {
    if (result) return;
    values = { ...values, [id]: value };
    error = null;
  }

  function readyToSubmit() {
    return question.blanks.every(
      (blank) => values[blank.id]?.trim().length > 0,
    );
  }

  function submit() {
    if (!readyToSubmit() || result) return;
    const outcome = evaluateQuestion(question, {
      type: "code-completion",
      values: { ...values },
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

  <pre class="code-preview" aria-label="빈칸이 포함된 Python 코드"><code
      >{previewTemplate()}</code
    ></pre>

  <div class="blank-sections">
    {#each question.blanks as blank, index}
      {@const labelId = `blank-label-${blank.id}`}
      <section class="blank-section" aria-labelledby={labelId}>
        <h3 id={labelId} class="blank-label">빈칸 {index + 1}</h3>
        <div
          class="blank-choice-grid"
          role="group"
          aria-label={`빈칸 ${index + 1}의 선택지`}
        >
          {#each blank.choices as choice}
            <button
              type="button"
              class="blank-choice"
              class:selected={values[blank.id] === choice}
              aria-pressed={values[blank.id] === choice}
              disabled={result !== null}
              onclick={() => selectValue(blank.id, choice)}
            >
              {choice}
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>

  <button
    class="button"
    type="button"
    disabled={!readyToSubmit() || result !== null}
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
      {result.correct ? "정답입니다." : "빈칸의 답을 다시 확인해 보세요."}
    </p>
  {/if}
</div>

<style>
  .question-body {
    display: grid;
    gap: 1rem;
  }

  .code-preview {
    margin: 0;
    overflow-x: auto;
    border-radius: 0.7rem;
    background: #f1f5fb;
    padding: 1rem;
    font-family: "SFMono-Regular", Consolas, monospace;
    line-height: 1.8;
    white-space: pre-wrap;
  }

  .code-preview code {
    display: block;
    background: transparent;
    padding: 0;
    font-size: inherit;
    white-space: inherit;
  }

  .blank-sections {
    display: grid;
    gap: 1rem;
  }

  .blank-section {
    display: grid;
    gap: 0.5rem;
  }

  .blank-label {
    margin: 0;
    color: #334155;
    font-size: 0.9rem;
    font-weight: 700;
  }

  .blank-choice-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
    gap: 0.6rem;
  }

  .blank-choice {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 3rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.65rem;
    background: white;
    padding: 0.65rem 0.85rem;
    color: #1e3a8a;
    font: inherit;
    line-height: 1.35;
    overflow-wrap: anywhere;
    text-align: center;
    cursor: pointer;
  }

  .blank-choice.selected {
    border-color: #2563eb;
    background: #eff6ff;
    box-shadow: 0 0 0 2px rgb(37 99 235 / 15%);
  }

  .blank-choice:disabled {
    cursor: default;
  }

  .blank-choice:focus-visible {
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

  @media (max-width: 640px) {
    .blank-choice-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
