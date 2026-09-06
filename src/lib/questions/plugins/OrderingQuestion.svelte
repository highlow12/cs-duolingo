<script lang="ts">
	import { onMount } from 'svelte';
	import ContentBlockRenderer from '$lib/components/ContentBlockRenderer.svelte';
	import { evaluateQuestion } from '$lib/questions/registry';
	import type { EvaluationResult, OrderingQuestion } from '$lib/questions/types';

	let {
		question,
		onEvaluated = () => {}
	}: {
		question: OrderingQuestion;
		onEvaluated?: (result: EvaluationResult) => void;
	} = $props();

	function shuffle<T>(items: T[]): T[] {
		const shuffled = [...items];
		for (let index = shuffled.length - 1; index > 0; index -= 1) {
			const target = Math.floor(Math.random() * (index + 1));
			[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
		}
		if (
			shuffled.length > 1 &&
			shuffled.every((item, index) => item === items[index])
		) {
			[shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
		}
		return shuffled;
	}

	let orderedItems = $state<OrderingQuestion['items']>([]);
	let result = $state<EvaluationResult | null>(null);
	let error = $state<string | null>(null);
	let announcement = $state('');
	let draggedIndex = $state<number | null>(null);

	onMount(() => {
		orderedItems = shuffle(question.items);
	});

	function move(index: number, offset: -1 | 1) {
		if (result) return;
		const target = index + offset;
		if (target < 0 || target >= orderedItems.length) return;
		const next = [...orderedItems];
		[next[index], next[target]] = [next[target], next[index]];
		orderedItems = next;
		announcement = `${next[target].id} 항목이 ${target + 1}번째 위치로 이동했습니다.`;
	}

	function drop(target: number) {
		if (result || draggedIndex === null || draggedIndex === target) return;
		const next = [...orderedItems];
		const [item] = next.splice(draggedIndex, 1);
		next.splice(target, 0, item);
		orderedItems = next;
		announcement = `${item.id} 항목이 ${target + 1}번째 위치로 이동했습니다.`;
		draggedIndex = null;
	}

	function submit() {
		if (result) return;
		const outcome = evaluateQuestion(question, {
			type: 'ordering',
			orderedItemIds: orderedItems.map((item) => item.id)
		});
		if (outcome.status === 'error') {
			error = outcome.error.message;
			return;
		}
		result = outcome.result;
		onEvaluated(result);
	}
</script>

<div class="question-body">
	{#each question.prompt as block}
		<ContentBlockRenderer {block} />
	{/each}

	<ol class="items" aria-label="순서 항목">
		{#each orderedItems as item, index}
			<li
				class="item"
				draggable={result === null}
				ondragstart={() => (draggedIndex = index)}
				ondragend={() => (draggedIndex = null)}
				ondragover={(event) => event.preventDefault()}
				ondrop={() => drop(index)}
			>
				<div class="item-content">
					<span class="item-number" aria-hidden="true">{index + 1}</span>
					{#each item.content as block}
						<ContentBlockRenderer {block} />
					{/each}
				</div>
				<div class="move-actions">
					<button
						class="icon-button"
						type="button"
						disabled={result !== null || index === 0}
						aria-label={`${item.id} 항목 위로 이동`}
						onclick={() => move(index, -1)}
					>
						↑
					</button>
					<button
						class="icon-button"
						type="button"
						disabled={result !== null || index === orderedItems.length - 1}
						aria-label={`${item.id} 항목 아래로 이동`}
						onclick={() => move(index, 1)}
					>
						↓
					</button>
				</div>
			</li>
		{/each}
	</ol>
	<p class="announcement" aria-live="polite">{announcement}</p>

	<button class="button" type="button" disabled={result !== null} onclick={submit}>정답 확인</button>

	{#if error}
		<p class="feedback incorrect" role="alert">{error}</p>
	{:else if result}
		<p class:correct={result.correct} class:incorrect={!result.correct} class="feedback" role="status">
			{result.correct ? '정답입니다.' : '순서를 다시 확인해 보세요.'}
		</p>
	{/if}
</div>

<style>
	.question-body {
		display: grid;
		gap: 1rem;
	}

	.items {
		display: grid;
		gap: 0.7rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border: 1px solid #dce3ef;
		border-radius: 0.75rem;
		background: white;
		padding: 0.8rem 1rem;
	}

	.item[draggable='true'] {
		cursor: grab;
	}

	.item-content {
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
		min-width: 0;
	}

	.item-content :global(p),
	.item-content :global(pre) {
		margin: 0;
	}

	.item-number {
		display: inline-grid;
		flex: 0 0 auto;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 50%;
		background: #e8eef8;
		font-weight: 800;
	}

	.move-actions {
		display: flex;
		gap: 0.35rem;
	}

	.icon-button {
		width: 2rem;
		height: 2rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.45rem;
		background: white;
		font-size: 1.1rem;
		cursor: pointer;
	}

	.icon-button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.announcement {
		min-height: 1.5rem;
		margin: 0;
		color: #60708a;
	}

	.feedback {
		margin: 0;
		font-weight: 700;
	}

	.correct {
		color: #15803d;
	}

	.incorrect {
		color: #b91c1c;
	}
</style>
