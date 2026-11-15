import elementData from "./workspace/element-data.json";

const weights = new Map<string, number>();
for (const element of (elementData as { elements: { symbol: string; atomic_weight: number | null }[] }).elements) {
  if (element.atomic_weight) weights.set(element.symbol, element.atomic_weight);
}

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
const TOKEN = /([A-Z][a-z]?)|(\d+(?:\.\d+)?)|([(\[])|([)\]])/y;
const COUNT = /\d+(?:\.\d+)?/y;

/** Element counts for one formula part without hydrate dots; supports nested () and []. */
function countPart(part: string): Map<string, number> {
  const stack: Map<string, number>[] = [new Map()];
  let position = 0;
  while (position < part.length) {
    TOKEN.lastIndex = position;
    const match = TOKEN.exec(part);
    if (!match) throw new Error("Unexpected character");
    const [, symbol, number, opening, closing] = match;
    position = TOKEN.lastIndex;
    let multiplier = 1;
    if (symbol || closing) {
      COUNT.lastIndex = position;
      const count = COUNT.exec(part);
      if (count) {
        multiplier = Number(count[0]);
        position = COUNT.lastIndex;
        if (multiplier <= 0) throw new Error("Zero count");
      }
    }
    const top = stack[stack.length - 1];
    if (symbol) {
      if (!weights.has(symbol)) throw new Error(`Unknown element: ${symbol}`);
      top.set(symbol, (top.get(symbol) ?? 0) + multiplier);
    } else if (opening) {
      stack.push(new Map());
    } else if (closing) {
      if (stack.length === 1) throw new Error("Unbalanced parentheses");
      const group = stack.pop()!;
      const parent = stack[stack.length - 1];
      for (const [key, value] of group) parent.set(key, (parent.get(key) ?? 0) + value * multiplier);
    } else if (number) {
      throw new Error("Count without element");
    }
  }
  if (stack.length !== 1) throw new Error("Unbalanced parentheses");
  return stack[0];
}

/**
 * Molar mass (g/mol) of a formula such as H2SO4, Ca(OH)2 or CuSO4·5H2O, from the
 * versioned element library. Mirrors backend/solution_prep.py so chat and
 * calculator agree. Returns NaN for anything that is not a valid formula.
 */
export function molarMass(formula: string): number {
  const text = formula.replace(/[₀-₉]/g, digit => String(SUBSCRIPTS.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/\s+/g, "");
  if (!text || text.length > 120) return NaN;
  try {
    let mass = 0;
    for (const part of text.split(/[·•*]|\.(?=\d*[A-Z(])/)) {
      if (!part) return NaN;
      const lead = /^(\d+(?:\.\d+)?)(?=[A-Z(\[])/.exec(part);
      const factor = lead ? Number(lead[1]) : 1;
      for (const [symbol, count] of countPart(lead ? part.slice(lead[0].length) : part)) mass += weights.get(symbol)! * count * factor;
    }
    return Number.isFinite(mass) && mass > 0 ? mass : NaN;
  } catch {
    return NaN;
  }
}
