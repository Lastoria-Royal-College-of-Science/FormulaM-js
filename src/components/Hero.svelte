<script lang="ts">
  import type { ThemeName } from "../core/types";

  export let theme: ThemeName = "dark";
  const logoSrc = `${import.meta.env.BASE_URL}logo.svg`;
</script>

<header class="mb-6 text-center">
  <img 
    class="max-h-[140px] w-[min(560px,88vw)] object-contain {theme === 'dark' ? 'filter invert hue-rotate-180' : ''}" 
    src={logoSrc} 
    alt="FormulaM" 
  />
  <p class="mx-auto mt-3 max-w-[760px] text-muted leading-6">Enumerate candidate formulas from observed m/z, explicit charge, tolerance, element bounds, and isotope restrictions.</p>
</header>
