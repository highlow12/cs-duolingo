<script lang="ts">
  import { base } from "$app/paths";
  import { onMount } from "svelte";
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
  let hintEvaluated = false;
  let swipeStart: SwipeStart | null = null;

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
  });

  function dismissSwipeHint() {
    showSwipeHint = false;
    markTrackSwipeHintSeen(localStorageIfAvailable());
  }

  function selectTrack(trackId: string) {
    // This guard keeps both tap and swipe navigation inside the currently
    // reachable set, even if a stale event arrives after progress changes.
    if (!tracks.some((track) => track.id === trackId)) return;
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
    <p class="eyebrow">개념을 연결하는 길</p>
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
        <div
          id={`track-panel-${selectedTrack.id}`}
          class="stack track"
          role="tabpanel"
          aria-labelledby={`track-tab-${selectedTrack.id}`}
          tabindex="0"
        >
          <div>
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
                ).length} / {selectedLessons.length} 완료</span
              >
            </div>
            {#if selectedTrack.description}<p class="muted">
                {selectedTrack.description}
              </p>{/if}
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
              >
                <span
                  class="lesson-number"
                  class:done={status === "completed"}
                  aria-hidden="true"
                  >{status === "completed"
                    ? "✓"
                    : String(index + 1).padStart(2, "0")}</span
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
      </div>
    </section>
  {/if}
</div>

<style>
  .track-switcher {
    display: grid;
    gap: 0.8rem;
  }
  .track-navigation {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
  }
  .track-tabs {
    display: flex;
    min-width: 0;
    gap: 0.5rem;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
  }
  .track-tab,
  .track-arrow {
    min-height: 2.75rem;
    border: 1px solid var(--border);
    border-radius: 0.7rem;
    background: white;
    color: #26344c;
    font-weight: 700;
  }
  .track-tab {
    flex: 0 0 auto;
    padding: 0.65rem 0.9rem;
    white-space: nowrap;
  }
  .track-tab:hover,
  .track-tab:focus-visible,
  .track-tab.active {
    border-color: var(--primary);
    background: var(--primary-soft);
    color: var(--primary);
  }
  .track-arrow {
    display: grid;
    width: 2.75rem;
    place-items: center;
    padding: 0;
    font-size: 1.25rem;
  }
  .track-arrow:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  .swipe-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border: 1px solid #bfdbfe;
    border-radius: 0.8rem;
    background: var(--primary-soft);
    color: #1e3a8a;
    padding: 0.75rem 1rem;
  }
  .hint-dismiss {
    flex: 0 0 auto;
    color: var(--primary);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }
  .track-surface {
    touch-action: pan-y;
    overscroll-behavior-x: contain;
  }
  .track h2,
  .track .row {
    margin: 0;
  }
  .track p {
    margin: 0.5rem 0 0;
  }
  .lesson-list {
    display: grid;
    gap: 0.75rem;
  }
  .lesson-card {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }
  .lesson-info {
    flex: 1;
    min-width: 0;
  }
  .lesson-info h3 {
    margin: 0.5rem 0;
  }
  .lesson-number {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    flex-shrink: 0;
    border-radius: 1rem;
    background: var(--primary-soft);
    color: var(--primary);
    font-weight: 800;
  }
  .lesson-number.done {
    background: #dcfce7;
    color: var(--success);
  }
  .locked {
    background: #f0f3f8;
  }
  .prerequisites {
    font-size: 0.9rem;
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
      gap: 0.75rem;
    }
    .lesson-card .button {
      margin-left: 3.75rem;
    }
  }
</style>
