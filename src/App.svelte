<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import TopBar from "./components/TopBar.svelte";
  import Hero from "./components/Hero.svelte";
  import SearchInputs from "./components/SearchInputs.svelte";
  import FormulaSpaceTable from "./components/FormulaSpaceTable.svelte";
  import MessageBanner from "./components/MessageBanner.svelte";
  import ResultsTable from "./components/ResultsTable.svelte";
  import ExamplesPanel from "./components/ExamplesPanel.svelte";
  import { downloadHitsCsv } from "./core/csv";
  import { buildMassIndex, loadMassPayload } from "./core/massData";
  import {
    chooseUnusedIsotope,
    createInitialRows,
    enforceUniqueIsotopes,
    firstAvailableElement,
    makeRow,
    validateAndBuildElements,
  } from "./core/searchSpace";
  import type { AppStatus, FindFormulaRequest, FormulaHit, FormulaSpaceRow, MassIndex, SearchFormState, ThemeName } from "./core/types";
  import type { WorkerResponse } from "./workers/workerProtocol";
  import { findFormulas } from "./core/search";

  let theme: ThemeName = "dark";
  let massIndex: MassIndex | null = null;
  let rows: FormulaSpaceRow[] = [];
  let nextRowId = 0;
  let results: FormulaHit[] = [];
  let form: SearchFormState = {
    mz: "180.06338810418",
    charge: "+1",
    toleranceMode: "ppm",
    tolerancePpm: "5",
    toleranceDa: "",
    maxResults: 100,
  };
  let status: AppStatus = "loading";
  let message = "Loading mass database...";
  let hasSearched = false;
  let worker: Worker | null = null;
  let activeRequestId: string | null = null;
  let colorSchemeMediaQuery: MediaQueryList | null = null;

  $: isBusy = status === "loading" || status === "running";

  function applyTheme(nextTheme: ThemeName): void {
    theme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
  }

  function handleThemeMediaChange(): void {
    applyTheme(getSystemTheme());
  }

  function toggleTheme(): void {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  function getSystemTheme(): ThemeName {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function syncThemeWithSystem(): void {
    applyTheme(getSystemTheme());
  }

  function updateForm(patch: Partial<SearchFormState>): void {
    form = { ...form, ...patch };
  }

  function updateRow(rowId: number, patch: Partial<FormulaSpaceRow>): void {
    if (!massIndex) return;
    const previous = rows.find((row) => row.id === rowId);
    if (!previous) return;

    let nextRows = rows.map((row) => (row.id === rowId ? { ...row, ...patch } : { ...row }));
    const updated = nextRows.find((row) => row.id === rowId);
    if (!updated) return;

    if (patch.element !== undefined && patch.element !== previous.element) {
      updated.isotope = chooseUnusedIsotope(nextRows, massIndex, updated.element, rowId);
      nextRows = enforceUniqueIsotopes(nextRows, massIndex, rowId);
    } else if (patch.isotope !== undefined && patch.isotope !== previous.isotope) {
      nextRows = enforceUniqueIsotopes(nextRows, massIndex, rowId, previous.isotope);
    }
    rows = nextRows;
  }

  function addRow(): void {
    if (!massIndex) return;
    const element = firstAvailableElement(rows, massIndex);
    rows = [...rows, makeRow(nextRowId, massIndex, rows, element, 0, 10)];
    nextRowId += 1;
  }

  function removeRow(rowId: number): void {
    if (rows.length <= 1) return;
    rows = rows.filter((row) => row.id !== rowId);
  }

  function selectedTolerance(): { tolerancePpm: string | null; toleranceDa: string | null } {
    const ppmText = form.tolerancePpm.trim();
    const daText = form.toleranceDa.trim();
    const tolerancePpm = (form.toleranceMode === "ppm" || form.toleranceMode === "both") && ppmText ? ppmText : null;
    const toleranceDa = (form.toleranceMode === "Da" || form.toleranceMode === "both") && daText ? daText : null;
    if (tolerancePpm === null && toleranceDa === null) {
      throw new Error("Provide a ppm tolerance, a Da tolerance, or both.");
    }
    return { tolerancePpm, toleranceDa };
  }

  function buildRequest(): FindFormulaRequest {
    if (!massIndex) throw new Error("Mass database is not loaded yet.");
    const maxResults = Number(form.maxResults);
    if (!Number.isInteger(maxResults) || maxResults < 1) throw new Error("Max results must be a positive integer.");
    const elements = validateAndBuildElements(rows, massIndex);
    const { tolerancePpm, toleranceDa } = selectedTolerance();
    return {
      mz: form.mz,
      elements,
      charge: form.charge,
      tolerancePpm,
      toleranceDa,
      maxResults,
      massIndex,
    };
  }

  function handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const response = event.data;
    if (response.requestId !== activeRequestId) return;
    if (response.type === "result") {
      results = response.hits;
      hasSearched = true;
      status = "success";
      message = `Found ${response.hits.length} candidate formula(s).`;
      return;
    }
    status = "error";
    message = response.message;
  }

  function runSearch(): void {
    try {
      const request = buildRequest();
      const requestId = crypto.randomUUID();
      activeRequestId = requestId;
      status = "running";
      message = "Searching candidate formulas...";

      if (worker) {
        worker.postMessage({ type: "search", requestId, payload: request });
        return;
      }

      // Fallback for unusual environments where Web Worker construction fails.
      const hits = findFormulas(request);
      results = hits;
      hasSearched = true;
      status = "success";
      message = `Found ${hits.length} candidate formula(s).`;
    } catch (error) {
      console.error(error);
      status = "error";
      message = error instanceof Error ? error.message : String(error);
    }
  }

  function downloadCsv(): void {
    if (results.length) downloadHitsCsv(results);
  }

  onMount(async () => {
    syncThemeWithSystem();

    colorSchemeMediaQuery = window.matchMedia("(prefers-color-scheme: light)");

    if (typeof colorSchemeMediaQuery.addEventListener === "function") {
      colorSchemeMediaQuery.addEventListener("change", handleThemeMediaChange);
    } else {
      // Safari and older browsers.
      colorSchemeMediaQuery.addListener(handleThemeMediaChange);
    }

    try {
      worker = new Worker(new URL("./workers/formulaSearch.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = handleWorkerMessage;
    } catch (error) {
      console.warn("Formula search worker could not be created; falling back to main-thread search.", error);
      worker = null;
    }

    try {
      const { payload, url } = await loadMassPayload();
      massIndex = buildMassIndex(payload);
      const initial = createInitialRows(massIndex);
      rows = initial.rows;
      nextRowId = initial.nextRowId;
      status = "idle";
      message = `Loaded mass database from ${url}.`;
    } catch (error) {
      console.error(error);
      status = "error";
      message = error instanceof Error ? error.message : String(error);
    }
  });

  onDestroy(() => {
    worker?.terminate();
    if (colorSchemeMediaQuery) {
      if (typeof colorSchemeMediaQuery.removeEventListener === "function") {
        colorSchemeMediaQuery.removeEventListener("change", handleThemeMediaChange);
      } else {
        colorSchemeMediaQuery.removeListener(handleThemeMediaChange);
      }
    }
  });
</script>

<main class="page-shell">
  <TopBar {theme} onToggleTheme={toggleTheme} />
  <Hero {theme} />

  <!-- <MessageBanner {status} {message} /> -->

  <SearchInputs {form} disabled={isBusy} onChange={updateForm} />

  {#if massIndex}
    <FormulaSpaceTable
      {rows}
      {massIndex}
      disabled={isBusy}
      onAddRow={addRow}
      onRemoveRow={removeRow}
      onUpdateRow={updateRow}
    />
  {/if}

  <section class="my-4 flex flex-wrap gap-3">
    <button type="button" class="primary-action" disabled={isBusy || !massIndex} on:click={runSearch}>Find candidate formulas</button>
    <button id="downloadCsv" type="button" class="secondary-action" disabled={isBusy || results.length === 0} on:click={downloadCsv}>Download CSV</button>
  </section>

  {#if hasSearched}
    <ResultsTable {results} />
  {/if}

  <ExamplesPanel />

  <footer class="pt-5.5 text-center text-[0.92rem] text-muted">
    © 2026 The Regents of the United Colleges, Lastoria Royal College of Science
  </footer>
</main>
