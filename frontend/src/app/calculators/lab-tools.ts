export type LabTool = {
  name: string;
  en: string;
  category: number;
  fields: string[];
  fieldsEn: string[];
  fieldHints?: { fa: string[]; en: string[] };
  example: number[];
  formula: string;
  explanation?: { fa: string; en: string; source: string; section: string };
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

const uncertaintyFields = [
  "عدم‌قطعیت استاندارد تکرارپذیری",
  "عدم‌قطعیت استاندارد کالیبراسیون",
  "سایر مؤلفه‌ها پس از ترکیب (استاندارد)",
];
const uncertaintyFieldsEn = [
  "Repeatability standard uncertainty",
  "Calibration standard uncertainty",
  "Combined other standard components",
];
const combinedUncertainty = ([repeatability, calibration, other]: number[]) =>
  Math.hypot(repeatability, calibration, other);

labTools.push(
  {
    name: "عدم‌قطعیت استاندارد نوع A از تکرار اندازه‌گیری",
    en: "Type A standard uncertainty of the mean",
    category: 2, series: true, unit: "",
    fields: ["اندازه‌گیری‌های مستقل در یک واحد، با فاصله یا سطر جدید"],
    fieldsEn: ["Independent readings in the same unit, separated by spaces or newlines"],
    example: [9.8, 10, 10.2],
    formula: "uA = s / √n",
    explanation: {
      fa: "s انحراف معیار نمونه و n تعداد اندازه‌گیری‌هاست. اگر نتیجهٔ گزارش‌شده میانگین تکرارهای مستقل در شرایط یکسان باشد، واریانس میانگین با افزایش تعداد تکرارها به نسبت ۱/n کم می‌شود. جذر آن، عدم‌قطعیت استاندارد میانگین را می‌دهد.",
      en: "s is the sample standard deviation and n is the number of readings. For the mean of independent readings under the same conditions, the variance of the mean scales as 1/n. Its square root gives the standard uncertainty of the mean.",
      source: "https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-appendix-law-propagation-uncertainty",
      section: "NIST TN 1297 · A.4",
    },
    calculate: values => sampleDeviation(values) / Math.sqrt(values.length),
  },
  {
    name: "عدم‌قطعیت استاندارد ترکیبی",
    en: "Combined standard uncertainty",
    category: 2, unit: "",
    fields: uncertaintyFields, fieldsEn: uncertaintyFieldsEn,
    example: [0.03, 0.04, 0],
    formula: "u_c = √(u_rep² + u_cal² + u_other²)",
    explanation: {
      fa: "u_rep سهم تکرارپذیری، u_cal سهم کالیبراسیون و u_other سهم ترکیبی سایر مؤلفه‌هاست. طبق قانون انتشار عدم‌قطعیت، وقتی سهم‌ها مستقل‌اند، واریانس‌هایشان جمع می‌شود. جذر مجموع، u_c را در واحد نتیجه به دست می‌دهد.",
      en: "u_rep is the repeatability contribution, u_cal is the calibration contribution, and u_other combines the other contributions. The law of propagation adds their variances when the contributions are independent. The square root gives u_c in the result unit.",
      source: "https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-5-combined-standard-uncertainty",
      section: "NIST TN 1297 · §5",
    },
    calculate: combinedUncertainty,
    valid: values => values.every(value => value >= 0),
  },
  {
    name: "عدم‌قطعیت گسترده",
    en: "Expanded measurement uncertainty",
    category: 2, unit: "",
    fields: [...uncertaintyFields, "ضریب پوشش (k)"],
    fieldsEn: [...uncertaintyFieldsEn, "Coverage factor (k)"],
    example: [0.03, 0.04, 0, 2],
    formula: "U = k × √(u_rep² + u_cal² + u_other²)",
    explanation: {
      fa: "ابتدا u_c از ترکیب مؤلفه‌های استاندارد مستقل به دست می‌آید. با ضرب آن در ضریب پوشش k، عدم‌قطعیت گسترده U محاسبه می‌شود. نتیجهٔ اندازه‌گیری y را می‌توان به شکل y ± U همراه با k گزارش کرد. سطح پوشش به توزیع و درجات آزادی بستگی دارد.",
      en: "First combine the independent standard contributions to obtain u_c. Multiply by the coverage factor k to obtain expanded uncertainty U. Report the measurement as y ± U together with k. Coverage depends on the distribution and degrees of freedom.",
      source: "https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-6-expanded-uncertainty",
      section: "NIST TN 1297 · §6",
    },
    calculate: values => values[3] * combinedUncertainty(values),
    valid: values => values.slice(0, 3).every(value => value >= 0) && values[3] > 0,
  },
);

labTools.push({
  name: "بودجهٔ عدم‌قطعیت GC–FID با کالیبراسیون خارجی",
  en: "GC–FID external calibration uncertainty budget",
  category: 2,
  fields: [
    "غلظت گزارش‌شده", "عدم‌قطعیت نسبی استاندارد برازش (%)", "عدم‌قطعیت نسبی استاندارد مادهٔ مرجع و تهیهٔ استاندارد (%)",
    "عدم‌قطعیت نسبی استاندارد دقت روش (%)", "عدم‌قطعیت نسبی استاندارد آماده‌سازی نمونه (%)",
    "عدم‌قطعیت نسبی استاندارد بازیابی یا بایاس (%)", "ضریب پوشش (k)",
  ],
  fieldsEn: [
    "Reported concentration", "Relative standard uncertainty of calibration fit (%)", "Relative standard uncertainty of reference material and standard preparation (%)",
    "Relative standard uncertainty of method precision (%)", "Relative standard uncertainty of sample preparation (%)",
    "Relative standard uncertainty of recovery or bias (%)", "Coverage factor (k)",
  ],
  example: [100, 1, 0.5, 2, 0.5, 1, 2],
  formula: "C = [(A − b) / a] × F / R\nuᵣ = √(u_fit² + u_std² + u_prec² + u_prep² + u_rec²)\nU = k × |C| × uᵣ / 100",
  unit: "",
  calculate: ([c, fit, standard, precision, preparation, recovery, k]) =>
    k * Math.abs(c) * Math.hypot(fit, standard, precision, preparation, recovery) / 100,
  valid: ([c, ...components]) => c > 0 && components.slice(0, 5).every(value => value >= 0) && components[5] > 0,
  explanation: {
    fa: "در کالیبراسیون خارجی خطی، A مساحت پیک نمونه، a شیب و b عرض از مبدأ است. F ضریب تبدیل از محلول تزریقی به مبنای گزارش است. R کسر بازیابی است و تنها وقتی روش تصحیح بازیابی دارد در مخرج به کار می‌رود. غلظت C را طبق روش آزمون از قبل حساب کنید. منابع را از پراکندگی برازش و استاندارد مرجع، توزین و حجم‌سنجی، دقت بین‌روزی و تزریق، استخراج و رقیق‌سازی، و داده‌های بازیابی یا بایاس برآورد کنید. اثر هم‌پوشانی پیک، انتگرال‌گیری و رانش پاسخ را با داده‌های اعتبارسنجی بررسی کنید. فقط سهم‌های مستقل و بدون دوباره‌شماری را وارد کنید. اگر دقت کل روش اثری را پوشش داده است، آن اثر را دوباره اضافه نکنید. U در همان واحد غلظت گزارش‌شده است. این مدل نزدیک صفر یا با سهم‌های هم‌بسته به ارزیابی جداگانه نیاز دارد.",
    en: "For linear external calibration, A is sample peak area, a the slope and b the intercept. F converts the injected solution concentration to the reporting basis. Divide by recovery fraction R only when the method applies recovery correction. Enter C as calculated by the test method. Estimate contributions from fit residuals, reference standards, weighing and volumetry, intermediate precision and injection, extraction and dilution, and recovery or bias data. Evaluate coelution, integration, and drift with validation data. Combine only independent contributions without double counting effects already included in method precision. U uses the reported concentration unit. Near zero or with correlated contributions, evaluate a separate model.",
    source: "https://eurachem.org/index.php/publications/guides/quam",
    section: "Eurachem/CITAC QUAM",
  },
});

labTools.push({
  name: "بودجهٔ عمومی عدم‌قطعیت GUM",
  en: "General GUM uncertainty budget",
  category: 2,
  series: true,
  fields: ["سهم‌های استاندارد در واحد نتیجه"],
  fieldsEn: ["Standard contributions in the result unit"],
  example: [0.03, 0.04, 0.02],
  formula: "qᵢ = cᵢ × u(xᵢ)\nu_c(y) = √Σqᵢ²",
  unit: "",
  calculate: values => values.reduce((combined, contribution) => Math.hypot(combined, contribution), 0),
  explanation: {
    fa: "ابتدا معادلهٔ اندازه‌گیری آزمون را بنویسید. برای هر ورودی xᵢ، عدم‌قطعیت استاندارد u(xᵢ) را در ضریب حساسیت cᵢ ضرب کنید. ضریب حساسیت میزان تغییر نتیجه به ازای تغییر کوچک آن ورودی است. هر حاصل‌ضرب qᵢ را در یک سطر وارد کنید. ابزار مؤلفه‌های بدون هم‌بستگی را ترکیب می‌کند و u_c را در واحد نتیجه می‌دهد. مؤلفه‌های هم‌بسته به جمله‌های کوواریانس نیاز دارند.",
    en: "Start with the test's measurement equation. Multiply each input standard uncertainty u(xᵢ) by its sensitivity coefficient cᵢ, the local change in the result per unit input change. Enter one product qᵢ per line. The tool combines uncorrelated contributions and reports u_c in the result unit. Correlated inputs require covariance terms.",
    source: "https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-appendix-law-propagation-uncertainty",
    section: "NIST TN 1297 · A.3",
  },
});

const propagationReference = "https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-appendix-law-propagation-uncertainty";

labTools.push(
  {
    name: "عدم‌قطعیت توزین با ترازو",
    en: "Balance weighing uncertainty",
    category: 2, unit: "g",
    fields: ["پراکندگی توزین‌های تکراری (g)", "تعداد توزین‌های میانگین‌گرفته‌شده", "عدم‌قطعیت درج‌شده در گواهی ترازو (g)", "ضریب پوشش درج‌شده در گواهی", "کوچک‌ترین تغییر عدد نمایشگر (g)", "بیشترین تغییر ناشی از رانش (g)", "بیشترین تغییر ناشی از دما (g)", "ضریب پوشش گزارش نهایی"],
    fieldsEn: ["Repeat weighing standard deviation s (g)", "Independent readings averaged in result n", "Certificate expanded uncertainty Ucal (g)", "Certificate coverage factor kcal", "Display increment d (g)", "Drift half-width a (g)", "Temperature effect half-width b (g)", "Reporting coverage factor k"],
    example: [0.002, 1, 0.004, 2, 0.001, 0.001, 0.001, 2],
    fieldHints: {
      fa: ["نمونه را چند بار مستقل وزن کنید و انحراف معیار نمونه (s) را از ابزار RSD بردارید. خود درصد RSD را وارد نکنید.",
        "اگر عدد گزارش از یک توزین آمده، ۱ بزنید. اگر میانگین سه توزین است، ۳ بزنید.",
        "در گواهی کالیبراسیون، برای بار مربوط دنبال Expanded uncertainty یا U بگردید. اگر به mg است، بر ۱۰۰۰ تقسیم کنید.",
        "عدد k را از همان ردیف یا توضیح همان عدم‌قطعیت در گواهی بردارید.",
        "فاصلهٔ دو عدد متوالی نمایشگر. مثلاً بین ۵۰٫۰۰۰ و ۵۰٫۰۰۱ گرم، گام ۰٫۰۰۱ گرم است.",
        "از سوابق کنترل ترازو، حد تغییر را به گرم بردارید. برای بازهٔ ±۰٫۰۰۱ گرم، ۰٫۰۰۱ را وارد کنید.",
        "اثر تغییر دما بر خواندهٔ ترازو را از دادهٔ آزمایش یا مشخصات دستگاه به گرم برآورد کنید. خود دما را وارد نکنید.",
        "از روش اجرایی گزارش‌گیری بردارید. عدد ۲ در نمونه صرفاً مقدار نمونه است."],
      en: ["Use the sample standard deviation s from repeated independent weighings. Enter s, not RSD.",
        "Enter 1 for a single reported weighing or 3 if the result averages three weighings.",
        "Look for expanded uncertainty U at the relevant load on the certificate. Divide mg by 1000 to obtain g.",
        "Use the k associated with that uncertainty on the certificate.",
        "Use the spacing between consecutive display readings, such as 0.001 g.",
        "Use the drift half-width in grams from balance check records.",
        "Estimate the effect of temperature on the reading in grams from experimental or instrument data.",
        "Use the factor specified by your reporting procedure. The sample uses 2."],
    },
    formula: "u_rep = s / √n\nu_cal = Ucal / kcal\nu_res = d / √12\nu_drift = a / √3\nu_temp = b / √3\nu_c = √(u_rep² + u_cal² + u_res² + u_drift² + u_temp²)\nU = k × u_c",
    calculate: ([s, n, certificate, kc, d, drift, temp, k]) =>
      k * Math.hypot(s / Math.sqrt(n), certificate / kc, d / Math.sqrt(12), drift / Math.sqrt(3), temp / Math.sqrt(3)),
    valid: ([s, n, certificate, kc, d, drift, temp, k]) =>
      Number.isSafeInteger(n) && n >= 1 && kc > 0 && k > 0 && [s, certificate, d, drift, temp].every(value => value >= 0),
    explanation: {
      fa: "این الگو برای توزین مستقیم است. s را از داده‌های تکراری به دست آورید. n تعداد قرائت‌هایی است که واقعاً در نتیجه میانگین شده‌اند. برای نتیجهٔ تک‌قرائتی n برابر ۱ است. Ucal و kcal را از گواهی در بار مربوط بردارید. برای یک سهم مستقل گردکردن، خطا در بازهٔ ±d/2 یکنواخت فرض شده است. a و b نیم‌عرض بازه‌های یکنواخت رانش و اثر دما در واحد جرم‌اند. اگر سهمی در تکرارپذیری یا گواهی پوشش داده شده، آن را دوباره وارد نکنید. برای مؤلفهٔ پوشش‌داده‌شده یا نامرتبط صفر بگذارید. توزین تفاضلی به مدل قرائت‌های خودش نیاز دارد.",
      en: "This template models direct weighing. Obtain s from repeat readings and enter the number n actually averaged in the reported result, or 1 for a single reading. Take Ucal and kcal from the certificate at the relevant load. The single independent rounding contribution assumes a uniform ±d/2 interval. a and b are drift and temperature half-widths in mass units. Enter zero for irrelevant or already covered components to avoid double counting. Difference weighing requires its own reading model.",
      source: "https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-4-type-b-evaluation-standard-uncertainty",
      section: "NIST TN 1297 · §4",
    },
  },
  {
    name: "عدم‌قطعیت چگالی از جرم و حجم",
    en: "Density uncertainty from mass and volume",
    category: 2, unit: "g/mL",
    fields: ["جرم نمونه (g)", "حجم همان نمونه (mL)", "عدم‌قطعیت استاندارد جرم (g)", "عدم‌قطعیت استاندارد حجم (mL)", "ضریب پوشش گزارش نهایی"],
    fieldsEn: ["Mass m (g)", "Volume V (mL)", "Standard mass uncertainty u(m) (g)", "Standard volume uncertainty u(V) (mL)", "Coverage factor k"],
    example: [50, 50, 0.005, 0.02, 2],
    fieldHints: {
      fa: ["جرم خالص نمونه را از نتیجهٔ توزین بردارید.",
        "حجم اندازه‌گیری‌شدهٔ همان نمونه را وارد کنید.",
        "از بودجهٔ توزین، u(m) را بردارید. اگر فقط U و k دارید، U را بر k تقسیم کنید.",
        "از بودجهٔ حجم، u(V) را بردارید. اگر گواهی فقط U و k دارد، U/k فقط سهم کالیبراسیون ظرف است.",
        "ضریب پوشش را از روش اجرایی گزارش‌گیری بردارید."],
      en: ["Use the net mass from the weighing result.",
        "Enter the measured volume of that same sample.",
        "Use u(m) from the weighing budget. If you have U and k, divide U by k.",
        "Use u(V) from the volume budget. Certificate U/k represents the vessel calibration contribution.",
        "Use the coverage factor specified in the reporting procedure."],
    },
    formula: "ρ = m / V\nc_m = 1 / V\nc_V = −m / V²\nu(ρ) = √[(c_m × u(m))² + (c_V × u(V))²]\nU = k × u(ρ)",
    calculate: ([m, v, um, uv, k]) => k * Math.hypot(um / v, (m / v) * (uv / v)),
    valid: ([m, v, um, uv, k]) => m > 0 && v > 0 && um >= 0 && uv >= 0 && k > 0,
    explanation: {
      fa: "شاخهٔ جرم می‌تواند شامل تکرارپذیری، کالیبراسیون و تفکیک‌پذیری ترازو باشد. اگر از الگوی توزین استفاده می‌کنید، U آن را بر k همان بودجه تقسیم کنید تا u(m) به دست آید. شاخهٔ حجم می‌تواند شامل گواهی ظرف، تکرارپذیری خواندن یا پرکردن و اثر دما باشد. ضرایب حساسیت مشتق‌های ρ نسبت به جرم و حجم‌اند. این فرم انتشار مرتبهٔ اول را برای جرم و حجم بدون هم‌بستگی به کار می‌برد. اگر دما اثر مشترک معناداری دارد، آن را در مدل جداگانه لحاظ کنید.",
      en: "The mass branch can include repeatability, balance calibration and resolution. If using the balance template, divide its U by its k to obtain u(m). The volume branch can include vessel calibration, fill or reading repeatability and temperature. The sensitivities are derivatives of density with respect to mass and volume. The form uses first-order propagation for uncorrelated mass and volume. Model any significant common temperature effect separately.",
      source: propagationReference,
      section: "NIST TN 1297 · A.3",
    },
  },
);
