<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import ContentBlockRenderer from '$lib/components/ContentBlockRenderer.svelte';
	import QuestionRenderer from '$lib/components/QuestionRenderer.svelte';
	import type { Lesson } from '$lib/content/types';
	import { contentRepository } from '$lib/content/repository/static-content-repository';
	import { advanceLesson, createLessonSession, recordAnswer, type LessonSession } from '$lib/lesson/lesson-engine';
	import type { EvaluationResult, Question } from '$lib/questions/types';

	let lessonId = $derived(page.params.lessonId);
	let lesson = $state<Lesson | null>(null);
	let session = $state<LessonSession | null>(null);
	let question = $state<Question | null>(null);
	let evaluation = $state<EvaluationResult | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let currentFlow = $derived(lesson && session ? lesson.flow[session.currentIndex] : null);
	let completed = $derived(session?.status === 'completed');

	onMount(() => {
		if (lessonId) void loadLesson(lessonId);
		else {
			error = '레슨 ID가 없습니다.';
			loading = false;
		}
	});

	$effect(() => {
		const flow = currentFlow;
		if (!flow || flow.type !== 'question') {
			question = null;
			return;
		}
		void loadQuestion(flow.ref);
	});

	async function loadLesson(id: string) {
		try {
			lesson = await contentRepository.getLesson(id);
			session = createLessonSession(lesson);
		} catch (caught) {
			error = caught instanceof Error ? caught.message : '레슨을 불러오지 못했습니다.';
		} finally {
			loading = false;
		}
	}

	async function loadQuestion(id: string) {
		try {
			question = await contentRepository.getQuestion(id);
		} catch (caught) {
			error = caught instanceof Error ? caught.message : '문제를 불러오지 못했습니다.';
		}
	}

	function onEvaluated(result: EvaluationResult) {
		evaluation = result;
		if (question && session) session = recordAnswer(session, question.id, result.correct);
	}

	function next() {
		if (!lesson || !session) return;
		if (currentFlow?.type === 'question' && !evaluation) return;
		session = advanceLesson(session, lesson);
		evaluation = null;
	}
</script>

<svelte:head><title>{lesson?.title ?? '레슨'} | CS 듀오링고</title></svelte:head>

{#if loading}
	<div class="card">레슨을 불러오는 중입니다…</div>
{:else if error}
	<div class="card error" role="alert">{error}</div>
{:else if lesson && session && completed}
	<section class="completion card">
		<p class="eyebrow">Lesson Complete</p>
		<h1>{lesson.title} 완료!</h1>
		<p>첫 번째 학습 흐름을 완료했습니다. 다음 단계에서는 이 기록을 IndexedDB와 복습 큐에 연결합니다.</p>
		<div class="actions">
			<a class="button" href="/learn">다른 레슨 보기</a>
			<a class="button secondary" href="/review">복습으로 이동</a>
		</div>
	</section>
{:else if lesson && session && currentFlow}
	<section class="lesson-header">
		<a class="back" href="/learn">← 학습 경로</a>
		<div class="progress-track" aria-label="레슨 진행도">
			<div style={`width: ${((session.currentIndex + 1) / lesson.flow.length) * 100}%`}></div>
		</div>
		<p class="muted">{session.currentIndex + 1} / {lesson.flow.length}</p>
		<h1>{lesson.title}</h1>
		<p class="muted">{lesson.description}</p>
	</section>

	<section class="lesson-card card">
		{#if currentFlow.type === 'content'}
			<div class="content-blocks">
				{#each lesson.content[currentFlow.ref] ?? [] as block}
					<ContentBlockRenderer {block} />
				{/each}
			</div>
		{:else if question}
			<QuestionRenderer {question} {onEvaluated} />
		{:else}
			<p>문제를 불러오는 중입니다…</p>
		{/if}

		<div class="lesson-actions">
			<button class="button" disabled={currentFlow.type === 'question' && !evaluation} onclick={next}>
				{session.currentIndex + 1 === lesson.flow.length ? '레슨 완료' : '계속'}
			</button>
		</div>
	</section>
{/if}

<style>
	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--primary);
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0.5rem 0;
		letter-spacing: -0.05em;
	}

	.back {
		color: var(--primary);
		font-weight: 700;
		text-decoration: none;
	}

	.lesson-header {
		display: grid;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}

	.progress-track {
		height: 0.5rem;
		overflow: hidden;
		border-radius: 999px;
		background: #e5eaf3;
	}

	.progress-track div {
		height: 100%;
		border-radius: inherit;
		background: var(--primary);
		transition: width 180ms ease;
	}

	.lesson-card {
		min-height: 300px;
	}

	.content-blocks {
		max-width: 48rem;
		margin: 0 auto;
	}

	.lesson-actions,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 2rem;
	}

	.completion {
		max-width: 680px;
		margin: 4rem auto;
		text-align: center;
	}

	.completion p:not(.eyebrow) {
		color: var(--muted);
		line-height: 1.7;
	}

	.error {
		color: var(--danger);
	}
</style>
