import { describe, expect, it } from "vitest";
import { labTools } from "../lab-tools";
import { formulaNotes } from "../formula-notes";
import { molarMass } from "../molar-mass";
import { convertUnit, quantities, unitFactor, unitNames, type QuantityKey } from "../unit-conversions";

const tool = (name: string) => {
  const found = labTools.find(item => item.en === name);
  if (!found) throw new Error(name);
  return found;
};
const run = (name: string, values: number[]) => {
  const item = tool(name);
  return { value: item.calculate(values), valid: item.valid ? item.valid(values) : true };
};

describe("molar mass from formula", () => {
  // Same values as backend/solution_prep.py, so chat and calculator agree.
  it.each([
    ["H2SO4", 98.072], ["Ca(OH)2", 74.092], ["CuSO4.5H2O", 249.677], ["CuSO4·5H2O", 249.677],
    ["K4[Fe(CN)6]", 368.3462], ["NaCl", 58.43976928], ["C6H12O6", 180.156], ["KHC8H4O4", 204.2223],
    ["H₂SO₄", 98.072], ["Na2 CO3", 105.98753856],
  ])("%s", (formula, expected) => expect(molarMass(formula)).toBeCloseTo(expected, 6));

  it.each(["", "h2so4", "Xx2", "Ca(OH2", "Ca)OH(2", "2", "H0", "NaCl!", "A".repeat(121)])("rejects %j", formula =>
    expect(molarMass(formula)).toBeNaN());

  it("tells cobalt from carbon monoxide", () => {
    expect(molarMass("Co")).toBeCloseTo(58.933194, 5);
    expect(molarMass("CO")).toBeCloseTo(28.01, 2);
  });

  it("is reached through the tool's text input", () => {
    const item = tool("Molar mass from formula");
    expect(item.text?.("Ca(OH)2")).toBeCloseTo(74.092, 6);
    expect(item.exampleText).toBe("H2SO4");
  });
});

describe("solution tools", () => {
  it("weighs Na2CO3 for 0.1 N with two equivalents per mole", () => {
    // 0.1 eq/L × 0.5 L × 105.99 / 2 g/eq / 0.995
    expect(run("Normal solution preparation", [0.1, 500, 105.99, 2, 99.5]).value).toBeCloseTo(2.66307, 4);
    expect(run("Normal solution preparation", [0.1, 500, 105.99, 0, 99.5]).valid).toBe(false);
    expect(run("Normal solution preparation", [0.1, 500, 105.99, 2, 101]).valid).toBe(false);
  });

  it("gives about 12 M for 37 % hydrochloric acid", () => {
    expect(run("Molarity of a concentrated reagent", [37, 1.19, 36.46]).value).toBeCloseTo(12.076, 2);
  });

  it("measures about 8.3 mL of 37 % HCl for 1 L of 0.1 M", () => {
    expect(run("Concentrate volume for a molar solution", [0.1, 1000, 36.46, 37, 1.19]).value).toBeCloseTo(8.2805, 3);
    // A target at or above the concentrate's own strength is impossible.
    expect(run("Concentrate volume for a molar solution", [13, 1000, 36.46, 37, 1.19]).valid).toBe(false);
  });
});

describe("pH tools", () => {
  it("converts between pH and hydrogen ion concentration", () => {
    expect(run("pH from hydrogen ion concentration", [0.001]).value).toBeCloseTo(3, 12);
    expect(run("Hydrogen ion concentration from pH", [3]).value).toBeCloseTo(0.001, 15);
    expect(run("pH from hydrogen ion concentration", [0]).valid).toBe(false);
  });

  it("returns pKa for an equimolar buffer and shifts one unit per decade of ratio", () => {
    expect(run("Buffer pH (Henderson–Hasselbalch)", [4.76, 0.1, 0.1]).value).toBeCloseTo(4.76, 12);
    expect(run("Buffer pH (Henderson–Hasselbalch)", [4.76, 1, 0.1]).value).toBeCloseTo(5.76, 12);
    expect(run("Buffer pH (Henderson–Hasselbalch)", [4.76, 0, 0.1]).valid).toBe(false);
  });
});

describe("titration tools", () => {
  it("applies the stoichiometric ratio", () => {
    // 0.1 M NaOH, 12.5 mL, against 25 mL of H2SO4 (0.5 mol acid per mol base)
    expect(run("Analyte concentration from titration", [0.1, 12.5, 25, 0.5]).value).toBeCloseTo(0.025, 12);
  });

  it("computes acid number with blank correction", () => {
    // (2.5 − 0.1) × 0.1 × 56.106 / 5
    expect(run("Acid number from KOH titration", [2.5, 0.1, 0.1, 5]).value).toBeCloseTo(2.693088, 6);
    expect(run("Acid number from KOH titration", [0.05, 0.1, 0.1, 5]).valid).toBe(false);
  });
});

describe("API gravity", () => {
  it("puts water at 10 °API and round-trips", () => {
    expect(run("API gravity from relative density", [1]).value).toBeCloseTo(10, 12);
    const api = run("API gravity from relative density", [0.85]).value;
    expect(api).toBeCloseTo(34.97, 2);
    expect(run("Relative density from API gravity", [api]).value).toBeCloseTo(0.85, 12);
  });
});

describe("unit converter", () => {
  it.each([
    [100, "temperature", "°C", "°F", 212], [32, "temperature", "°F", "°C", 0], [0, "temperature", "K", "°C", -273.15],
    [-40, "temperature", "°C", "°F", -40], [1, "pressure", "atm", "psi", 14.6959488], [1, "pressure", "bar", "kPa", 100],
    [1, "length", "in", "mm", 25.4], [1, "mass", "lb", "g", 453.59237], [1, "volume", "bbl", "L", 158.987294928],
    [1, "volume", "gal (US)", "L", 3.785411784], [1, "density", "g/mL", "kg/m³", 1000], [1, "dynamicViscosity", "cP", "mPa·s", 1],
    [1, "kinematicViscosity", "St", "cSt", 100], [1, "flow", "m³/h", "L/min", 16.6666667], [1, "energy", "kcal", "kJ", 4.184],
    [1, "energy", "kWh", "MJ", 3.6], [1, "energy", "Btu", "kJ", 1.05505585],
  ] as [number, QuantityKey, string, string, number][])("%s %s %s → %s", (value, quantity, from, to, expected) =>
    expect(convertUnit(value, quantity, from, to)).toBeCloseTo(expected, 6));

  it("rejects temperatures below absolute zero and unknown units", () => {
    expect(convertUnit(-300, "temperature", "°C", "K")).toBeNaN();
    expect(convertUnit(-1, "temperature", "K", "°C")).toBeNaN();
    expect(convertUnit(1, "pressure", "bar", "furlong")).toBeNaN();
    expect(convertUnit(1, "pressure", "constructor", "bar")).toBeNaN();
  });

  it("round-trips every unit pair and offers its defaults", () => {
    for (const quantity of Object.keys(quantities) as QuantityKey[]) {
      const units = unitNames(quantity);
      for (const unit of quantities[quantity].defaults) expect(units).toContain(unit);
      for (const from of units) for (const to of units)
        expect(convertUnit(convertUnit(300, quantity, from, to), quantity, to, from)).toBeCloseTo(300, 6);
    }
    expect(unitFactor("temperature", "K")).toBeNull();
  });
});

it("every new tool has a valid example and a bilingual explanation", () => {
  for (const name of ["Normal solution preparation", "Molarity of a concentrated reagent", "Concentrate volume for a molar solution",
    "Molar mass from formula", "pH from hydrogen ion concentration", "Hydrogen ion concentration from pH", "Buffer pH (Henderson–Hasselbalch)",
    "Analyte concentration from titration", "Acid number from KOH titration", "API gravity from relative density", "Relative density from API gravity"]) {
    const item = tool(name);
    expect(item.fields).toHaveLength(item.fieldsEn.length);
    expect(item.valid?.(item.example) ?? true).toBe(true);
    expect(Number.isFinite(item.calculate(item.example))).toBe(true);
    expect(formulaNotes[name]?.fa && formulaNotes[name]?.en).toBeTruthy();
  }
  expect(formulaNotes.unitConverter.fa && formulaNotes.unitConverter.en).toBeTruthy();
});
