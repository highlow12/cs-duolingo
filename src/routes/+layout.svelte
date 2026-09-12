<script lang="ts">
  import "../app.css";
  import AppHeader from "$lib/components/AppHeader.svelte";
  import OfflineStatus from "$lib/components/OfflineStatus.svelte";

  let { children } = $props();
</script>

<a class="skip-link" href="#main-content">본문으로 건너뛰기</a>

<AppHeader />

<main id="main-content" class="shell page-content" tabindex="-1">
  {@render children()}
</main>

<footer class="site-footer">
  <div class="shell footer-inner">
    <span>CS 듀오링고</span>
    <OfflineStatus />
  </div>
</footer>
