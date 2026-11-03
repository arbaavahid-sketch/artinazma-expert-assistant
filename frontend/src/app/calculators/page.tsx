"use client";

import { useState } from "react";
import { Activity, Calculator as CalculatorIcon, Check, Copy, Droplets, FlaskConical, Gauge, Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { labTools, linearFit, mean, sampleDeviation } from "./lab-tools";
import styles from "./hero.module.css";

const pressureUnits = { Pa: 1, kPa: 1000, MPa: 1000000, bar: 100000, atm: 101325, psi: 6894.757293168 };
type PressureUnit = keyof typeof pressureUnits;
const controls = "ui-input min-h-12 tabular-nums";
const categoryIcons = [Droplets, Gauge, Activity, FlaskConical];
const heroCalculations = ["Mean", "SD", "Dilution", "Molarity", "Recovery", "Density", "Reynolds", "Flow"];
const alternateUnits: Record<string, [string, number]> = {
  "mL": ["L", 1000], "mol/L": ["mmol/L", 0.001],
  "m³/h": ["L/min", 0.06], "L/min": ["m³/h", 1 / 0.06],
  "mm": ["m", 1000], "m": ["mm", 0.001],
};
const categoryColors = [
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
  "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
];

function parseNumber(value: string) {
  const normalized = value.trim()
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/٫/g, ".");
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized) ? Number(normalized) : NaN;
}

export default function CalculatorsPage() {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const [tool, setTool] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(-1);
  const categories = en ? ["Solutions", "Unit conversions", "Lab analysis", "Process engineering"] :
    ["محلول و غلظت", "تبدیل واحد", "تحلیل آزمایشگاه", "محاسبات فرایندی"];
  const catalog = [
    { name: "رقیق‌سازی محلول", en: "Solution dilution", category: 0, unit: "mL mol/L" },
    { name: "آماده‌سازی محلول مولار", en: "Molar solution preparation", category: 0, unit: "g mol/L" },
    { name: "تبدیل واحد فشار", en: "Pressure conversion", category: 1, unit: Object.keys(pressureUnits).join(" ") },
    ...labTools,
  ];
  const selected = catalog[tool];
  const visible = catalog.map((item, index) => ({ item, index })).filter(({ item }) =>
    (category === -1 || item.category === category) &&
    `${item.name} ${item.en} ${item.unit} ${"fields" in item ? item.fields.join(" ") : ""}`.toLowerCase()
      .replace(/‌/g, " ").includes(query.trim().toLowerCase().replace(/‌/g, " ")));

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-8">
      <header className="relative isolate grid items-center gap-4 overflow-hidden rounded-3xl bg-[#10244b] px-6 py-7 text-white sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:px-9">
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-linear-to-br from-[#14264c] via-[#173e82] to-[#07586f]" />

        <div className="min-w-0">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            <FlaskConical size={14} aria-hidden="true" />
            {en ? "Artin tool library" : "کتابخانهٔ ابزار آرتین"}
            <span className="size-1 rounded-full bg-cyan-200" aria-hidden="true" />
            {new Intl.NumberFormat(locale).format(catalog.length)} {en ? "tools" : "ابزار"}
          </span>
          <h1 className="text-2xl font-extrabold sm:text-4xl">{t("nav.calculators")}</h1>
          <p className="mt-2 text-sm leading-7 text-blue-100">
            {en ? "Calculators for laboratory work and process engineering"
              : "ابزارهای محاسبه برای آزمایشگاه و مهندسی فرایند"}
          </p>
        </div>
        <div aria-hidden="true" dir="ltr" className={styles.scene}>
          <div className={styles.core}><FlaskConical size={28} strokeWidth={1.6} /></div>
          {[heroCalculations, ["ppm", "RSD"]].map((labels, orbit) => (
            <div key={orbit} className={`${styles.orbit} ${orbit === 1 ? styles.inner : ""}`}>
              {labels.map((label, index) => (
                <span key={label} className={styles.position}
                  style={{ transform: `rotate(${index * 360 / labels.length}deg) translateX(var(--radius)) rotate(${-index * 360 / labels.length}deg)` }}>
                  <span className={styles.label}>{label}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="ui-card space-y-3 p-4">
        <h2 className="text-sm font-bold">{en ? "Tool library" : "فهرست ابزارها"}</h2>
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 opacity-60" aria-hidden="true" />
          <input type="search" className={`${controls} [padding-inline:2.35rem] [&::-webkit-search-cancel-button]:hidden`} value={query} onChange={event => setQuery(event.target.value)}
            aria-label={en ? "Find a calculator" : "جست‌وجوی ماشین‌حساب"}
            placeholder={en ? "Search, e.g. ppm" : "جست‌وجو، مثلاً ppm"} />
          {query && <button type="button" onClick={() => setQuery("")} aria-label={en ? "Clear search" : "پاک کردن جست‌وجو"}
            className="absolute end-1 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg hover:bg-[var(--surface-soft)]"><X size={16} aria-hidden="true" /></button>}
        </div>
        <select className={controls} value={category} onChange={event => setCategory(Number(event.target.value))}
          aria-label={en ? "Tool category" : "دستهٔ ابزار"}>
          <option value={-1}>{en ? "All categories" : "همهٔ دسته‌ها"}</option>
          {categories.map((label, index) => <option key={label} value={index}>{label}</option>)}
        </select>
        <div className="grid max-h-80 gap-2 overflow-y-auto pe-1 lg:max-h-[32rem]">
        {visible.map(({ item, index }) => {
          const Icon = categoryIcons[item.category];
          return (
            <button key={index} type="button" aria-pressed={tool === index} onClick={() => setTool(index)}
              className="flex min-h-14 cursor-pointer items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 text-start text-sm font-medium transition-colors hover:bg-[var(--surface-soft)] aria-pressed:border-[var(--color-info-border)] aria-pressed:bg-[var(--color-info-bg)] aria-pressed:text-[var(--color-info-text)]">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${categoryColors[item.category]}`}><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
              <span className="grow leading-6">{en ? item.en : item.name}</span>
              {tool === index && <Check size={15} className="shrink-0" aria-hidden="true" />}
            </button>
          );
        })}
        {visible.length === 0 && <p className="text-sm">{en ? "No matching tools." : "ابزاری با این عبارت پیدا نشد."}</p>}
        </div>
      </aside>
      <Calculator key={tool} tool={tool} title={en ? selected.en : selected.name} category={categories[selected.category]} en={en} />
      </div>
    </main>
  );
}

function Calculator({ tool, title, category, en }: { tool: number; title: string; category: string; en: boolean }) {
  const extra = labTools[tool - 3];
  const ppm = extra?.en === "Mass concentration in ppm";
  const [ppmFromMass, setPpmFromMass] = useState(true);
  const [sampleUnit, setSampleUnit] = useState("g");
  const [useAlternate, setUseAlternate] = useState<Record<number, boolean>>({});
  const massMode = ppm && ppmFromMass;
  const examples = massMode ? [5, sampleUnit === "g" ? 2000 : 2] :
    extra?.example ?? (tool === 2 ? [1.5] : tool === 0 ? [1, 0.1, 250] : [0.1, 250, 58.44]);
  const exampleText = extra?.pairs
    ? examples.map((value, index) => index % 2 === 0 ? `${value} ${examples[index + 1]}` : "").filter(Boolean).join("\n")
    : examples.join("\n");
  const [values, setValues] = useState(() => extra?.series ? [""] : examples.map(() => ""));
  const [from, setFrom] = useState<PressureUnit>("bar");
  const [to, setTo] = useState<PressureUnit>("kPa");
  const [submitted, setSubmitted] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [unknowns, setUnknowns] = useState("");
  const [pasteStandards, setPasteStandards] = useState(false);
  const standardRows = (values[0] || "\n\n").split("\n");
  function updateStandardRows(rows: string[]) {
    setValues([rows.join("\n")]);
    setSubmitted(false);
  }
  const pressure = tool === 2;
  const dilution = tool === 0;
  const labels = massMode ? (en ? ["Analyte mass (mg)", "Total sample mass"] : ["جرم ماده (mg)", "جرم کل نمونه"])
    : extra ? (en ? extra.fieldsEn : extra.fields) : pressure ? [en ? "Pressure" : "فشار"] : dilution
    ? en ? ["Stock concentration (mol/L)", "Target concentration (mol/L)", "Final volume (mL)"]
      : ["غلظت محلول مادر (mol/L)", "غلظت هدف (mol/L)", "حجم نهایی (mL)"]
    : en ? ["Target molarity (mol/L)", "Final volume (mL)", "Molar mass (g/mol)"]
      : ["مولاریتهٔ هدف (mol/L)", "حجم نهایی (mL)", "جرم مولی (g/mol)"];
  const units = labels.map(label => {
    const base = label.match(/\(([^()]+)\)$/)?.[1];
    return base && alternateUnits[base] ? { base, alternate: alternateUnits[base] } : null;
  });
  const rawNumbers = (extra?.series ? values[0].trim().split(/\s+/) : values.slice(0, labels.length)).map(parseNumber);
  const numbers = rawNumbers.map((value, index) => value * (useAlternate[index] ? units[index]?.alternate[1] ?? 1 : 1));
  const [a, b, c] = numbers;
  const sampleKg = sampleUnit === "g" ? b / 1000 : b;
  const result = massMode ? a / sampleKg : extra ? extra.calculate(numbers) : pressure ? a * (pressureUnits[from] / pressureUnits[to]) : dilution ? (b / a) * c : a * (b / 1000) * c;
  const invalidPairRow = extra?.pairs ? values[0].trim().split(/\r?\n/).findIndex(line => {
    const pair = line.trim().split(/\s+/).map(parseNumber);
    return pair.length !== 2 || pair.some(value => !Number.isFinite(value));
  }) : -1;
  const invalid = (extra?.series && numbers.length < 2) ||
    numbers.some(number => !Number.isFinite(number) || (!extra && !pressure && number <= 0)) ||
    (extra?.valid !== undefined && !extra.valid(numbers));
  const ppmFieldErrors = ppm ? [
    !Number.isFinite(a) || a < 0 ? (en ? "Enter a non-negative value." : "عدد صفر یا بزرگ‌تر وارد کنید.") :
      massMode && sampleKg > 0 && result > 1e6 ? (en ? "Analyte mass cannot exceed the sample mass." : "جرم ماده نمی‌تواند از جرم کل نمونه بیشتر باشد.") : "",
    !Number.isFinite(b) || b <= 0 ? (en ? "Enter a value greater than zero." : "عددی بزرگ‌تر از صفر وارد کنید.") : "",
  ] : [];
  const error = ppmFieldErrors.find(Boolean) || (invalidPairRow >= 0 ? (en
    ? `Line ${invalidPairRow + 1} must contain two numbers: concentration and instrument response, separated by whitespace.`
    : `در سطر ${(invalidPairRow + 1).toLocaleString("fa")} دو عدد وارد کنید. اول غلظت، بعد پاسخ دستگاه، با فاصله بین آن‌ها.`)
    : extra?.pairs && numbers.length < 6 ? (en ? "Enter at least three calibration pairs." : "حداقل سه جفت غلظت و پاسخ دستگاه وارد کنید.")
    : invalid ? (en ? "Check the input values and their permitted ranges." : "مقادیر ورودی و محدودهٔ مجاز آن‌ها را بررسی کنید.")
    : dilution && b > a ? (en ? "The target concentration cannot exceed the stock concentration." : "غلظت هدف برای رقیق‌سازی نمی‌تواند بیشتر از غلظت محلول مادر باشد.")
    : !Number.isFinite(result) || (!extra && !pressure && result === 0) ? (en ? "The result is outside the supported numeric range." : "نتیجه خارج از محدودهٔ عددی قابل محاسبه است.")
    : "");
  const format = (number: number) => new Intl.NumberFormat(en ? "en" : "fa", {
    maximumSignificantDigits: 8,
    notation: number !== 0 && (Math.abs(number) < 0.0001 || Math.abs(number) >= 1e9) ? "scientific" : "standard",
  }).format(number);
  const formula = massMode ? "C (ppm w/w) = m (mg) / mₛ (kg)" : extra?.formula ?? (pressure ? "P₂ = P₁ × (Pa per source unit / Pa per target unit)"
    : dilution ? "V₁ = C₂ × V₂ / C₁" : "m = C × (V / 1000) × M");
  const substitution = ppm ? `${a} / ${massMode && sampleUnit === "g" ? `(${b} / 1000)` : b}` : extra ? "" : pressure ? `${a} × (${pressureUnits[from]} / ${pressureUnits[to]})`
    : dilution ? `${b} × ${c} / ${a}` : `${a} × (${b} / 1000) × ${c}`;
  const fit = extra?.pairs && submitted && !error ? linearFit(numbers) : null;
  const stats = extra?.series && !extra.pairs && submitted && !error
    ? { average: mean(numbers), deviation: sampleDeviation(numbers) } : null;
  const standardX = fit ? numbers.filter((_, index) => index % 2 === 0) : [];
  const samples = fit && unknowns.trim() ? unknowns.trim().split(/\r?\n/).filter(line => line.trim()).map(line => {
    const [response, factor = 1, ...rest] = line.trim().split(/\s+/).map(parseNumber);
    const concentration = (response - fit.intercept) / fit.slope;
    const corrected = concentration * factor;
    const valid = rest.length === 0 && factor >= 1 && Number.isFinite(factor) && Number.isFinite(corrected);
    return { response, factor, concentration, corrected, valid,
      extrapolated: !standardX.some(x => x <= concentration) || !standardX.some(x => x >= concentration) };
  }) : [];
  const output = fit
    ? `a = ${format(fit.slope)} · b = ${format(fit.intercept)} · R² = ${Number.isFinite(fit.r2) ? format(fit.r2) : "—"}`
    : `${format(result)} ${extra?.unit ?? (pressure ? to : dilution ? "mL" : "g")}`.trim();
  const conversions = units.flatMap((unit, index) => unit && useAlternate[index]
    ? [`${format(rawNumbers[index])} ${unit.alternate[0]} = ${format(numbers[index])} ${unit.base}`] : []);
  const statsText = stats ? [
    `${en ? "Mean" : "میانگین"} = ${format(stats.average)}`,
    `${en ? "Sample SD" : "انحراف معیار نمونه"} = ${format(stats.deviation)}`,
    `RSD = ${stats.average === 0 ? "—" : `${format(100 * stats.deviation / Math.abs(stats.average))}%`}`,
  ] : [];
  const calculation = stats ? statsText.join("\n") : substitution ? `${substitution} ≈ ${output}` : output;

  return (
    <form className="ui-card space-y-5 p-5 sm:p-7"
      onSubmit={event => { event.preventDefault(); setSubmitted(true); setCopyStatus(""); }}>
      <div className="border-b border-[var(--border-soft)] pb-4">
        <span className="mb-2 inline-flex rounded-full bg-[var(--color-info-bg)] px-3 py-1 text-xs font-semibold text-[var(--color-info-text)]">{category}</span>
        <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {en ? "Enter the values below to see the result and calculation."
            : "مقادیر را وارد کنید تا نتیجه و نحوهٔ محاسبه را ببینید."}
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
      {ppm && <label className="block space-y-2 text-sm font-semibold">
        <span>{en ? "What data do you have?" : "چه داده‌ای دارید؟"}</span>
        <select className={controls} value={ppmFromMass ? "mass" : "volume"} onChange={event => {
          setPpmFromMass(event.target.value === "mass");
          setValues(["", ""]);
          setSubmitted(false);
        }}>
          <option value="mass">{en ? "Analyte mass and total sample mass" : "جرم ماده و جرم کل نمونه"}</option>
          <option value="volume">{en ? "Concentration in mg/L" : "غلظت بر حسب mg/L"}</option>
        </select>
      </label>}
      <div className={extra?.pairs ? "space-y-4" : "space-y-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 sm:p-4"}>
      {!extra?.pairs && <h3 className="text-sm font-bold">{en ? "Input values" : "داده‌های ورودی"}</h3>}
      <div className={pressure || extra?.series ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
      {extra?.pairs && !pasteStandards ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-4">
            <h3 className="text-sm font-bold">{en ? "Calibration standards" : "استانداردهای کالیبراسیون"}</h3>
            <button type="button" className="min-h-9 rounded-lg border border-[var(--border-soft)] px-2.5 text-xs font-semibold hover:bg-[var(--surface-soft)]"
              onClick={() => setPasteStandards(true)}>{en ? "Paste from Excel" : "چسباندن از اکسل"}</button>
          </div>
          <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-2 border-y border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-3 text-xs font-semibold sm:px-4">
            <span className="text-center">#</span><span>{en ? "Concentration" : "غلظت استاندارد"}</span><span>{en ? "Instrument response" : "پاسخ دستگاه"}</span>
            {standardRows.map((row, rowIndex) => {
              const cells = row.split(/\s/);
              return (
                <div key={rowIndex} className="contents">
                  <span className="text-center tabular-nums opacity-65">{format(rowIndex + 1)}</span>
                  {[0, 1].map(column => (
                    <input key={column} dir="ltr" inputMode="decimal" className="ui-input h-10 min-w-0 text-center tabular-nums [padding:0.25rem]"
                      aria-label={`${column === 0 ? (en ? "Concentration" : "غلظت") : (en ? "Response" : "پاسخ دستگاه")} ${format(rowIndex + 1)}`}
                      value={cells[column] ?? ""} onChange={event => {
                        const pair = [cells[0] ?? "", cells[1] ?? ""];
                        pair[column] = event.target.value.trim();
                        updateStandardRows(standardRows.map((value, index) => index === rowIndex ? pair.join(" ") : value));
                      }} />
                  ))}
                </div>
              );
            })}
          </div>
          <button type="button" className="m-2 min-h-9 rounded-lg px-2.5 text-xs font-semibold text-[var(--color-info-text)] hover:bg-[var(--color-info-bg)]"
            onClick={() => updateStandardRows([...standardRows, ""])}>{en ? "+ Add standard" : "+ افزودن استاندارد"}</button>
        </div>
      ) : labels.map((label, index) => (
        <label key={index} className="block space-y-1">
          <span className="block text-sm font-semibold">{units[index] ? label.replace(/\s*\([^()]+\)$/, "") : label}</span>
          {extra?.series && !extra.pairs && <span className="block text-xs leading-6 opacity-75">
            {en ? "Paste a single Excel column here. Keep all values in the same unit." : "یک ستون عددی را از اکسل بچسبانید. همهٔ مقادیر باید در یک واحد باشند."}
          </span>}
          {extra?.series ? (
            <textarea dir="ltr" rows={4} className={`${controls} resize-y font-mono`} value={values[0]}
                placeholder={exampleText} onChange={event => {
                setValues([event.target.value]);
                setSubmitted(false);
              }} />
          ) : (
          <input dir="ltr" inputMode={pressure ? "text" : "decimal"} className={controls} value={values[index]}
            aria-invalid={submitted && Boolean(ppmFieldErrors[index])}
            placeholder={`${en ? "e.g." : "مثلاً"} ${format(examples[index] / (useAlternate[index] ? units[index]?.alternate[1] ?? 1 : 1))}`}
            onChange={event => {
              setValues(values.map((value, position) => position === index ? event.target.value : value));
              setSubmitted(false);
            }} />
          )}
          {ppm && index === 1 && !massMode && <span className="block text-xs opacity-75">
            {en ? "Density converts solution volume to mass." : "چگالی برای تبدیل حجم محلول به جرم لازم است."}
          </span>}
          {submitted && ppmFieldErrors[index] && <span role="alert" className="block text-xs text-[var(--color-danger-text)]">{ppmFieldErrors[index]}</span>}
        </label>
      ))}
      {massMode && <label className="block space-y-1 text-sm font-semibold">
        <span>{en ? "Sample mass unit" : "واحد جرم نمونه"}</span>
        <select dir="ltr" className={controls} value={sampleUnit} onChange={event => {
          setSampleUnit(event.target.value);
          setSubmitted(false);
        }}><option>g</option><option>kg</option></select>
      </label>}
      </div>
      {extra?.pairs && pasteStandards && <button type="button" className="min-h-9 rounded-lg border border-[var(--border-soft)] px-3 text-xs font-semibold text-[var(--color-info-text)]"
        onClick={() => {
          if (pasteStandards) updateStandardRows(values[0].trim().split(/\r?\n/).map(line => line.trim().split(/\s+/).join(" ")));
          setPasteStandards(!pasteStandards);
        }}>{pasteStandards ? (en ? "Show input table" : "نمایش جدول ورودی") : (en ? "Paste from Excel" : "چسباندن از اکسل")}</button>}
      </div>
      {extra?.pairs && (
        <label className="block space-y-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 sm:p-4">
          <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
            {en ? "Unknown samples" : "نمونه‌های مجهول"}
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-0.5 text-xs font-medium">{en ? "Optional" : "اختیاری"}</span>
          </span>
          <span className="block text-xs leading-6 opacity-75">{en
            ? "One sample per line. Paste the response and optional dilution factor from two Excel columns. Default factor: 1."
            : "هر سطر یک نمونه. پاسخ دستگاه و ضریب رقیق‌سازی اختیاری را از دو ستون اکسل بچسبانید. ضریب پیش‌فرض ۱ است."}</span>
          <textarea dir="ltr" rows={3} className={`${controls} resize-y font-mono`} value={unknowns}
            placeholder={"0.17\t1\n0.25\t5"} onChange={event => {
              setUnknowns(event.target.value);
              setSubmitted(false);
            }} />
        </label>
      )}
      {pressure && (
        <div className="grid grid-cols-2 gap-3">
          {([from, to] as const).map((unit, index) => (
            <label key={index} className="space-y-1">
              <span>{index === 0 ? (en ? "From unit" : "واحد مبدأ") : (en ? "To unit" : "واحد مقصد")}</span>
              <select dir="ltr" className={controls} value={unit} onChange={event => {
                (index === 0 ? setFrom : setTo)(event.target.value as PressureUnit);
                setSubmitted(false);
              }}>
                {Object.keys(pressureUnits).map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      {units.some(Boolean) && <div className="grid gap-3 sm:grid-cols-2">
        {units.map((unit, index) => unit && <label key={index} className="block space-y-1 text-xs font-semibold">
          <span>{en ? "Unit" : "واحد"} · {labels[index].replace(/\s*\([^()]+\)$/, "")}</span>
          <select dir="ltr" className={controls} value={useAlternate[index] ? unit.alternate[0] : unit.base} onChange={event => {
            setUseAlternate(previous => ({ ...previous, [index]: event.target.value !== unit.base }));
            setSubmitted(false);
          }}><option>{unit.base}</option><option>{unit.alternate[0]}</option></select>
        </label>)}
      </div>}
      <div className="flex flex-wrap gap-2">
      <button type="submit" className="inline-flex min-h-12 grow cursor-pointer items-center justify-center gap-2 rounded-xl bg-[image:var(--brand-gradient)] px-5 font-semibold text-white hover:bg-[image:var(--brand-gradient-hover)] sm:grow-0">
        <CalculatorIcon size={18} aria-hidden="true" />
        {en ? "Calculate" : "محاسبه"}
      </button>
      <button type="button" className="min-h-12 cursor-pointer rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 text-sm font-medium"
        onClick={() => { setUseAlternate({}); setValues(extra?.series ? [exampleText] : examples.map(String)); setSubmitted(false); }}>
        {en ? "Load example" : "بارگذاری نمونه"}
      </button>
      </div>
      {submitted && error && !ppmFieldErrors.some(Boolean) && <p role="alert" className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-3 text-sm text-[var(--color-danger-text)]">{error}</p>}
      </div>
      <section className="min-w-0 space-y-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-bold">
          <CalculatorIcon size={17} className="text-[var(--color-info-text)]" aria-hidden="true" />
          {en ? "Calculation output" : "خروجی محاسبه"}
        </div>
        {submitted && !error ? (
        <div className="space-y-3 rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-4">
          <h3 className="font-semibold">{extra ? (en ? "Result" : "نتیجه") : pressure ? (en ? "Converted pressure" : "فشار تبدیل‌شده")
            : dilution ? (en ? "Stock solution volume" : "حجم محلول مادر") : (en ? "Required solute mass" : "جرم مادهٔ حل‌شونده")}</h3>
          {stats ? <ul className="space-y-2 text-sm font-bold text-[var(--color-success-text)]">
            {statsText.map(line => <li key={line}><bdi>{line}</bdi></li>)}
          </ul> : <p className={`${fit ? "text-base" : "text-3xl"} font-bold tabular-nums text-[var(--color-success-text)]`}><bdi dir="ltr">{output}</bdi></p>}
          {stats?.average === 0 && <p className="text-xs">{en ? "RSD is undefined when the mean is zero." : "وقتی میانگین صفر است، RSD تعریف نمی‌شود."}</p>}
          {conversions.length > 0 && <ul dir="ltr" className="space-y-1 text-xs">{conversions.map(line => <li key={line}>{line}</li>)}</ul>}
          {fit && <CalibrationPlot values={numbers} slope={fit.slope} intercept={fit.intercept}
            unknowns={samples.filter(sample => sample.valid && !sample.extrapolated).map(sample => [sample.concentration, sample.response])} en={en} />}
          {fit?.slope === 0 && <p className="text-sm">{en ? "A zero slope cannot be used to estimate unknown concentrations." : "با شیب صفر نمی‌توان غلظت نمونهٔ مجهول را برآورد کرد."}</p>}
          {samples.length > 0 && (
            <div className="overflow-x-auto rounded-lg bg-[var(--surface)]">
              <table className="w-full text-start text-xs">
                <thead><tr className="border-b border-[var(--border-soft)]">
                  {(en ? ["Sample", "Response", "Dilution", "Measured concentration", "Original concentration", "Status"] :
                    ["نمونه", "پاسخ", "ضریب", "غلظت اندازه‌گیری", "غلظت اولیه", "وضعیت"]).map(label => <th key={label} className="p-2 text-start">{label}</th>)}
                </tr></thead>
                <tbody>{samples.map((sample, index) => (
                  <tr key={index} className="border-b border-[var(--border-soft)]">
                    <td className="p-2">{format(index + 1)}</td>
                    {[sample.response, sample.factor, sample.concentration, sample.corrected].map((value, column) =>
                      <td className="p-2 tabular-nums" key={column}><bdi>{sample.valid ? format(value) : "—"}</bdi></td>)}
                    <td className="p-2">{!sample.valid ? (en ? "Invalid" : "نامعتبر") : sample.extrapolated
                      ? (en ? "Extrapolation" : "برون‌یابی") : (en ? "In range" : "در بازه")}</td>
                  </tr>
                ))}</tbody>
              </table>
              <p className="p-2 text-xs opacity-75">{en ? "Concentrations use the same unit as your standards." : "واحد غلظت‌ها همان واحد استانداردهاست."}</p>
            </div>
          )}
          {substitution && <p dir="ltr" className="break-words font-mono text-sm leading-6">{calculation}</p>}
          {dilution && <p>{en ? "Use this volume of stock solution and bring it to the final volume with solvent."
            : "این حجم از محلول مادر را بردارید و با حلال به حجم نهایی برسانید."}</p>}
          {!extra && !dilution && !pressure && <p>{en ? "Calculated for pure solute. Use the molar mass of the chemical form being weighed."
            : "محاسبه برای مادهٔ خالص است. جرم مولی را بر اساس شکل شیمیایی ماده‌ای که توزین می‌کنید وارد کنید."}</p>}
          <button type="button" className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 text-sm font-medium" onClick={async () => {
            try {
              const rows = samples.map((sample, index) => sample.valid
                ? [index + 1, sample.response, sample.factor, sample.concentration, sample.corrected, sample.extrapolated ? "Extrapolation" : "In range"].join("\t")
                : [index + 1, "", "", "", "", "Invalid"].join("\t"));
              const table = rows.length ? "\nSample\tResponse\tDilution\tMeasured concentration\tOriginal concentration\tStatus\n" + rows.join("\n") : "";
              await navigator.clipboard.writeText([title, formula, ...conversions, calculation + table].join("\n"));
              setCopyStatus(en ? "Copied" : "کپی شد");
            } catch {
              setCopyStatus(en ? "Select the result to copy it manually." : "نتیجه را انتخاب و دستی کپی کنید.");
            }
          }}><Copy size={15} aria-hidden="true" />{en ? "Copy result" : "کپی نتیجه"}</button>
          {copyStatus && <p role="status">{copyStatus}</p>}
        </div>
        ) : <p className="rounded-xl border border-dashed border-[var(--border-soft)] p-4 text-sm leading-6 opacity-75">
          {en ? "Enter values and select Calculate to see the result here." : "بعد از وارد کردن داده‌ها، «محاسبه» را بزنید تا نتیجه اینجا نمایش داده شود."}
        </p>}
        <div className="space-y-2 border-t border-[var(--border-soft)] pt-3">
          <h3 className="text-xs font-semibold opacity-75">{en ? "Formula" : "فرمول محاسبه"}</h3>
          <p dir="ltr" className="break-words whitespace-pre-line rounded-lg bg-[var(--surface)] p-3 font-mono text-sm leading-6">{formula}</p>
        </div>
      </section>
      </div>
    </form>
  );
}

function CalibrationPlot({ values, slope, intercept, unknowns, en }: {
  values: number[]; slope: number; intercept: number; unknowns: number[][]; en: boolean;
}) {
  const points = Array.from({ length: values.length / 2 }, (_, i) => [values[2 * i], values[2 * i + 1]]);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const start = slope * minX + intercept;
  const end = slope * maxX + intercept;
  const minY = Math.min(start, end, ...ys);
  const maxY = Math.max(start, end, ...ys);
  const xAt = (x: number) => 35 + 245 * (x - minX) / (maxX - minX);
  const yAt = (y: number) => maxY === minY ? 70 : 125 - 110 * (y - minY) / (maxY - minY);
  return (
    <figure className="rounded-lg bg-[var(--surface)] p-2">
      <svg viewBox="0 0 300 150" role="img" aria-label={en ? "Calibration points and fitted line" : "نقاط کالیبراسیون و خط برازش"}>
        <path d="M35 15V125H280" fill="none" stroke="currentColor" opacity=".45" />
        <line x1={35} x2={280} y1={yAt(start)} y2={yAt(end)} stroke="var(--color-info-text)" strokeWidth={2} />
        {points.map(([x, y], i) => <circle key={i} cx={xAt(x)} cy={yAt(y)} r={4} fill="var(--color-success-text)"><title>{x}, {y}</title></circle>)}
        {unknowns.map(([x, y], i) => <rect key={i} x={xAt(x) - 3} y={yAt(y) - 3} width={6} height={6} fill="var(--color-info-text)"><title>{x}, {y}</title></rect>)}
        <text x={155} y={145} fill="currentColor" fontSize={10} textAnchor="middle">{en ? "Concentration" : "غلظت"}</text>
        <text transform="translate(12 70) rotate(-90)" fill="currentColor" fontSize={10} textAnchor="middle">{en ? "Response" : "پاسخ دستگاه"}</text>
      </svg>
      <figcaption className="flex flex-wrap gap-3 px-2 text-xs">
        <span className="text-[var(--color-success-text)]">● {en ? "Standards" : "استانداردها"}</span>
        <span className="text-[var(--color-info-text)]">■ {en ? "In-range samples" : "نمونه‌های داخل بازه"}</span>
      </figcaption>
    </figure>
  );
}
