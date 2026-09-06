<svelte:head><title>진행도 | CS 듀오링고</title></svelte:head>

<div class="stack">
	<div>
		<p class="eyebrow">Progress</p>
		<h1>나의 진행도</h1>
		<p class="muted">학습 기록과 게임화 지표를 이 화면에서 확인하게 됩니다.</p>
	</div>
	<div class="grid">
		<div class="card stat"><span>완료 레슨</span><strong>0</strong></div>
		<div class="card stat"><span>복습 대기</span><strong>0</strong></div>
		<div class="card stat"><span>현재 streak</span><strong>0일</strong></div>
		<div class="card stat"><span>XP</span><strong>0</strong></div>
	</div>
</div>

<style>
	.stack {
		display: grid;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--primary);
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
	}

	.stat {
		display: grid;
		gap: 0.5rem;
	}

	.stat span {
		color: var(--muted);
	}

	.stat strong {
		font-size: 2rem;
	}
</style>
