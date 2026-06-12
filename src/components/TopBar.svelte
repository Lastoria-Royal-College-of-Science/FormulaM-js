<script lang="ts">
  import type { ThemeName } from "../core/types";

  export let theme: ThemeName = "dark";
  export let onToggleTheme: () => void;

  $: isDark = theme === "dark";
</script>

<header class="mb-5 flex items-center justify-end gap-2.5 lt-md:flex-wrap lt-md:justify-center" aria-label="Page controls">
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
</header>
