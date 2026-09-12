<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import QuestionRenderer from '$lib/components/QuestionRenderer.svelte';
  import { loadDashboard, errorMessage, type Dashboard } from '$lib/application/dashboard';
  import { learningRepository } from '$lib/storage/repositories/learning-repository';
  import type { Question } from '$lib/questions/types';
  let data = $state<Dashboard | null>(null);
  let error = $state('');
  let queue = $state<Question[]>([]);
  let started = $state(false);
  let index = $state(0);
  let ready = $state(false);
  let correct = $state(0);
  let savedIds = new Set<string>();
  let current = $derived(queue[index]);
  async function load() { error = ''; try { data = await loadDashboard(); } catch(e) { error = errorMessage(e); } }
  onMount(() => { void load(); });
  function start() { if(!data) return; queue = data.queue.slice(0,data.snapshot.settings.reviewLimit);index=0;correct=0;ready=false; savedIds = new Set();started=true; }
  async function completed(summary:{id:string;correct:boolean;durationMs:number}) {
    if(!current) throw new Error('복습 문제를 찾지 못했습니다.');
    await learningRepository.saveAttempt({...summary,question:current,mode:'review'});
    if(!savedIds.has(summary.id)) { savedIds.add(summary.id); if(summary.correct) correct++; }
  }
  function next() { if(!ready) return; index++;ready=false; }
  async function refresh() { started=false;data=null;await load(); }
</script>
<svelte:head><title>오늘의 복습 | CS 듀오링고</title></svelte:head>
<div class="stack review-shell">
  <div class="page-heading"><span class="review-prompt" aria-hidden="true">복습 / queue</span><h1>오늘의 복습</h1><p class="muted">다시 떠올리면 오래 남아요.</p></div>
  {#if error}<div class="card error" role="alert">{error}<button class="button secondary" onclick={load}>다시 시도</button></div>
  {:else if !data}<p class="card" role="status">복습할 문제를 찾고 있습니다…</p>
  {:else if !started}
    <section class="card review-start"><h2>{data.queue.length ? `${data.queue.length}개 문제가 기다려요` : '지금은 복습을 모두 마쳤어요'}</h2>
    <p class="muted">{data.queue.length ? `이번에는 최대 ${data.snapshot.settings.reviewLimit}개씩 풀어요. 오답은 한 번 더 생각해볼 수 있어요.` : '다음 복습 시간이 되면 배운 문제가 여기에 나타납니다.'}</p>
    {#if data.queue.length}<button class="button" onclick={start}>복습 시작</button>{:else}<div class="actions"><a class="button" href={`${base}/learn`}>새로운 개념 배우기</a><button class="button secondary" onclick={refresh}>복습 다시 확인</button></div>{/if}
    </section>
  {:else if index >= queue.length}
    <section class="card review-start review-complete"><span class="review-complete-mark" aria-hidden="true">↻</span><h2>{queue.length}개 문제를 다시 떠올렸어요</h2><p>첫 시도 정답 {correct}개 · 다시 배운 문제 {queue.length-correct}개</p><p class="muted">복습 기록과 다음 복습 시간을 저장했습니다.</p><div class="actions"><a class="button" href={`${base}/`}>홈으로</a><button class="button secondary" onclick={refresh}>남은 복습 확인</button></div></section>
  {:else if current}
    <div class="row"><span>{data.lessons.find((l) => l.id === current.lessonId)?.title}</span><span>{index+1} / {queue.length}</span></div><progress max={queue.length} value={index} aria-label="복습 진행도"></progress>
    <section class="card review-question">{#key `${index}:${current.id}`}<QuestionRenderer question={current} onCompleted={completed} onReady={() => { ready=true; }} />{/key}<div class="actions"><button class="button" disabled={!ready} onclick={next}>{index+1 === queue.length ? '복습 마치기' : '다음 문제'}</button><a class="text-link" href={`${base}/`}>여기까지 학습하기</a></div></section>
  {/if}
</div>
<style>
  .review-shell { max-width:800px; margin:auto; }
  .review-prompt { color:var(--primary); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.76rem; font-weight:650; }
  .review-start,.review-question { padding:clamp(var(--space-5),4vw,var(--space-10)); }
  .review-start { border-top:3px solid var(--primary); }
  .review-start p { line-height:1.7; }
  .review-question .actions { margin-top:var(--space-8); padding-top:var(--space-5); border-top:1px solid var(--border); }
  .review-complete { text-align:center; }
  .review-complete-mark { display:grid;place-items:center;width:3.5rem;height:3.5rem;margin:0 auto var(--space-4);border:1px solid var(--success);border-radius:50%;background:var(--success-soft);color:var(--success);font-size:1.5rem;animation:review-complete-in var(--dur-5) var(--ease-out-quart) both; }
  .review-complete .actions { justify-content:center; margin-top:var(--space-5); padding-top:0; border-top:0; }
  @keyframes review-complete-in { from { opacity:0; transform:scale(.96) rotate(-5deg); } to { opacity:1; transform:scale(1) rotate(0); } }
  @media(max-width:640px) { .review-question .actions { align-items:stretch; flex-direction:column; } .review-question .actions .button { width:100%; } .review-complete .actions { align-items:stretch; } }
</style>
