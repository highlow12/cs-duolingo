<script lang="ts">
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import { contentLabel } from "$lib/questions/presentation";
  import type { QuestionRendererProps } from "$lib/questions/renderer-contract";
  import { shuffleDistinct } from "$lib/questions/shuffle";

  type Props = QuestionRendererProps<"ordering">;
  let {
    question,
    disabled,
    attemptKey,
    reveal,
    submittedAnswer = null,
    random = Math.random,
    onAnswerChange,
  }: Props = $props();

  let orderedItems = $state<typeof question.items>([]);
  let renderedKey = $state("");
  let renderedIdentity = $state("");
  let previousOrder = $state<typeof question.items | null>(null);
  let announcement = $state("");
  let draggedIndex = $state<number | null>(null);

  $effect(() => {
    const identity = `${question.id}:${question.revision}`;
    const key = `${identity}:${attemptKey}`;
    if (renderedKey === key) return;
    if (renderedIdentity !== identity) previousOrder = null;
    renderedIdentity = identity;
    renderedKey = key;
    orderedItems = shuffleDistinct(question.items, random, previousOrder);
    previousOrder = [...orderedItems];
    draggedIndex = null;
    announcement = "순서를 정한 뒤 정답을 확인하세요.";
    onAnswerChange({
      type: "ordering",
      orderedItemIds: orderedItems.map((item) => item.id),
    });
  });

  function announcePosition(item: (typeof orderedItems)[number], index: number) {
    announcement = `${contentLabel(item.content)} 항목이 ${index + 1}번째 위치로 이동했습니다.`;
  }

  function move(index: number, offset: -1 | 1) {
    if (disabled) return;
    const target = index + offset;
    if (target < 0 || target >= orderedItems.length) return;
    const next = [...orderedItems];
    [next[index], next[target]] = [next[target], next[index]];
    orderedItems = next;
    previousOrder = [...next];
    announcePosition(next[target], target);
    onAnswerChange({ type: "ordering", orderedItemIds: next.map((item) => item.id) });
  }

  function drop(target: number) {
    if (disabled || draggedIndex === null || draggedIndex === target) {
      draggedIndex = null;
      return;
    }
    const next = [...orderedItems];
    const [item] = next.splice(draggedIndex, 1);
    next.splice(target, 0, item);
    orderedItems = next;
    previousOrder = [...next];
    draggedIndex = null;
    announcePosition(item, target);
    onAnswerChange({ type: "ordering", orderedItemIds: next.map((candidate) => candidate.id) });
  }

  function isCanonical(id: string): boolean {
    return reveal?.type === "ordering" && reveal.orderedItemIds.includes(id);
  }

  function isSubmittedAt(index: number, id: string): boolean {
    return submittedAnswer?.type === "ordering" && submittedAnswer.orderedItemIds[index] === id;
  }
</script>

<div class="question-body">
  {#each question.prompt as block}
    <ContentBlockRenderer {block} />
  {/each}

  <ol class="items" aria-label="순서 항목">
    {#each orderedItems as item, index}
      {@const submitted = isSubmittedAt(index, item.id)}
      {@const canonical = isCanonical(item.id)}
      <li
        class="item"
        draggable={!disabled}
        ondragstart={() => { if (!disabled) draggedIndex = index; }}
        ondragend={() => (draggedIndex = null)}
        ondragover={(event) => { if (!disabled) event.preventDefault(); }}
        ondrop={() => drop(index)}
      >
        <div class="item-content">
          <span class="item-number" aria-hidden="true">{index + 1}</span>
          <span class="item-label">
            {#each item.content as block}
              <ContentBlockRenderer {block} />
            {/each}
          </span>
          {#if submitted}<span class="answer-marker">내 답 {index + 1}번째</span>{/if}
          {#if canonical}<span class="answer-marker">정답 위치 {question.correctOrder.indexOf(item.id) + 1}</span>{/if}
        </div>
        <div class="move-actions" aria-label={`${contentLabel(item.content)} 이동`}>
          <button
            class="icon-button"
            type="button"
            disabled={disabled || index === 0}
            aria-label={`${contentLabel(item.content)} 위로 이동`}
            onclick={() => move(index, -1)}
          >↑</button>
          <button
            class="icon-button"
            type="button"
            disabled={disabled || index === orderedItems.length - 1}
            aria-label={`${contentLabel(item.content)} 아래로 이동`}
            onclick={() => move(index, 1)}
          >↓</button>
        </div>
      </li>
    {/each}
  </ol>
  <p class="announcement" aria-live="polite">{announcement}</p>
</div>

<style>
  .question-body { display: grid; gap: 1rem; }
  .items { display: grid; gap: 0.7rem; margin: 0; padding: 0; list-style: none; }
  .item { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; border: 1px solid #dce3ef; border-radius: 0.75rem; background: white; padding: 0.8rem 1rem; }
  .item[draggable="true"] { cursor: grab; }
  .item-content { display: flex; align-items: flex-start; flex: 1; gap: 0.7rem; min-width: 0; }
  .item-label { flex: 1; min-width: 0; }
  .item-label :global(p), .item-label :global(pre) { margin: 0; }
  .item-number { display: inline-grid; flex: 0 0 auto; place-items: center; width: 1.7rem; height: 1.7rem; border-radius: 50%; background: #e8eef8; font-weight: 800; }
  .move-actions { display: flex; gap: 0.35rem; }
  .icon-button { width: 2rem; height: 2rem; border: 1px solid #cbd5e1; border-radius: 0.45rem; background: white; font-size: 1.1rem; cursor: pointer; }
  .icon-button:disabled { cursor: not-allowed; opacity: 0.45; }
  .icon-button:focus-visible { outline: 3px solid rgb(37 99 235 / 35%); outline-offset: 2px; }
  .answer-marker { flex: 0 0 auto; border-radius: 999px; background: #eef2ff; padding: 0.2rem 0.45rem; color: #3730a3; font-size: 0.78rem; font-weight: 700; white-space: nowrap; }
  .announcement { min-height: 1.5rem; margin: 0; color: #60708a; }
</style>
