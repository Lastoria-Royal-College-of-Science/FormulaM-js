# AGENTS.md

## Scope

This file applies to the whole repository.

FormulaM is a front-end-only molecular formula search tool intended for GitHub Pages. Keep the application static: do not add a required server, database, hosted API, or runtime secret dependency.

The current refactor target is Vite + TypeScript + Svelte. If the branch still contains the older vanilla HTML/CSS/JavaScript app, preserve behavior while migrating in small, verifiable steps.

## Commands

Use the package manager already present in the branch. For the Vite/Svelte refactor, use:

```bash
npm install
npm run dev
npm run validate:data
npm test
npm run check
npm run build
```

Before marking a change complete, run the narrowest relevant check first. For changes that touch shared TypeScript, search logic, mass data, or UI behavior, run the full validation sequence above. If a script is not present in the current branch, state that explicitly in the final note instead of inventing a substitute.

## Architecture rules

- Keep scientific logic framework-independent under `src/core/`.
- Keep formula enumeration out of Svelte components; UI code should call typed core functions or a Web Worker.
- Keep long-running searches in a Web Worker when using the Vite/Svelte implementation.
- Treat `public/data/masses.json` or `data/masses.json` as scientific input data. Do not replace, regenerate, or reformat it unless the task explicitly asks for a data update.
- Keep GitHub Pages compatibility. Vite project-site builds should use `base: "/FormulaM/"`.

## Testing expectations

Add or update tests when changing:

- charge parsing or display
- ppm/Da tolerance handling
- isotope labels or formula formatting
- result sorting, filtering, CSV output, or error messages
- mass-data loading or validation

Prefer small regression tests for the changed behavior. Do not weaken assertions to make tests pass.

## Style

- Use TypeScript for new application and core code.
- Keep Svelte components focused on rendering, input state, and user interaction.
- Prefer explicit error messages over silent fallback behavior for scientific inputs.
- If UnoCSS is introduced, use it for UI shortcuts and layout utilities only; do not let styling changes affect `src/core/` or worker behavior.

## Do not

- When adding new dependencies, do not manually edit `package.json` and then run `npm install`. Always add dependencies using `npm install <package>` (or `npm install --save-dev <package>` for dev dependencies) so that the lockfile (for example, `package-lock.json`) is updated by the package manager and to avoid manual synchronization errors.

- Do not commit secrets, tokens, credentials, or private keys.
- Do not add telemetry or upload user-entered masses/formula ranges without an explicit task.
- Do not change formula-search semantics without updating tests and documenting the behavior change.
- Do not hide calculation or data-loading failures by catching and ignoring exceptions.
- Do not introduce large runtime dependencies without explaining why they are necessary for this static app.
