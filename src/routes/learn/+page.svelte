<script lang="ts">
  import { onMount } from 'svelte';
  import { loadDashboard, errorMessage, type Dashboard } from '$lib/application/dashboard';
  import { lessonStatus, missingPrerequisites, statusLabels } from '$lib/curriculum/progress';
  let data = $state<Dashboard | null>(null);
  let error = $state('');
  let selected = $state('all');
  async function load() { error = ''; try { data = await loadDashboard(); } catch(e) { error = errorMessage(e); } }
  onMount(() => { void load(); });
</script>
<svelte:head><title>학습 경로 | CS 듀오링고</title></svelte:head>
<div class="stack">
  <div class="page-heading"><p class="eyebrow">개념을 연결하는 길</p><h1>학습 경로</h1><p class="muted">Python에서 자료구조로, 컴퓨터 구조에서 네트워크와 그래픽스로.</p></div>
  {#if error}<div class="card error" role="alert">{error}<button class="button secondary" onclick={load}>다시 시도</button></div>
  {:else if !data}<p class="card" role="status">학습 경로를 불러오는 중입니다…</p>
  {:else}
    <label class="filter">트랙 <select bind:value={selected}><option value="all">전체 트랙</option>{#each [...data.curriculum.tracks].sort((a,b) => a.order-b.order) as track}<option value={track.id}>{track.title}</option>{/each}</select></label>
    {#each [...data.curriculum.tracks].sort((a,b) => a.order-b.order).filter((t) => selected === 'all' || t.id === selected) as track}
      {@const lessons = data.lessons.filter((l) => l.track === track.id)}
      {#if lessons.length}
      <section class="stack track"><div><div class="row"><h2>{track.title}</h2><span class="muted">{lessons.filter((l) => lessonStatus(l,data!.curriculum,data!.snapshot.lessonStates) === 'completed').length} / {lessons.length} 완료</span></div><p class="muted">{track.description}</p></div>
        <div class="lesson-list">
          {#each lessons as lesson, index}
            {@const status = lessonStatus(lesson, data.curriculum, data.snapshot.lessonStates)}
            <article class="card lesson-card" class:locked={status === 'locked'}>
              <span class="lesson-number" class:done={status === 'completed'} aria-hidden="true">{status === 'completed' ? '✓' : String(index+1).padStart(2,'0')}</span>
              <div class="lesson-info"><span class="badge" class:success={status === 'completed'}>{statusLabels[status]}</span><h3>{lesson.title}</h3><p class="muted">{lesson.description}</p>
              {#if status === 'locked'}<p class="prerequisites">먼저 배워요: {missingPrerequisites(lesson.id,data.curriculum,data.snapshot.lessonStates).map((id) => data!.lessons.find((l) => l.id === id)?.title ?? id).join(', ')}</p>{/if}</div>
              {#if status !== 'locked'}<a class="button secondary" href={`/learn/${lesson.id}`} aria-label={`${lesson.title} ${status === 'completed' ? '다시 읽기' : '학습하기'}`}>{status === 'completed' ? '다시 읽기' : status === 'in-progress' ? '이어하기' : '시작'}</a>{/if}
            </article>
          {/each}
        </div>
      </section>
      {/if}
    {/each}
  {/if}
</div>
<style>
  .filter { display:flex; align-items:center; gap:1rem; }
  .track h2,.track .row { margin:0; } .track p { margin:.5rem 0 0; }
  .lesson-list { display:grid; gap:.75rem; }
  .lesson-card { display:flex; align-items:center; gap:1.25rem; }
  .lesson-info { flex:1; min-width:0; } .lesson-info h3 { margin:.5rem 0; }
  .lesson-number { display:grid;place-items:center;width:3rem;height:3rem;flex-shrink:0;border-radius:1rem;background:var(--primary-soft);color:var(--primary);font-weight:800; }
  .lesson-number.done { background:#dcfce7;color:var(--success); }
  .locked { background:#f0f3f8; } .prerequisites { font-size:.9rem; }
  @media(max-width:540px) { .lesson-card { flex-wrap:wrap;gap:.75rem; } .lesson-card .button { margin-left:3.75rem; } }
</style>
