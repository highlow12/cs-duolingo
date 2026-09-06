<svelte:head>
	<title>CS 듀오링고</title>
	<meta
		name="description"
		content="짧은 설명과 반복 문제로 컴퓨터과학을 학습하는 Offline First 앱"
	/>
</svelte:head>

<section class="hero">
	<div>
		<p class="eyebrow">Computer Science Learning</p>
		<h1>컴퓨터과학을<br />조금씩, 확실하게.</h1>
		<p class="lead">
			짧은 설명을 읽고 바로 문제를 풀며, 시간이 지나면 다시 복습하는 학습 앱입니다.
		</p>
		<div class="actions">
			<a class="button" href="/learn">학습 시작</a>
			<a class="button secondary" href="/review">오늘의 복습</a>
		</div>
	</div>
	<div class="hero-card card">
		<span class="hero-icon">λ</span>
		<strong>첫 번째 수직 슬라이스</strong>
		<p>Python 변수 레슨에서 설명 → 문제 → 즉시 피드백 흐름을 확인해 보세요.</p>
		<a href="/learn/py.variables">Python 변수 레슨 열기 →</a>
	</div>
</section>

<section class="stack">
	<h2>핵심 학습 루프</h2>
	<div class="grid">
		<div class="card"><strong>1. 개념</strong><p class="muted">짧은 설명으로 핵심 개념을 확인합니다.</p></div>
		<div class="card"><strong>2. 문제</strong><p class="muted">다양한 문제 형식으로 바로 이해를 확인합니다.</p></div>
		<div class="card"><strong>3. 복습</strong><p class="muted">학습 기록을 바탕으로 다시 풀 문제를 정합니다.</p></div>
	</div>
</section>

<style>
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr);
		align-items: center;
		gap: 2rem;
		min-height: 430px;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--primary);
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.4rem, 7vw, 5rem);
		letter-spacing: -0.07em;
		line-height: 1.05;
	}

	.lead {
		max-width: 34rem;
		margin: 1.5rem 0;
		color: var(--muted);
		font-size: 1.1rem;
		line-height: 1.7;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.hero-card {
		display: grid;
		gap: 0.8rem;
		transform: rotate(2deg);
		padding: 1.5rem;
	}

	.hero-card p {
		margin: 0;
		color: var(--muted);
		line-height: 1.6;
	}

	.hero-card a {
		color: var(--primary);
		font-weight: 700;
		text-decoration: none;
	}

	.hero-icon {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border-radius: 1rem;
		background: #dbeafe;
		color: var(--primary);
		font-size: 1.5rem;
		font-weight: 800;
	}

	h2 {
		margin: 0;
		font-size: 1.5rem;
	}

	.grid p {
		margin-bottom: 0;
	}

	@media (max-width: 720px) {
		.hero {
			grid-template-columns: 1fr;
			min-height: 0;
			padding: 1rem 0 3rem;
		}

		.hero-card {
			transform: none;
		}
	}
</style>
