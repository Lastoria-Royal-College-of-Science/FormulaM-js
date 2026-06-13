<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import TopBar from "./components/TopBar.svelte";
  import Hero from "./components/Hero.svelte";
  import SearchInputs from "./components/SearchInputs.svelte";
  import FormulaSpaceTable from "./components/FormulaSpaceTable.svelte";
  import MessageBanner from "./components/MessageBanner.svelte";
  import ResultsTable from "./components/ResultsTable.svelte";
  import SpectrumImport from "./components/SpectrumImport.svelte";
  import SpectrumPlot from "./components/SpectrumPlot.svelte";
  import PlotSettingsPanel from "./components/PlotSettingsPanel.svelte";
  import PeakInspector from "./components/PeakInspector.svelte";
  import ExportPanel from "./components/ExportPanel.svelte";
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
  import { getAssignment, attachAssignmentsToPeaks, buildPeakAssignment, removeAssignment, upsertAssignment } from "./core/assignments";
  import { downloadAnnotatedSpectrumPng, downloadAssignmentsCsv } from "./core/exportSpectrum";
  import { createPlotSettings, DEFAULT_PLOT_SETTINGS } from "./core/plotTicks";
  import { findFormulas } from "./core/search";
  import { loadSpectrumImportSource } from "./core/spectrumImport";
  import { buildSpectrumPreview, normalizeSpectrumTable, suggestSpectrumSelection } from "./core/spectrumNormalize";
  import type {
    AppStatus,
    FindFormulaRequest,
    FormulaHit,
    FormulaSpaceRow,
    MassIndex,
    PeakAssignment,
    PlotSettings,
    SearchFormState,
    SpectrumImportSheet,
    SpectrumImportSource,
    SpectrumPeak,
    SpectrumPreviewTable,
    ThemeName,
  } from "./core/types";
  import type { WorkerResponse } from "./workers/workerProtocol";

  let theme: ThemeName = "dark";
  let massIndex: MassIndex | null = null;
  let rows: FormulaSpaceRow[] = [];
  let nextRowId = 0;
  let results: FormulaHit[] = [];
  let form: SearchFormState = {
    mz: "180.062839518",
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

  let rawSpectrumPeaks: SpectrumPeak[] = [];
  let spectrumPeaks: SpectrumPeak[] = [];
  let spectrumAssignments: PeakAssignment[] = [];
  let selectedPeakId: string | null = null;
  let selectedPeak: SpectrumPeak | null = null;
  let selectedAssignment: PeakAssignment | null = null;
  let spectrumImportSource: SpectrumImportSource | null = null;
  let currentSpectrumImportSheet: SpectrumImportSheet | null = null;
  let spectrumPreview: SpectrumPreviewTable | null = null;
  let spectrumFileName = "";
  let spectrumMzColumn = "";
  let spectrumIntensityColumn = "";
  let spectrumActiveSheetName = "";
  let spectrumHasHeaderRow = true;
  let spectrumMzColumnIndex: number | null = null;
  let spectrumIntensityColumnIndex: number | null = null;
  let spectrumImportError = "";
  let includeUnassignedInAssignmentCsv = false;
  let plotSettings: PlotSettings = { ...DEFAULT_PLOT_SETTINGS };

  $: isBusy = status === "loading" || status === "running";
  $: spectrumPeaks = attachAssignmentsToPeaks(rawSpectrumPeaks, spectrumAssignments, selectedPeakId);
  $: selectedPeak = spectrumPeaks.find((peak) => peak.id === selectedPeakId) ?? null;
  $: selectedAssignment = getAssignment(spectrumAssignments, selectedPeakId);
  $: assignedCount = spectrumAssignments.length;
  $: selectedPeakLabel = selectedPeak ? selectedPeak.mz.toFixed(6) : "";
  $: canExportAssignmentCsv = rawSpectrumPeaks.length > 0 && (includeUnassignedInAssignmentCsv || assignedCount > 0);
  $: currentSpectrumImportSheet = spectrumImportSource?.sheets.find((sheet) => sheet.name === spectrumActiveSheetName) ?? spectrumImportSource?.sheets[0] ?? null;
  $: spectrumPreview = currentSpectrumImportSheet ? buildSpectrumPreview(currentSpectrumImportSheet.table, spectrumHasHeaderRow) : null;

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

  function updatePlotSettings(patch: Partial<PlotSettings>): void {
    plotSettings = { ...plotSettings, ...patch };
  }

  function clearImportedSpectrumData(): void {
    rawSpectrumPeaks = [];
    spectrumAssignments = [];
    selectedPeakId = null;
    spectrumMzColumn = "";
    spectrumIntensityColumn = "";
    includeUnassignedInAssignmentCsv = false;
    plotSettings = { ...DEFAULT_PLOT_SETTINGS };
    results = [];
    hasSearched = false;
  }

  function clearSpectrumImportState(): void {
    spectrumImportSource = null;
    spectrumFileName = "";
    spectrumActiveSheetName = "";
    spectrumHasHeaderRow = true;
    spectrumMzColumnIndex = null;
    spectrumIntensityColumnIndex = null;
    spectrumImportError = "";
    clearImportedSpectrumData();
  }

  function resetPlotView(): void {
    if (!rawSpectrumPeaks.length) {
      plotSettings = { ...DEFAULT_PLOT_SETTINGS };
      return;
    }

    const nextView = createPlotSettings(rawSpectrumPeaks);
    plotSettings = {
      ...plotSettings,
      xMin: nextView.xMin,
      xMax: nextView.xMax,
    };
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

  function importSourceLabel(sheetName: string): string {
    return spectrumImportSource && spectrumImportSource.sheets.length > 1 ? `${spectrumFileName} / ${sheetName}` : spectrumFileName;
  }

  function isSpectrumImportSheet(candidate: unknown): candidate is SpectrumImportSheet {
    return Boolean(
      candidate
      && typeof candidate === "object"
      && "name" in candidate
      && "table" in candidate
      && Array.isArray((candidate as SpectrumImportSheet).table),
    );
  }

  function applySpectrumImportResult(sourceName: string, sheet: SpectrumImportSheet): void {
    if (!sheet) {
      throw new Error("Spectrum import failed: no active worksheet is selected.");
    }

    const imported = normalizeSpectrumTable(sheet.table, {
      sourceName,
      hasHeaderRow: spectrumHasHeaderRow,
      mzColumnIndex: spectrumMzColumnIndex,
      intensityColumnIndex: spectrumIntensityColumnIndex,
    });

    rawSpectrumPeaks = imported.peaks;
    spectrumAssignments = [];
    selectedPeakId = null;
    spectrumMzColumn = imported.mzColumn;
    spectrumIntensityColumn = imported.intensityColumn;
    includeUnassignedInAssignmentCsv = false;
    plotSettings = createPlotSettings(imported.peaks);
    results = [];
    hasSearched = false;
  }

  function applySuggestedSpectrumSelection(sheet: SpectrumImportSheet): void {
    const suggestion = suggestSpectrumSelection(sheet.table, sheet.suggestedHasHeaderRow);
    spectrumActiveSheetName = sheet.name;
    spectrumHasHeaderRow = suggestion.hasHeaderRow;
    spectrumMzColumnIndex = suggestion.mzColumnIndex;
    spectrumIntensityColumnIndex = suggestion.intensityColumnIndex;
  }

  function handleApplySpectrumSelection(sheet: SpectrumImportSheet | Event | null = currentSpectrumImportSheet): void {
    const resolvedSheet = isSpectrumImportSheet(sheet) ? sheet : currentSpectrumImportSheet;
    if (!resolvedSheet) return;

    try {
      spectrumImportError = "";
      const label = importSourceLabel(resolvedSheet.name);
      applySpectrumImportResult(label, resolvedSheet);
      status = "success";
      message = `Imported ${rawSpectrumPeaks.length} peaks from ${label}. Adjust worksheet or column mapping if needed.`;
    } catch (error) {
      console.error(error);
      clearImportedSpectrumData();
      spectrumImportError = error instanceof Error ? error.message : String(error);
      status = "error";
      message = spectrumImportError;
    }
  }

  function handleSpectrumSheetSelect(sheetName: string): void {
    if (!spectrumImportSource) return;
    const sheet = spectrumImportSource.sheets.find((candidate) => candidate.name === sheetName);
    if (!sheet) return;
    applySuggestedSpectrumSelection(sheet);
    handleApplySpectrumSelection(sheet);
  }

  function handleSpectrumHasHeaderRowSelect(value: boolean): void {
    spectrumHasHeaderRow = value;
    if (!currentSpectrumImportSheet) return;

    const suggestion = suggestSpectrumSelection(currentSpectrumImportSheet.table, value);
    if (spectrumMzColumnIndex === null) spectrumMzColumnIndex = suggestion.mzColumnIndex;
    if (spectrumIntensityColumnIndex === null) spectrumIntensityColumnIndex = suggestion.intensityColumnIndex;
  }

  function handleSpectrumMzColumnSelect(index: number | null): void {
    spectrumMzColumnIndex = index;
  }

  function handleSpectrumIntensityColumnSelect(index: number | null): void {
    spectrumIntensityColumnIndex = index;
  }

  async function handleSpectrumImport(file: File | null): Promise<void> {
    if (!file) {
      clearSpectrumImportState();
      status = "idle";
      message = "Spectrum cleared. FormulaM single m/z search remains available.";
      return;
    }

    try {
      clearImportedSpectrumData();
      spectrumImportError = "";
      status = "running";
      message = `Loading preview for ${file.name}...`;

      spectrumImportSource = await loadSpectrumImportSource(file);
      spectrumFileName = file.name;

      const firstSheet = spectrumImportSource.sheets[0];
      if (!firstSheet) throw new Error(`Spectrum import failed: ${file.name} does not contain any readable tables.`);

      applySuggestedSpectrumSelection(firstSheet);
      handleApplySpectrumSelection(firstSheet);
    } catch (error) {
      console.error(error);
      clearSpectrumImportState();
      spectrumImportError = error instanceof Error ? error.message : String(error);
      status = "error";
      message = spectrumImportError;
    }
  }

  function handlePeakSelect(peak: SpectrumPeak): void {
    selectedPeakId = peak.id;
    updateForm({ mz: peak.mz.toFixed(6) });
    status = "idle";
    message = `Selected peak ${peak.mz.toFixed(6)}. Adjust charge/tolerance if needed, then run formula search.`;
  }

  function handleAssign(hit: FormulaHit): void {
    if (!selectedPeak) return;
    spectrumAssignments = upsertAssignment(spectrumAssignments, buildPeakAssignment(selectedPeak, hit));
    status = "success";
    message = `Assigned ${hit.formula} to peak ${selectedPeak.mz.toFixed(6)}.`;
  }

  function handleRemoveAssignment(peakId: string): void {
    const previous = getAssignment(spectrumAssignments, peakId);
    spectrumAssignments = removeAssignment(spectrumAssignments, peakId);
    if (previous) {
      status = "success";
      message = `Removed assignment ${previous.formula} from peak ${previous.mz.toFixed(6)}.`;
    }
  }

  function handleExportAssignments(): void {
    if (!canExportAssignmentCsv) return;
    downloadAssignmentsCsv(spectrumPeaks, includeUnassignedInAssignmentCsv);
    status = "success";
    message = "Downloaded spectrum assignment CSV.";
  }

  async function handleExportPng(): Promise<void> {
    if (!rawSpectrumPeaks.length) return;
    try {
      status = "running";
      message = "Exporting annotated spectrum PNG...";
      await downloadAnnotatedSpectrumPng(spectrumPeaks, plotSettings, theme);
      status = "success";
      message = "Downloaded annotated spectrum PNG.";
    } catch (error) {
      console.error(error);
      status = "error";
      message = error instanceof Error ? error.message : String(error);
    }
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

<div id="top" class="min-h-screen">
  <TopBar {theme} onToggleTheme={toggleTheme} />

  <main class="page-shell">
    <Hero />
    <MessageBanner {status} {message} />

    <SpectrumImport
      activeSheetName={spectrumActiveSheetName}
      disabled={isBusy}
      hasHeaderRow={spectrumHasHeaderRow}
      importSource={spectrumImportSource}
      intensityColumnIndex={spectrumIntensityColumnIndex}
      intensityColumnName={spectrumIntensityColumn}
      peakCount={rawSpectrumPeaks.length}
      previewTable={spectrumPreview}
      sourceName={spectrumFileName}
      mzColumnIndex={spectrumMzColumnIndex}
      mzColumnName={spectrumMzColumn}
      importError={spectrumImportError}
      onApplySelection={handleApplySpectrumSelection}
      onImportFile={handleSpectrumImport}
      onSelectHasHeaderRow={handleSpectrumHasHeaderRowSelect}
      onSelectIntensityColumn={handleSpectrumIntensityColumnSelect}
      onSelectMzColumn={handleSpectrumMzColumnSelect}
      onSelectSheet={handleSpectrumSheetSelect}
    />

    <SpectrumPlot
      peaks={spectrumPeaks}
      settings={plotSettings}
      {theme}
      {selectedPeakId}
      onSelectPeak={handlePeakSelect}
      onResetView={resetPlotView}
    />

    {#if rawSpectrumPeaks.length > 0}
      <PlotSettingsPanel settings={plotSettings} disabled={isBusy} onChange={updatePlotSettings} />
      <PeakInspector selectedPeak={selectedPeak} assignment={selectedAssignment} onRemoveAssignment={handleRemoveAssignment} />
    {/if}

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
      <button id="downloadCsv" type="button" class="secondary-action" disabled={isBusy || results.length === 0} on:click={downloadCsv}>Download formula hits CSV</button>
    </section>

    {#if hasSearched}
      <ResultsTable
        {results}
        selectedPeakLabel={selectedPeakLabel}
        selectedPeakHasAssignment={Boolean(selectedAssignment)}
        onAssign={rawSpectrumPeaks.length > 0 ? handleAssign : null}
      />
    {/if}

    {#if rawSpectrumPeaks.length > 0}
      <ExportPanel
        includeUnassigned={includeUnassignedInAssignmentCsv}
        canExportAssignments={canExportAssignmentCsv}
        disabled={isBusy}
        totalPeaks={rawSpectrumPeaks.length}
        {assignedCount}
        onIncludeUnassignedChange={(value) => (includeUnassignedInAssignmentCsv = value)}
        onExportAssignments={handleExportAssignments}
        onExportPng={handleExportPng}
      />
    {/if}

    <footer class="pt-5.5 text-center text-[0.92rem] text-muted">
      © 2026 The Regents of the United Colleges, Lastoria Royal College of Science
    </footer>
  </main>
</div>
