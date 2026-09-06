<script lang="ts">
	import ContentBlockRenderer from '$lib/components/ContentBlockRenderer.svelte';
	import { evaluateQuestion } from '$lib/questions/registry';
	import type { EvaluationResult, SingleChoiceQuestion, UserAnswer } from '$lib/questions/types';

	let {
		question,
		onEvaluated = () => {}
	}: {
		question: SingleChoiceQuestion;
		onEvaluated?: (result: EvaluationResult) => void;
	} = $props();

	let selectedId = $state<string | null>(null);
	let result = $state<EvaluationResult | null>(null);

	function submit() {
		if (!selectedId || result) return;
		const answer: UserAnswer = { optionId: selectedId };
		result = evaluateQuestion(question, answer);
		onEvaluated(result);
	}
</script>

<div class="question-body">
	{#each question.prompt as block}
		<ContentBlockRenderer {block} />
	{/each}

	<div class="options" role="radiogroup" aria-label="답 선택">
		{#each question.options as option}
			<button
				class:selected={selectedId === option.id}
				class="option"
				role="radio"
				aria-checked={selectedId === option.id}
				disabled={result !== null}
				onclick={() => (selectedId = option.id)}
			>
				{#each option.content as block}
					<ContentBlockRenderer {block} />
				{/each}
			</button>
		{/each}
	</div>

	<button class="button" disabled={!selectedId || result !== null} onclick={submit}>정답 확인</button>

	{#if result}
		<p class:correct={result.correct} class:incorrect={!result.correct} class="feedback" role="status">
			{result.feedback}
		</p>
	{/if}
</div>

<style>
	.question-body {
		display: grid;
		gap: 1rem;
	}

	.options {
		display: grid;
		gap: 0.75rem;
	}

	.option {
		border: 1px solid #dce3ef;
		border-radius: 0.75rem;
		background: white;
		padding: 0.8rem 1rem;
		text-align: left;
	}

	.option.selected {
		border-color: #2563eb;
		box-shadow: 0 0 0 2px rgb(37 99 235 / 15%);
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
