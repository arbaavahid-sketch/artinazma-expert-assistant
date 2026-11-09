import { extendedModels } from "./extended-models";
import { supplementaryModels } from "./supplementary-models";
import { scientificModels } from "./scientific-models";
export type FamilyModel = {
  fa: string; en: string; formula: string; unit: string;
  inputs: { fa: string; en: string; unit: string;help?:{fa:string;en:string} }[];
  explanation?: string|{fa:string;en:string};
  sourceEdition?:string;
  reference?: string;
  example?: number[];
  evaluate: (x: number[]) => { value: number; sensitivities: number[]; valid: boolean };
};
export const familyModels: Record<string, FamilyModel> = {
  ...scientificModels,
  ...extendedModels,
  ...supplementaryModels,
  volumetricTitration: {
    example: [10, 1, .1, 1, 25],
    explanation: "مقدار تیترانت پس از کسر بلانک از حجم و غلظت به دست می‌آید. ضریب z نسبت مول آنالیت به مول تیترانت است، نه لزوماً ظرفیت اسیدی/قلیایی. آن را از واکنش موازنه‌شده بردارید. غلظت تیترانت از استانداردسازی و حجم‌ها از بورت و پیپت به دست می‌آیند.",
    fa: "تیتراسیون حجمی با بلانک", en: "Blank-corrected volumetric titration", formula: "C = (Vt − Vb) × Ct × z / Vs", unit: "mol/L",
    inputs: [{ fa: "حجم تیترانت Vt", en: "Titrant volume Vt", unit: "mL" }, { fa: "حجم بلانک Vb", en: "Blank volume Vb", unit: "mL" },
      { fa: "غلظت تیترانت Ct", en: "Titrant concentration Ct", unit: "mol/L" }, { fa: "ضریب استوکیومتری z", en: "Stoichiometric factor z", unit: "1" },
      { fa: "حجم نمونه Vs", en: "Sample volume Vs", unit: "mL" }],
    evaluate: ([t, b, c, z, s]) => ({ value: (t - b) * c * z / s,
      sensitivities: [c * z / s, -c * z / s, (t - b) * z / s, (t - b) * c / s, -(t - b) * c * z / s ** 2],
      valid: t >= 0 && b >= 0 && c > 0 && z > 0 && s > 0 }),
  },
  relativeDensity: {
    example: [850, 998.2],
    explanation: "نسبت چگالی نمونه در دمای Ts به چگالی مرجع در دمای Tr است. هر دو چگالی باید واحد یکسان داشته باشند. دماهای Ts و Tr را در شناسهٔ روش یا منبع داده ثبت کنید؛ این مدل تبدیل دما انجام نمی‌دهد.",
    fa: "چگالی نسبی از چگالی نمونه و مرجع", en: "Relative density from sample and reference densities", formula: "d = ρ_sample(Ts) / ρ_reference(Tr)", unit: "1",
    inputs: [{ fa: "چگالی نمونه در دمای تعریف‌شده", en: "Sample density at its stated temperature", unit: "kg/m³" },
      { fa: "چگالی مرجع در دمای مرجع تعریف‌شده", en: "Reference density at its stated reference temperature", unit: "kg/m³" }],
    evaluate: ([a, b]) => ({ value: a / b, sensitivities: [1 / b, -a / b ** 2], valid: a > 0 && b > 0 }),
  },
  kinematicFromDynamic: {
    example: [8.5, 850],
    explanation: "از رابطهٔ ν=η/ρ و تبدیل واحدها به mm²/s به دست می‌آید. دو ورودی باید در دمای یکسان باشند. گواهی دستگاه، عدم‌قطعیت دما و هم‌بستگی ناشی از اندازه‌گیری مشترک را بررسی کنید.",
    fa: "گرانروی کینماتیکی از دینامیکی و چگالی", en: "Kinematic viscosity from dynamic viscosity and density", formula: "ν = 1000 × η / ρ", unit: "mm²/s",
    inputs: [{ fa: "گرانروی دینامیکی", en: "Dynamic viscosity", unit: "mPa·s" },
      { fa: "چگالی در همان دما", en: "Density at the same temperature", unit: "kg/m³" }],
    evaluate: ([eta, rho]) => ({ value: 1000 * eta / rho, sensitivities: [1000 / rho, -1000 * eta / rho ** 2], valid: eta > 0 && rho > 0 }),
  },
  viscosity: {
    example: [.1, 100],
    explanation: "در محدوده‌ای که روش و گواهی ویسکومتر رابطهٔ ν=Ct را مجاز می‌دانند، ثابت کالیبراسیون در زمان عبور ضرب می‌شود. تصحیح انرژی جنبشی، دمای حمام و جریان نامناسب ممکن است به مدل کامل‌تری نیاز داشته باشند. این رابطه برای HTHS مناسب نیست.",
    fa: "گرانروی کینماتیکی از ثابت و زمان", en: "Kinematic viscosity from constant and time", formula: "ν = C × t", unit: "mm²/s",
    inputs: [{ fa: "ثابت ویسکومتر C", en: "Viscometer constant C", unit: "mm²/s²" }, { fa: "زمان جریان t", en: "Flow time t", unit: "s" }],
    evaluate: ([c, t]) => ({ value: c * t, sensitivities: [t, c], valid: c > 0 && t > 0 }),
  },
  residue: {
    example: [.2, 10],
    explanation: "جرم خالص باقیمانده بر جرم نمونه تقسیم و به درصد تبدیل می‌شود. جرم خالص را پس از کسر ظرف و بلانک وارد کنید. کالیبراسیون ترازو، هم‌بستگی توزین‌ها، انتقال، خشک‌کردن و تکرارپذیری باید در عدم‌قطعیت ورودی‌ها پوشش داده شوند.",
    fa: "درصد جرمی باقیمانده", en: "Residue mass percentage", formula: "w = 100 × m_res / m_sample", unit: "% mass",
    inputs: [{ fa: "جرم خالص باقیمانده", en: "Net residue mass", unit: "g" }, { fa: "جرم نمونه", en: "Sample mass", unit: "g" }],
    evaluate: ([r, m]) => ({ value: 100 * r / m, sensitivities: [100 / m, -100 * r / m ** 2], valid: m > 0 && r >= 0 && r <= m }),
  },
  loss: {
    example: [10, 9],
    explanation: "اختلاف جرم اولیه و نهایی بر جرم اولیه تقسیم می‌شود. ظرف باید از هر دو جرم کسر شده باشد. چون جرم اولیه در صورت و مخرج مشترک است، ضریب حساسیت آن از مشتق رابطه محاسبه می‌شود؛ دو ورودی مستقل با نام جرم اولیه نسازید.",
    fa: "درصد افت جرم", en: "Mass loss percentage", formula: "w = 100 × (m_initial − m_final) / m_initial", unit: "% mass",
    inputs: [{ fa: "جرم اولیه", en: "Initial mass", unit: "g" }, { fa: "جرم نهایی", en: "Final mass", unit: "g" }],
    evaluate: ([a, b]) => ({ value: 100 * (a - b) / a, sensitivities: [100 * b / a ** 2, -100 / a], valid: a > 0 && b >= 0 && b <= a }),
  },
  corrected: {
    example: [25, -.2],
    explanation: "تصحیح با علامت به قرائت اضافه می‌شود. اگر گواهی فقط خطای دستگاه E را نوشته باشد، تصحیح معمولاً −E است؛ تعریف گواهی را بررسی کنید. مقدار تصحیح، عدم‌قطعیت تصحیح نیست. واحد نتیجه را مطابق دستگاه تعیین کنید و سهم دقت، رانش و محیط را دوباره نشمارید.",
    fa: "قرائت تصحیح‌شده", en: "Corrected reading", formula: "y = I + correction", unit: "",
    inputs: [{ fa: "قرائت دستگاه", en: "Instrument reading", unit: "" }, { fa: "تصحیح با علامت", en: "Signed correction", unit: "" }],
    evaluate: ([a, b]) => ({ value: a + b, sensitivities: [1, 1], valid: true }),
  },
  diluted: {
    example: [5, 1, 10],
    explanation: "ابتدا بلانک در همان واحد و مبنای غلظت از قرائت کسر می‌شود، سپس ضریب رقیق‌سازی اعمال می‌شود. D نسبت حجم نهایی به حجم برداشت است. اگر دستگاه بلانک یا رقیق‌سازی را قبلاً اعمال کرده، دوباره اعمال نکنید. بازیابی و اثر ماتریس در این رابطهٔ پایه نیستند.",
    fa: "غلظت پس از کسر بلانک و رقیق‌سازی", en: "Blank-corrected diluted concentration", formula: "C = (C_read − C_blank) × D", unit: "",
    inputs: [{ fa: "غلظت خوانده‌شده", en: "Read concentration", unit: "" }, { fa: "غلظت بلانک در همان واحد", en: "Blank in the same unit", unit: "" }, { fa: "ضریب رقیق‌سازی", en: "Dilution factor", unit: "1" }],
    evaluate: ([a, b, d]) => ({ value: (a - b) * d, sensitivities: [d, -d, a - b], valid: d >= 1 }),
  },
  dynamic: {
    example: [10, 850],
    explanation: "رابطهٔ η=νρ پس از تبدیل واحدها به mPa·s است. چگالی و گرانروی کینماتیکی باید در دمای یکسان باشند. این تبدیل، روش اندازه‌گیری مستقیم گرانروی در نرخ برش مشخص را جایگزین نمی‌کند.",
    fa: "گرانروی دینامیکی از چگالی و گرانروی کینماتیکی", en: "Dynamic viscosity from density and kinematic viscosity", formula: "η = ν × ρ / 1000", unit: "mPa·s",
    inputs: [{ fa: "گرانروی کینماتیکی", en: "Kinematic viscosity", unit: "mm²/s" }, { fa: "چگالی در همان دما", en: "Density at the same temperature", unit: "kg/m³" }],
    evaluate: ([nu, rho]) => ({ value: nu * rho / 1000, sensitivities: [rho / 1000, nu / 1000], valid: nu > 0 && rho > 0 }),
  },
};
