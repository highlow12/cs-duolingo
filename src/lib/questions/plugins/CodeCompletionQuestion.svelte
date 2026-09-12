<script lang="ts">
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import type { QuestionRendererProps } from "$lib/questions/renderer-contract";
  import { shuffleDistinct } from "$lib/questions/shuffle";

  type Props = QuestionRendererProps<"code-completion">;
  let {
    question,
    disabled,
    attemptKey,
    reveal,
    submittedAnswer = null,
    random = Math.random,
    onAnswerChange,
  }: Props = $props();

  let values = $state<Record<string, string>>({});
  let displayedChoices = $state<Record<string, string[]>>({});
  let previousChoices = $state<Record<string, string[]>>({});
  let renderedKey = $state("");
  let renderedIdentity = $state("");

  $effect(() => {
    const identity = `${question.id}:${question.revision}`;
    const key = `${identity}:${attemptKey}`;
    if (renderedKey === key) return;
    if (renderedIdentity !== identity) previousChoices = {};
    renderedIdentity = identity;
    renderedKey = key;
    displayedChoices = Object.fromEntries(
      question.blanks.map((blank) => [
        blank.id,
        shuffleDistinct(blank.choices, random, previousChoices[blank.id]),
      ]),
    );
    previousChoices = Object.fromEntries(
      Object.entries(displayedChoices).map(([id, choices]) => [id, [...choices]]),
    );
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
          {#each displayedChoices[blank.id] ?? [] as choice}
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
  .question-body { display: grid; gap: var(--space-4); }
  .code-preview { margin: 0; overflow-x: auto; border:1px solid color-mix(in srgb,var(--primary) 35%,var(--border)); border-radius: var(--radius-md); background: var(--code-bg); color:var(--code-text); padding: 1rem; font-family: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; line-height: 1.8; white-space: pre-wrap; }
  .code-preview code { display: block; background: transparent; padding: 0; font-size: inherit; white-space: inherit; }
  .blank-sections { display: grid; gap: var(--space-4); }
  .blank-section { display: grid; gap: var(--space-2); }
  .blank-label { margin: 0; color: var(--text-muted); font-size: 0.78rem; font-weight: 600; }
  .blank-choice-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); gap: var(--space-2); }
  .blank-choice { display: flex; align-items: center; justify-content: center; gap: var(--space-2); width: 100%; min-height: 3rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); padding: 0.65rem 0.85rem; color: var(--text); font: inherit; line-height: 1.35; overflow-wrap: anywhere; text-align: center; cursor: pointer; transition: border-color var(--dur-1) ease, background-color var(--dur-1) ease; }
  .blank-choice:hover:not(:disabled) { border-color: var(--border-strong); background: var(--surface-muted); }
  .blank-choice.selected { border-color: var(--primary); background: var(--primary-soft); }
  .blank-choice.submitted { border-color: var(--warning); background: var(--warning-soft); }
  .blank-choice.canonical { border-color: var(--success); background: var(--success-soft); }
  .answer-marker { border-radius: 999px; background: var(--primary-soft); padding: 0.2rem 0.45rem; color: var(--primary-strong); font-size: 0.72rem; font-weight: 650; white-space: nowrap; }
  .blank-choice:disabled { cursor: default; }
  .blank-choice:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  @media (max-width: 640px) { .blank-choice-grid { grid-template-columns: 1fr; } }
</style>
