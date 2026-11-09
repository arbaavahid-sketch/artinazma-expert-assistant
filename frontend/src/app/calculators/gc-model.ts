export const gcInputs = [
  { key: "area", fa: "مساحت پیک نمونه A", en: "Sample peak area A" },
  { key: "slope", fa: "شیب a برای غلظت بر حسب mg/L", en: "Slope a for concentration in mg/L" },
  { key: "intercept", fa: "عرض از مبدأ b", en: "Intercept b" },
  { key: "extract", fa: "حجم نهایی محلول (mL)", en: "Final solution volume (mL)" },
  { key: "dilution", fa: "ضریب رقیق‌سازی بعد از استخراج", en: "Post-extraction dilution factor" },
  { key: "mass", fa: "جرم نمونه (g)", en: "Sample mass (g)" },
  { key: "recovery", fa: "بازیابی برای تصحیح (%)", en: "Recovery correction (%)" },
] as const;

export type GCValues = Record<typeof gcInputs[number]["key"], number>;

export function gcExtraction(values: GCValues) {
  const { area, slope, intercept, extract, dilution, mass, recovery } = values;
  const factor = extract * dilution / (mass * (recovery / 100));
  const concentration = (area - intercept) / slope * factor;
  return {
    concentration,
    sensitivities: [factor / slope, -concentration / slope, -factor / slope,
      concentration / extract, concentration / dilution, -concentration / mass, -concentration / recovery],
    valid: Object.values(values).every(Number.isFinite) && slope > 0 && extract > 0 &&
      dilution >= 1 && mass > 0 && recovery > 0,
  };
}
