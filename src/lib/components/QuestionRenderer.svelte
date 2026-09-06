<script lang="ts">
  import { onMount, tick } from "svelte";
  import ContentBlockRenderer from "$lib/components/ContentBlockRenderer.svelte";
  import {
    createQuestionHost,
    type QuestionAttempt,
    type QuestionHost,
    type QuestionHostClock,
    type QuestionHostState,
  } from "$lib/questions/host";
  import {
    describeAnswer,
    describeCanonicalAnswer,
    type AnswerDisplay,
  } from "$lib/questions/presentation";
  import { getQuestionRenderer } from "$lib/questions/renderer-registry";
  import type { Question, EvaluationResult, UserAnswer } from "$lib/questions/types";

  type CompletionSummary = { id: string; correct: boolean; durationMs: number };

  let {
    question,
    onCompleted = async () => {},
    onReady = () => {},
    // Kept for callers of the prototype API while the lesson route migrates.
    onEvaluated,
    random = Math.random,
  }: {
    question: Question;
    onCompleted?: (summary: CompletionSummary) => void | Promise<void>;
    onReady?: () => void;
    onEvaluated?: (result: EvaluationResult) => void;
    random?: () => number;
  } = $props();

  let host = $state<QuestionHost | null>(null);
  let hostState = $state<QuestionHostState | null>(null);
  let currentIdentity = $state("");
  let mounted = false;
  let unsubscribe = $state<(() => void) | null>(null);
  let readyIdentity = $state("");
  let firstWrongIdentity = $state("");
  let attemptDurations = $state<Map<string, number>>(new Map());
  let totalDurationMs = $state(0);
  let completedAttemptId = $state("");
  let visitGeneration = 0;
  let answerRegion = $state<HTMLElement | null>(null);
  let finalHeading = $state<HTMLElement | null>(null);
  let lastFocusKey = $state("");

  function browserClock(): QuestionHostClock {
    return {
      now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
      isVisible: () => typeof document === "undefined" || document.visibilityState !== "hidden",
      subscribeVisibility: (listener) => {
        if (typeof document === "undefined") return () => {};
        const handler = () => listener(document.visibilityState !== "hidden");
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
      },
    };
  }

  async function persistAttempt(
    attempt: QuestionAttempt,
    identity: string,
    generation: number,
  ): Promise<void> {
    if (!mounted || identity !== currentIdentity || generation !== visitGeneration)
      return;
    if (!attemptDurations.has(attempt.attemptId)) {
      attemptDurations = new Map(attemptDurations).set(attempt.attemptId, attempt.durationMs);
      totalDurationMs = Math.min(
        Number.MAX_SAFE_INTEGER,
        totalDurationMs + Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, attempt.durationMs)),
      );
    }
    if (!attempt.final) {
      if (!attempt.result.correct) firstWrongIdentity = identity;
      return;
    }

    if (completedAttemptId === attempt.attemptId) return;
    const summary: CompletionSummary = {
      id: attempt.attemptId,
      // Any first wrong answer makes the question an Again review, even when
      // the required retry is subsequently correct.
      correct: attempt.result.correct && firstWrongIdentity !== identity,
      durationMs: totalDurationMs,
    };
    if (onCompleted) await onCompleted(summary);
    if (!mounted || identity !== currentIdentity || generation !== visitGeneration)
      return;
    completedAttemptId = attempt.attemptId;
    // This compatibility callback is retained for the prototype lesson route;
    // completion remains gated on the awaited onCompleted callback above.
    try {
      if (onEvaluated)
        onEvaluated({ correct: summary.correct, score: summary.correct ? 1 : 0 });
    } catch {
      // A legacy observer must not turn an already-persisted completion into a
      // second persistence attempt.
    }
  }

  function installHost(): void {
    const identity = `${question.id}:${question.revision}`;
    if (identity === currentIdentity && host) return;
    visitGeneration += 1;
    host?.stop();
    unsubscribe?.();
    const generation = visitGeneration;
    const next = createQuestionHost(question, {
      autoStart: false,
      clock: browserClock(),
      random,
      onAttempt: (attempt) => persistAttempt(attempt, identity, generation),
    });
    currentIdentity = identity;
    firstWrongIdentity = "";
    attemptDurations = new Map();
    totalDurationMs = 0;
    completedAttemptId = "";
    readyIdentity = "";
    lastFocusKey = "";
    host = next;
    hostState = next.state;
    unsubscribe = next.subscribe((state) => {
      if (identity !== currentIdentity) return;
      hostState = state;
      if (state.phase === "final-feedback" && readyIdentity !== identity) {
        readyIdentity = identity;
        onReady?.();
      }
    });
    if (mounted) next.start();
  }

  $effect(() => {
    // Reading only the identity keeps answer interactions from recreating the
    // lifecycle while still resetting on a new revision.
    void question.id;
    void question.revision;
    installHost();
  });

  onMount(() => {
    mounted = true;
    host?.start();
    return () => {
      mounted = false;
      visitGeneration += 1;
      unsubscribe?.();
      unsubscribe = null;
      host?.stop();
    };
  });

  $effect(() => {
    const phase = hostState?.phase;
    if (!phase) return;
    const focusKey = `${currentIdentity}:${phase}:${hostState?.attemptKey ?? 0}`;
    if (focusKey === lastFocusKey) return;
    void tick().then(() => {
      if (focusKey !== `${currentIdentity}:${hostState?.phase}:${hostState?.attemptKey ?? 0}`)
        return;
      if (phase === "final-feedback") {
        finalHeading?.focus();
      } else if (phase === "answering") {
        const first = answerRegion?.querySelector<HTMLElement>("button:not([disabled])");
        first?.focus();
      } else {
        return;
      }
      lastFocusKey = focusKey;
    });
  });

  function answerChanged(answer: UserAnswer | null): void {
    host?.setAnswer(answer);
  }

  function submit(): void {
    void host?.submit();
  }

  function retry(): void {
    host?.retry();
  }

  function retryPersistence(): void {
    void host?.retryPending();
  }

  function recoverEvaluation(): void {
    host?.recover();
  }

  function answerDisplay(): AnswerDisplay | null {
    if (!hostState?.submittedAnswer) return null;
    return describeAnswer(question, hostState.submittedAnswer);
  }

  function canonicalDisplay(): AnswerDisplay | null {
    if (!hostState?.canonicalAnswer) return null;
    return describeCanonicalAnswer(question, hostState.canonicalAnswer);
  }

  function rendererForQuestion() {
    if (!question || typeof question.type !== "string") return null;
    return getQuestionRenderer(question.type);
  }
</script>

{#if hostState?.phase === "error" && hostState.error?.source === "validation"}
  <section class="question-error" role="alert" aria-live="polite">
    <h2>문제를 표시할 수 없습니다.</h2>
    <p>이 문제를 지금은 풀 수 없습니다. 이전 화면으로 돌아가 다시 시도해 주세요.</p>
  </section>
{:else if hostState?.phase === "error" && hostState.error}
  <section class="question-error" role="alert" aria-live="polite">
    <h2>{hostState.error.source === "persistence" ? "답안을 저장하지 못했습니다." : "답안을 확인해 주세요."}</h2>
    <p>{hostState.error.source === "persistence" ? "저장을 다시 시도하면 같은 제출을 이어갑니다." : hostState.error.message}</p>
    {#if hostState.error.source === "persistence"}
      <button class="button" type="button" onclick={retryPersistence}>저장 다시 시도</button>
    {:else}
      <button class="button" type="button" onclick={recoverEvaluation}>다시 풀기</button>
    {/if}
  </section>
{:else if hostState}
  {@const Renderer = rendererForQuestion()}
  <section class="question-host" aria-busy={hostState.phase === "evaluating"}>
    <div class="answer-region" bind:this={answerRegion}>
      {#if Renderer}
        <Renderer
          {question}
          disabled={hostState.phase !== "answering"}
          attemptKey={hostState.attemptKey}
          reveal={hostState.canonicalAnswer}
          submittedAnswer={hostState.submittedAnswer}
          {random}
          onAnswerChange={answerChanged}
        />
      {:else}
        <section class="question-error" role="alert">
          <h2>문제를 표시할 수 없습니다.</h2>
          <p>지원하지 않는 문제 형식입니다.</p>
        </section>
      {/if}
    </div>

    {#if hostState.phase === "answering" || hostState.phase === "evaluating"}
      <button
        class="button submit-button"
        type="button"
        disabled={hostState.phase !== "answering" || hostState.currentAnswer === null}
        onclick={submit}
      >
        {hostState.phase === "evaluating" ? "확인 중…" : "정답 확인"}
      </button>
    {:else if hostState.phase === "retry-feedback"}
      <div class="feedback-card" aria-live="polite">
        <p class="feedback incorrect">오답입니다. 한 번 더 풀어보세요.</p>
        <button class="button" type="button" onclick={retry}>다시 풀기</button>
      </div>
    {:else if hostState.phase === "final-feedback"}
      {@const finalResult = hostState.attempts[hostState.attempts.length - 1]}
      {@const submitted = answerDisplay()}
      {@const canonical = canonicalDisplay()}
      <section class="final-feedback" aria-live="polite" aria-labelledby="question-final-heading">
        <h2 id="question-final-heading" tabindex="-1" bind:this={finalHeading}>
          {finalResult?.correct ? "정답입니다." : "정답을 확인해 보세요."}
        </h2>
        {#if submitted && canonical}
          <div class="answer-comparison">
            <div class="answer-panel">
              <h3>{submitted.title}</h3>
              {#if submitted.kind === "value"}<p>{submitted.value}</p>{/if}
              {#if submitted.kind === "single" || submitted.kind === "list"}
                <ol>{#each submitted.values ?? [] as value}<li>{value}</li>{/each}</ol>
              {/if}
              {#if submitted.kind === "pairs"}
                <ul>{#each submitted.pairs ?? [] as pair}<li>{pair.left} ↔ {pair.right}</li>{/each}</ul>
              {/if}
              {#if submitted.kind === "blanks"}
                <ul>{#each submitted.blanks ?? [] as blank}<li><strong>{blank.label}</strong>: {blank.value}</li>{/each}</ul>
              {/if}
            </div>
            <div class="answer-panel canonical-panel">
              <h3>{canonical.title}</h3>
              {#if canonical.kind === "value"}<p>{canonical.value}</p>{/if}
              {#if canonical.kind === "single" || canonical.kind === "list"}
                <ol>{#each canonical.values ?? [] as value}<li>{value}</li>{/each}</ol>
              {/if}
              {#if canonical.kind === "pairs"}
                <ul>{#each canonical.pairs ?? [] as pair}<li>{pair.left} ↔ {pair.right}</li>{/each}</ul>
              {/if}
              {#if canonical.kind === "blanks"}
                <ul>{#each canonical.blanks ?? [] as blank}<li><strong>{blank.label}</strong>: {blank.value}</li>{/each}</ul>
              {/if}
            </div>
          </div>
        {/if}
        {#if question.explanation}
          <section class="explanation" aria-labelledby="question-explanation-heading">
            <h3 id="question-explanation-heading">설명</h3>
            {#each question.explanation as block}<ContentBlockRenderer {block} />{/each}
          </section>
        {/if}
      </section>
    {/if}
  </section>
{/if}

<style>
  .question-host { display: grid; gap: 1rem; }
  .answer-region { min-width: 0; }
  .button { border: 0; border-radius: 0.65rem; background: #2563eb; padding: 0.7rem 1rem; color: white; font: inherit; font-weight: 700; cursor: pointer; }
  .button:disabled { cursor: not-allowed; opacity: 0.5; }
  .button:focus-visible { outline: 3px solid rgb(37 99 235 / 35%); outline-offset: 2px; }
  .submit-button { justify-self: start; }
  .feedback-card, .final-feedback, .question-error { display: grid; gap: 0.75rem; border-radius: 0.75rem; background: #f8fafc; padding: 1rem; }
  .feedback-card .button, .question-error .button { justify-self: start; }
  .feedback { margin: 0; font-weight: 700; }
  .incorrect { color: #b91c1c; }
  .final-feedback h2, .question-error h2 { margin: 0; }
  .final-feedback h2:focus { outline: 3px solid rgb(37 99 235 / 35%); outline-offset: 3px; }
  .answer-comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
  .answer-panel { min-width: 0; border: 1px solid #dce3ef; border-radius: 0.65rem; background: white; padding: 0.8rem; }
  .answer-panel h3 { margin: 0 0 0.5rem; font-size: 0.95rem; }
  .answer-panel p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .answer-panel ol, .answer-panel ul { display: grid; gap: 0.35rem; margin: 0; padding-left: 1.25rem; }
  .canonical-panel { border-color: #86efac; }
  .explanation { border-top: 1px solid #dce3ef; padding-top: 0.75rem; }
  .explanation h3 { margin: 0; }
  @media (max-width: 640px) { .answer-comparison { grid-template-columns: 1fr; } }
</style>
