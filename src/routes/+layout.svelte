<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="site-header">
	<div class="shell header-inner">
		<a class="brand" href="/">CS 듀오링고</a>
		<nav aria-label="주요 메뉴">
			<a href="/learn">학습</a>
			<a href="/review">복습</a>
			<a href="/progress">진행도</a>
			<a href="/settings">설정</a>
		</nav>
	</div>
</header>

<main class="shell page-content">{@render children()}</main>
