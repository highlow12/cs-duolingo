<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import HeartIndicator from "$lib/components/HeartIndicator.svelte";
  import { isNavItemActive } from "$lib/components/app-header";

  let currentPath = $derived(page.url.pathname);

  const navItems = [
    { href: `${base}/learn`, label: "학습" },
    { href: `${base}/review`, label: "복습" },
    { href: `${base}/progress`, label: "진행도" },
    { href: `${base}/settings`, label: "설정" },
  ] as const;
</script>

<header class="site-header">
  <div class="shell header-inner">
    <a class="brand" href={`${base}/`} aria-label="CS 듀오링고 홈">
      <span class="brand-mark" aria-hidden="true">λ</span>
      <span>CS 듀오링고</span>
    </a>

    <nav class="primary-nav" aria-label="주요 메뉴">
      {#each navItems as item}
        {@const active = isNavItemActive(currentPath, item.href)}
        <!-- prettier-ignore -->
        <a
          class:active={active}
          href={item.href}
          aria-current={active ? "page" : undefined}
        >
          {item.label}
        </a>
      {/each}
    </nav>

    <div class="heart-slot">
      <HeartIndicator />
    </div>
  </div>
</header>

<style>
  .site-header {
    position: sticky;
    top: 0;
    z-index: 10;
    border-bottom: 1px solid var(--border);
    background: rgb(255 255 255 / 90%);
    backdrop-filter: blur(12px);
  }

  .header-inner {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    min-height: 68px;
    gap: 1rem;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    gap: 0.55rem;
    color: inherit;
    font-weight: 800;
    text-decoration: none;
    letter-spacing: -0.03em;
    white-space: nowrap;
  }

  .brand-mark {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.65rem;
    background: var(--primary);
    color: white;
    font-size: 1.1rem;
    font-weight: 900;
  }

  .primary-nav {
    display: flex;
    min-width: 0;
    justify-content: center;
    gap: 0.35rem;
    color: var(--muted);
    font-size: 0.95rem;
  }

  .heart-slot {
    display: flex;
    min-width: 0;
    justify-content: flex-end;
  }

  .primary-nav a {
    display: inline-flex;
    align-items: center;
    min-height: 2.25rem;
    border-radius: 0.6rem;
    padding: 0.35rem 0.7rem;
    text-decoration: none;
    white-space: nowrap;
  }

  .primary-nav a:hover,
  .primary-nav a:focus-visible,
  .primary-nav a.active {
    background: var(--primary-soft);
    color: var(--primary);
  }

  @media (max-width: 640px) {
    .header-inner {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "brand heart"
        "nav nav";
      gap: 0.55rem 0.75rem;
      min-height: 0;
      padding: 0.75rem 0;
    }

    .brand {
      grid-area: brand;
    }

    .primary-nav {
      display: grid;
      grid-area: nav;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      width: 100%;
      gap: 0.2rem;
      font-size: 0.9rem;
    }

    .primary-nav a {
      min-width: 0;
      min-height: 2.75rem;
      justify-content: center;
      padding-inline: 0.2rem;
    }

    .heart-slot {
      grid-area: heart;
      justify-self: end;
    }
  }
</style>
