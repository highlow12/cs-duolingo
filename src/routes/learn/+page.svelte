<script lang="ts">
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import {
    loadDashboard,
    errorMessage,
    type Dashboard,
  } from "$lib/application/dashboard";
  import {
    hasSeenTrackSwipeHint,
    markTrackSwipeHintSeen,
    swipeDirection,
    type SwipeDirection,
  } from "$lib/application/track-navigation";
  import {
    visibleTracks as getVisibleTracks,
    lessonStatus,
    missingPrerequisites,
    statusLabels,
  } from "$lib/curriculum/progress";

  type SwipeStart = { pointerId: number; x: number; y: number };

  let data = $state<Dashboard | null>(null);
  let error = $state("");
  let selectedTrackId = $state<string | null>(null);
  let showSwipeHint = $state(false);
  let transitionDirection = $state<SwipeDirection>("next");
  let hintEvaluated = false;
  let swipeStart: SwipeStart | null = null;
  let reducedMotion = $state(false);

  function trackMotif(trackId: string): string {
    switch (trackId) {
      case "python": return ">_";
      case "computer-architecture": return "CPU";
      case "discrete-math": return "Σ";
      case "data-structures": return "•—•";
      case "algorithms": return "↗";
      case "computer-systems": return "0101";
      default: return "[]";
    }
  }

  let tracks = $derived(
    data
      ? getVisibleTracks(
          data.curriculum,
          data.lessons,
          data.snapshot.lessonStates,
        )
      : [],
  );
  let selectedTrack = $derived(
    tracks.find((track) => track.id === selectedTrackId) ?? tracks[0] ?? null,
  );
  let selectedTrackIndex = $derived(
    selectedTrack
      ? tracks.findIndex((track) => track.id === selectedTrack.id)
      : -1,
  );
  let selectedLessons = $derived(
    data && selectedTrack
      ? data.lessons.filter((lesson) => lesson.track === selectedTrack.id)
      : [],
  );

  function localStorageIfAvailable(): Storage | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  async function load() {
    error = "";
    try {
      const next = await loadDashboard();
      data = next;

      const nextTracks = getVisibleTracks(
        next.curriculum,
        next.lessons,
        next.snapshot.lessonStates,
      );
      // Track selection is deliberately local to this page. Every fresh entry
      // starts at the first currently reachable track in curriculum order.
      selectedTrackId = nextTracks[0]?.id ?? null;
      if (!hintEvaluated && nextTracks.length > 1) {
        hintEvaluated = true;
        const storage = localStorageIfAvailable();
        showSwipeHint = !hasSeenTrackSwipeHint(storage);
        if (showSwipeHint) markTrackSwipeHintSeen(storage);
      }
    } catch (e) {
      error = errorMessage(e);
    }
  }

  onMount(() => {
    void load();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => (reducedMotion = media.matches);
    syncMotion();
    media.addEventListener?.("change", syncMotion);
    return () => media.removeEventListener?.("change", syncMotion);
  });

  function dismissSwipeHint() {
    showSwipeHint = false;
    markTrackSwipeHintSeen(localStorageIfAvailable());
  }

  function selectTrack(trackId: string) {
    // This guard keeps both tap and swipe navigation inside the currently
    // reachable set, even if a stale event arrives after progress changes.
    const nextIndex = tracks.findIndex((track) => track.id === trackId);
    if (nextIndex < 0 || nextIndex === selectedTrackIndex) return;
    transitionDirection = nextIndex > selectedTrackIndex ? "next" : "previous";
    selectedTrackId = trackId;
    if (showSwipeHint) dismissSwipeHint();
  }

  function moveTrack(direction: SwipeDirection) {
    if (showSwipeHint) dismissSwipeHint();
    const nextIndex = selectedTrackIndex + (direction === "next" ? 1 : -1);
    const nextTrack = tracks[nextIndex];
    if (nextTrack) selectTrack(nextTrack.id);
  }

  function handleTrackKeydown(event: KeyboardEvent, trackId: string) {
    const index = tracks.findIndex((track) => track.id === trackId);
    const nextIndex =
      event.key === "ArrowRight"
        ? index + 1
        : event.key === "ArrowLeft"
          ? index - 1
          : -1;
    const nextTrack = tracks[nextIndex];
    if (!nextTrack) return;
    event.preventDefault();
    selectTrack(nextTrack.id);
    if (typeof document !== "undefined") {
      requestAnimationFrame(() =>
        document.getElementById(`track-tab-${nextTrack.id}`)?.focus(),
      );
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (!event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const surface = event.currentTarget as HTMLElement;
    surface.setPointerCapture(event.pointerId);
    swipeStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handlePointerUp(event: PointerEvent) {
    if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
    const start = swipeStart;
    swipeStart = null;
    const surface = event.currentTarget as HTMLElement;
    if (surface.hasPointerCapture(event.pointerId))
      surface.releasePointerCapture(event.pointerId);
    const direction = swipeDirection(
      event.clientX - start.x,
      event.clientY - start.y,
    );
    if (direction) {
      event.preventDefault();
      moveTrack(direction);
    }
  }

  function handlePointerCancel(event: PointerEvent) {
    if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
    swipeStart = null;
    const surface = event.currentTarget as HTMLElement;
    if (surface.hasPointerCapture(event.pointerId))
      surface.releasePointerCapture(event.pointerId);
  }
</script>

<svelte:head><title>학습 경로 | CS 듀오링고</title></svelte:head>

<div class="stack">
  <div class="page-heading">
    <span class="page-kicker">학습 경로 / {tracks.length || "—"}개 트랙</span>
    <h1>학습 경로</h1>
    <p class="muted">
      Python에서 자료구조로, 컴퓨터 구조에서 네트워크와 그래픽스로.
    </p>
  </div>

  {#if error}
    <div class="card error" role="alert">
      {error}<button class="button secondary" onclick={load}>다시 시도</button>
    </div>
  {:else if !data}
    <p class="card" role="status">학습 경로를 불러오는 중입니다…</p>
  {:else if !tracks.length}
    <section class="card" role="status">
      <h2>아직 열린 학습 트랙이 없어요</h2>
      <p class="muted">새 학습 콘텐츠가 준비되면 이곳에 트랙이 나타납니다.</p>
    </section>
  {:else if selectedTrack}
    <section class="track-switcher" aria-label="학습 트랙">
      <div class="track-navigation" role="group" aria-label="트랙 변경">
        <button
          type="button"
          class="track-arrow"
          aria-label="이전 트랙"
          disabled={selectedTrackIndex <= 0}
          onclick={() => moveTrack("previous")}>←</button
        >
        <div class="track-tabs" role="tablist" aria-label="열린 트랙">
          {#each tracks as track}
            <button
              type="button"
              id={`track-tab-${track.id}`}
              role="tab"
              class="track-tab"
              class:active={track.id === selectedTrack.id}
              aria-selected={track.id === selectedTrack.id}
              aria-controls={`track-panel-${track.id}`}
              tabindex={track.id === selectedTrack.id ? 0 : -1}
              onkeydown={(event) => handleTrackKeydown(event, track.id)}
              onclick={() => selectTrack(track.id)}>{track.title}</button
            >
          {/each}
        </div>
        <button
          type="button"
          class="track-arrow"
          aria-label="다음 트랙"
          disabled={selectedTrackIndex < 0 ||
            selectedTrackIndex >= tracks.length - 1}
          onclick={() => moveTrack("next")}>→</button
        >
      </div>

      {#if showSwipeHint}
        <div class="swipe-hint" role="note">
          <span>좌우로 밀어서 열린 트랙을 바꿀 수 있어요.</span>
          <button type="button" class="hint-dismiss" onclick={dismissSwipeHint}
            >알겠어요</button
          >
        </div>
      {/if}

      <div
        class="track-surface"
        role="region"
        aria-label="스와이프로 트랙 변경"
        onpointerdown={handlePointerDown}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerCancel}
      >
        {#key selectedTrack.id}
          <div
            id={`track-panel-${selectedTrack.id}`}
            class="stack track"
            role="tabpanel"
            aria-labelledby={`track-tab-${selectedTrack.id}`}
            tabindex="0"
            in:fly={{
              x: reducedMotion ? 0 : transitionDirection === "next" ? 72 : -72,
              duration: reducedMotion ? 0 : 240,
              opacity: 1,
            }}
          >
            <div>
              <div class="track-heading" data-track={selectedTrack.id}>
                <span class="track-motif" aria-hidden="true">{trackMotif(selectedTrack.id)}</span>
                <div class="track-heading-copy">
                  <div class="row">
                    <h2>{selectedTrack.title}</h2>
                    <span class="muted"
                  >{selectedLessons.filter(
                    (lesson) =>
                      lessonStatus(
                        lesson,
                        data!.curriculum,
                        data!.snapshot.lessonStates,
                      ) === "completed",
                  ).length} / {selectedLessons.length} 완료</span>
                  </div>
                  {#if selectedTrack.description}<p class="muted">
                    {selectedTrack.description}
                  </p>{/if}
                </div>
              </div>
            </div>
            <div class="lesson-list">
              {#each selectedLessons as lesson, index}
                {@const status = lessonStatus(
                  lesson,
                  data.curriculum,
                  data.snapshot.lessonStates,
                )}
                <article
                  class="card lesson-card"
                  class:locked={status === "locked"}
                  class:in-progress={status === "in-progress"}
                  data-track={selectedTrack.id}
                >
                  <span
                    class="lesson-number"
                    class:done={status === "completed"}
                    aria-hidden="true"
                    ><span class="lesson-motif">{status === "completed" ? "✓" : trackMotif(selectedTrack.id)}</span><span class="lesson-index">{String(index + 1).padStart(2, "0")}</span></span
                  >
                  <div class="lesson-info">
                    <span class="badge" class:success={status === "completed"}
                      >{statusLabels[status]}</span
                    >
                    <h3>{lesson.title}</h3>
                    <p class="muted">{lesson.description}</p>
                    {#if status === "locked"}<p class="prerequisites">
                        먼저 배워요: {missingPrerequisites(
                          lesson.id,
                          data.curriculum,
                          data.snapshot.lessonStates,
                        )
                          .map(
                            (id) =>
                              data!.lessons.find((item) => item.id === id)
                                ?.title ?? id,
                          )
                          .join(", ")}
                      </p>{/if}
                  </div>
                  {#if status !== "locked"}<a
                      class="button secondary"
                      href={`${base}/learn/${lesson.id}`}
                      aria-label={`${lesson.title} ${status === "completed" ? "다시 읽기" : "학습하기"}`}
                      >{status === "completed"
                        ? "다시 읽기"
                        : status === "in-progress"
                          ? "이어하기"
                          : "시작"}</a
                    >{/if}
                </article>
              {/each}
            </div>
          </div>
        {/key}
      </div>
    </section>
  {/if}
</div>

<style>
  .track-switcher {
    display: grid;
    gap: var(--space-4);
  }

  .track-navigation {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
  }

  .track-tabs {
    display: flex;
    min-width: 0;
    gap: var(--space-2);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    padding: 0.15rem 0.1rem 0.35rem;
  }

  .track-tab,
  .track-arrow {
    min-height: 44px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text-muted);
    font-weight: 600;
    transition: border-color var(--dur-1) ease, background-color var(--dur-1) ease, color var(--dur-1) ease;
  }

  .track-tab {
    flex: 0 0 auto;
    padding: 0.6rem 0.85rem;
    white-space: nowrap;
  }

  .track-tab:hover,
  .track-tab:focus-visible,
  .track-tab.active {
    border-color: color-mix(in srgb, var(--primary) 72%, var(--border));
    background: var(--primary-soft);
    color: var(--primary-strong);
  }

  .track-arrow {
    display: grid;
    width: 2.75rem;
    place-items: center;
    padding: 0;
    color: var(--text);
    font-size: 1.1rem;
  }

  .track-arrow:hover:not(:disabled) {
    border-color: var(--border-strong);
    background: var(--surface-muted);
  }

  .track-arrow:disabled {
    opacity: 0.45;
  }

  .swipe-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border));
    border-radius: var(--radius-md);
    background: var(--primary-soft);
    color: var(--text);
    padding: 0.7rem 0.9rem;
    font-size: 0.9rem;
  }

  .hint-dismiss {
    flex: 0 0 auto;
    color: var(--primary);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
    min-height: 44px;
    padding: 0.4rem;
  }

  .track-surface {
    overflow: hidden;
    touch-action: pan-y;
    overscroll-behavior-x: contain;
  }

  .track h2,
  .track .row {
    margin: 0;
  }

  .track p {
    margin: var(--space-2) 0 0;
  }

  .track-heading {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
    border-bottom: 1px solid var(--border);
    padding-bottom: var(--space-5);
  }

  .track-heading-copy {
    flex: 1;
    min-width: 0;
  }

  .track-motif {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 3.25rem;
    height: 3.25rem;
    border: 1px solid color-mix(in srgb, var(--track-accent, var(--primary)) 60%, var(--border));
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--track-accent, var(--primary)) 12%, var(--surface));
    color: var(--track-accent, var(--primary));
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1;
  }

  .lesson-list {
    display: grid;
    gap: var(--space-3);
  }

  .lesson-card {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    border-left: 3px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    transition: border-color var(--dur-1) ease, background-color var(--dur-1) ease;
  }

  .lesson-card[data-track] {
    border-left-color: color-mix(in srgb, var(--track-accent, var(--border)) 62%, var(--border));
  }

  .lesson-card.in-progress {
    border-left-width: 4px;
    background: color-mix(in srgb, var(--track-accent, var(--primary)) 5%, var(--surface));
  }

  .lesson-info {
    flex: 1;
    min-width: 0;
  }

  .lesson-info h3 {
    margin: var(--space-2) 0 var(--space-1);
  }

  .lesson-info p {
    margin-bottom: 0;
  }

  .lesson-number {
    display: grid;
    align-content: center;
    justify-items: center;
    flex: 0 0 auto;
    width: 3.25rem;
    min-height: 3.25rem;
    flex-shrink: 0;
    border: 1px solid color-mix(in srgb, var(--track-accent, var(--primary)) 60%, var(--border));
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--track-accent, var(--primary)) 10%, var(--surface));
    color: var(--track-accent, var(--primary));
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-weight: 700;
    line-height: 1;
  }

  .lesson-motif { font-size: 0.72rem; }
  .lesson-index { margin-top: 0.28rem; color: var(--text-muted); font-size: 0.65rem; font-weight: 500; }

  .lesson-number.done {
    border-color: var(--success);
    background: var(--success-soft);
    color: var(--success);
  }

  .lesson-number.done .lesson-index { color: var(--success); }

  .locked {
    border-left-color: var(--border) !important;
    background: var(--surface-muted);
    color: var(--text-muted);
  }

  .locked .lesson-number {
    border-color: var(--border);
    background: var(--surface-muted);
    color: var(--text-muted);
  }

  .prerequisites {
    color: var(--warning) !important;
    font-size: 0.82rem;
  }

  @media (max-width: 540px) {
    .track-navigation {
      gap: 0.35rem;
    }
    .track-tab {
      padding-inline: 0.7rem;
    }
    .swipe-hint {
      align-items: flex-start;
      flex-direction: column;
    }
    .lesson-card {
      flex-wrap: wrap;
      gap: var(--space-3);
    }
    .lesson-card .button {
      margin-left: calc(3.25rem + var(--space-3));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .track-surface :global(*) {
      transition-duration: 0ms !important;
      animation-duration: 0ms !important;
    }
  }
</style>
