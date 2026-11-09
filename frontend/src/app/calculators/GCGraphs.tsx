"use client";

import { useState } from "react";
import { linearFit } from "./lab-tools";
import type { GCGraphData } from "./gum-project";

function normalizeNumbers(text: string) {
  return text.replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/٫/g, ".").replace(/−/g, "-");
}

function parsePairs(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(line => line.trim());
  const points = lines.map(line => normalizeNumbers(line.trim()).split(/[\t,; ]+/).map(value =>
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ? Number(value) : NaN));
  return points.length >= 2 && points.length <= 10000 &&
    points.every(pair => pair.length === 2 && pair.every(value => Number.isFinite(value) && Math.abs(value) <= 1e100)) ? points : null;
}

function Plot({ points, line, en, calibration }: { points: number[][]; line?: { slope: number; intercept: number }; en: boolean; calibration: boolean }) {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const fitted = line ? [line.slope * minX + line.intercept, line.slope * maxX + line.intercept] : [];
  const minY = Math.min(...ys, ...fitted);
  const maxY = Math.max(...ys, ...fitted);
  const x = (value: number) => 50 + 420 * (value - minX) / (maxX - minX || 1);
  const y = (value: number) => 190 - 160 * (value - minY) / (maxY - minY || 1);
  return <svg viewBox="0 0 500 235" role="img" aria-label={calibration ? (en ? "Calibration graph" : "نمودار کالیبراسیون") : (en ? "Imported chromatogram" : "کروماتوگرام واردشده")}>
    <path d="M50 25V190H470" fill="none" stroke="currentColor" opacity=".5" />
    {!calibration && <path d={points.map(([a,b], index) => `${index ? "L" : "M"}${x(a)},${y(b)}`).join(" ")} fill="none" stroke="var(--color-info-text)" strokeWidth="1.4" />}
    {calibration && points.map(([a,b], index) => <circle key={index} cx={x(a)} cy={y(b)} r="3.5" fill="var(--color-success-text)" />)}
    {line && <line x1={x(minX)} y1={y(fitted[0])} x2={x(maxX)} y2={y(fitted[1])} stroke="var(--color-info-text)" strokeWidth="1.5" />}
    <text x="50" y="207" fill="currentColor" fontSize="9">{minX.toPrecision(4)}</text>
    <text x="470" y="207" fill="currentColor" fontSize="9" textAnchor="end">{maxX.toPrecision(4)}</text>
    <text x="45" y="35" fill="currentColor" fontSize="9" textAnchor="end">{maxY.toPrecision(4)}</text>
    <text x="45" y="190" fill="currentColor" fontSize="9" textAnchor="end">{minY.toPrecision(4)}</text>
    <text x="260" y="228" fill="currentColor" textAnchor="middle" fontSize="11">{calibration ? (en ? "Concentration (mg/L)" : "غلظت (mg/L)") : (en ? "Time (source unit)" : "زمان (واحد فایل)")}</text>
  </svg>;
}

export default function GCGraphs({ en, onCalibration, initialData, onDataChange }: {
  en: boolean;
  onCalibration: (slope: number, intercept: number, us: number, ub: number, correlation: number) => void;
  initialData?: GCGraphData;
  onDataChange?: (patch: Partial<GCGraphData>) => void;
}) {
  const [standards, setStandards] = useState(initialData?.standards ?? "");
  const [chromatogram, setChromatogram] = useState(initialData?.chromatogram ?? "");
  const [fileError, setFileError] = useState("");
  const points = parsePairs(standards);
  const fit = points && points.length >= 3 ? linearFit(points.flat()) : null;
  const usable = fit && Number.isFinite(fit.slope) && fit.slope > 0 && Number.isFinite(fit.intercept);
  const trace = parsePairs(chromatogram);
  const increasing = trace?.every((point, index) => index === 0 || point[0] > trace[index - 1][0]);
  const tableRows = standards ? standards.split(/\r?\n/).map(line => line.split(/[\t,; ]+/)) : [["", ""], ["", ""], ["", ""]];
  const updateStandards = (value: string) => {setStandards(value);onDataChange?.({standards:value});};

  return <details className="space-y-3 rounded-xl border border-[var(--border-soft)] p-3">
    <summary className="cursor-pointer text-sm font-bold">{en ? "Calibration and chromatogram" : "نمودار کالیبراسیون و کروماتوگرام"}</summary>
    <div className="mt-3 space-y-3 text-sm">
      {tableRows.length<=100 && <fieldset className="space-y-2">
        <legend className="font-semibold">{en?"Calibration standards":"استانداردهای کالیبراسیون"}</legend>
        <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2 text-xs font-semibold"><span>#</span><span>{en?"Concentration (mg/L)":"غلظت (mg/L)"}</span><span>{en?"Peak area":"مساحت پیک"}</span><span/></div>
        {tableRows.map((row,index)=><div key={index} className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2">
          <span className="text-xs opacity-70">{index+1}</span>
          {[0,1].map(column=><input key={column} dir="ltr" inputMode="decimal" className="ui-input min-w-0 px-2" aria-label={en?`Standard ${index+1} ${column===0?'concentration':'peak area'}`:`استاندارد ${index+1} ${column===0?'غلظت':'مساحت پیک'}`} value={row[column]??""} onChange={event=>{
            updateStandards(tableRows.map((pair,i)=>i===index?[column===0?event.target.value:pair[0]??"",column===1?event.target.value:pair[1]??""].join("\t"):pair.join("\t")).join("\n"));
          }}/>)}
          <button type="button" aria-label={en?`Remove standard ${index+1}`:`حذف استاندارد ${index+1}`} disabled={tableRows.length<=3} className="rounded-lg p-1 disabled:opacity-30" onClick={()=>updateStandards(tableRows.filter((_,i)=>i!==index).map(pair=>pair.join("\t")).join("\n"))}>×</button>
        </div>)}
        <button type="button" disabled={tableRows.length>=100} className="ui-btn ui-btn-ghost" onClick={()=>updateStandards([...tableRows,["",""]].map(pair=>pair.join("\t")).join("\n"))}>{en?"Add standard":"افزودن استاندارد"}</button>
      </fieldset>}
      <details><summary className="cursor-pointer text-xs font-semibold">{en?"Paste columns from Excel / edit raw pairs":"چسباندن دو ستون از اکسل یا ویرایش متنی"}</summary>
      <label className="mt-2 block space-y-1"><span>{en ? "Standards: concentration (mg/L), peak area; one pair per line" : "استانداردها؛ هر سطر غلظت (mg/L) و مساحت پیک، با فاصله"}</span>
        <textarea dir="ltr" className="ui-input font-mono" rows={4} value={standards} placeholder={"0 10\n5 61\n10 109\n15 161"} onChange={event => {
          setStandards(event.target.value); onDataChange?.({ standards: event.target.value });
        }} />
      </label>
      </details>
      {usable && points && <div className="rounded-xl bg-[var(--surface)] p-2">
        <Plot points={points} line={fit} calibration en={en} />
        <p dir="ltr">y = {fit.slope.toPrecision(6)}x + ({fit.intercept.toPrecision(6)}) · R² = {Number.isFinite(fit.r2) ? fit.r2.toPrecision(6) : "—"}</p>
        <button type="button" className="ui-btn ui-btn-ghost" onClick={() => {
          const n = points.length;
          const meanX = points.reduce((sum, p) => sum + p[0] / n, 0);
          const sxx = points.reduce((sum, p) => sum + (p[0] - meanX) ** 2, 0);
          const s = Math.sqrt(points.reduce((sum, p) => sum + (p[1] - fit.slope * p[0] - fit.intercept) ** 2, 0) / (n - 2));
          onCalibration(fit.slope, fit.intercept, s / Math.sqrt(sxx),
            s * Math.sqrt(1 / n + meanX ** 2 / sxx), -meanX / Math.sqrt(sxx / n + meanX ** 2));
        }}>{en ? "Use fit and slope–intercept correlation" : "انتقال برازش و هم‌بستگی شیب و عرض از مبدأ"}</button>
        <p className="text-xs leading-6">{en ? "Unweighted ordinary least squares, assuming negligible concentration errors and constant response variance. Sample response uncertainty is entered separately."
          : "برازش کمترین مربعات بدون وزن، با فرض ناچیز بودن خطای غلظت استانداردها و واریانس ثابت پاسخ است. عدم‌قطعیت پاسخ نمونه جدا وارد می‌شود."}</p>
      </div>}
      {standards.trim() && !usable && <p role="alert">{en ? "Enter at least three finite pairs with a positive slope and distinct concentrations." : "حداقل سه جفت عدد معتبر با غلظت‌های متفاوت و شیب مثبت وارد کنید."}</p>}
      <label className="block space-y-1"><span>{en ? "Chromatogram: time, signal (CSV/TXT, up to 10,000 points)" : "کروماتوگرام؛ زمان و سیگنال (CSV یا TXT، حداکثر ۱۰ هزار نقطه)"}</span>
        <input type="file" accept=".csv,.txt,.tsv" className="ui-input" onChange={async event => {
          const file = event.target.files?.[0];
          if (!file) return;
          setFileError(""); setChromatogram("");
          onDataChange?.({ chromatogram: "" });
          if (file.size > 2_000_000) { setFileError(en ? "File must be smaller than 2 MB." : "حجم فایل باید کمتر از ۲ مگابایت باشد."); return; }
          try {
            const text = await file.text();
            const lines = text.trim().split(/\r?\n/);
            // Only discard an identifiable two-column text header, never a malformed data row.
            const first = lines[0]?.trim().split(/[\t,; ]+/).map(cell => cell.trim().replace(/^"|"$/g, ""));
            if (first?.length === 2 && first.every(cell => /\p{L}/u.test(cell) &&
              !/^(?:NaN|Infinity|[+-]?inf)$/i.test(cell) && !/^[+−\-\d۰-۹٠-٩.٫]/.test(cell))) lines.shift();
            setChromatogram(lines.join("\n"));
            onDataChange?.({ chromatogram: lines.join("\n") });
          } catch { setFileError(en ? "Could not read file." : "فایل خوانده نشد."); }
        }} />
      </label>
      <p className="text-xs leading-6">{en ? "The first column is time and the second is signal in the source file's units. One optional header row is allowed. Peak identity and area integration are not inferred."
        : "ستون اول زمان و ستون دوم سیگنال در واحد فایل دستگاه است. یک سطر عنوان اختیاری پذیرفته می‌شود. این نمودار شناسایی ماده یا انتگرال‌گیری پیک انجام نمی‌دهد."}</p>
      {fileError && <p role="alert">{fileError}</p>}
      {chromatogram && (!trace || !increasing) && <p role="alert">{en ? "Check the two numeric columns and increasing time order." : "دو ستون عددی و ترتیب افزایشی زمان را بررسی کنید."}</p>}
      {trace && increasing && <Plot points={trace} en={en} calibration={false} />}
    </div>
  </details>;
}
