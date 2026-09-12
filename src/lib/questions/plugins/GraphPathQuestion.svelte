<script lang="ts">
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import type { QuestionRendererProps } from "$lib/questions/renderer-contract";

  type Props = QuestionRendererProps<"graph-path">;
  let {
    question,
    disabled,
    attemptKey,
    reveal,
    submittedAnswer = null,
    onAnswerChange,
  }: Props = $props();

  let selectedIds = $state<string[]>([]);
  let renderedKey = $state("");
  let announcement = $state("");

  $effect(() => {
    const key = `${question.id}:${question.revision}:${attemptKey}`;
    if (renderedKey === key) return;
    renderedKey = key;
    selectedIds = [question.startNodeId];
    announcement = `${nodeLabel(question.startNodeId)}에서 시작합니다.`;
    onAnswerChange(null);
  });

  function nodeFor(id: string) {
    return question.nodes.find((node) => node.id === id);
  }

  function nodeLabel(id: string): string {
    return nodeFor(id)?.label ?? id;
  }

  function currentId(): string {
    return selectedIds.at(-1) ?? question.startNodeId;
  }

  function canMove(fromId: string, toId: string): boolean {
    if (selectedIds.includes(toId)) return false;
    return question.edges.some(
      (edge) =>
        (edge.fromId === fromId && edge.toId === toId) ||
        (!question.directed && edge.fromId === toId && edge.toId === fromId),
    );
  }

  function isAvailable(id: string): boolean {
    return !disabled && currentId() !== question.goalNodeId && canMove(currentId(), id);
  }

  function emit(next: string[]) {
    selectedIds = next;
    if (next.at(-1) === question.goalNodeId) {
      onAnswerChange({ type: "graph-path", nodeIds: [...next] });
      announcement = `${nodeLabel(question.goalNodeId)}에 도착했습니다. 경로를 제출할 수 있습니다.`;
    } else {
      onAnswerChange(null);
      announcement = `${nodeLabel(next.at(-1) ?? question.startNodeId)}로 이동했습니다.`;
    }
  }

  function selectNode(id: string) {
    if (!isAvailable(id)) return;
    emit([...selectedIds, id]);
  }

  function undo() {
    if (disabled || selectedIds.length <= 1) return;
    emit(selectedIds.slice(0, -1));
  }

  function reset() {
    if (disabled) return;
    selectedIds = [question.startNodeId];
    onAnswerChange(null);
    announcement = `${nodeLabel(question.startNodeId)}에서 다시 시작합니다.`;
  }

  function selectedIndex(id: string): number {
    return selectedIds.indexOf(id);
  }

  function submittedIndex(id: string): number {
    return submittedAnswer?.type === "graph-path"
      ? submittedAnswer.nodeIds.indexOf(id)
      : -1;
  }

  function canonicalIndex(id: string): number {
    return reveal?.type === "graph-path" ? reveal.nodeIds.indexOf(id) : -1;
  }
</script>

<div class="question-body">
  {#each question.prompt as block}
    <ContentBlockRenderer {block} />
  {/each}

  <div class="graph-meta">
    <span>{question.directed ? "방향 그래프" : "무방향 그래프"}</span>
    <span>시작: {nodeLabel(question.startNodeId)}</span>
    <span>목표: {nodeLabel(question.goalNodeId)}</span>
  </div>

  <div class="graph" aria-label="경로 선택 그래프">
    <svg class="edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <marker
          id="graph-path-arrow"
          markerWidth="4"
          markerHeight="4"
          refX="3"
          refY="2"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L4,2 L0,4 z" />
        </marker>
      </defs>
      {#each question.edges as edge}
        {@const from = nodeFor(edge.fromId)}
        {@const to = nodeFor(edge.toId)}
        {#if from && to}
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            marker-end={question.directed ? "url(#graph-path-arrow)" : undefined}
          />
        {/if}
      {/each}
    </svg>

    {#each question.nodes as node}
      {@const index = selectedIndex(node.id)}
      {@const submitted = submittedIndex(node.id)}
      {@const canonical = canonicalIndex(node.id)}
      <button
        class="node"
        class:selected={index >= 0}
        class:current={currentId() === node.id}
        class:available={isAvailable(node.id)}
        class:start={node.id === question.startNodeId}
        class:goal={node.id === question.goalNodeId}
        class:submitted={submitted >= 0}
        class:canonical={canonical >= 0}
        style={`left:${node.x}%;top:${node.y}%`}
        type="button"
        disabled={!isAvailable(node.id)}
        aria-label={`${node.label}${index >= 0 ? `, 선택 순서 ${index + 1}` : ""}`}
        onclick={() => selectNode(node.id)}
      >
        <span class="node-label">{node.label}</span>
        {#if index >= 0}<span class="node-order">{index + 1}</span>{/if}
        {#if disabled && submitted >= 0}<span class="answer-marker">내 답 {submitted + 1}</span>{/if}
        {#if disabled && canonical >= 0}<span class="answer-marker canonical-marker">정답 {canonical + 1}</span>{/if}
      </button>
    {/each}
  </div>

  <div class="path-summary" aria-live="polite">
    <strong>현재 경로</strong>
    <span>{selectedIds.map(nodeLabel).join(" → ")}</span>
  </div>

  <div class="actions">
    <button type="button" class="secondary" disabled={disabled || selectedIds.length <= 1} onclick={undo}>
      한 단계 취소
    </button>
    <button type="button" class="secondary" disabled={disabled || selectedIds.length <= 1} onclick={reset}>
      처음부터
    </button>
  </div>

  <p class="sr-only" aria-live="polite">{announcement}</p>
</div>

<style>
  .question-body {
    display: grid;
    gap: var(--space-4);
  }

  .graph-meta,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .graph-meta span {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.3rem 0.65rem;
    font-size: 0.85rem;
  }

  .graph {
    position: relative;
    min-height: 22rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--surface);
  }

  .edges {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .edges line {
    stroke: currentColor;
    stroke-width: 0.8;
    opacity: 0.45;
  }

  .edges path {
    fill: currentColor;
    opacity: 0.65;
  }

  .node {
    position: absolute;
    transform: translate(-50%, -50%);
    min-width: 4.25rem;
    min-height: 4.25rem;
    border: 2px solid var(--border-strong);
    border-radius: 999px;
    background: var(--surface);
    padding: 0.55rem;
    display: grid;
    place-items: center;
    gap: 0.15rem;
    z-index: 1;
  }

  .node.available {
    cursor: pointer;
    border-style: dashed;
    box-shadow: 0 0 0 0.2rem color-mix(in srgb, currentColor 12%, transparent);
  }

  .node.selected {
    border-width: 3px;
    background: var(--primary-soft);
  }

  .node.current {
    outline: 3px solid currentColor;
    outline-offset: 3px;
  }

  .node.goal::after {
    content: "목표";
    position: absolute;
    top: -1.4rem;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .node.start::before {
    content: "시작";
    position: absolute;
    bottom: -1.4rem;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .node-order {
    font-size: 0.7rem;
    font-weight: 800;
  }

  .answer-marker {
    font-size: 0.62rem;
    white-space: nowrap;
  }

  .canonical-marker {
    font-weight: 800;
  }

  .path-summary {
    display: grid;
    gap: 0.25rem;
    padding: 0.8rem 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-muted);
  }

  .secondary {
    min-height: 2.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    padding: 0.45rem 0.8rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 640px) {
    .graph {
      min-height: 19rem;
    }

    .node {
      min-width: 3.65rem;
      min-height: 3.65rem;
      font-size: 0.85rem;
    }
  }
</style>
