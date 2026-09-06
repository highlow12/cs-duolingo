<svelte:head><title>복습 | CS 듀오링고</title></svelte:head>

<section class="card empty-state">
	<p class="eyebrow">Review</p>
	<h1>오늘의 복습</h1>
	<p>아직 저장된 복습 문제가 없습니다. 첫 레슨을 완료하면 이 화면에 복습 큐가 연결됩니다.</p>
	<a class="button" href="/learn">학습하러 가기</a>
</section>

<style>
	.empty-state {
		max-width: 680px;
		margin: 4rem auto;
		text-align: center;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--primary);
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.empty-state p:not(.eyebrow) {
		margin-bottom: 1.5rem;
		color: var(--muted);
		line-height: 1.7;
	}
</style>
