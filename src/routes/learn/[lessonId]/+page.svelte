<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import ContentBlockRenderer from '$lib/components/ContentBlockRenderer.svelte';
  import QuestionRenderer from '$lib/components/QuestionRenderer.svelte';
  import { contentRepository } from '$lib/content/repository/static-content-repository';
  import { learningRepository } from '$lib/storage/repositories/learning-repository';
  import { missingPrerequisites } from '$lib/curriculum/progress';
  import { advanceLesson, recordAnswer, type LessonSession } from '$lib/lesson/lesson-engine';
  import type { Lesson } from '$lib/content/types';
  import type { Question } from '$lib/questions/types';
  import { errorMessage } from '$lib/application/dashboard';
  let navigationEpoch = 0;
  let lesson = $state<Lesson | null>(null);
  let session = $state<LessonSession | null>(null);
  let questions = $state<Record<string,Question>>({});
  let loading = $state(true);
  let error = $state('');
  let saveError = $state('');
  let ready = $state(false);
  let resumedAnswer = $state(false);
  let saving = $state(false);
  let blocked = $state<string[]>([]);
  let flow = $derived(lesson && session ? lesson.flow[session.currentIndex] : null);
  let question = $derived(flow?.type === 'question' ? questions[flow.ref] : null);
  $effect(() => {
    const id = page.params.lessonId;
    navigationEpoch++;
    let cancelled = false;
    loading = true; error = ''; saveError = ''; ready = false; resumedAnswer = false; saving = false; lesson = null; session = null; blocked = [];
    void (async () => {
      try {
        const [loaded, curriculum, snapshot] = await Promise.all([contentRepository.getLesson(id!), contentRepository.getCurriculum(), learningRepository.getSnapshot()]);
        if(cancelled) return;
        const missing = missingPrerequisites(loaded.id,curriculum,snapshot.lessonStates);
        if(missing.length && !snapshot.lessonStates.some((s) => s.lessonId === loaded.id && s.status === 'completed')) {
          const labels = await Promise.all(missing.map(async (required) => (await contentRepository.getLesson(required)).title));
          if(!cancelled) { blocked = labels; lesson = loaded; }
          return;
        }
        const loadedQuestions = await Promise.all(loaded.flow.filter((f) => f.type === 'question').map((f) => contentRepository.getQuestion(f.ref)));
        if(cancelled) return;
        const restored = await learningRepository.startLesson(loaded);
        if(cancelled) return;
        questions = Object.fromEntries(loadedQuestions.map((q) => [q.id,q]));
        lesson = loaded; session = restored;
        const restoredFlow = loaded.flow[restored.currentIndex];
        resumedAnswer = restoredFlow?.type === 'question' && restored.answers.some((answer) => answer.questionId === restoredFlow.ref);
        ready = resumedAnswer;
      } catch(e) { if(!cancelled) error = errorMessage(e); }
      finally { if(!cancelled) loading = false; }
    })();
    return () => { cancelled = true; };
  });
  async function completeQuestion(summary: {id:string;correct:boolean;durationMs:number}) {
    if(!question || !session) throw new Error('문제 상태를 다시 확인해 주세요.');
    const current = question;
    const activeSession = session;
    const epoch = navigationEpoch;
    await learningRepository.saveAttempt({...summary,question:current,mode:'lesson'});
    // The same session answer is replaced on a save retry instead of appended twice.
    const updated = recordAnswer({...activeSession,answers:activeSession.answers.filter((a) => a.questionId !== current.id)},current.id,summary.correct);
    await learningRepository.saveSession(updated);
    if(epoch === navigationEpoch) session = updated;
  }
  async function next() {
    if(!lesson || !session || saving || (flow?.type === 'question' && !ready)) return;
    saving = true; saveError = '';
    const epoch = navigationEpoch;
    try {
      const advanced = advanceLesson(session,lesson);
      if(advanced.status === 'completed') await learningRepository.completeLesson(lesson,advanced);
      else await learningRepository.saveSession(advanced);
      if(epoch === navigationEpoch) { session = advanced; ready = false; resumedAnswer = false; }
    } catch(e) { if(epoch === navigationEpoch) saveError = errorMessage(e); }
    finally { if(epoch === navigationEpoch) saving = false; }
  }
</script>
<svelte:head><title>{lesson?.title ?? '레슨'} | CS 듀오링고</title></svelte:head>
{#if loading}<p class="card" role="status">레슨을 준비하는 중입니다…</p>
{:else if error}<section class="card error" role="alert"><h1>레슨을 열지 못했어요</h1><p>{error}</p><a class="button secondary" href={`${base}/learn`}>학습 경로로</a></section>
{:else if blocked.length}<section class="card"><h1>먼저 배울 개념이 있어요</h1><p>{blocked.join(', ')} 레슨을 완료하면 {lesson?.title} 레슨이 열립니다.</p><a class="button" href={`${base}/learn`}>학습 경로로</a></section>
{:else if lesson && session?.status === 'completed'}
  <section class="card completion"><span class="completion-mark" aria-hidden="true">✓</span><p class="eyebrow">학습 완료</p><h1>{lesson.title}</h1><p>학습 기록을 저장했어요. 배운 문제는 알맞은 때에 복습으로 다시 만나요.</p><p class="muted">첫 시도 정답 {session.answers.filter((a) => a.correct).length} / {session.answers.length}</p><div class="actions"><a class="button" href={`${base}/`}>다음 학습 확인</a><a class="button secondary" href={`${base}/learn`}>학습 경로</a></div></section>
{:else if lesson && session && flow}
  <div class="lesson-player stack">
    <header><a class="text-link" href={`${base}/learn`}>← 학습 경로</a><div class="row lesson-counter"><span>{lesson.title}</span><span>{session.currentIndex+1} / {lesson.flow.length}</span></div><progress value={session.currentIndex} max={lesson.flow.length} aria-label="레슨 진행도"></progress></header>
    <section class="card learning-card">
      {#if flow.type === 'content'}
        <p class="eyebrow">개념 익히기</p>
        {#each flow.blocks as block}<ContentBlockRenderer {block} />{/each}
      {:else if question && resumedAnswer}
        <h2>이 문제의 학습 기록을 저장했어요</h2><p>중단한 위치로 돌아왔습니다. 계속 눌러 다음 단계로 이동하세요.</p>
        {#each question.explanation ?? [] as block}<ContentBlockRenderer {block} />{/each}
      {:else if question}
        {#key `${lesson.id}:${session.currentIndex}:${question.revision}`}
          <QuestionRenderer {question} onCompleted={completeQuestion} onReady={() => { ready = true; }} />
        {/key}
      {/if}
      {#if saveError}<p class="error" role="alert">저장하지 못했어요. {saveError} 아래 버튼으로 다시 시도할 수 있습니다.</p>{/if}
      <div class="lesson-controls"><a class="text-link" href={`${base}/learn`}>나중에 이어하기</a><button class="button" disabled={saving || (flow.type === 'question' && !ready)} onclick={next}>{saving ? '저장 중…' : session.currentIndex+1 === lesson.flow.length ? '레슨 완료' : '계속'}</button></div>
    </section>
  </div>
{/if}
<style>
  .lesson-player { max-width:800px;margin:auto; } .lesson-counter { margin:1rem 0 .5rem; color:var(--muted); }
  .learning-card { padding:clamp(1.25rem,4vw,2.5rem);min-height:320px; }
  .lesson-controls { display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border); }
  .completion { max-width:700px;margin:2rem auto;text-align:center;padding:3rem 1.5rem; }
  .completion p { line-height:1.7; } .completion-mark { display:grid;place-items:center;margin:0 auto 1rem;background:#dcfce7;color:var(--success);border-radius:50%;width:4rem;height:4rem;font-size:2rem; }
  .actions { justify-content:center; }
</style>
