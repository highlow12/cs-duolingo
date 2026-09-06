<script lang="ts">
	import ContentBlockRenderer from '$lib/components/ContentBlockRenderer.svelte';
	import { evaluateQuestion } from '$lib/questions/registry';
	import type { EvaluationResult, FillBlankQuestion, UserAnswer } from '$lib/questions/types';

	let {
		question,
		onEvaluated = () => {}
	}: {
		question: FillBlankQuestion;
		onEvaluated?: (result: EvaluationResult) => void;
	} = $props();

	let value = $state('');
	let result = $state<EvaluationResult | null>(null);

	function submit() {
		if (!value.trim() || result) return;
		const answer: UserAnswer = { value };
		result = evaluateQuestion(question, answer);
		onEvaluated(result);
	}
</script>

<div class="question-body">
	{#each question.prompt as block}
		<ContentBlockRenderer {block} />
	{/each}

	<label>
		<span>답</span>
		<input bind:value disabled={result !== null} autocomplete="off" onkeydown={(event) => event.key === 'Enter' && submit()} />
	</label>

	<button class="button" disabled={!value.trim() || result !== null} onclick={submit}>정답 확인</button>

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

	label {
		display: grid;
		gap: 0.4rem;
		font-weight: 700;
	}

	input {
		border: 1px solid #cbd5e1;
		border-radius: 0.6rem;
		padding: 0.75rem;
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
