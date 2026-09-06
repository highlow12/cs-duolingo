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
  <div class="page-heading"><p class="eyebrow">매일 쌓이는 컴퓨터과학</p><h1>오늘도 한 개념씩.</h1><p class="muted">이어서 배우고, 잊기 전에 한 번 더 풀어보세요.</p></div>
  {#if error}<div class="card error" role="alert">{error}<button class="button secondary" onclick={load}>다시 시도</button></div>
  {:else if !data}<p class="card" role="status">학습 기록을 불러오는 중입니다…</p>
  {:else}
    <div class="stats-grid" aria-label="나의 학습 요약">
      <div class="stat"><span>연속 학습</span><strong>{data.snapshot.game.streak}<small>일</small></strong></div>
      <div class="stat"><span>누적 경험치</span><strong>{data.snapshot.game.xp}<small>XP</small></strong></div>
      <div class="stat"><span>완료한 레슨</span><strong>{data.snapshot.lessonStates.filter((s) => s.status === 'completed').length}<small> / {data.lessons.length}</small></strong></div>
    </div>
    <div class="home-actions">
      <section class="card next-lesson">
        <p class="eyebrow">{data.nextLesson ? '다음 학습' : '모든 레슨 완료'}</p>
        <h2>{data.nextLesson?.title ?? '배운 내용을 오래 기억해요'}</h2>
        <p>{data.nextLesson?.description ?? '복습을 이어가거나 학습 경로에서 다시 읽을 레슨을 골라보세요.'}</p>
        <a class="button" href={data.nextLesson ? `${base}/learn/${data.nextLesson.id}` : `${base}/learn`}>{data.nextLesson ? '이어서 학습하기' : '학습 경로 보기'}</a>
      </section>
      <section class="card review-card">
        <p class="eyebrow">오늘의 복습</p><h2>{data.queue.length}개 문제</h2>
        <p class="muted">{data.queue.length ? '배운 개념을 다시 떠올릴 시간이에요.' : '지금 풀 복습이 없어요. 새로운 개념을 배워볼까요?'}</p>
        <a class="button secondary" href={`${base}/review`}>복습 확인하기</a>
      </section>
    </div>
    <section class="card daily-goal"><div class="row"><h2>오늘의 목표</h2><strong>{data.snapshot.game.todayXp} / {data.snapshot.settings.dailyGoal} XP</strong></div><progress max={data.snapshot.settings.dailyGoal} value={Math.min(data.snapshot.game.todayXp, data.snapshot.settings.dailyGoal)} aria-label="오늘의 XP 목표"></progress><p class="muted">{data.snapshot.game.todayXp >= data.snapshot.settings.dailyGoal ? '오늘 목표를 달성했어요. 내일도 이어가요!' : '짧은 문제 풀이가 하루하루 쌓여요.'}</p></section>
    <div class="row"><a class="text-link" href={`${base}/learn`}>전체 학습 경로 보기 →</a><a class="text-link" href={`${base}/progress`}>나의 기록 보기 →</a></div>
  {/if}
</div>
<style>
  .home-actions { display:grid; grid-template-columns: 1.5fr 1fr; gap:1rem; }
  .next-lesson { border-top:4px solid var(--primary); padding:2rem; }
  .next-lesson h2 { font-size:1.8rem; }
  .next-lesson p:not(.eyebrow) { max-width:36rem; color:var(--muted); line-height:1.7; }
  .review-card { padding:2rem; background:var(--primary-soft); }
  .daily-goal h2 { font-size:1.1rem; margin:0; }
  .daily-goal p { margin:.75rem 0 0; }
  @media(max-width:640px) { .home-actions { grid-template-columns:1fr; } }
</style>
