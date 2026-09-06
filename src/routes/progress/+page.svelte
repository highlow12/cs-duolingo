<script lang="ts">
  import { onMount } from 'svelte';
  import { loadDashboard, errorMessage, type Dashboard } from '$lib/application/dashboard';
  let data = $state<Dashboard | null>(null);
  let error = $state('');
  async function load() { error='';try { data=await loadDashboard(); } catch(e) { error=errorMessage(e); } }
  onMount(() => { void load(); });
</script>
<svelte:head><title>나의 학습 기록 | CS 듀오링고</title></svelte:head>
<div class="stack">
  <div class="page-heading"><p class="eyebrow">작은 학습이 쌓인 기록</p><h1>나의 진행도</h1></div>
  {#if error}<div class="card error" role="alert">{error}<button class="button secondary" onclick={load}>다시 시도</button></div>
  {:else if !data}<p class="card" role="status">학습 기록을 불러오는 중입니다…</p>
  {:else}
    <div class="stats-grid"><div class="stat"><span>누적 경험치</span><strong>{data.snapshot.game.xp}<small>XP</small></strong></div><div class="stat"><span>연속 학습</span><strong>{data.snapshot.game.streak}<small>일</small></strong></div><div class="stat"><span>최장 연속 학습</span><strong>{data.snapshot.game.longestStreak}<small>일</small></strong></div></div>
    <section class="card stack"><h2>트랙별 학습</h2>
      {#each [...data.curriculum.tracks].sort((a,b)=>a.order-b.order) as track}
        {@const lessons = data.lessons.filter((l)=>l.track===track.id)}
        {@const completed = lessons.filter((l)=>data!.snapshot.lessonStates.some((s)=>s.lessonId===l.id && s.status==='completed')).length}
        {#if lessons.length}<div><div class="row"><strong>{track.title}</strong><span>{completed} / {lessons.length}</span></div><progress value={completed} max={lessons.length} aria-label={`${track.title} 진행도`}></progress></div>{/if}
      {/each}
    </section>
    <section class="card"><div class="row"><h2>복습 기록</h2><a class="text-link" href="/review">복습하러 가기 →</a></div><p>학습한 문제 <strong>{data.snapshot.questionStates.length}개</strong> · 지금 복습할 문제 <strong>{data.queue.length}개</strong></p><p class="muted">첫 시도에서 틀린 문제는 재시도에서 맞혀도 다시 배울 문제로 기록합니다.</p></section>
    <section class="card"><h2>최근 학습한 레슨</h2>
      {#if !data.snapshot.lessonStates.length}<p class="muted">아직 학습 기록이 없어요. 첫 레슨을 시작해보세요.</p><a class="button" href="/learn">학습 시작</a>
      {:else}<ul class="recent-list">{#each [...data.snapshot.lessonStates].filter((s)=>data!.lessons.some((l)=>l.id===s.lessonId)).sort((a,b)=>(b.lastStudiedAt??0)-(a.lastStudiedAt??0)).slice(0,10) as state}<li><a class="text-link" href={`/learn/${state.lessonId}`}>{data.lessons.find((l)=>l.id===state.lessonId)?.title}</a><span class="muted">{state.status==='completed'?'완료':'학습 중'} · {state.lastStudiedAt ? new Date(state.lastStudiedAt).toLocaleDateString('ko-KR') : '—'}</span></li>{/each}</ul>{/if}
    </section>
  {/if}
</div>
<style>.recent-list {list-style:none;padding:0;margin:0}.recent-list li {display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;padding:1rem 0;border-top:1px solid var(--border)}</style>
