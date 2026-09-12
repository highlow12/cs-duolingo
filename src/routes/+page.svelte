<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { loadDashboard, errorMessage, type Dashboard } from '$lib/application/dashboard';
  let data = $state<Dashboard | null>(null);
  let error = $state('');
  async function load() { error = ''; try { data = await loadDashboard(); } catch (e) { error = errorMessage(e); } }
  onMount(() => { void load(); });
</script>
<svelte:head><title>오늘의 학습 | CS 듀오링고</title></svelte:head>
<div class="stack">
  <div class="page-heading home-heading">
    <span class="home-prompt" aria-hidden="true">&gt;_ / today</span>
    <h1>오늘도 한 개념씩.</h1>
    <p class="muted">이어서 배우고, 잊기 전에 한 번 더 풀어보세요.</p>
  </div>
  {#if error}<div class="card error" role="alert">{error}<button class="button secondary" onclick={load}>다시 시도</button></div>
  {:else if !data}<p class="card" role="status">학습 기록을 불러오는 중입니다…</p>
  {:else}
    <div class="stats-grid" aria-label="나의 학습 요약">
      <div class="stat"><span>연속 학습</span><strong>{data.snapshot.game.streak}<small>일</small></strong></div>
      <div class="stat"><span>누적 경험치</span><strong>{data.snapshot.game.xp}<small>XP</small></strong></div>
      <div class="stat"><span>완료한 레슨</span><strong>{data.snapshot.lessonStates.filter((s) => s.status === 'completed').length}<small> / {data.lessons.length}</small></strong></div>
    </div>
    <div class="home-actions">
      <section class="card next-lesson" data-track={data.nextLesson?.track ?? undefined}>
        <div class="lesson-signal"><span class="signal-dot" aria-hidden="true"></span>{data.nextLesson ? '다음 학습' : '모든 레슨 완료'}</div>
        <h2>{data.nextLesson?.title ?? '배운 내용을 오래 기억해요'}</h2>
        <p>{data.nextLesson?.description ?? '복습을 이어가거나 학습 경로에서 다시 읽을 레슨을 골라보세요.'}</p>
        <a class="button" href={data.nextLesson ? `${base}/learn/${data.nextLesson.id}` : `${base}/learn`}>{data.nextLesson ? '이어서 학습하기' : '학습 경로 보기'}</a>
      </section>
      <section class="card review-card">
        <div class="lesson-signal"><span class="review-glyph" aria-hidden="true">↻</span> 오늘의 복습</div><h2>{data.queue.length}개 문제</h2>
        <p class="muted">{data.queue.length ? '배운 개념을 다시 떠올릴 시간이에요.' : '지금 풀 복습이 없어요. 새로운 개념을 배워볼까요?'}</p>
        <a class="button secondary" href={`${base}/review`}>복습 확인하기</a>
      </section>
    </div>
    <section class="daily-goal" class:goal-complete={data.snapshot.game.todayXp >= data.snapshot.settings.dailyGoal}><div class="row"><h2>오늘의 목표</h2><strong>{data.snapshot.game.todayXp} / {data.snapshot.settings.dailyGoal} XP</strong></div><progress max={data.snapshot.settings.dailyGoal} value={Math.min(data.snapshot.game.todayXp, data.snapshot.settings.dailyGoal)} aria-label="오늘의 XP 목표"></progress><p class="muted">{data.snapshot.game.todayXp >= data.snapshot.settings.dailyGoal ? '오늘 목표를 달성했어요. 내일도 이어가요!' : '짧은 문제 풀이가 하루하루 쌓여요.'}</p></section>
    <div class="row home-links"><a class="text-link" href={`${base}/learn`}>전체 학습 경로 보기</a><a class="text-link" href={`${base}/progress`}>나의 기록 보기</a></div>
  {/if}
</div>
<style>
  .home-heading { gap: 0.45rem; }
  .home-prompt,
  .lesson-signal {
    color: var(--primary);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.76rem;
    font-weight: 650;
  }

  .home-prompt { letter-spacing: 0.02em; }
  .home-actions { display: grid; grid-template-columns: 1.45fr 1fr; gap: var(--space-4); }
  .next-lesson { position: relative; border-top: 3px solid var(--track-accent, var(--primary)); padding: var(--space-8); }
  .next-lesson h2 { max-width: 34rem; margin-top: var(--space-3); font-size: clamp(1.45rem, 3vw, 1.85rem); }
  .next-lesson p { max-width: 36rem; color: var(--text-muted); }
  .signal-dot { display: inline-block; width: 0.45rem; height: 0.45rem; margin-right: 0.35rem; border-radius: 50%; background: var(--track-accent, var(--primary)); vertical-align: middle; }
  .review-card { padding: var(--space-8); background: var(--primary-soft); }
  .review-glyph { color: var(--primary); font-size: 1rem; }
  .review-card h2 { margin-top: var(--space-3); }
  .daily-goal { display: grid; gap: var(--space-3); border-top: 1px solid var(--border); padding-top: var(--space-5); }
  .daily-goal h2 { margin: 0; font-size: 1rem; }
  .daily-goal strong { color: var(--primary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.85rem; }
  .daily-goal p { margin: 0; }
  .daily-goal.goal-complete { border-top-color: var(--success); }
  .daily-goal.goal-complete strong { color: var(--success); }
  .home-links { padding-top: var(--space-1); }
  @media(max-width:640px) {
    .home-actions { grid-template-columns: 1fr; }
    .next-lesson, .review-card { padding: var(--space-6); }
  }
</style>
