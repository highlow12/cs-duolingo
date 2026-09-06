<script lang="ts">
	import FillBlankQuestion from '$lib/questions/plugins/FillBlankQuestion.svelte';
	import SingleChoiceQuestion from '$lib/questions/plugins/SingleChoiceQuestion.svelte';
	import type { EvaluationResult, Question } from '$lib/questions/types';

	let {
		question,
		onEvaluated = () => {}
	}: {
		question: Question;
		onEvaluated?: (result: EvaluationResult) => void;
	} = $props();
</script>

{#if question.type === 'single-choice'}
	<SingleChoiceQuestion {question} {onEvaluated} />
{:else if question.type === 'fill-blank'}
	<FillBlankQuestion {question} {onEvaluated} />
{:else}
	<div class="card unsupported">
		<p>아직 구현되지 않은 문제 형식입니다: <code>{question.type}</code></p>
	</div>
{/if}
