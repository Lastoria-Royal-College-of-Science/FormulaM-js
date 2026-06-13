import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { buildMassIndex } from "../src/core/massData";
import { findFormulas } from "../src/core/search";
import type { MassPayload } from "../src/core/types";

const payload = JSON.parse(await readFile(new URL("../public/data/masses.json", import.meta.url), "utf8")) as MassPayload;
const massIndex = buildMassIndex(payload);

describe("FormulaM search", () => {
  it("finds a glucose-like singly charged formula", () => {
    const glucose = findFormulas({
      mz: "180.062839518",
      elements: { C: [0, 12], H: [0, 30], O: [0, 12] },
      charge: "+1",
      tolerancePpm: "5",
      maxResults: 10,
      massIndex,
    });
    expect(glucose.length).toBeGreaterThan(0);
    expect(glucose[0].formula).toBe("C6H12O6");
    expect(glucose[0].mass).toBe("180.063388098");
    expect(glucose[0].mz).toBe("180.062839518");
    expect(glucose[0].error_da).toBe("0.000000000");
    expect(glucose[0].error_ppm).toBe("0.000000");
  });

  it("supports a doubly charged formula label", () => {
    const glucose2p = findFormulas({
      mz: "90.031145469",
      elements: { C: [0, 12], H: [0, 30], O: [0, 12] },
      charge: "+2",
      tolerancePpm: "5",
      maxResults: 10,
      massIndex,
    });
    expect(glucose2p.length).toBeGreaterThan(0);
    expect(glucose2p[0].formula).toBe("C6H12O6");
    expect(glucose2p[0].charge_state).toBe("2+");
    expect(glucose2p[0].mz).toBe("90.031145469");
  });

  it("applies electron-mass correction to bare negative ions", () => {
    const glucose1m = findFormulas({
      mz: "180.063936678",
      elements: { C: [0, 12], H: [0, 30], O: [0, 12] },
      charge: "-1",
      tolerancePpm: "5",
      maxResults: 10,
      massIndex,
    });
    expect(glucose1m.length).toBeGreaterThan(0);
    expect(glucose1m[0].formula).toBe("C6H12O6");
    expect(glucose1m[0].mass).toBe("180.063388098");
    expect(glucose1m[0].mz).toBe("180.063936678");
    expect(glucose1m[0].error_da).toBe("0.000000000");
    expect(glucose1m[0].error_ppm).toBe("0.000000");
    expect(glucose1m[0].charge_state).toBe("-");
  });

  it("formats mixed isotope formulas", () => {
    const mixedIsotope = findFormulas({
      mz: "181.066194353",
      elements: { C: [5, 5], "13C": [1, 1], H: [12, 12], O: [6, 6] },
      charge: "+1",
      toleranceDa: "0.000001",
      tolerancePpm: null,
      maxResults: 10,
      massIndex,
    });
    expect(mixedIsotope.length).toBeGreaterThan(0);
    expect(mixedIsotope[0].formula).toBe("C5[13C]H12O6");
  });
});
