import { describe, expect, it } from "vitest";
import { labTools } from "../lab-tools";

function tool(name: string) {
  const result = labTools.find(item => item.en === name);
  if (!result) throw new Error(name);
  return result;
}

describe("measurement uncertainty reference cases", () => {
  it("distinguishes uncertainty of a mean from repeatability of one reading", () => {
    const typeA = tool("Type A standard uncertainty of the mean");
    expect(typeA.calculate([9.8, 10, 10.2])).toBeCloseTo(0.115470053837925, 12);
    expect(typeA.formula).toBe("uA = s / √n");
  });

  it("combines independent certificate and repeatability contributions", () => {
    const combined = tool("Combined standard uncertainty");
    expect(combined.calculate([0.03, 0.04, 0])).toBeCloseTo(0.05, 12);
    expect(tool("Expanded measurement uncertainty").calculate([0.03, 0.04, 0, 2])).toBeCloseTo(0.1, 12);
    expect(combined.valid?.([-0.03, 0.04, 0])).toBe(false);
  });

  it("uses the number of readings actually averaged for balance repeatability", () => {
    const balance = tool("Balance weighing uncertainty");
    expect(balance.calculate([0.002, 1, 0.004, 2, 0.001, 0.001, 0.001, 2]))
      .toBeCloseTo(0.005916079783099616, 12);
    expect(balance.calculate([0.002, 4, 0, 2, 0, 0, 0, 2])).toBeCloseTo(0.002, 12);
    expect(balance.valid?.([0.002, 1.5, 0, 2, 0, 0, 0, 2])).toBe(false);
  });

  it("propagates mass and volume sensitivity coefficients", () => {
    const density = tool("Density uncertainty from mass and volume");
    expect(density.calculate([50, 50, 0.005, 0.02, 2])).toBeCloseTo(0.000824621125123532, 12);
    expect(density.valid?.([50, 0, 0.005, 0.02, 2])).toBe(false);
  });
});
