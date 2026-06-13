import { defineConfig, presetIcons, presetUno } from "unocss";

const noNativeOutline = "[outline:none] focus:[outline:none] focus-visible:[outline:none] active:[outline:none]";
const interactiveBorder = `hover:border-accent active:border-accent focus:border-accent focus-visible:border-accent ${noNativeOutline}`;
const blueButtonBorder = `hover:border-control-border active:border-accent focus-visible:border-accent ${noNativeOutline}`;
const disabledState = "disabled:cursor-not-allowed disabled:opacity-55";
const buttonInteraction = `${interactiveBorder} active:shadow-control-glow focus-visible:shadow-control-glow`;
const blueButtonInteraction = `${blueButtonBorder} active:shadow-control-glow focus-visible:shadow-control-glow`;
const fieldInteraction = `${interactiveBorder} focus:shadow-control-glow focus-visible:shadow-control-glow`;

export default defineConfig({
  presets: [presetUno(), presetIcons()],
  safelist: ["topbar-shell-scrolled"],
  theme: {
    colors: {
      bg: "var(--bg)",
      surface: "var(--surface)",
      "surface-2": "var(--surface-2)",
      "control-bg": "var(--control-bg)",
      text: "var(--text)",
      muted: "var(--muted)",
      border: "var(--border)",
      "control-border": "var(--control-border)",
      accent: "var(--accent)",
      "accent-contrast": "var(--accent-contrast)",
      danger: "var(--danger)",
      success: "var(--success)",
      info: "var(--info)",
      focus: "var(--focus-ring)",
      row: "var(--row-odd)",
    },
    boxShadow: {
      app: "var(--shadow)",
      "control-glow": "var(--control-glow)",
    },
  },
  shortcuts: {
    "page-shell": "mx-auto w-full max-w-[1180px] px-4 py-6 pb-7 lt-md:px-2.5 lt-md:pt-3.5",
    "topbar-shell": "relative sticky top-0 z-40 w-full bg-transparent before:pointer-events-none before:absolute before:bottom-0 before:left-[-2rem] before:right-[-2rem] before:top-[-1.5rem] before:bg-[color:color-mix(in_srgb,var(--surface),transparent_28%)] before:opacity-0 before:transition-opacity before:duration-200 before:ease-out before:backdrop-blur-xl before:backdrop-saturate-150 before:content-[''] after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-[color:color-mix(in_srgb,var(--border),transparent_14%)] after:opacity-0 after:transition-opacity after:duration-200 after:ease-out after:content-['']",
    "topbar-shell-scrolled": "before:opacity-100 after:opacity-100",
    "topbar-frame": "relative z-10 mx-auto flex h-[72px] w-full max-w-[1180px] items-center justify-between gap-4 px-4 lt-md:h-[66px] lt-md:gap-[13px] lt-md:px-[13px]",
    "topbar-brand": "inline-flex h-10 items-center gap-[6px] no-underline text-text transition-colors duration-200 hover:text-accent",
    "topbar-brand-mark": "h-10 w-10 shrink-0 object-contain",
    "topbar-brand-copy": "text-[1.125rem] leading-none font-bold tracking-[0.02em] lt-sm:text-[1rem]",
    "topbar-actions": "flex shrink-0 items-center gap-4 lt-md:gap-[13px]",
    "ui-card": "my-4.5 rounded-2 border border-solid border-border bg-surface p-5.5 shadow-app lt-md:p-4",
    "round-control": `inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-solid border-control-border bg-control-bg p-0 text-text shadow-app ${buttonInteraction}`,
    "field-title": "mb-1.5 block font-[650]",
    "field-hint": "mt-1.25 block text-muted",
    "field-control": `w-full min-h-[42px] rounded-[10px] border border-solid border-control-border bg-control-bg px-3 py-2.5 text-text ${fieldInteraction} ${disabledState}`,
    "field-select": "bg-no-repeat bg-[length:6px_6px] [background-image:linear-gradient(45deg,transparent_50%,var(--muted)_50%),linear-gradient(135deg,var(--muted)_50%,transparent_50%)] [background-position:calc(100%-18px)_50%,calc(100%-12px)_50%] pr-10",
    "help-button": `ml-1.25 inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border border-solid border-control-border bg-surface-2 p-0 text-xs text-muted ${buttonInteraction}`,
    "primary-action": `min-h-[42px] cursor-pointer rounded-2 border border-solid border-transparent bg-accent px-4 py-2.5 font-[750] text-accent-contrast ${blueButtonInteraction} ${disabledState}`,
    "secondary-action": `min-h-[42px] cursor-pointer rounded-2 border border-solid border-control-border bg-surface-2 px-4 py-2.5 text-text ${buttonInteraction} ${disabledState}`,
    "icon-action": `inline-flex h-[42px] min-h-[42px] w-11 items-center justify-center cursor-pointer rounded-2 border border-solid border-transparent bg-accent p-0 text-accent-contrast ${blueButtonInteraction} ${disabledState}`,
    "danger-icon-action": `inline-flex h-10 w-10 items-center justify-center cursor-pointer rounded-[10px] border border-solid border-control-border bg-surface-2 p-0 text-danger ${buttonInteraction} ${disabledState}`,
    "toggle-control": "inline-flex cursor-pointer select-none items-center gap-3.5 text-text",
    "toggle-control-disabled": "cursor-not-allowed opacity-70",
    "toggle-input": "sr-only",
    "toggle-track": "relative h-7 w-12 shrink-0 rounded-full border border-solid border-[var(--toggle-track-border)] bg-[var(--toggle-track-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-all duration-200 ease-out peer-checked:border-[var(--toggle-track-active-border)] peer-checked:bg-[var(--toggle-track-active)] peer-focus-visible:shadow-control-glow after:absolute after:left-[3px] after:top-1/2 after:h-5 after:w-5 after:-translate-y-1/2 after:rounded-full after:border after:border-solid after:border-[var(--toggle-thumb-border)] after:bg-[var(--toggle-thumb-bg)] after:shadow-[0_2px_8px_rgba(15,23,42,0.28)] after:transition-all after:duration-200 after:ease-out after:content-[''] peer-checked:after:translate-x-5 peer-checked:after:border-[var(--toggle-thumb-active-border)] peer-checked:after:bg-[var(--toggle-thumb-active-bg)]",
    "toggle-copy": "text-[0.98rem] leading-[1.4]",
    "table-head": "px-2 py-2 text-left text-[0.9rem] text-muted",
    "table-cell": "border-t border-border [border-top-style:solid] px-2 py-2 align-middle",
    "formula-table-head": "border-b border-border [border-bottom-style:solid] px-2 py-2 text-left text-[0.9rem] text-muted",
    "formula-table-cell": "px-2 py-2 align-middle",
    "inline-code": "rounded-1.5 border border-solid border-border bg-surface-2 px-1.25 py-px",
  },
});
