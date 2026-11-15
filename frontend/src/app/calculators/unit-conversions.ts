/**
 * Units for the quick unit converter. Each linear unit states how many SI base
 * units it equals; temperature is converted through kelvin.
 * Exact definitions: atm 101325 Pa, psi 6894.757293168 Pa, inch 0.0254 m,
 * pound 0.45359237 kg, US gallon 3.785411784 L, oil barrel 158.987294928 L,
 * thermochemical calorie 4.184 J, IT Btu 1055.05585262 J.
 */
type Quantity = { fa: string; en: string; base: string; defaults: [string, string]; units: Record<string, number> };

export const quantities = {
  pressure: { fa: "فشار", en: "Pressure", base: "Pa", defaults: ["bar", "kPa"],
    units: { Pa: 1, kPa: 1000, MPa: 1e6, bar: 1e5, mbar: 100, atm: 101325, psi: 6894.757293168, mmHg: 133.322387415 } },
  temperature: { fa: "دما", en: "Temperature", base: "K", defaults: ["°C", "°F"], units: { "°C": 1, "°F": 1, K: 1 } },
  length: { fa: "طول", en: "Length", base: "m", defaults: ["mm", "in"],
    units: { m: 1, cm: 0.01, mm: 0.001, "µm": 1e-6, in: 0.0254, ft: 0.3048 } },
  mass: { fa: "جرم", en: "Mass", base: "kg", defaults: ["g", "mg"],
    units: { kg: 1, g: 0.001, mg: 1e-6, "µg": 1e-9, lb: 0.45359237, oz: 0.028349523125 } },
  volume: { fa: "حجم", en: "Volume", base: "m³", defaults: ["L", "mL"],
    units: { "m³": 1, L: 0.001, mL: 1e-6, "µL": 1e-9, "gal (US)": 0.003785411784, bbl: 0.158987294928, "ft³": 0.028316846592 } },
  density: { fa: "چگالی", en: "Density", base: "kg/m³", defaults: ["g/mL", "kg/m³"],
    units: { "kg/m³": 1, "g/mL": 1000, "kg/L": 1000, "lb/ft³": 16.01846337396, "lb/gal (US)": 119.8264273167 } },
  dynamicViscosity: { fa: "ویسکوزیتهٔ دینامیکی", en: "Dynamic viscosity", base: "Pa·s", defaults: ["cP", "Pa·s"],
    units: { "Pa·s": 1, "mPa·s": 0.001, cP: 0.001, P: 0.1 } },
  kinematicViscosity: { fa: "ویسکوزیتهٔ سینماتیکی", en: "Kinematic viscosity", base: "m²/s", defaults: ["cSt", "m²/s"],
    units: { "m²/s": 1, "mm²/s": 1e-6, cSt: 1e-6, St: 1e-4 } },
  flow: { fa: "دبی حجمی", en: "Volumetric flow", base: "m³/s", defaults: ["m³/h", "L/min"],
    units: { "m³/s": 1, "m³/h": 1 / 3600, "L/s": 0.001, "L/min": 0.001 / 60, "gal/min (US)": 0.003785411784 / 60, "bbl/day": 0.158987294928 / 86400 } },
  energy: { fa: "انرژی", en: "Energy", base: "J", defaults: ["kJ", "kcal"],
    units: { J: 1, kJ: 1000, MJ: 1e6, cal: 4.184, kcal: 4184, Btu: 1055.05585262, kWh: 3.6e6 } },
} satisfies Record<string, Quantity>;

export type QuantityKey = keyof typeof quantities;
export const isQuantity = (value: unknown): value is QuantityKey => typeof value === "string" && Object.hasOwn(quantities, value);
export const unitNames = (quantity: QuantityKey) => Object.keys(quantities[quantity].units);

/** SI base units per one `unit`, or null where the conversion is not a plain factor (temperature). */
export function unitFactor(quantity: QuantityKey, unit: string): number | null {
  const units: Record<string, number> = quantities[quantity].units;
  return quantity === "temperature" || !Object.hasOwn(units, unit) ? null : units[unit];
}

const toKelvin: Record<string, (value: number) => number> = {
  "°C": value => value + 273.15, "°F": value => (value - 32) * 5 / 9 + 273.15, K: value => value,
};
const fromKelvin: Record<string, (value: number) => number> = {
  "°C": value => value - 273.15, "°F": value => (value - 273.15) * 9 / 5 + 32, K: value => value,
};

/** NaN for an unknown unit or a temperature below absolute zero. */
export function convertUnit(value: number, quantity: QuantityKey, from: string, to: string): number {
  if (quantity === "temperature") {
    if (!Object.hasOwn(toKelvin, from) || !Object.hasOwn(fromKelvin, to)) return NaN;
    const kelvin = toKelvin[from](value);
    // Float noise must not reject absolute zero itself.
    return kelvin < -1e-9 ? NaN : from === to ? value : fromKelvin[to](kelvin);
  }
  const source = unitFactor(quantity, from);
  const target = unitFactor(quantity, to);
  return source === null || target === null ? NaN : value * (source / target);
}
