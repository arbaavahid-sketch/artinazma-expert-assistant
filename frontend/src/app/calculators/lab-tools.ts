export type LabTool = {
  name: string;
  en: string;
  category: number;
  fields: string[];
  fieldsEn: string[];
  example: number[];
  formula: string;
  unit: string;
  series?: boolean;
  pairs?: boolean;
  calculate: (values: number[]) => number;
  valid?: (values: number[]) => boolean;
};

export const labTools: LabTool[] = [
  { name: "جرم توزین با لحاظ خلوص", en: "Purity correction", category: 0,
    fields: ["جرم مادهٔ خالص (g)", "خلوص جرمی (%)"], fieldsEn: ["Pure mass (g)", "Mass purity (%)"], example: [5, 98],
    formula: "m = mₚ × 100 / purity", unit: "g", calculate: ([m, p]) => m * 100 / p, valid: ([m, p]) => m > 0 && p > 0 && p <= 100 },
  { name: "درصد جرمی محلول", en: "Mass percentage w/w", category: 0,
    fields: ["جرم حل‌شونده (g)", "جرم محلول (g)"], fieldsEn: ["Solute mass (g)", "Solution mass (g)"], example: [5, 100],
    formula: "% w/w = 100 × mₛ / m", unit: "% w/w", calculate: ([a, b]) => 100 * a / b, valid: ([a, b]) => a >= 0 && b > 0 && a <= b },
  { name: "تبدیل غلظت جرمی ppm به mg/L", en: "Mass ppm to mg/L", category: 0,
    fields: ["غلظت جرمی (mg/kg)", "چگالی محلول (kg/L)"], fieldsEn: ["Mass concentration (mg/kg)", "Solution density (kg/L)"], example: [100, 1.02],
    formula: "C (mg/L) = C (mg/kg) × ρ (kg/L)", unit: "mg/L", calculate: ([a, b]) => a * b, valid: ([a, b]) => a >= 0 && b > 0 },
  { name: "تبدیل دبی حجمی", en: "Volumetric flow conversion", category: 1,
    fields: ["دبی حجمی (L/min)"], fieldsEn: ["Volumetric flow (L/min)"], example: [10],
    formula: "Q (m³/h) = Q (L/min) × 0.06", unit: "m³/h", calculate: ([a]) => a * 0.06 },
  { name: "تبدیل دمای سلسیوس به کلوین", en: "Celsius to Kelvin conversion", category: 1,
    fields: ["دما (°C)"], fieldsEn: ["Temperature (°C)"], example: [25],
    formula: "T (K) = T (°C) + 273.15", unit: "K", calculate: ([a]) => a + 273.15, valid: ([a]) => a >= -273.15 },
  { name: "درصد بازیابی نمونهٔ افزوده", en: "Spike recovery", category: 2,
    fields: ["نتیجهٔ نمونهٔ افزوده", "نتیجهٔ نمونهٔ اولیه", "غلظت افزوده‌شده"], fieldsEn: ["Spiked result", "Unspiked result", "Added concentration"], example: [19.8, 10, 10],
    formula: "Recovery = 100 × (Cspiked − Cinitial) / Cadded", unit: "%", calculate: ([a, b, c]) => 100 * (a - b) / c, valid: ([, , c]) => c > 0 },
  { name: "غلظت از معادلهٔ کالیبراسیون", en: "Linear calibration concentration", category: 2,
    fields: ["پاسخ دستگاه", "شیب خط", "عرض از مبدأ"], fieldsEn: ["Instrument response", "Slope", "Intercept"], example: [0.52, 0.1, 0.02],
    formula: "x = (y − b) / a", unit: "", calculate: ([y, a, b]) => (y - b) / a, valid: ([, a]) => a !== 0 },
  { name: "سرعت متوسط سیال در لوله", en: "Pipe flow velocity", category: 3,
    fields: ["دبی حجمی (m³/h)", "قطر داخلی لوله (mm)"], fieldsEn: ["Volumetric flow (m³/h)", "Internal diameter (mm)"], example: [12, 50],
    formula: "v = (Q / 3600) / (π × (D / 1000)² / 4)", unit: "m/s", calculate: ([q, d]) => (q / 3600) / (Math.PI * (d / 1000) ** 2 / 4), valid: ([q, d]) => q >= 0 && d > 0 },
  { name: "عدد رینولدز در لوله", en: "Pipe Reynolds number", category: 3,
    fields: ["چگالی (kg/m³)", "سرعت متوسط (m/s)", "قطر داخلی (m)", "ویسکوزیتهٔ دینامیکی (Pa·s)"], fieldsEn: ["Density (kg/m³)", "Mean velocity (m/s)", "Internal diameter (m)", "Dynamic viscosity (Pa·s)"], example: [998, 1, 0.05, 0.001],
    formula: "Re = ρ × v × D / μ", unit: "", calculate: ([r, v, d, m]) => r * v * d / m, valid: ([r, v, d, m]) => r > 0 && v >= 0 && d > 0 && m > 0 },
  { name: "دبی جرمی از دبی حجمی", en: "Mass flow from volumetric flow", category: 3,
    fields: ["دبی حجمی (m³/h)", "چگالی (kg/m³)"], fieldsEn: ["Volumetric flow (m³/h)", "Density (kg/m³)"], example: [12, 850],
    formula: "ṁ = Q × ρ", unit: "kg/h", calculate: ([q, r]) => q * r, valid: ([q, r]) => q >= 0 && r > 0 },
];
labTools.push(
  { name: "رقیق‌سازی سریالی با نسبت ثابت", en: "Serial dilution", category: 0,
    fields: ["غلظت اولیه (mol/L)", "ضریب رقیق‌سازی هر مرحله", "تعداد مراحل"], fieldsEn: ["Initial concentration (mol/L)", "Dilution factor per step", "Number of steps"], example: [1, 10, 3],
    formula: "Cₙ = C₀ / Fⁿ", unit: "mol/L", calculate: ([c, f, n]) => c / f ** n, valid: ([c, f, n]) => c > 0 && f >= 1 && Number.isSafeInteger(n) && n > 0 && c / f ** n > 0 },
  { name: "جرم توزین برای محلول مولار با لحاظ خلوص", en: "Molar solution with purity correction", category: 0,
    fields: ["مولاریته (mol/L)", "حجم نهایی (mL)", "جرم مولی (g/mol)", "خلوص جرمی (%)"], fieldsEn: ["Molarity (mol/L)", "Final volume (mL)", "Molar mass (g/mol)", "Mass purity (%)"], example: [0.1, 250, 58.44, 98],
    formula: "m = C × (V / 1000) × M × 100 / purity", unit: "g", calculate: ([c, v, m, p]) => c * (v / 1000) * m * 100 / p, valid: ([c, v, m, p]) => c > 0 && v > 0 && m > 0 && p > 0 && p <= 100 },
  { name: "درصد جرم به حجم", en: "Mass per volume percentage w/v", category: 0,
    fields: ["جرم حل‌شونده (g)", "حجم نهایی محلول (mL)"], fieldsEn: ["Solute mass (g)", "Final solution volume (mL)"], example: [5, 250],
    formula: "% w/v = 100 × m / V", unit: "% w/v", calculate: ([m, v]) => 100 * m / v, valid: ([m, v]) => m >= 0 && v > 0 },
  { name: "درصد حجمی", en: "Volume percentage v/v", category: 0,
    fields: ["حجم جزء (mL)", "حجم نهایی محلول (mL)"], fieldsEn: ["Component volume (mL)", "Final solution volume (mL)"], example: [25, 250],
    formula: "% v/v = 100 × V₁ / V₂", unit: "% v/v", calculate: ([a, b]) => 100 * a / b, valid: ([a, b]) => a >= 0 && b > 0 && a <= b },
  { name: "غلظت بر حسب ppm جرمی", en: "Mass concentration in ppm", category: 0,
    fields: ["غلظت (mg/L)", "چگالی محلول (kg/L)"], fieldsEn: ["Concentration (mg/L)", "Solution density (kg/L)"], example: [102, 1.02],
    formula: "C (ppm w/w) = C (mg/L) / ρ (kg/L)", unit: "ppm (w/w, mg/kg)", calculate: ([c, r]) => c / r, valid: ([c, r]) => c >= 0 && r > 0 },
  { name: "محاسبهٔ چگالی", en: "Density from mass and volume", category: 3,
    fields: ["جرم (kg)", "حجم (m³)"], fieldsEn: ["Mass (kg)", "Volume (m³)"], example: [850, 1],
    formula: "ρ = m / V", unit: "kg/m³", calculate: ([m, v]) => m / v, valid: ([m, v]) => m > 0 && v > 0 },
  { name: "دبی حجمی از دبی جرمی", en: "Volumetric flow from mass flow", category: 3,
    fields: ["دبی جرمی (kg/h)", "چگالی (kg/m³)"], fieldsEn: ["Mass flow (kg/h)", "Density (kg/m³)"], example: [10200, 850],
    formula: "Q = ṁ / ρ", unit: "m³/h", calculate: ([m, r]) => m / r, valid: ([m, r]) => m >= 0 && r > 0 },
  { name: "تبدیل دبی گاز با ضریب تراکم‌پذیری", en: "Gas flow at reference conditions", category: 3,
    fields: ["دبی واقعی (m³/h)", "فشار مطلق واقعی (kPa)", "دمای واقعی (K)", "ضریب Z واقعی", "فشار مطلق مرجع (kPa)", "دمای مرجع (K)", "ضریب Z مرجع"],
    fieldsEn: ["Actual flow (m³/h)", "Actual absolute pressure (kPa)", "Actual temperature (K)", "Actual Z factor", "Reference absolute pressure (kPa)", "Reference temperature (K)", "Reference Z factor"],
    example: [100, 202.65, 300, 1, 101.325, 300, 1],
    formula: "Qref = Q × (P / Pref) × (Tref / T) × (Zref / Z)", unit: "m³/h", calculate: ([q, p, t, z, pr, tr, zr]) => q * (p / pr) * (tr / t) * (zr / z), valid: ([q, ...conditions]) => q >= 0 && conditions.every(value => value > 0) },
  { name: "ویسکوزیتهٔ سینماتیکی از دینامیکی", en: "Dynamic to kinematic viscosity", category: 3,
    fields: ["ویسکوزیتهٔ دینامیکی (mPa·s)", "چگالی (kg/m³)"], fieldsEn: ["Dynamic viscosity (mPa·s)", "Density (kg/m³)"], example: [1, 1000],
    formula: "ν (mm²/s) = 1000 × μ (mPa·s) / ρ (kg/m³)", unit: "mm²/s", calculate: ([m, r]) => 1000 * m / r, valid: ([m, r]) => m > 0 && r > 0 },
  { name: "افت فشار اصطکاکی لولهٔ پر", en: "Darcy–Weisbach friction pressure drop", category: 3,
    fields: ["ضریب اصطکاک دارسی", "طول لوله (m)", "قطر داخلی (m)", "چگالی (kg/m³)", "سرعت متوسط (m/s)"],
    fieldsEn: ["Darcy friction factor", "Pipe length (m)", "Internal diameter (m)", "Density (kg/m³)", "Mean velocity (m/s)"], example: [0.02, 100, 0.05, 1000, 1],
    formula: "ΔP = f × (L / D) × ρv² / 2", unit: "Pa", calculate: ([f, l, d, r, v]) => f * (l / d) * r * v ** 2 / 2, valid: ([f, l, d, r, v]) => f >= 0 && l >= 0 && d > 0 && r > 0 && v >= 0 },
  { name: "توان هیدرولیکی پمپ", en: "Pump hydraulic power", category: 3,
    fields: ["دبی حجمی (m³/h)", "افزایش فشار (kPa)"], fieldsEn: ["Volumetric flow (m³/h)", "Pressure rise (kPa)"], example: [36, 200],
    formula: "P (kW) = (Q / 3600) × ΔP", unit: "kW", calculate: ([q, p]) => q / 3600 * p, valid: ([q, p]) => q >= 0 && p >= 0 },
);
export const mean = (values: number[]) => values.reduce((sum, value) => sum + value / values.length, 0);
export const sampleDeviation = (values: number[]) => {
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2 / (values.length - 1), 0));
};

labTools.push(
  ...[
    { name: "میانگین، انحراف معیار نمونه و RSD", en: "Mean, sample standard deviation and RSD", formula: "x̄ = Σx / n\ns = √(Σ(x − x̄)² / (n − 1))\nRSD = 100 × s / |x̄|", unit: "", calculate: sampleDeviation },
  ].map(tool => ({ ...tool, category: 2, series: true, fields: ["داده‌ها در یک واحد، جداشده با فاصله یا سطر جدید"],
    fieldsEn: ["Values in the same unit, separated by spaces or newlines"], example: [9.8, 10, 10.2] })),
  { name: "تبدیل کلوین به سلسیوس", en: "Kelvin to Celsius conversion", category: 1,
    fields: ["دما (K)"], fieldsEn: ["Temperature (K)"], example: [298.15],
    formula: "T (°C) = T (K) − 273.15", unit: "°C", calculate: ([a]) => a - 273.15, valid: ([a]) => a >= 0 },
  { name: "تبدیل دبی مترمکعب بر ساعت به لیتر بر دقیقه", en: "m³/h to L/min flow conversion", category: 1,
    fields: ["دبی حجمی (m³/h)"], fieldsEn: ["Volumetric flow (m³/h)"], example: [0.6],
    formula: "Q (L/min) = Q (m³/h) / 0.06", unit: "L/min", calculate: ([a]) => a / 0.06 },
  { name: "تبدیل چگالی گرم بر میلی‌لیتر به کیلوگرم بر مترمکعب", en: "g/mL to kg/m³ density conversion", category: 1,
    fields: ["چگالی (g/mL)"], fieldsEn: ["Density (g/mL)"], example: [0.85],
    formula: "ρ (kg/m³) = 1000 × ρ (g/mL)", unit: "kg/m³", calculate: ([a]) => 1000 * a, valid: ([a]) => a > 0 },
  { name: "گرمای محسوس", en: "Sensible heat energy", category: 3,
    fields: ["جرم (kg)", "ظرفیت گرمایی ویژه (kJ/kg·K)", "تغییر دما (K)"], fieldsEn: ["Mass (kg)", "Specific heat (kJ/kg·K)", "Temperature change (K)"], example: [10, 4.18, 20],
    formula: "Q = m × cₚ × ΔT", unit: "kJ", calculate: ([m, c, t]) => m * c * t, valid: ([m, c]) => m > 0 && c > 0 },
  { name: "فشار هیدرواستاتیک", en: "Hydrostatic pressure difference", category: 3,
    fields: ["چگالی (kg/m³)", "ارتفاع ستون مایع (m)"], fieldsEn: ["Density (kg/m³)", "Liquid column height (m)"], example: [1000, 2],
    formula: "ΔP = ρ × 9.80665 × h", unit: "Pa", calculate: ([r, h]) => r * 9.80665 * h, valid: ([r, h]) => r > 0 && h >= 0 },
);

export function linearFit(values: number[]) {
  const x = values.filter((_, index) => index % 2 === 0);
  const y = values.filter((_, index) => index % 2 === 1);
  const mx = mean(x);
  const my = mean(y);
  const xx = x.reduce((sum, value) => sum + (value - mx) ** 2, 0);
  const yy = y.reduce((sum, value) => sum + (value - my) ** 2, 0);
  const xy = x.reduce((sum, value, index) => sum + (value - mx) * (y[index] - my), 0);
  const slope = xy / xx;
  return { slope, intercept: my - slope * mx, r2: (xy / Math.sqrt(xx) / Math.sqrt(yy)) ** 2 };
}

labTools.push(
  { name: "برازش خط کالیبراسیون", en: "Linear calibration regression R²", category: 2, series: true, pairs: true,
    fields: ["هر سطر یک جفت غلظت و پاسخ دستگاه با فاصله"],
    fieldsEn: ["One concentration and instrument response pair per line"],
    example: [0, 0.02, 1, 0.12, 2, 0.22], unit: "", formula: "y = ax + b",
    calculate: values => linearFit(values).slope,
    valid: values => values.length >= 6 && values.length % 2 === 0 },
  { name: "خطای نسبی اندازه‌گیری", en: "Relative measurement error", category: 2,
    fields: ["مقدار اندازه‌گیری‌شده", "مقدار مرجع در همان واحد"], fieldsEn: ["Measured value", "Reference in the same unit"], example: [98, 100],
    formula: "Error (%) = 100 × (x − xref) / xref", unit: "%", calculate: ([x, ref]) => 100 * (x - ref) / ref, valid: ([, ref]) => ref !== 0 },
  { name: "توان ورودی پمپ با لحاظ بازده", en: "Pump input power with efficiency", category: 3,
    fields: ["توان هیدرولیکی (kW)", "بازده (%)"], fieldsEn: ["Hydraulic power (kW)", "Efficiency (%)"], example: [2, 80],
    formula: "Pin = Phyd × 100 / η", unit: "kW", calculate: ([p, e]) => p * 100 / e, valid: ([p, e]) => p >= 0 && e > 0 && e <= 100 },
);
