<script lang="ts">
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import type { QuestionRendererProps } from "$lib/questions/renderer-contract";

  type Props = QuestionRendererProps<"code-completion">;
  let {
    question,
    disabled,
    attemptKey,
    reveal,
    submittedAnswer = null,
    onAnswerChange,
  }: Props = $props();

  let values = $state<Record<string, string>>({});
  let renderedKey = $state("");

  $effect(() => {
    const key = `${question.id}:${question.revision}:${attemptKey}`;
    if (renderedKey === key) return;
    renderedKey = key;
    values = Object.fromEntries(question.blanks.map((blank) => [blank.id, ""]));
    onAnswerChange(null);
  });

  function orderedBlanks() {
    const seen = new Set<string>();
    const ordered = [] as typeof question.blanks;
    const pattern = /\{\{blank:([^}]+)\}\}/g;
    for (const match of question.template.matchAll(pattern)) {
      const blank = question.blanks.find((candidate) => candidate.id === match[1]);
      if (blank && !seen.has(blank.id)) {
        seen.add(blank.id);
        ordered.push(blank);
      }
    }
    for (const blank of question.blanks) if (!seen.has(blank.id)) ordered.push(blank);
    return ordered;
  }

  function previewTemplate(): string {
    return question.template.replace(
      /\{\{blank:([^}]+)\}\}/g,
      (_match, id: string) => values[id] || "___",
    );
  }

  function selectValue(id: string, value: string) {
    if (disabled) return;
    values = { ...values, [id]: value };
    const complete = question.blanks.every((blank) => values[blank.id]?.length > 0);
    onAnswerChange(
      complete
        ? { type: "code-completion", values: { ...values } }
        : null,
    );
  }

  function isSubmitted(id: string, choice: string): boolean {
    return submittedAnswer?.type === "code-completion" && submittedAnswer.values[id] === choice;
  }

  function isCanonical(id: string, choice: string): boolean {
    return reveal?.type === "code-completion" && reveal.values[id] === choice;
  }
</script>

<div class="question-body">
  {#each question.prompt as block}
    <ContentBlockRenderer {block} />
  {/each}

  <pre class="code-preview" aria-label="빈칸이 포함된 Python 코드"><code>{previewTemplate()}</code></pre>

  <div class="blank-sections">
    {#each orderedBlanks() as blank, index}
      {@const labelId = `blank-label-${question.id}-${blank.id}`}
      <section class="blank-section" aria-labelledby={labelId}>
        <h3 id={labelId} class="blank-label">빈칸 {index + 1}</h3>
        <div class="blank-choice-grid" role="group" aria-label={`빈칸 ${index + 1}의 선택지`}>
          {#each blank.choices as choice}
            {@const selected = values[blank.id] === choice}
            {@const submitted = isSubmitted(blank.id, choice)}
            {@const canonical = isCanonical(blank.id, choice)}
            <button
              type="button"
              class:selected
              class:submitted
              class:canonical
              class="blank-choice"
              aria-pressed={selected}
              aria-label={`${choice}${submitted ? ", 내 답" : ""}${canonical ? ", 정답" : ""}`}
              disabled={disabled}
              onclick={() => selectValue(blank.id, choice)}
            >
              <span>{choice}</span>
              {#if submitted}<span class="answer-marker">내 답</span>{/if}
              {#if canonical}<span class="answer-marker">정답</span>{/if}
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>

<style>
  .question-body { display: grid; gap: 1rem; }
  .code-preview { margin: 0; overflow-x: auto; border-radius: 0.7rem; background: #f1f5fb; padding: 1rem; font-family: "SFMono-Regular", Consolas, monospace; line-height: 1.8; white-space: pre-wrap; }
  .code-preview code { display: block; background: transparent; padding: 0; font-size: inherit; white-space: inherit; }
  .blank-sections { display: grid; gap: 1rem; }
  .blank-section { display: grid; gap: 0.5rem; }
  .blank-label { margin: 0; color: #334155; font-size: 0.9rem; font-weight: 700; }
  .blank-choice-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); gap: 0.6rem; }
  .blank-choice { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; min-height: 3rem; border: 1px solid #cbd5e1; border-radius: 0.65rem; background: white; padding: 0.65rem 0.85rem; color: #1e3a8a; font: inherit; line-height: 1.35; overflow-wrap: anywhere; text-align: center; cursor: pointer; }
  .blank-choice.selected { border-color: #2563eb; background: #eff6ff; }
  .blank-choice.submitted { border-color: #b45309; }
  .blank-choice.canonical { border-color: #15803d; }
  .answer-marker { border-radius: 999px; background: #eef2ff; padding: 0.2rem 0.45rem; color: #3730a3; font-size: 0.78rem; font-weight: 700; white-space: nowrap; }
  .blank-choice:disabled { cursor: default; }
  .blank-choice:focus-visible { outline: 3px solid rgb(37 99 235 / 35%); outline-offset: 2px; }
  @media (max-width: 640px) { .blank-choice-grid { grid-template-columns: 1fr; } }
</style>
