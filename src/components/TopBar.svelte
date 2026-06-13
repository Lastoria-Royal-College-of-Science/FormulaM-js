<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { ThemeName } from "../core/types";

  export let theme: ThemeName = "dark";
  export let onToggleTheme: () => void;

  const brandMarkSrc = `${import.meta.env.BASE_URL}favicon.svg`;

  let isScrolled = false;

  $: isDark = theme === "dark";

  function syncScrolledState(): void {
    const nextScrolled = window.scrollY > 8;
    if (nextScrolled !== isScrolled) isScrolled = nextScrolled;
  }

  onMount(() => {
    syncScrolledState();
    window.addEventListener("scroll", syncScrolledState, { passive: true });
  });

  onDestroy(() => {
    window.removeEventListener("scroll", syncScrolledState);
  });
</script>

<header class="topbar-shell" class:topbar-shell-scrolled={isScrolled}>
  <div class="topbar-frame">
    <a class="topbar-brand" href="#top">
      <img class="topbar-brand-mark" src={brandMarkSrc} alt="" aria-hidden="true" />
      <span class="topbar-brand-copy">FormulaM</span>
    </a>

    <nav class="topbar-actions" aria-label="Page controls">
      <a class="round-control no-underline font-[650]" href="https://github.com/Lastoria-Royal-College-of-Science/FormulaM" target="_blank" rel="noopener noreferrer" aria-label="Open FormulaM on GitHub">
        <span class="i-mdi-github h-5 w-5" aria-hidden="true"></span>
      </a>
      <button type="button" class="round-control cursor-pointer" aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={isDark} on:click={onToggleTheme}>
        {#if isDark}
          <span class="i-mdi-weather-night h-[18px] w-[18px]" aria-hidden="true"></span>
        {:else}
          <span class="i-mdi-white-balance-sunny h-[18px] w-[18px]" aria-hidden="true"></span>
        {/if}
      </button>
    </nav>
  </div>
</header>
