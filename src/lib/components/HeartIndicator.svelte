<script lang="ts">
  import { onMount } from "svelte";
  import {
    HEARTS_CHANGED_EVENT,
    learningRepository,
    type HeartStatus,
  } from "$lib/storage/repositories/learning-repository";

  let status = $state<HeartStatus | null>(null);
  let open = $state(false);
  let now = $state(Date.now());
  let loading = $state(true);
  let adNotice = $state("");
  let observedLocalDate = "";

  function localDateNow() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  async function refresh() {
    try {
      status = await learningRepository.getHeartStatus();
    } finally {
      loading = false;
    }
  }

  function recoveryLabel(value: HeartStatus | null) {
    if (!value) return "확인 중…";
    if (value.isFull || value.nextRecoveryAt === null) return "가득 찼어요";
    const remaining = Math.max(0, value.nextRecoveryAt - now);
    const totalMinutes = Math.max(1, Math.ceil(remaining / (60 * 1000)));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}시간 ${minutes}분 후`;
    return `${minutes}분 후`;
  }

  function showAdNotice() {
    adNotice = "현재 광고가 준비되지 않았어요.";
    if (typeof window !== "undefined")
      window.setTimeout(() => (adNotice = ""), 3200);
  }

  onMount(() => {
    void refresh();
    observedLocalDate = localDateNow();
    const onHeartsChanged = () => void refresh();
    window.addEventListener(HEARTS_CHANGED_EVENT, onHeartsChanged);
    const timer = window.setInterval(() => {
      now = Date.now();
      const currentLocalDate = localDateNow();
      if (currentLocalDate !== observedLocalDate) {
        observedLocalDate = currentLocalDate;
        void refresh();
      } else if (
        status &&
        status.nextRecoveryAt !== null &&
        now >= status.nextRecoveryAt
      ) {
        void refresh();
      }
    }, 1000);
    return () => {
      window.removeEventListener(HEARTS_CHANGED_EVENT, onHeartsChanged);
      window.clearInterval(timer);
    };
  });
</script>

<div class="heart-indicator">
  <button
    class="heart-button"
    type="button"
    aria-label="남은 하트 {status?.count ?? 0}개"
    aria-expanded={open}
    aria-controls="heart-popover"
    onclick={() => (open = !open)}
  >
    <span aria-hidden="true">♥</span>
    <span>{loading ? "…" : (status?.count ?? 0)}/3</span>
  </button>

  {#if open}
    <section id="heart-popover" class="heart-popover" aria-label="하트 정보">
      <p class="heart-total">
        <span aria-hidden="true">♥</span>
        {status?.count ?? 0} / 3
      </p>
      <p class="heart-recovery">
        {status?.isFull
          ? "하트가 가득 찼어요."
          : `다음 하트: ${recoveryLabel(status)}`}
      </p>
      <button
        class="button secondary ad-button"
        type="button"
        onclick={showAdNotice}
      >
        광고 보고 하트 초기화
      </button>
      {#if adNotice}<p class="ad-notice" role="status" aria-live="polite">{adNotice}</p>{/if}
    </section>
  {/if}
</div>

<style>
  .heart-indicator {
    position: relative;
    flex-shrink: 0;
  }
  .heart-button {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    min-height: 2.25rem;
    padding: 0.35rem 0.55rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--heart);
    font-size: 0.85rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .heart-button:hover,
  .heart-button:focus-visible {
    border-color: var(--heart);
    background: var(--danger-soft);
  }
  .heart-popover {
    position: absolute;
    top: calc(100% + 0.65rem);
    right: 0;
    z-index: 20;
    width: min(18rem, calc(100vw - 2rem));
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    box-shadow: var(--shadow-sm);
    animation: popover-in var(--dur-2) var(--ease-out-quart);
  }
  .heart-popover::before {
    position: absolute;
    top: -0.4rem;
    right: 1rem;
    width: 0.75rem;
    height: 0.75rem;
    border-top: 1px solid var(--border);
    border-left: 1px solid var(--border);
    background: var(--surface-raised);
    content: "";
    transform: rotate(45deg);
  }
  .heart-total {
    margin: 0;
    font-weight: 800;
  }
  .heart-total span {
    color: var(--heart);
  }
  .heart-recovery {
    margin: 0.4rem 0 1rem;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .ad-button {
    width: 100%;
    min-height: 2.4rem;
    padding: 0.55rem 0.7rem;
    font-size: 0.85rem;
  }

  .ad-notice {
    margin: 0.65rem 0 0;
    border-left: 2px solid var(--warning);
    background: var(--warning-soft);
    color: var(--text);
    padding: 0.45rem 0.6rem;
    font-size: 0.8rem;
  }

  @keyframes popover-in {
    from { opacity: 0; transform: translateY(-0.35rem) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
</style>
