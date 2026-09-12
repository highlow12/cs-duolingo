<script lang="ts">
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import { contentLabel } from "$lib/questions/presentation";
  import type { QuestionRendererProps } from "$lib/questions/renderer-contract";
  import { shuffleDistinct } from "$lib/questions/shuffle";

  type Props = QuestionRendererProps<"matching">;
  let {
    question,
    disabled,
    attemptKey,
    reveal,
    submittedAnswer = null,
    random = Math.random,
    onAnswerChange,
  }: Props = $props();

  let rightItems = $state<typeof question.rightItems>([]);
  let selectedLeftId = $state<string | null>(null);
  let selectedRightId = $state<string | null>(null);
  let matchedLeftIds = $state<string[]>([]);
  let matchedRightIds = $state<string[]>([]);
  let renderedKey = $state("");
  let renderedIdentity = $state("");
  let previousRightOrder = $state<typeof question.rightItems | null>(null);
  let announcement = $state("A와 B에서 카드 한 장씩 골라 짝을 맞추세요.");

  $effect(() => {
    const identity = `${question.id}:${question.revision}`;
    const key = `${identity}:${attemptKey}`;
    if (renderedKey === key) return;
    if (renderedIdentity !== identity) previousRightOrder = null;
    renderedIdentity = identity;
    renderedKey = key;
    rightItems = shuffleDistinct(question.rightItems, random, previousRightOrder);
    previousRightOrder = [...rightItems];
    selectedLeftId = null;
    selectedRightId = null;
    matchedLeftIds = [];
    matchedRightIds = [];
    announcement = "A와 B에서 카드 한 장씩 골라 짝을 맞추세요.";
    onAnswerChange(null);
  });

  function isMatched(side: "left" | "right", id: string): boolean {
    return side === "left" ? matchedLeftIds.includes(id) : matchedRightIds.includes(id);
  }

  function isSelected(side: "left" | "right", id: string): boolean {
    return side === "left" ? selectedLeftId === id : selectedRightId === id;
  }

  function pairForRight(rightId: string): string | null {
    return question.correctPairs.find((pair) => pair.rightId === rightId)?.leftId ?? null;
  }

  function emitAnswerIfComplete() {
    if (matchedLeftIds.length !== question.leftItems.length) {
      onAnswerChange(null);
      return;
    }
    onAnswerChange({
      type: "matching",
      pairs: question.leftItems.map((item) => ({
        leftId: item.id,
        rightId: question.correctPairs.find((pair) => pair.leftId === item.id)?.rightId ?? "",
      })),
    });
  }

  function selectCard(side: "left" | "right", id: string) {
    if (disabled || isMatched(side, id)) return;
    if (side === "left") selectedLeftId = id;
    else selectedRightId = id;

    const leftId = side === "left" ? id : selectedLeftId;
    const rightId = side === "right" ? id : selectedRightId;
    if (!leftId || !rightId) {
      announcement = side === "left" ? "B 오른쪽 카드에서 한 장을 더 고르세요." : "A 왼쪽 카드에서 한 장을 더 고르세요.";
      onAnswerChange(null);
      return;
    }

    if (pairForRight(rightId) === leftId) {
      matchedLeftIds = [...matchedLeftIds, leftId];
      matchedRightIds = [...matchedRightIds, rightId];
      selectedLeftId = null;
      selectedRightId = null;
      announcement = "짝을 맞췄습니다.";
      emitAnswerIfComplete();
      return;
    }

    selectedLeftId = null;
    selectedRightId = null;
    announcement = "짝이 아닙니다. A와 B에서 다시 골라 보세요.";
    onAnswerChange(null);
  }

  function isSubmitted(side: "left" | "right", id: string): boolean {
    if (submittedAnswer?.type !== "matching") return false;
    if (side === "left") return submittedAnswer.pairs.some((pair) => pair.leftId === id);
    return submittedAnswer.pairs.some((pair) => pair.rightId === id);
  }

  function isCanonical(side: "left" | "right", id: string): boolean {
    if (!reveal || reveal.type !== "matching") return false;
    return side === "left"
      ? reveal.pairs.some((pair) => pair.leftId === id)
      : reveal.pairs.some((pair) => pair.rightId === id);
  }

  function cardLabel(side: "left" | "right", id: string): string {
    const items = side === "left" ? question.leftItems : question.rightItems;
    const item = items.find((candidate) => candidate.id === id);
    return item ? contentLabel(item.content) : "내용 없음";
  }

  function accessibleLabel(side: "left" | "right", id: string): string {
    const state = isMatched(side, id) ? ", 짝을 맞춤" : isSelected(side, id) ? ", 선택됨" : "";
    const submitted = isSubmitted(side, id) ? ", 내 답" : "";
    const canonical = isCanonical(side, id) ? ", 정답" : "";
    return `${side === "left" ? "A 왼쪽" : "B 오른쪽"} 카드: ${cardLabel(side, id)}${state}${submitted}${canonical}`;
  }
</script>

<div class="question-body">
  {#each question.prompt as block}
    <ContentBlockRenderer {block} />
  {/each}

  <div class="matching-board" role="group" aria-label="A와 B의 짝 맞추기">
    <section class="matching-column" aria-labelledby={`matching-left-${question.id}`}>
      <h3 id={`matching-left-${question.id}`}>A · 왼쪽 항목</h3>
      <div class="card-list">
        {#each question.leftItems as item}
          {@const selected = isSelected("left", item.id)}
          {@const matched = isMatched("left", item.id)}
          <button
            type="button"
            class:selected
            class:matched
            class="memory-card"
            aria-pressed={selected || matched}
            aria-label={accessibleLabel("left", item.id)}
            disabled={disabled || matched}
            onclick={() => selectCard("left", item.id)}
          >
            <span class="card-content">
              {#each item.content as block}<ContentBlockRenderer {block} />{/each}
            </span>
            {#if isSubmitted("left", item.id)}<span class="answer-marker">내 답</span>{/if}
            {#if isCanonical("left", item.id)}<span class="answer-marker">정답</span>{/if}
          </button>
        {/each}
      </div>
    </section>

    <section class="matching-column" aria-labelledby={`matching-right-${question.id}`}>
      <h3 id={`matching-right-${question.id}`}>B · 오른쪽 항목</h3>
      <div class="card-list">
        {#each rightItems as item}
          {@const selected = isSelected("right", item.id)}
          {@const matched = isMatched("right", item.id)}
          <button
            type="button"
            class:selected
            class:matched
            class="memory-card"
            aria-pressed={selected || matched}
            aria-label={accessibleLabel("right", item.id)}
            disabled={disabled || matched}
            onclick={() => selectCard("right", item.id)}
          >
            <span class="card-content">
              {#each item.content as block}<ContentBlockRenderer {block} />{/each}
            </span>
            {#if isSubmitted("right", item.id)}<span class="answer-marker">내 답</span>{/if}
            {#if isCanonical("right", item.id)}<span class="answer-marker">정답</span>{/if}
          </button>
        {/each}
      </div>
    </section>
  </div>

  <p class="announcement" aria-live="polite">{announcement}</p>
</div>

<style>
  .question-body { display: grid; gap: var(--space-4); }
  .matching-board { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-3); }
  .matching-column { display: grid; min-width: 0; align-content: start; gap: var(--space-2); }
  .matching-column h3 { margin: 0; color: var(--text-muted); font-size: 0.78rem; font-weight: 600; }
  .card-list { display: grid; gap: var(--space-3); }
  .memory-card { display: flex; align-items: center; gap: var(--space-2); width: 100%; min-width: 0; max-width: 100%; min-height: 4.5rem; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); padding: 0.75rem; color: var(--text); text-align: center; cursor: pointer; transition: border-color var(--dur-1) ease, background-color var(--dur-1) ease, box-shadow var(--dur-1) ease; }
  .memory-card:hover:not(:disabled) { border-color: var(--border-strong); background: var(--surface-muted); }
  .memory-card.selected { border-color: var(--primary); background: var(--primary-soft); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent); }
  .memory-card.matched { border-color: var(--success); background: var(--success-soft); }
  .card-content { flex: 1; min-width: 0; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
  .card-content :global(p), .card-content :global(pre) { margin: 0; }
  .card-content :global(pre), .card-content :global(code) { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
  .answer-marker { flex: 0 0 auto; border-radius: 999px; background: var(--primary-soft); padding: 0.2rem 0.45rem; color: var(--primary-strong); font-size: 0.72rem; font-weight: 650; white-space: nowrap; }
  .memory-card:disabled { cursor: default; }
  .memory-card:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .announcement { min-height: 1.5rem; margin: 0; color: var(--text-muted); font-size: .85rem; }
  @media (max-width: 640px) { .matching-board { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
</style>
