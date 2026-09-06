<script lang="ts">
	import FillBlankQuestion from '$lib/questions/plugins/FillBlankQuestion.svelte';
	import CodeCompletionQuestion from '$lib/questions/plugins/CodeCompletionQuestion.svelte';
	import CodeOutputQuestion from '$lib/questions/plugins/CodeOutputQuestion.svelte';
	import MatchingQuestion from '$lib/questions/plugins/MatchingQuestion.svelte';
	import MultiSelectQuestion from '$lib/questions/plugins/MultiSelectQuestion.svelte';
	import OrderingQuestion from '$lib/questions/plugins/OrderingQuestion.svelte';
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
{:else if question.type === 'multi-select'}
	<MultiSelectQuestion {question} {onEvaluated} />
{:else if question.type === 'ordering'}
	<OrderingQuestion {question} {onEvaluated} />
{:else if question.type === 'matching'}
	<MatchingQuestion {question} {onEvaluated} />
{:else if question.type === 'code-output'}
	<CodeOutputQuestion {question} {onEvaluated} />
{:else if question.type === 'code-completion'}
	<CodeCompletionQuestion {question} {onEvaluated} />
{/if}
