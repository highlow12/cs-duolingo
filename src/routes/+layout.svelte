<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import "../app.css";
  import OfflineStatus from "$lib/components/OfflineStatus.svelte";
  import HeartIndicator from "$lib/components/HeartIndicator.svelte";

  let { children } = $props();
  let currentPath = $derived(page.url.pathname);

  const navItems = [
    { href: `${base}/learn`, label: "학습" },
    { href: `${base}/review`, label: "복습" },
    { href: `${base}/progress`, label: "진행도" },
    { href: `${base}/settings`, label: "설정" },
  ] as const;

  function isActive(href: string) {
    return currentPath === href || currentPath.startsWith(`${href}/`);
  }
</script>

<a class="skip-link" href="#main-content">본문으로 건너뛰기</a>

<header class="site-header">
  <div class="shell header-inner">
    <a class="brand" href={`${base}/`} aria-label="CS 듀오링고 홈">
      <span class="brand-mark" aria-hidden="true">λ</span>
      <span>CS 듀오링고</span>
    </a>
    <nav class="primary-nav" aria-label="주요 메뉴">
      {#each navItems as item}
        <a
          class:active={isActive(item.href)}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          {item.label}
        </a>
      {/each}
    </nav>
    <HeartIndicator />
  </div>
</header>

<main id="main-content" class="shell page-content" tabindex="-1">
  {@render children()}
</main>

<footer class="site-footer">
  <div class="shell footer-inner">
    <span>CS 듀오링고</span>
    <OfflineStatus />
  </div>
</footer>

<style>
  @media (max-width: 640px) {
    .header-inner {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "brand heart"
        "nav nav";
      align-items: center;
    }

    .brand {
      grid-area: brand;
    }

    .primary-nav {
      grid-area: nav;
    }

    :global(.heart-indicator) {
      grid-area: heart;
      justify-self: end;
    }
  }
</style>
