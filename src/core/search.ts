import {
  absBigInt,
  bigIntToDecimalString,
  ceilDiv,
  ceilRational,
  decimalToScaledBigInt,
  floorDiv,
  maxBigInt,
  nonNegativeDecimalRational,
  rationalToDecimalString,
} from "./decimal";
import {
  formatChargeState,
  formatFormula,
  formatIonFormula,
  normalizeSpeciesLabel,
  parseCharge,
} from "./formula";
import type { FindFormulaRequest, FormulaHit, SearchElements } from "./types";

type ElementBound = number | [number, number] | { min?: number | string; max?: number | string | null } | null | undefined;
type InternalHit = FormulaHit & { _sort_abs_error: bigint; _sort_mass: bigint };
// NIST CODATA electron mass in u; FormulaM exact masses are handled in Da, so the numeric value is the same here.
// Reference: https://physics.nist.gov/cuu/Constants/index.html
export const ELECTRON_MASS_DA = "0.000548579909065";

function parseBound(bound: ElementBound): [number, number | null] {
  if (bound === null || bound === undefined) return [0, null];
  if (Number.isInteger(bound)) return [0, Number(bound)];
  if (Array.isArray(bound) && bound.length === 2) return [Number(bound[0]), Number(bound[1])];
  if (typeof bound === "object") {
    const mapping = bound as { min?: number | string; max?: number | string | null };
    return [Number(mapping.min ?? 0), mapping.max === undefined || mapping.max === null ? null : Number(mapping.max)];
  }
  throw new Error("element bounds must be a max integer, [min, max], or {min, max}");
}

function parseNonNegativeCount(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be a non-negative integer`);
  return number;
}

function normalizeBounds(
  elements: SearchElements | string[],
  massTable: Record<string, string>,
  upperMassInt: bigint,
  scaleDigits: number,
): Record<string, [number, number]> {
  const entries = Array.isArray(elements)
    ? elements.map((symbol) => [symbol, null] as [string, null])
    : Object.entries(elements || {}) as [string, ElementBound][];
  if (!entries.length) throw new Error("at least one element symbol is required");

  const bounds: Record<string, [number, number]> = {};
  for (const [rawSymbol, rawBound] of entries) {
    const symbol = normalizeSpeciesLabel(rawSymbol);
    if (!(symbol in massTable)) throw new Error(`no exact mass is available for symbol or isotope label ${symbol}`);
    const massInt = decimalToScaledBigInt(massTable[symbol], scaleDigits, "round");
    if (massInt <= 0n) throw new Error(`mass for ${symbol} must be positive`);

    let [minimum, maximum] = parseBound(rawBound);
    minimum = parseNonNegativeCount(minimum, `minimum count for ${symbol}`);
    if (maximum === null) maximum = Number(upperMassInt / massInt);
    maximum = parseNonNegativeCount(maximum, `maximum count for ${symbol}`);
    if (minimum > maximum) throw new Error(`minimum count exceeds maximum count for ${symbol}`);
    bounds[symbol] = [minimum, maximum];
  }
  return bounds;
}

function ppmToleranceToScaled(targetMzInt: bigint, ppmValue: unknown): bigint {
  const ppm = nonNegativeDecimalRational(ppmValue, "tolerance_ppm");
  const numerator = targetMzInt * ppm.numerator;
  const denominator = ppm.denominator * 1_000_000n;
  return ceilRational(numerator, denominator);
}

function toSafeCount(value: bigint, label: string): number {
  if (value < 0n) return 0;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is too large for browser enumeration; tighten element bounds`);
  }
  return Number(value);
}

function buildCandidate({
  composition,
  massInt,
  targetMzInt,
  charge,
  chargeAbs,
  electronMassInt,
  scaleDigits,
}: {
  composition: Record<string, number>;
  massInt: bigint;
  targetMzInt: bigint;
  charge: number;
  chargeAbs: number;
  electronMassInt: bigint;
  scaleDigits: number;
}): InternalHit {
  const formula = formatFormula(composition);
  const chargeBig = BigInt(charge);
  const chargeAbsBig = BigInt(chargeAbs);
  const ionMassInt = massInt - chargeBig * electronMassInt;
  const ionDiffInt = ionMassInt - targetMzInt * chargeAbsBig;
  return {
    formula,
    composition: { ...composition },
    mass: bigIntToDecimalString(massInt, scaleDigits, 9),
    mz: rationalToDecimalString(ionMassInt, chargeAbsBig * (10n ** BigInt(scaleDigits)), 9),
    error_da: rationalToDecimalString(ionDiffInt, chargeAbsBig * (10n ** BigInt(scaleDigits)), 9),
    error_ppm: rationalToDecimalString(ionDiffInt * 1_000_000n, chargeAbsBig * targetMzInt, 6),
    charge,
    charge_state: formatChargeState(charge),
    ion_formula: formatIonFormula(formula, charge),
    _sort_abs_error: absBigInt(ionDiffInt),
    _sort_mass: massInt,
  };
}

export function findFormulas({
  mz,
  elements,
  charge,
  toleranceDa = null,
  tolerancePpm = "5",
  maxResults = null,
  massIndex,
  massDigits = 9,
}: FindFormulaRequest): FormulaHit[] {
  if (!massIndex || !massIndex.masses) throw new Error("massIndex is required");
  if (massDigits < 6) throw new Error("massDigits must be at least 6");

  const targetMzInt = decimalToScaledBigInt(mz, massDigits, "round");
  if (targetMzInt <= 0n) throw new Error("mz must be positive");

  const resolvedCharge = parseCharge(charge);
  const chargeAbs = Math.abs(resolvedCharge);
  const chargeAbsBig = BigInt(chargeAbs);
  const electronMassInt = decimalToScaledBigInt(ELECTRON_MASS_DA, massDigits, "round");
  const chargeBig = BigInt(resolvedCharge);

  const toleranceCandidates: bigint[] = [];
  if (toleranceDa !== null && toleranceDa !== undefined && String(toleranceDa).trim() !== "") {
    const daInt = decimalToScaledBigInt(toleranceDa, massDigits, "ceil");
    if (daInt < 0n) throw new Error("tolerance_da must be non-negative");
    toleranceCandidates.push(daInt);
  }
  if (tolerancePpm !== null && tolerancePpm !== undefined && String(tolerancePpm).trim() !== "") {
    toleranceCandidates.push(ppmToleranceToScaled(targetMzInt, tolerancePpm));
  }
  if (!toleranceCandidates.length) throw new Error("provide tolerance_da, tolerance_ppm, or both");

  const mzToleranceInt = toleranceCandidates.reduce(maxBigInt, 0n);
  const neutralTargetInt = targetMzInt * chargeAbsBig + chargeBig * electronMassInt;
  const neutralToleranceInt = mzToleranceInt * chargeAbsBig;
  const lowerInt = neutralTargetInt - neutralToleranceInt;
  const upperInt = neutralTargetInt + neutralToleranceInt;
  if (upperInt < lowerInt) return [];

  const bounds = normalizeBounds(elements, massIndex.masses, upperInt, massDigits);
  const symbols = Object.keys(bounds).sort((a, b) => {
    const ma = decimalToScaledBigInt(massIndex.masses[a], massDigits, "round");
    const mb = decimalToScaledBigInt(massIndex.masses[b], massDigits, "round");
    return mb > ma ? 1 : mb < ma ? -1 : a.localeCompare(b);
  });
  const massesInt = symbols.map((symbol) => decimalToScaledBigInt(massIndex.masses[symbol], massDigits, "round"));
  const minCounts = symbols.map((symbol) => bounds[symbol][0]);
  const maxCounts = symbols.map((symbol) => bounds[symbol][1]);

  const n = symbols.length;
  const remMin = Array<bigint>(n + 1).fill(0n);
  const remMax = Array<bigint>(n + 1).fill(0n);
  for (let i = n - 1; i >= 0; i -= 1) {
    remMin[i] = remMin[i + 1] + BigInt(minCounts[i]) * massesInt[i];
    remMax[i] = remMax[i + 1] + BigInt(maxCounts[i]) * massesInt[i];
  }
  if (remMin[0] > upperInt || remMax[0] < lowerInt) return [];

  const candidates: InternalHit[] = [];
  const composition: Record<string, number> = {};

  function recurse(index: number, currentMassInt: bigint): void {
    if (index === n) {
      if (lowerInt <= currentMassInt && currentMassInt <= upperInt) {
        const cleanComposition: Record<string, number> = {};
        for (const [symbol, count] of Object.entries(composition)) {
          if (count) cleanComposition[symbol] = count;
        }
        candidates.push(buildCandidate({
          composition: cleanComposition,
          massInt: currentMassInt,
          targetMzInt,
          charge: resolvedCharge,
          chargeAbs,
          electronMassInt,
          scaleDigits: massDigits,
        }));
      }
      return;
    }

    const symbol = symbols[index];
    const massInt = massesInt[index];
    const minAfter = remMin[index + 1];
    const maxAfter = remMax[index + 1];

    const loMass = ceilDiv(lowerInt - currentMassInt - maxAfter, massInt);
    const hiMass = floorDiv(upperInt - currentMassInt - minAfter, massInt);
    const lo = Math.max(minCounts[index], toSafeCount(loMass, `lower count for ${symbol}`));
    const hi = Math.min(maxCounts[index], toSafeCount(hiMass, `upper count for ${symbol}`));
    if (lo > hi) return;

    for (let count = lo; count <= hi; count += 1) {
      if (count) composition[symbol] = count;
      else delete composition[symbol];
      recurse(index + 1, currentMassInt + BigInt(count) * massInt);
    }
    delete composition[symbol];
  }

  recurse(0, 0n);
  candidates.sort((a, b) => {
    if (a._sort_abs_error !== b._sort_abs_error) return a._sort_abs_error < b._sort_abs_error ? -1 : 1;
    if (a._sort_mass !== b._sort_mass) return a._sort_mass < b._sort_mass ? -1 : 1;
    return a.formula.localeCompare(b.formula);
  });

  if (maxResults !== null && maxResults !== undefined) {
    const limit = Number(maxResults);
    if (!Number.isInteger(limit) || limit < 0) throw new Error("max_results must be a non-negative integer");
    return candidates.slice(0, limit).map(stripInternalFields);
  }
  return candidates.map(stripInternalFields);
}

function stripInternalFields(hit: InternalHit): FormulaHit {
  const { _sort_abs_error: _unusedAbs, _sort_mass: _unusedMass, ...publicHit } = hit;
  return publicHit;
}
