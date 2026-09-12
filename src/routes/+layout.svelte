<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import "../app.css";
  import OfflineStatus from "$lib/components/OfflineStatus.svelte";
  import HeartIndicator from "$lib/components/HeartIndicator.svelte";
  import {
    applyThemeToDocument,
    emitThemeChange,
    readThemeChoice,
    resolveTheme,
    setThemePreference,
    subscribeThemeChanges,
    type Theme,
    type ThemeChoice,
  } from "$lib/application/theme";

  const buildCommit = import.meta.env.PUBLIC_BUILD_COMMIT;
  const buildCommitShort = buildCommit?.slice(0, 7);
  const buildCommitUrl = buildCommit
    ? `https://github.com/highlow12/cs-duolingo/commit/${buildCommit}`
    : null;

  let { children } = $props();
  let currentPath = $derived(page.url.pathname);
  let theme = $state<Theme>("light");
  let themeChoice = $state<ThemeChoice>("system");

  const navItems = [
    { href: `${base}/learn`, label: "학습" },
    { href: `${base}/review`, label: "복습" },
    { href: `${base}/progress`, label: "진행도" },
    { href: `${base}/settings`, label: "설정" },
  ] as const;

  function isActive(href: string) {
    return currentPath === href || currentPath.startsWith(`${href}/`);
  }

  function toggleTheme() {
    theme = setThemePreference(theme === "dark" ? "light" : "dark");
  }

  onMount(() => {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      // System theme still works when storage is blocked.
    }
    themeChoice = readThemeChoice(storage);
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const prefersDark = media?.matches === true;
    const rootTheme = document.documentElement.dataset.theme;
    theme =
      rootTheme === "dark" || rootTheme === "light"
        ? rootTheme
        : resolveTheme(themeChoice, prefersDark);
    applyThemeToDocument(theme);

    const unsubscribe = subscribeThemeChanges((change) => {
      themeChoice = change.choice;
      theme = change.theme;
    });

    const onSystemThemeChange = () => {
      if (themeChoice !== "system") return;
      const next = resolveTheme("system", media?.matches === true);
      applyThemeToDocument(next);
      emitThemeChange({ choice: "system", theme: next });
    };
    if (media?.addEventListener) media.addEventListener("change", onSystemThemeChange);
    // Safari versions that predate MediaQueryList.addEventListener.
    else media?.addListener?.(onSystemThemeChange);

    return () => {
      unsubscribe();
      if (media?.removeEventListener) media.removeEventListener("change", onSystemThemeChange);
      else media?.removeListener?.(onSystemThemeChange);
    };
  });
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
          <span class="nav-glyph" aria-hidden="true">{item.label === "학습" ? "[]" : item.label === "복습" ? "↻" : item.label === "진행도" ? "▥" : "⚙"}</span>
          {item.label}
        </a>
      {/each}
    </nav>
    <button
      class="theme-toggle"
      type="button"
      aria-label={theme === "dark" ? "라이트 테마로 전환" : "다크 테마로 전환"}
      title={theme === "dark" ? "라이트 테마" : "다크 테마"}
      onclick={toggleTheme}
    >
      <span class="theme-toggle-icon" aria-hidden="true">{theme === "dark" ? "☼" : "◐"}</span>
    </button>
    <HeartIndicator />
  </div>
</header>

<main id="main-content" class="shell page-content" tabindex="-1">
  {@render children()}
</main>

<footer class="site-footer">
  <div class="shell footer-inner">
    <span>CS 듀오링고</span>
    <div class="footer-meta">
      {#if buildCommitUrl}
        <a class="build-commit" href={buildCommitUrl}>배포 기준 {buildCommitShort}</a>
      {:else}
        <span class="build-commit">로컬 빌드</span>
      {/if}
      <OfflineStatus />
    </div>
  </div>
</footer>

<style>
  .nav-glyph {
    display: none;
    margin-right: 0.3rem;
    color: var(--primary);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
  }

  @media (max-width: 640px) {
    .nav-glyph {
      display: inline;
      margin: 0;
    }

    :global(.heart-indicator) {
      grid-area: heart;
      justify-self: end;
    }
  }

  .footer-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.7rem;
  }

  .build-commit {
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8rem;
  }

  a.build-commit:hover,
  a.build-commit:focus-visible {
    color: var(--primary);
  }
</style>
