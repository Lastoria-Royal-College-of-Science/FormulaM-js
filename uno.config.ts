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
    "ui-card": "my-4.5 rounded-2 border border-solid border-border bg-surface p-5.5 shadow-app lt-md:p-4",
    "round-control": `inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-solid border-control-border bg-control-bg p-0 text-text shadow-app ${buttonInteraction}`,
    "field-title": "mb-1.5 block font-[650]",
    "field-hint": "mt-1.25 block text-muted",
    "field-control": `w-full min-h-[42px] rounded-[10px] border border-solid border-control-border bg-control-bg px-3 py-2.5 text-text ${fieldInteraction} ${disabledState}`,
    "help-button": `ml-1.25 inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border border-solid border-control-border bg-surface-2 p-0 text-xs text-muted ${buttonInteraction}`,
    "primary-action": `min-h-[42px] cursor-pointer rounded-2 border border-solid border-transparent bg-accent px-4 py-2.5 font-[750] text-accent-contrast ${blueButtonInteraction} ${disabledState}`,
    "secondary-action": `min-h-[42px] cursor-pointer rounded-2 border border-solid border-control-border bg-surface-2 px-4 py-2.5 text-text ${buttonInteraction} ${disabledState}`,
    "icon-action": `inline-flex h-[42px] min-h-[42px] w-11 items-center justify-center cursor-pointer rounded-2 border border-solid border-transparent bg-accent p-0 text-accent-contrast ${blueButtonInteraction} ${disabledState}`,
    "danger-icon-action": `inline-flex h-10 w-10 items-center justify-center cursor-pointer rounded-[10px] border border-solid border-control-border bg-surface-2 p-0 text-danger ${buttonInteraction} ${disabledState}`,
    "table-head": "px-2 py-2 text-left text-[0.9rem] text-muted",
    "table-cell": "border-t border-border [border-top-style:solid] px-2 py-2 align-middle",
    "formula-table-head": "border-b border-border [border-bottom-style:solid] px-2 py-2 text-left text-[0.9rem] text-muted",
    "formula-table-cell": "px-2 py-2 align-middle",
    "inline-code": "rounded-1.5 border border-solid border-border bg-surface-2 px-1.25 py-px",
  },
});
