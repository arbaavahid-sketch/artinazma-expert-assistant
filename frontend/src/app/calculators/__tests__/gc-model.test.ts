import { expect, it } from "vitest";
import { gcExtraction, gcInputs, type GCValues } from "../gc-model";

const values: GCValues = { area: 110, slope: 10, intercept: 10, extract: 50, dilution: 2, mass: 10, recovery: 80 };

it("converts injected mg/L to original sample mg/kg", () => {
  expect(gcExtraction(values).concentration).toBe(125);
  expect(gcExtraction(values).valid).toBe(true);
});

it("matches analytic sensitivities to independent finite differences", () => {
  const model = gcExtraction(values);
  gcInputs.forEach((input, index) => {
    const step = Math.abs(values[input.key]) * 1e-5;
    const plus = gcExtraction({ ...values, [input.key]: values[input.key] + step }).concentration;
    const minus = gcExtraction({ ...values, [input.key]: values[input.key] - step }).concentration;
    expect(model.sensitivities[index]).toBeCloseTo((plus - minus) / (2 * step), 6);
  });
});

it("retains response uncertainty at the blank and rejects zero denominators", () => {
  const model = gcExtraction({ ...values, area: 10 });
  expect(model.concentration).toBe(0);
  expect(model.sensitivities[0]).toBe(1.25);
  expect(gcExtraction({ ...values, recovery: 0 }).valid).toBe(false);
  expect(gcExtraction({ ...values, slope: 0 }).valid).toBe(false);
});
