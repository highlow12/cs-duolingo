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
  let dragTargetIndex = $state<number | null>(null);
  let dragPointerId = $state<number | null>(null);
  let listElement = $state<HTMLOListElement | null>(null);

  $effect(() => {
    const identity = `${question.id}:${question.revision}`;
    const key = `${identity}:${attemptKey}`;
    if (renderedKey === key) return;
    if (renderedIdentity !== identity) previousOrder = null;
    renderedIdentity = identity;
    renderedKey = key;
    orderedItems = shuffleDistinct(question.items, random, previousOrder);
    previousOrder = [...orderedItems];
    clearDragState();
    announcement = "순서를 정한 뒤 정답을 확인하세요.";
    onAnswerChange({
      type: "ordering",
      orderedItemIds: orderedItems.map((item) => item.id),
    });
  });

  function announcePosition(item: (typeof orderedItems)[number], index: number) {
    announcement = `${contentLabel(item.content)} 항목이 ${index + 1}번째 위치로 이동했습니다.`;
  }

  function emitOrder(next: typeof orderedItems) {
    orderedItems = next;
    previousOrder = [...next];
    onAnswerChange({
      type: "ordering",
      orderedItemIds: next.map((item) => item.id),
    });
  }

  function move(index: number, offset: -1 | 1) {
    if (disabled) return;
    const target = index + offset;
    if (target < 0 || target >= orderedItems.length) return;
    const next = [...orderedItems];
    [next[index], next[target]] = [next[target], next[index]];
    emitOrder(next);
    announcePosition(next[target], target);
  }

  function applyDrop(source: number, target: number) {
    if (disabled || source === target) return;
    if (source < 0 || target < 0 || source >= orderedItems.length || target >= orderedItems.length)
      return;

    const next = [...orderedItems];
    const [item] = next.splice(source, 1);
    next.splice(target, 0, item);
    emitOrder(next);
    announcePosition(item, target);
  }

  function clearDragState() {
    draggedIndex = null;
    dragTargetIndex = null;
    dragPointerId = null;
  }

  function drop(target: number) {
    const source = draggedIndex;
    clearDragState();
    if (source === null) return;
    applyDrop(source, target);
  }

  function targetIndexAt(clientY: number): number | null {
    if (!listElement) return null;
    const items = Array.from(
      listElement.querySelectorAll<HTMLElement>("[data-order-index]"),
    );
    if (items.length === 0) return null;

    for (const item of items) {
      const rect = item.getBoundingClientRect();
      const index = Number(item.dataset.orderIndex);
      if (clientY < rect.top + rect.height / 2 && Number.isInteger(index))
        return index;
    }

    const lastIndex = Number(items.at(-1)?.dataset.orderIndex);
    return Number.isInteger(lastIndex) ? lastIndex : null;
  }

  function startPointerDrag(event: PointerEvent, index: number) {
    if (disabled) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    draggedIndex = index;
    dragTargetIndex = index;
    dragPointerId = event.pointerId;
    announcement = `${contentLabel(orderedItems[index].content)} 항목 드래그를 시작했습니다. 현재 ${index + 1}번째입니다.`;
  }

  function movePointerDrag(event: PointerEvent) {
    if (
      disabled ||
      draggedIndex === null ||
      dragPointerId !== event.pointerId
    )
      return;

    event.preventDefault();
    const target = targetIndexAt(event.clientY);
    if (target !== null) dragTargetIndex = target;

    const edge = 72;
    const step = 12;
    if (event.clientY < edge) window.scrollBy(0, -step);
    else if (event.clientY > window.innerHeight - edge) window.scrollBy(0, step);
  }

  function finishPointerDrag(event: PointerEvent) {
    if (dragPointerId !== event.pointerId) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    if (handle.hasPointerCapture(event.pointerId))
      handle.releasePointerCapture(event.pointerId);

    const source = draggedIndex;
    const target = dragTargetIndex ?? source;
    clearDragState();
    if (source !== null && target !== null) applyDrop(source, target);
  }

  function cancelPointerDrag(event: PointerEvent) {
    if (dragPointerId !== event.pointerId) return;
    const handle = event.currentTarget as HTMLElement;
    if (handle.hasPointerCapture(event.pointerId))
      handle.releasePointerCapture(event.pointerId);
    clearDragState();
    announcement = "드래그가 취소되었습니다.";
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

  <p class="drag-hint">손잡이를 드래그하거나 화살표 버튼으로 순서를 바꾸세요.</p>
  <ol class="items" aria-label="순서 항목" bind:this={listElement}>
    {#each orderedItems as item, index}
      {@const submitted = isSubmittedAt(index, item.id)}
      {@const canonical = isCanonical(item.id)}
      <li
        class="item"
        class:dragging={draggedIndex === index}
        class:drop-target={draggedIndex !== null && dragTargetIndex === index && draggedIndex !== index}
        data-order-index={index}
        draggable={!disabled}
        ondragstart={() => {
          if (!disabled) {
            draggedIndex = index;
            dragTargetIndex = index;
          }
        }}
        ondragend={() => clearDragState()}
        ondragover={(event) => {
          if (!disabled) {
            event.preventDefault();
            dragTargetIndex = index;
          }
        }}
        ondrop={() => drop(index)}
      >
        <button
          class="drag-handle"
          type="button"
          draggable="false"
          disabled={disabled}
          aria-label={`${contentLabel(item.content)} 드래그해서 이동`}
          title="드래그해서 순서 이동"
          onpointerdown={(event) => startPointerDrag(event, index)}
          onpointermove={movePointerDrag}
          onpointerup={finishPointerDrag}
          onpointercancel={cancelPointerDrag}
        >
          <span aria-hidden="true">⠿</span>
        </button>
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
  .question-body { display: grid; gap: var(--space-4); }
  .drag-hint { margin: 0; color: var(--text-muted); font-size: 0.85rem; }
  .items { display: grid; gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
  .item { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); padding: 0.8rem 1rem; transition: border-color var(--dur-1) ease, box-shadow var(--dur-1) ease, opacity var(--dur-1) ease; }
  .item[draggable="true"] { cursor: grab; }
  .item.dragging { opacity: 0.65; }
  .item.drop-target { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent); }
  .drag-handle { display: inline-grid; flex: 0 0 auto; place-items: center; width: 2.75rem; height: 2.75rem; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); font-size: 1.35rem; line-height: 1; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
  .drag-handle:active { cursor: grabbing; background: var(--surface-muted); }
  .drag-handle:disabled { cursor: default; opacity: 0.4; }
  .drag-handle:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .item-content { display: flex; align-items: flex-start; flex: 1; gap: var(--space-3); min-width: 0; }
  .item-label { flex: 1; min-width: 0; }
  .item-label :global(p), .item-label :global(pre) { margin: 0; }
  .item-number { display: inline-grid; flex: 0 0 auto; place-items: center; width: 1.7rem; height: 1.7rem; border: 1px solid var(--border); border-radius: 50%; background: var(--surface-muted); color: var(--text-muted); font-family: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.75rem; font-weight:650; }
  .move-actions { display: flex; gap: var(--space-1); }
  .icon-button { width: 2.75rem; height: 2.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color:var(--text); font-size: 1.1rem; cursor: pointer; }
  .icon-button:disabled { cursor: not-allowed; opacity: 0.45; }
  .icon-button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .answer-marker { flex: 0 0 auto; border-radius: 999px; background: var(--primary-soft); padding: 0.2rem 0.45rem; color: var(--primary-strong); font-size: 0.72rem; font-weight: 650; white-space: nowrap; }
  .announcement { min-height: 1.5rem; margin: 0; color: var(--text-muted); font-size:.85rem; }

  @media (max-width: 640px) {
    .item { padding: 0.7rem 0.65rem; }
    .drag-handle { width: 2.5rem; height: 2.75rem; }
    .move-actions { flex-direction: column; }
  }
</style>
