<svelte:head><title>설정 | CS 듀오링고</title></svelte:head>

<section class="card settings">
	<p class="eyebrow">Settings</p>
	<h1>설정</h1>
	<p class="muted">MVP에서는 로컬 데이터와 콘텐츠 버전을 관리하는 기능부터 추가합니다.</p>
	<div class="setting-row">
		<div>
			<strong>저장 방식</strong>
			<p class="muted">IndexedDB · 기기 내 저장</p>
		</div>
		<span class="badge">준비 중</span>
	</div>
	<div class="setting-row">
		<div>
			<strong>백업</strong>
			<p class="muted">StudyEvent 기반 Export / Import</p>
		</div>
		<span class="badge">준비 중</span>
	</div>
</section>

<style>
	.settings {
		max-width: 760px;
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

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-top: 1px solid var(--border);
		padding: 1rem 0;
	}

	.setting-row p {
		margin: 0.25rem 0 0;
	}

	.badge {
		border-radius: 999px;
		background: #eef2ff;
		color: #4338ca;
		padding: 0.35rem 0.65rem;
		font-size: 0.8rem;
		font-weight: 700;
		white-space: nowrap;
	}
</style>
