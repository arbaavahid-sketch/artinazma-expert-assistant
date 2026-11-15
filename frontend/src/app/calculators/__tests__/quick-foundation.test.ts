import { beforeEach, describe, expect, it } from "vitest";
import { labTools } from "../lab-tools";
import { builtInQuickTools, quickToolId } from "../quick-tool-ids";
import { formatQuantity, isRounded } from "../quick-format";
import { addQuickEntry, clearQuickHistory, HISTORY_LIMIT, readQuickDigits, readQuickHistory, resetQuickStore, setQuickDigits, type QuickEntry } from "../quick-store";

const names = [...builtInQuickTools, ...labTools.map(tool => tool.en)];

describe("stable quick-tool ids", () => {
  it("gives every catalogue entry a unique id the usage API accepts", () => {
    const ids = names.map(quickToolId);
    expect(new Set(ids).size).toBe(names.length);
    for (const id of ids) expect(`quick-${id}`).toMatch(/^quick-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(40);
  });

  it("keeps released ids when the catalogue order changes", () => {
    expect(quickToolId("Solution dilution")).toBe("dilution");
    expect(quickToolId("Pressure conversion")).toBe("pressure");
    expect(quickToolId("Mean, sample standard deviation and RSD")).toBe("mean-sd-rsd");
    expect(quickToolId("Linear calibration regression R²")).toBe("calibration-fit");
    expect(quickToolId("General GUM uncertainty budget")).toBe("gum-budget");
  });

  it("rejects a tool that was added without an id", () => {
    expect(() => quickToolId("Unregistered tool")).toThrow(/no stable id/);
  });
});

describe("number format", () => {
  it("uses one digit system per locale", () => {
    expect(formatQuantity(0.1, false)).toBe("۰٫۱");
    expect(formatQuantity(250, false)).toBe("۲۵۰");
    expect(formatQuantity(0.1, true)).toBe("0.1");
  });

  it("limits significant figures and switches to scientific notation at the extremes", () => {
    expect(formatQuantity(58.443, true, 3)).toBe("58.4");
    expect(formatQuantity(1.23456789, true, 6)).toBe("1.23457");
    expect(formatQuantity(0.0000123, true, 6)).toBe("1.23E-5");
  });

  it("flags rounding only when real digits are dropped", () => {
    expect(isRounded(25, 6)).toBe(false);
    expect(isRounded(0.1 * 3, 6)).toBe(false);
    expect(isRounded(1 / 3, 6)).toBe(true);
    expect(isRounded(58.443, 3)).toBe(true);
    expect(isRounded(0, 3)).toBe(false);
  });
});

describe("local history and preferences", () => {
  const entry = (tool: string, value: string): QuickEntry => ({
    tool, at: "2026-11-15T08:00:00.000Z", output: `${value} mL`, inputs: value,
    state: { values: [value], alternate: {}, from: "bar", to: "kPa", ppmFromMass: true, sampleUnit: "g", unknowns: "" },
  });
  beforeEach(() => { localStorage.clear(); resetQuickStore(); });

  it("stores newest first and survives a reload", () => {
    addQuickEntry(entry("dilution", "1"));
    addQuickEntry(entry("pressure", "2"));
    resetQuickStore();
    expect(readQuickHistory().map(item => item.tool)).toEqual(["pressure", "dilution"]);
  });

  it("refreshes a repeated calculation instead of duplicating it", () => {
    addQuickEntry(entry("dilution", "1"));
    addQuickEntry(entry("pressure", "2"));
    addQuickEntry(entry("dilution", "1"));
    expect(readQuickHistory().map(item => item.tool)).toEqual(["dilution", "pressure"]);
  });

  it("keeps a bounded list and can be cleared", () => {
    for (let index = 0; index < HISTORY_LIMIT + 5; index++) addQuickEntry(entry("dilution", String(index)));
    expect(readQuickHistory()).toHaveLength(HISTORY_LIMIT);
    expect(readQuickHistory()[0].inputs).toBe(String(HISTORY_LIMIT + 4));
    clearQuickHistory();
    resetQuickStore();
    expect(readQuickHistory()).toEqual([]);
  });

  it("ignores damaged storage", () => {
    localStorage.setItem("artin.quick-history.v1", '[{"tool":1},"x",null]');
    localStorage.setItem("artin.quick-digits.v1", "7");
    expect(readQuickHistory()).toEqual([]);
    expect(readQuickDigits()).toBe(6);
  });

  it("remembers the chosen significant figures", () => {
    setQuickDigits(4);
    setQuickDigits(7);
    resetQuickStore();
    expect(readQuickDigits()).toBe(4);
  });
});
