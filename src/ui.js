import { findFormulas } from "./search.js";
import {
  buildMassIndex,
  defaultIsotopeLabel,
  elementCapacity,
  formatIsotopeOption,
  loadMassPayload,
} from "./massData.js";

const state = {
  massIndex: null,
  rows: [],
  nextRowId: 0,
  results: [],
};

const DEFAULT_ROWS = [
  { element: "C", lower: 0, upper: 20 },
  { element: "H", lower: 0, upper: 60 },
  { element: "N", lower: 0, upper: 10 },
  { element: "O", lower: 0, upper: 20 },
];

const FALLBACK_ROW_ELEMENTS = ["P", "S", "Cl", "Br", "F", "B", "Si", "Na"];

const $ = (id) => document.getElementById(id);

const THEME_STORAGE_KEY = "formulam-theme";

function applyTheme(theme) {
  const normalized = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = normalized;
  const toggle = $("themeToggle");
  const label = $("themeToggleText");
  const icon = document.querySelector(".theme-toggle-icon");
  if (toggle) {
    toggle.setAttribute("aria-pressed", String(normalized === "dark"));
    toggle.setAttribute("aria-label", normalized === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
  if (label) label.textContent = normalized === "dark" ? "Dark" : "Light";
  if (icon) icon.textContent = normalized === "dark" ? "☾" : "☀";
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(savedTheme || "dark");
  $("themeToggle").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  });
}


function setStatus(text, kind = "") {
  const el = $("status");
  el.textContent = text;
  el.className = `status ${kind}`.trim();
  el.hidden = !text;
}

function setMessage(text, kind = "") {
  const el = $("message");
  el.textContent = text;
  el.className = `message ${kind}`.trim();
}

function makeRow(element, lower = 0, upper = 10, isotope = null) {
  const chosenElement = element || firstAvailableElement();
  return {
    id: state.nextRowId++,
    element: chosenElement,
    isotope: isotope || chooseUnusedIsotope(chosenElement, null),
    lower,
    upper,
  };
}

function initRows() {
  state.rows = [];
  state.nextRowId = 0;
  for (const row of DEFAULT_ROWS) {
    if (state.massIndex.defaultIsotopeBySymbol[row.element]) {
      state.rows.push(makeRow(row.element, row.lower, row.upper));
    }
  }
  if (!state.rows.length) state.rows.push(makeRow(firstAvailableElement(), 0, 10));
}

function countRowsByElement(exceptRowId = null) {
  const counts = new Map();
  for (const row of state.rows) {
    if (row.id === exceptRowId) continue;
    counts.set(row.element, (counts.get(row.element) || 0) + 1);
  }
  return counts;
}

function elementOptionsForRow(rowId = null) {
  const counts = countRowsByElement(rowId);
  const options = [];
  for (const symbol of state.massIndex.elementSymbols) {
    if ((counts.get(symbol) || 0) < elementCapacity(state.massIndex, symbol)) {
      options.push(symbol);
    }
  }
  const row = state.rows.find((candidate) => candidate.id === rowId);
  if (row && !options.includes(row.element)) options.unshift(row.element);
  return options;
}

function firstAvailableElement() {
  const options = elementOptionsForRow(null);
  if (!options.length) throw new Error("No additional element rows are available.");
  return options[0];
}

function usedIsotopesForElement(element, exceptRowId = null) {
  const used = new Set();
  for (const row of state.rows) {
    if (row.id !== exceptRowId && row.element === element) used.add(row.isotope);
  }
  return used;
}

function chooseUnusedIsotope(element, exceptRowId = null) {
  const options = state.massIndex.isotopeOptions[element] || [];
  if (!options.length) throw new Error(`No isotopes are available for ${element}.`);
  const used = usedIsotopesForElement(element, exceptRowId);
  const defaultLabel = defaultIsotopeLabel(state.massIndex, element);
  if (!used.has(defaultLabel) && options.includes(defaultLabel)) return defaultLabel;
  return options.find((label) => !used.has(label)) || options[0];
}

function enforceUniqueIsotopes(changedRow, previousIsotope = null) {
  const options = state.massIndex.isotopeOptions[changedRow.element] || [];
  if (!options.includes(changedRow.isotope)) changedRow.isotope = chooseUnusedIsotope(changedRow.element, changedRow.id);

  const duplicate = state.rows.find(
    (row) => row.id !== changedRow.id && row.element === changedRow.element && row.isotope === changedRow.isotope,
  );
  if (duplicate) {
    if (previousIsotope && options.includes(previousIsotope) && previousIsotope !== changedRow.isotope) {
      duplicate.isotope = previousIsotope;
    } else {
      duplicate.isotope = chooseUnusedIsotope(duplicate.element, duplicate.id);
    }
  }

  const seen = new Set();
  for (const row of state.rows.filter((candidate) => candidate.element === changedRow.element)) {
    if (!seen.has(row.isotope)) {
      seen.add(row.isotope);
      continue;
    }
    const replacement = options.find((label) => !seen.has(label));
    if (replacement) {
      row.isotope = replacement;
      seen.add(replacement);
    }
  }
}

function searchKeyForRow(row) {
  return row.isotope === defaultIsotopeLabel(state.massIndex, row.element) ? row.element : row.isotope;
}

function validateAndBuildElements() {
  if (!state.rows.length) throw new Error("Enter at least one element bound.");

  const rowsByElement = new Map();
  const usedIsotopes = new Map();
  const elements = {};
  for (let index = 0; index < state.rows.length; index += 1) {
    const row = state.rows[index];
    const rowNumber = index + 1;
    if (!state.massIndex.defaultIsotopeBySymbol[row.element]) throw new Error(`Row ${rowNumber}: unknown element ${row.element}.`);
    const isotopeOptions = state.massIndex.isotopeOptions[row.element] || [];
    if (!isotopeOptions.includes(row.isotope)) {
      throw new Error(`Row ${rowNumber}: isotope ${row.isotope} is not available for element ${row.element}.`);
    }

    rowsByElement.set(row.element, (rowsByElement.get(row.element) || 0) + 1);
    if (rowsByElement.get(row.element) > isotopeOptions.length) {
      throw new Error(`Row ${rowNumber}: element ${row.element} cannot appear more than ${isotopeOptions.length} time(s).`);
    }

    const elementIsotopes = usedIsotopes.get(row.element) || new Set();
    if (elementIsotopes.has(row.isotope)) {
      throw new Error(`Row ${rowNumber}: isotope ${row.isotope} is already selected for element ${row.element}.`);
    }
    elementIsotopes.add(row.isotope);
    usedIsotopes.set(row.element, elementIsotopes);

    const lower = Number(row.lower);
    const upper = Number(row.upper);
    if (!Number.isInteger(lower) || lower < 0) throw new Error(`Row ${rowNumber}: lower limit must be a non-negative integer.`);
    if (!Number.isInteger(upper) || upper < 0) throw new Error(`Row ${rowNumber}: upper limit must be a non-negative integer.`);
    if (lower > upper) throw new Error(`Row ${rowNumber}: lower limit must be less than or equal to upper limit.`);

    const key = searchKeyForRow(row);
    if (key in elements) throw new Error(`Row ${rowNumber}: duplicate search key ${key}.`);
    elements[key] = [lower, upper];
  }
  return elements;
}

function optionElement(value, label, selected = false) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  option.selected = selected;
  return option;
}

function renderRows() {
  const tbody = $("formulaRows");
  tbody.innerHTML = "";

  for (const row of state.rows) {
    const tr = document.createElement("tr");

    const elementCell = document.createElement("td");
    const elementSelect = document.createElement("select");
    for (const symbol of elementOptionsForRow(row.id)) {
      elementSelect.append(optionElement(symbol, symbol, symbol === row.element));
    }
    elementSelect.addEventListener("change", () => {
      row.element = elementSelect.value;
      row.isotope = chooseUnusedIsotope(row.element, row.id);
      enforceUniqueIsotopes(row);
      renderRows();
    });
    elementCell.append(elementSelect);

    const isotopeCell = document.createElement("td");
    const isotopeSelect = document.createElement("select");
    for (const isotope of state.massIndex.isotopeOptions[row.element] || []) {
      isotopeSelect.append(optionElement(isotope, formatIsotopeOption(state.massIndex, isotope), isotope === row.isotope));
    }
    isotopeSelect.addEventListener("change", () => {
      const previous = row.isotope;
      row.isotope = isotopeSelect.value;
      enforceUniqueIsotopes(row, previous);
      renderRows();
    });
    isotopeCell.append(isotopeSelect);

    const lowerCell = document.createElement("td");
    const lowerInput = document.createElement("input");
    lowerInput.type = "number";
    lowerInput.min = "0";
    lowerInput.step = "1";
    lowerInput.value = row.lower;
    lowerInput.addEventListener("input", () => { row.lower = lowerInput.value === "" ? "" : Number(lowerInput.value); });
    lowerCell.append(lowerInput);

    const upperCell = document.createElement("td");
    const upperInput = document.createElement("input");
    upperInput.type = "number";
    upperInput.min = "0";
    upperInput.step = "1";
    upperInput.value = row.upper;
    upperInput.addEventListener("input", () => { row.upper = upperInput.value === "" ? "" : Number(upperInput.value); });
    upperCell.append(upperInput);

    const removeCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-row";
    removeButton.textContent = "-";
    removeButton.title = "Remove row";
    removeButton.disabled = state.rows.length <= 1;
    removeButton.addEventListener("click", () => {
      if (state.rows.length <= 1) return;
      state.rows = state.rows.filter((candidate) => candidate.id !== row.id);
      renderRows();
    });
    removeCell.append(removeButton);

    tr.append(elementCell, isotopeCell, lowerCell, upperCell, removeCell);
    tbody.append(tr);
  }

  $("addRow").disabled = elementOptionsForRow(null).length === 0;
}

function addRow() {
  const element = firstAvailableElement();
  state.rows.push(makeRow(element, 0, 10));
  renderRows();
}

function toleranceInputs() {
  const mode = $("toleranceMode").value;
  const ppmText = $("tolerancePpm").value.trim();
  const daText = $("toleranceDa").value.trim();
  const tolerancePpm = (mode === "ppm" || mode === "both") && ppmText ? ppmText : null;
  const toleranceDa = (mode === "Da" || mode === "both") && daText ? daText : null;
  if (tolerancePpm === null && toleranceDa === null) {
    throw new Error("Provide a ppm tolerance, a Da tolerance, or both.");
  }
  return { tolerancePpm, toleranceDa };
}

function renderResults(results) {
  const tbody = $("resultsBody");
  tbody.innerHTML = "";
  for (const hit of results) {
    const tr = document.createElement("tr");
    for (const key of ["formula", "ion_formula", "charge_state", "mass", "mz", "error_da", "error_ppm"]) {
      const td = document.createElement("td");
      td.textContent = String(hit[key]);
      tr.append(td);
    }
    tbody.append(tr);
  }
  $("resultsCard").hidden = false;
  $("downloadCsv").disabled = results.length === 0;
}

function runSearch() {
  try {
    setMessage("");
    const elements = validateAndBuildElements();
    const { tolerancePpm, toleranceDa } = toleranceInputs();
    const maxResults = Number($("maxResults").value);
    if (!Number.isInteger(maxResults) || maxResults < 1) throw new Error("Max results must be a positive integer.");

    const hits = findFormulas({
      mz: $("mz").value,
      elements,
      charge: $("charge").value,
      tolerancePpm,
      toleranceDa,
      maxResults,
      massIndex: state.massIndex,
    });
    state.results = hits;
    renderResults(hits);
    setMessage(`Found ${hits.length} candidate formula(s).`, "success");
  } catch (error) {
    console.error(error);
    setMessage(error.message, "error");
  }
}

function csvEscape(value) {
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadCsv() {
  const headers = ["formula", "ion_formula", "charge", "neutral_mass", "predicted_mz", "error_da", "error_ppm"];
  const rows = state.results.map((hit) => [
    hit.formula,
    hit.ion_formula,
    hit.charge_state,
    hit.mass,
    hit.mz,
    hit.error_da,
    hit.error_ppm,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "formula_hits.csv";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function main() {
  try {
    initTheme();
    $("ppmHelpButton").addEventListener("click", () => $("ppmHelpDialog").showModal());
    $("addRow").addEventListener("click", addRow);
    $("runSearch").addEventListener("click", runSearch);
    $("downloadCsv").addEventListener("click", downloadCsv);

    const { payload, url } = await loadMassPayload();
    state.massIndex = buildMassIndex(payload);
    initRows();
    renderRows();
    setStatus(`Loaded mass database from ${url}.`, "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message, "error");
  }
}

main();
