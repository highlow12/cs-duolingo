<script lang="ts">
	import { page } from '$app/state';
	import '../app.css';

	let { children } = $props();
	let currentPath = $derived(page.url.pathname);

	const navItems = [
		{ href: '/learn', label: '학습' },
		{ href: '/review', label: '복습' },
		{ href: '/progress', label: '진행도' },
		{ href: '/settings', label: '설정' }
	] as const;

	function isActive(href: string) {
		return currentPath === href || currentPath.startsWith(`${href}/`);
	}
</script>

<a class="skip-link" href="#main-content">본문으로 건너뛰기</a>

<header class="site-header">
	<div class="shell header-inner">
		<a class="brand" href="/" aria-label="CS 듀오링고 홈">
			<span class="brand-mark" aria-hidden="true">λ</span>
			<span>CS 듀오링고</span>
		</a>
		<nav class="primary-nav" aria-label="주요 메뉴">
			{#each navItems as item}
				<a
					class:active={isActive(item.href)}
					href={item.href}
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</div>
</header>

<main id="main-content" class="shell page-content" tabindex="-1">{@render children()}</main>

<footer class="site-footer">
	<div class="shell footer-inner">
		<span>CS 듀오링고</span>
		<span class="offline-label"><span aria-hidden="true">●</span> 기기에서 바로 학습</span>
	</div>
</footer>
