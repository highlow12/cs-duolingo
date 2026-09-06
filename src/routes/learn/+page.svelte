<script lang="ts">
	import { onMount } from 'svelte';
	import type { Curriculum, Lesson } from '$lib/content/types';
	import { contentRepository } from '$lib/content/repository/static-content-repository';

	let curriculum = $state<Curriculum | null>(null);
	let lessons = $state<Lesson[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(() => {
		void loadCurriculum();
	});

	async function loadCurriculum() {
		try {
			curriculum = await contentRepository.getCurriculum();
			lessons = await Promise.all(
				curriculum.nodes.map((node) => contentRepository.getLesson(node.lesson))
			);
		} catch (caught) {
			error = caught instanceof Error ? caught.message : '커리큘럼을 불러오지 못했습니다.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>학습 | CS 듀오링고</title></svelte:head>

<div class="stack">
	<div>
		<p class="eyebrow">Curriculum</p>
		<h1>학습 경로</h1>
		<p class="muted">선행 개념을 따라 다음 레슨을 열어 보세요.</p>
	</div>

	{#if loading}
		<div class="card">커리큘럼을 불러오는 중입니다…</div>
	{:else if error}
		<div class="card error" role="alert">{error}<br />먼저 <code>npm run content:build</code>를 실행했는지 확인하세요.</div>
	{:else if curriculum}
		{#each curriculum.tracks as track}
			<section class="track stack">
				<div>
					<h2>{track.title}</h2>
					<p class="muted">{track.description}</p>
				</div>
				<div class="grid">
					{#each lessons.filter((lesson) => lesson.track === track.id) as lesson}
						<a class="lesson-card card" href={`/learn/${lesson.id}`}>
							<span class="status">시작 가능</span>
							<h3>{lesson.title}</h3>
							<p class="muted">{lesson.description}</p>
							<span class="open">레슨 열기 →</span>
						</a>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>

<style>
	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--primary);
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	h1,
	h2,
	h3 {
		letter-spacing: -0.04em;
	}

	h1 {
		margin: 0;
	}

	h2 {
		margin: 0;
	}

	.track {
		margin-top: 1rem;
	}

	.track h2 + p {
		margin-top: 0.35rem;
	}

	.lesson-card {
		display: block;
		text-decoration: none;
		transition: transform 120ms ease, box-shadow 120ms ease;
	}

	.lesson-card:hover,
	.lesson-card:focus-visible {
		transform: translateY(-2px);
		box-shadow: 0 12px 28px rgb(35 55 90 / 10%);
	}

	.lesson-card h3 {
		margin: 0.8rem 0 0.35rem;
	}

	.lesson-card p {
		margin: 0 0 1rem;
		line-height: 1.5;
	}

	.status {
		color: var(--success);
		font-size: 0.8rem;
		font-weight: 800;
	}

	.open {
		color: var(--primary);
		font-weight: 700;
	}

	.error {
		color: var(--danger);
	}
</style>
