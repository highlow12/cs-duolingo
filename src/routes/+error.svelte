<script lang="ts">
  import { base } from '$app/paths';
	import { page } from '$app/state';

	let status = $derived(page.status || 404);
	let notFound = $derived(status === 404);
	let message = $derived(
		notFound
			? '요청한 페이지를 찾을 수 없습니다.'
			: '페이지를 표시하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
	);
</script>

<svelte:head>
	<title>{status} | CS 듀오링고</title>
	<meta name="description" content={message} />
</svelte:head>

<section class="error-page card" aria-labelledby="error-title">
	<p class="eyebrow">{notFound ? '페이지를 찾을 수 없습니다' : '오류가 발생했습니다'}</p>
	<p class="status" aria-hidden="true">{status}</p>
	<h1 id="error-title">
		{notFound ? '잠깐, 길을 다시 찾아볼까요?' : '잠시 후 다시 시도해 주세요.'}
	</h1>
	<p class="message">{message}</p>
	<div class="actions">
		<a class="button" href={`${base}/`}>홈으로 가기</a>
		<a class="button secondary" href={`${base}/learn`}>학습 경로 열기</a>
	</div>
</section>

<style>
	.error-page {
		max-width: 680px;
		margin: 3rem auto;
		text-align: center;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--primary);
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.status {
		margin: 0;
		color: var(--primary);
		font-size: clamp(4rem, 15vw, 7rem);
		font-weight: 900;
		letter-spacing: -0.08em;
		line-height: 1;
	}

	h1 {
		margin: 1rem 0 0.75rem;
	}

	.message {
		margin-bottom: 1.5rem;
		color: var(--muted);
		line-height: 1.7;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
	}
</style>
