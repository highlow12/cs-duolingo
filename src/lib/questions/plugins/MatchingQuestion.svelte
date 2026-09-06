<script lang="ts">
  import { onMount } from "svelte";
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import { evaluateQuestion } from "$lib/questions/registry";
  import type { ContentBlock } from "$lib/content/types";
  import type {
    EvaluationResult,
    MatchingQuestion,
  } from "$lib/questions/types";

  type MatchingCard = {
    cardId: string;
    pairId: string;
    side: "left" | "right";
    content: ContentBlock[];
  };

  let {
    question,
    onEvaluated = () => {},
  }: {
    question: MatchingQuestion;
    onEvaluated?: (result: EvaluationResult) => void;
  } = $props();

  let leftCards = $derived(createCards("left"));
  let rightCards = $state<MatchingCard[]>(createCards("right"));
  let selectedLeftId = $state<string | null>(null);
  let selectedRightId = $state<string | null>(null);
  let matchedPairIds = $state<string[]>([]);
  let result = $state<EvaluationResult | null>(null);
  let error = $state<string | null>(null);
  let announcement = $state("A와 B에서 카드 한 장씩 골라 짝을 맞추세요.");

  function shuffle<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled;
  }

  function createCards(side: "left" | "right"): MatchingCard[] {
    if (side === "left") {
      return question.leftItems.map((item) => ({
        cardId: `left:${item.id}`,
        pairId: item.id,
        side,
        content: item.content,
      }));
    }

    const pairByRightId = new Map(
      question.correctPairs.map((pair) => [pair.rightId, pair.leftId]),
    );
    return question.rightItems.map((item) => ({
      cardId: `right:${item.id}`,
      pairId: pairByRightId.get(item.id) ?? item.id,
      side,
      content: item.content,
    }));
  }

  onMount(() => {
    rightCards = shuffle(createCards("right"));
  });

  function isSelected(card: MatchingCard): boolean {
    return card.side === "left"
      ? selectedLeftId === card.cardId
      : selectedRightId === card.cardId;
  }

  function isMatched(card: MatchingCard): boolean {
    return matchedPairIds.includes(card.pairId);
  }

  function cardAccessibleLabel(card: MatchingCard, index: number): string {
    const content = card.content
      .map((block) => {
        if (block.type === "text") return block.text;
        if (block.type === "markdown") return block.markdown;
        if (block.type === "code") return block.code;
        return block.alt;
      })
      .join(" ")
      .trim();
    const state = isMatched(card)
      ? ", 짝을 맞춤"
      : isSelected(card)
        ? ", 선택됨"
        : "";
    return `${card.side === "left" ? "A 왼쪽" : "B 오른쪽"} 카드 ${index + 1}: ${content || "내용"}${state}`;
  }

  function answerPairs() {
    return question.correctPairs.map((pair) => ({ ...pair }));
  }

  function finishIfComplete() {
    if (matchedPairIds.length !== question.correctPairs.length) return;
    const outcome = evaluateQuestion(question, {
      type: "matching",
      pairs: answerPairs(),
    });
    if (outcome.status === "error") {
      error = outcome.error.message;
      return;
    }
    result = outcome.result;
    announcement = "모든 짝을 맞췄습니다.";
    onEvaluated(outcome.result);
  }

  function selectCard(card: MatchingCard) {
    if (result || isMatched(card)) return;

    error = null;
    if (card.side === "left") {
      selectedLeftId = card.cardId;
    } else {
      selectedRightId = card.cardId;
    }

    const nextLeftId = card.side === "left" ? card.cardId : selectedLeftId;
    const nextRightId = card.side === "right" ? card.cardId : selectedRightId;
    if (!nextLeftId || !nextRightId) {
      announcement =
        card.side === "left"
          ? "B 오른쪽 카드에서 한 장을 더 고르세요."
          : "A 왼쪽 카드에서 한 장을 더 고르세요.";
      return;
    }

    const leftCard = leftCards.find(
      (candidate) => candidate.cardId === nextLeftId,
    );
    const rightCard = rightCards.find(
      (candidate) => candidate.cardId === nextRightId,
    );
    if (!leftCard || !rightCard) return;

    if (leftCard.pairId === rightCard.pairId) {
      matchedPairIds = [...matchedPairIds, leftCard.pairId];
      selectedLeftId = null;
      selectedRightId = null;
      announcement = "짝을 맞췄습니다.";
      finishIfComplete();
      return;
    }

    selectedLeftId = null;
    selectedRightId = null;
    announcement = "짝이 아닙니다. A와 B에서 다시 골라 보세요.";
  }
</script>

<div class="question-body">
  {#each question.prompt as block}
    <ContentBlockRenderer {block} />
  {/each}

  <div class="matching-board" role="group" aria-label="A와 B의 짝 맞추기">
    <section class="matching-column" aria-labelledby="matching-left-heading">
      <h3 id="matching-left-heading">A · 왼쪽 항목</h3>
      <div class="card-list">
        {#each leftCards as card, index}
          <button
            type="button"
            class="memory-card"
            class:selected={isSelected(card)}
            class:matched={isMatched(card)}
            aria-pressed={isSelected(card) || isMatched(card)}
            aria-label={cardAccessibleLabel(card, index)}
            disabled={result !== null || isMatched(card)}
            onclick={() => selectCard(card)}
          >
            <div class="card-content">
              {#each card.content as block}
                <ContentBlockRenderer {block} />
              {/each}
            </div>
          </button>
        {/each}
      </div>
    </section>

    <section class="matching-column" aria-labelledby="matching-right-heading">
      <h3 id="matching-right-heading">B · 오른쪽 항목</h3>
      <div class="card-list">
        {#each rightCards as card, index}
          <button
            type="button"
            class="memory-card"
            class:selected={isSelected(card)}
            class:matched={isMatched(card)}
            aria-pressed={isSelected(card) || isMatched(card)}
            aria-label={cardAccessibleLabel(card, index)}
            disabled={result !== null || isMatched(card)}
            onclick={() => selectCard(card)}
          >
            <div class="card-content">
              {#each card.content as block}
                <ContentBlockRenderer {block} />
              {/each}
            </div>
          </button>
        {/each}
      </div>
    </section>
  </div>

  <p class="announcement" aria-live="polite">{announcement}</p>

  {#if error}
    <p class="feedback incorrect" role="alert">{error}</p>
  {:else if result}
    <p
      class:correct={result.correct}
      class:incorrect={!result.correct}
      class="feedback"
      role="status"
    >
      {result.correct ? "정답입니다." : "연결 관계를 다시 확인해 보세요."}
    </p>
  {/if}
</div>

<style>
  .question-body {
    display: grid;
    gap: 1rem;
  }

  .matching-board {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.75rem;
  }

  .matching-column {
    display: grid;
    min-width: 0;
    align-content: start;
    gap: 0.6rem;
  }

  .matching-column h3 {
    margin: 0;
    color: #334155;
    font-size: 0.9rem;
  }

  .card-list {
    display: grid;
    gap: 0.75rem;
  }

  .memory-card {
    display: grid;
    width: 100%;
    min-height: 7rem;
    place-items: center;
    border: 1px solid #cbd5e1;
    border-radius: 0.75rem;
    background: white;
    padding: 0.75rem;
    color: #1e3a8a;
    text-align: center;
    cursor: pointer;
  }

  .memory-card.selected {
    border-color: #2563eb;
    background: #eff6ff;
    box-shadow: 0 0 0 2px rgb(37 99 235 / 15%);
  }

  .memory-card.matched {
    border-color: #16a34a;
    background: #f0fdf4;
  }

  .memory-card:disabled {
    cursor: default;
  }

  .memory-card:focus-visible {
    outline: 3px solid rgb(37 99 235 / 35%);
    outline-offset: 2px;
  }

  .card-content :global(p),
  .card-content :global(pre) {
    margin: 0;
  }

  .announcement {
    min-height: 1.5rem;
    margin: 0;
    color: #60708a;
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

  @media (max-width: 36rem) {
    .matching-board,
    .card-list {
      gap: 0.5rem;
    }

    .memory-card {
      min-height: 5.5rem;
      padding: 0.6rem 0.45rem;
    }
  }
</style>
