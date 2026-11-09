import { expect, it } from "vitest";
import { familyModels } from "../family-models";

it.each([
  ["viscosity", [0.1, 100], 10],
  ["residue", [0.2, 10], 2],
  ["loss", [10, 9], 10],
  ["corrected", [25, -0.2], 24.8],
  ["diluted", [5, 1, 10], 40],
  ["dynamic", [10, 850], 8.5],
] as const)("verifies %s value and each sensitivity", (key, inputs, expected) => {
  const x = [...inputs];
  const model = familyModels[key];
  const result = model.evaluate(x);
  expect(result.valid).toBe(true);
  expect(result.value).toBeCloseTo(expected, 10);
  x.forEach((value, index) => {
    const h = Math.abs(value) * 1e-5;
    const plus = x.map((v, i) => i === index ? v + h : v);
    const minus = x.map((v, i) => i === index ? v - h : v);
    expect(result.sensitivities[index]).toBeCloseTo((model.evaluate(plus).value - model.evaluate(minus).value) / (2*h), 6);
  });
});

it.each([
  ["volumetricTitration", [10, 1, 0.1, 1, 25], 0.036],
  ["relativeDensity", [850, 1000], 0.85],
  ["kinematicFromDynamic", [8.5, 850], 10],
] as const)("verifies added %s model and sensitivities", (key, inputs, expected) => {
  const x = [...inputs];
  const model = familyModels[key];
  const result = model.evaluate(x);
  expect(result.valid).toBe(true);
  expect(result.value).toBeCloseTo(expected, 10);
  x.forEach((value, index) => {
    const h = Math.abs(value) * 1e-5;
    const plus = x.map((v, i) => i === index ? v + h : v);
    const minus = x.map((v, i) => i === index ? v - h : v);
    expect(result.sensitivities[index]).toBeCloseTo((model.evaluate(plus).value - model.evaluate(minus).value) / (2*h), 6);
  });
});
