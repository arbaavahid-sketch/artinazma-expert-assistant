"use client";

// Charts, stat widgets and small layout pieces used by the admin dashboard.

import Link from "next/link";
import { ArrowUpRight, Clock3, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { formatNumber, useI18n } from "@/lib/i18n";
import { getDomainLabel, type CacheStats, type DailyCount, type FeedbackStats, type QuestionDomain } from "./dashboard-types";

// ─── CSV export helper ───────────────────────────────────────────────────────
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const NEWLINE = "\n";
  const escapeCell = (v: string | number) => {
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((r) => r.map(escapeCell).join(",")),
  ].join(NEWLINE);
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Line Chart: daily questions ────────────────────────────────────────────
export function DailyLineChart({
  data,
  analyticsDays,
  loading,
  onDaysChange,
  locale,
}: {
  data: DailyCount[];
  analyticsDays: number;
  loading: boolean;
  onDaysChange: (days: number) => void;
  locale: string;
}) {
  const isEn = locale === "en";
  const W = 360, H = 96, PAD = { top: 10, right: 8, bottom: 24, left: 28 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map(d => d.count), 1);
  const n = data.length;

  const xOf = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * innerW;
  const yOf = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  // Build SVG polyline points
  const points = data.map((d, i) => `${xOf(i)},${yOf(d.count)}`).join(" ");

  // Area fill path
  const area = [
    `M ${xOf(0)},${yOf(data[0].count)}`,
    ...data.map((d, i) => `L ${xOf(i)},${yOf(d.count)}`),
    `L ${xOf(n - 1)},${PAD.top + innerH}`,
    `L ${xOf(0)},${PAD.top + innerH}`,
    "Z",
  ].join(" ");

  // Y-axis ticks (0, half, max)
  const yTicks = [0, Math.round(maxVal / 2), maxVal].filter((v, i, arr) => arr.indexOf(v) === i);

  // X-axis labels: show ~5 evenly spaced
  const labelStep = Math.max(1, Math.floor(n / 5));
  const xLabels = data
    .map((d, i) => ({ i, label: d.day.slice(5) }))
    .filter(({ i }) => i % labelStep === 0 || i === n - 1);

  return (
    <div className="ui-card artin-analytics-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-[var(--foreground)]">{isEn ? "Daily Activity" : "فعالیت روزانه"}</h2>
          <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
            {isEn ? "Registered questions by day" : "تعداد سوالات ثبت‌شده به تفکیک روز"}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="text-xs font-black text-[var(--text-subtle)]">{isEn ? "Range" : "بازه"}:</span>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
              className={`rounded-xl px-2.5 py-1.5 text-xs font-black transition ${
                analyticsDays === d
                  ? "bg-[var(--brand-fill)] text-white shadow-sm"
                  : "border border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-muted)] hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-text)]"
              }`}
            >
              {isEn ? `${d} days` : `${d} روز`}
            </button>
          ))}
          <button
            onClick={() => downloadCSV("daily-activity.csv", [isEn ? "Date" : "تاریخ", isEn ? "Question count" : "تعداد سوال"], data.map((d) => [d.day, d.count]))}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-muted)] transition hover:bg-[var(--color-success-bg)] hover:text-[var(--color-success-text)]"
            title={isEn ? "Download CSV" : "دانلود CSV"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          {loading && <span className="text-xs font-bold text-[var(--text-subtle)]">{isEn ? "Loading..." : "در حال بارگذاری..."}</span>}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="min-h-0 w-full flex-1"
        style={{ direction: "ltr", fontFamily: "inherit" }}
        role="img"
        aria-label={isEn ? "Daily question counts" : "نمودار تعداد پرسش‌های روزانه"}
      >
        <defs>
          <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left} y1={yOf(v)} x2={PAD.left + innerW} y2={yOf(v)}
              stroke="#e2e8f0" strokeWidth="1"
            />
            <text x={PAD.left - 4} y={yOf(v) + 4} textAnchor="end" fontSize="8" fill="#94a3b8">
              {v}
            </text>
          </g>
        ))}
        {/* Area fill */}
        <path d={area} fill="url(#lineArea)" />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#0d9488"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Data points */}
        {data.map((d, i) => (
          <g key={d.day}>
            <circle cx={xOf(i)} cy={yOf(d.count)} r="3.5" fill="white" stroke="#0d9488" strokeWidth="2" />
            {d.count > 0 && (
              <title>{isEn ? `${d.day}: ${d.count} questions` : `${d.day}: ${d.count} سوال`}</title>
            )}
          </g>
        ))}
        {/* X labels */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Pie Chart: question domains ─────────────────────────────────────────────
export const PIE_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function DomainPieChart({ domains, locale }: { domains: QuestionDomain[]; locale: string }) {
  const isEn = locale === "en";
  const total = domains.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  const CX = 80, CY = 80, R = 64, IR = 38; // donut
  let startAngle = -Math.PI / 2;

  const slices = domains.map((d, i) => {
    const angle = (d.count / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const ix1 = CX + IR * Math.cos(endAngle);
    const iy1 = CY + IR * Math.sin(endAngle);
    const ix2 = CX + IR * Math.cos(startAngle);
    const iy2 = CY + IR * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${IR} ${IR} 0 ${large} 0 ${ix2} ${iy2} Z`;
    const color = PIE_COLORS[i % PIE_COLORS.length];
    const pct = Math.round((d.count / total) * 100);
    const midAngle = startAngle + angle / 2;
    startAngle = endAngle;
    return { path, color, pct, midAngle, label: getDomainLabel(d.domain, locale), count: d.count };
  });

  return (
    <div className="ui-card artin-analytics-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-4">
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-black leading-6 text-[var(--foreground)]">
            {isEn ? "Question Domains" : "حوزه‌های سوالات"}
          </h2>
          <p className="mt-1 max-w-[180px] text-[11px] font-bold leading-4 text-[var(--text-subtle)]">
            {isEn ? "Share of all questions" : "سهم از کل سوالات"}
          </p>
        </div>
        <button
          onClick={() => downloadCSV("domain-distribution.csv", [isEn ? "Domain" : "حوزه", isEn ? "Count" : "تعداد", isEn ? "Percent" : "درصد"], domains.map((d) => [d.domain, d.count, total > 0 ? ((d.count / total) * 100).toFixed(1) : 0]))}
          className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--text-muted)] transition hover:bg-[var(--color-success-bg)] hover:text-[var(--color-success-text)]"
          title={isEn ? "Download CSV" : "دانلود CSV"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          CSV
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center gap-4" dir="ltr">
        <div className="flex w-[92px] shrink-0 justify-center">
          <svg viewBox="0 0 160 160" className="h-[92px] w-[92px]" aria-hidden="true">
            {slices.map((s, i) => (
              <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2">
                <title>{`${s.label}: ${s.count} (${s.pct}%)`}</title>
              </path>
            ))}
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1e293b">{total}</text>
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="7.5" fill="#64748b">{isEn ? "questions" : "سوال"}</text>
          </svg>
        </div>
        <div className="min-w-0 flex-1 self-stretch overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5 py-1" dir={isEn ? "ltr" : "rtl"}>
            {slices.map((s, i) => (
              <div key={i} className={`flex min-w-0 items-center gap-2 text-xs ${isEn ? "text-left" : "text-right"}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate font-bold text-[var(--text-muted)]">{s.label}</span>
                <span className="shrink-0 tabular-nums text-[var(--text-subtle)]">{s.pct}{isEn ? "%" : "٪"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feedback Stats Widget ───────────────────────────────────────────────────
export function FeedbackStatsWidget({ stats, locale }: { stats: FeedbackStats; locale: string }) {
  const isEn = locale === "en";
  const pct = stats.satisfaction_pct;
  const ratedPct = stats.total_questions > 0
    ? Math.round((stats.rated / stats.total_questions) * 100)
    : 0;

  return (
    <div className="ui-card artin-analytics-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]">
          <Star size={20} />
        </div>
        <div>
          <h2 className="text-lg font-black text-[var(--foreground)]">{isEn ? "User Satisfaction" : "رضایت کاربران"}</h2>
          <p className="text-xs text-[var(--text-subtle)]">{isEn ? "Feedback on Artin's answers" : "بازخورد روی پاسخ‌های آرتین"}</p>
        </div>
      </div>

      {/* Satisfaction score */}
      <div className="mb-3 flex items-end gap-3">
        <div className="text-3xl font-black text-[var(--foreground)]">
          {pct !== null ? `${pct}${isEn ? "%" : "٪"}` : "—"}
        </div>
        <div className="mb-1 text-sm font-bold text-[var(--color-success-text)]">{isEn ? "Satisfaction" : "رضایت"}</div>
      </div>

      {/* Progress bar */}
      {pct !== null && (
        <div className="mb-5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: pct >= 70
                  ? "linear-gradient(to right, #10b981, #059669)"
                  : pct >= 40
                  ? "linear-gradient(to right, #f59e0b, #d97706)"
                  : "linear-gradient(to right, #ef4444, #dc2626)",
              }}
            />
          </div>
        </div>
      )}

      {/* Like / Dislike row */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-2xl bg-[var(--color-success-bg)] p-3">
          <ThumbsUp size={16} className="text-[var(--color-success-text)]" />
          <div>
            <div className="text-xl font-black text-[var(--color-success-text)]">{stats.up}</div>
            <div className="text-[11px] font-bold text-emerald-500">{isEn ? "Helpful" : "مفید بود"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-[var(--color-danger-bg)] p-3">
          <ThumbsDown size={16} className="text-red-500" />
          <div>
            <div className="text-xl font-black text-[var(--color-danger-text)]">{stats.down}</div>
            <div className="text-[11px] font-bold text-red-400">{isEn ? "Needs improvement" : "نیاز به بهبود"}</div>
          </div>
        </div>
      </div>

      {/* Rated vs unrated */}
      <div className="rounded-2xl bg-[var(--surface-soft)] p-3 text-xs font-bold text-[var(--text-subtle)] space-y-1">
        <div className="flex justify-between">
          <span>{isEn ? "Rated" : "ارزیابی‌شده"}</span>
          <span className="text-[var(--text-muted)]">
            {isEn ? `${stats.rated} of ${stats.total_questions} (${ratedPct}%)` : `${stats.rated} از ${stats.total_questions} (${ratedPct}٪)`}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{isEn ? "Unrated" : "بدون نظر"}</span>
          <span>{stats.unrated}</span>
        </div>
      </div>
    </div>
  );
}


// ─── Cache Gauge Widget ──────────────────────────────────────────────────────
export function CacheGaugeWidget({ stats, locale }: { stats: CacheStats; locale: string }) {
  const isEn = locale === "en";
  const pct = stats.fill_pct;
  const R = 52, CX = 70, CY = 68;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcEnd = {
    x: CX + R * Math.cos(toRad(180 - pct * 1.8)),
    y: CY - R * Math.sin(toRad(pct * 1.8)),
  };
  const largeArc = pct * 1.8 > 180 ? 1 : 0;
  const arcD = `M ${CX - R} ${CY} A ${R} ${R} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`;
  const bgD  = `M ${CX - R} ${CY} A ${R} ${R} 0 1 1 ${CX + R} ${CY}`;
  const color = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#10b981";

  return (
    <div className="ui-card artin-analytics-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-4">
      <div className="mb-2">
        <h2 className="text-base font-black text-[var(--foreground)]">{isEn ? "Smart Cache Status" : "وضعیت Cache هوشمند"}</h2>
        <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
          {isEn ? "Stored responses to reduce API cost" : "پاسخ‌های ذخیره‌شده برای کاهش هزینه API"}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <svg viewBox="0 0 140 80" className="w-24 shrink-0" aria-hidden="true" style={{ direction: "ltr" }}>
          <path d={bgD} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
          {pct > 0 && (
            <path d={arcD} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
          )}
          <text x={CX} y={CY - 8} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#1e293b">{pct}{isEn ? "%" : "٪"}</text>
          <text x={CX} y={CY + 6} textAnchor="middle" fontSize="7.5" fill="#64748b">{isEn ? "filled" : "پر شده"}</text>
          <text x="8" y={CY + 16} textAnchor="middle" fontSize="7" fill="#94a3b8">{isEn ? "0" : "۰"}</text>
          <text x="132" y={CY + 16} textAnchor="middle" fontSize="7" fill="#94a3b8">{stats.max_entries}</text>
        </svg>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs" style={{ direction: isEn ? "ltr" : "rtl" }}>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="font-bold text-[var(--text-muted)]">
              {isEn ? `${stats.total_entries} cached responses` : `${stats.total_entries} پاسخ کش‌شده`}
            </span>
          </div>
          <div className="text-[var(--text-subtle)]">{isEn ? `Maximum: ${stats.max_entries} entries` : `حداکثر: ${stats.max_entries} ورودی`}</div>
          <div className="text-[var(--text-subtle)]">{isEn ? `Retention: ${stats.ttl_hours} hours` : `مدت نگهداری: ${stats.ttl_hours} ساعت`}</div>
          <div className="mt-1 w-fit rounded-xl bg-[var(--color-success-bg)] px-2.5 py-1 text-xs font-bold text-[var(--color-success-text)]">
            {isEn ? `${stats.total_entries} API calls saved` : `${stats.total_entries} بار صرفه‌جویی API`}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Hourly Activity Heatmap ───────────────────────────────────────────────
export function HourlyHeatmap({ data, locale }: { data: { hour: number; count: number }[]; locale: string }) {
  const isEn = locale === "en";
  const maxCount = Math.max(...data.map(d => d.count), 1);

  function getColor(count: number) {
    if (count === 0) return "#f1f5f9";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "#c7d2fe";
    if (ratio < 0.5) return "#818cf8";
    if (ratio < 0.75) return "#6366f1";
    return "#4338ca";
  }

  return (
    <div className="ui-card artin-analytics-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-4">
      <div className="mb-2">
        <h2 className="text-base font-black text-[var(--foreground)]">{isEn ? "Peak Hours" : "ساعات پرتردد"}</h2>
        <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">{isEn ? "User activity by hour of day" : "فعالیت کاربران به تفکیک ساعت روز"}</p>
      </div>
      <div className="grid grid-cols-12 gap-1.5" style={{ direction: "ltr" }}>
        {data.map((d) => (
          <div key={d.hour} className="flex flex-col items-center gap-1">
            <div
              className="aspect-square w-full rounded-md transition-all hover:scale-110"
              style={{ background: getColor(d.count) }}
              title={isEn ? `Hour ${d.hour}: ${d.count} questions` : `ساعت ${d.hour}: ${d.count} سوال`}
            />
            <span className="text-[9px] font-bold text-[var(--text-subtle)]">
              {d.hour}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-[var(--text-subtle)]">
        <span>{isEn ? "Low" : "کم"}</span>
        <div className="flex gap-0.5">
          {["#f1f5f9", "#c7d2fe", "#818cf8", "#6366f1", "#4338ca"].map((c) => (
            <div key={c} className="h-3 w-3 rounded-sm" style={{ background: c }} />
          ))}
        </div>
        <span>{isEn ? "High" : "زیاد"}</span>
      </div>
    </div>
  );
}

// ─── Response Time Stats Widget ──────────────────────────────────────────────
export function ResponseTimeWidget({ avgMs, totalAnswered, locale }: { avgMs: number; totalAnswered: number; locale: string }) {
  const isEn = locale === "en";
  const avgSec = (avgMs / 1000).toFixed(1);
  const rating = avgMs < 3000
    ? (isEn ? "Excellent" : "عالی")
    : avgMs < 8000
      ? (isEn ? "Good" : "خوب")
      : avgMs < 15000
        ? (isEn ? "Average" : "متوسط")
        : (isEn ? "Slow" : "کند");
  const ratingColor = avgMs < 3000 ? "text-[var(--color-success-text)]" : avgMs < 8000 ? "text-[var(--color-info-text)]" : avgMs < 15000 ? "text-[var(--color-warning-text)]" : "text-[var(--color-danger-text)]";
  const barPct = Math.min(100, Math.round((avgMs / 20000) * 100));

  return (
    <div className="ui-card artin-analytics-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
          <Clock3 size={20} />
        </div>
        <div>
          <h2 className="text-lg font-black text-[var(--foreground)]">{isEn ? "Response Time" : "زمان پاسخ"}</h2>
          <p className="text-xs text-[var(--text-subtle)]">{isEn ? "Average AI answer generation time" : "میانگین زمان تولید پاسخ AI"}</p>
        </div>
      </div>

      <div className="mb-3 flex items-end gap-3">
        <div className="text-3xl font-black text-[var(--foreground)]">{avgSec}</div>
        <div className="mb-1 text-sm font-bold text-[var(--text-subtle)]">{isEn ? "seconds" : "ثانیه"}</div>
        <div className={`mb-1 mr-2 text-sm font-black ${ratingColor}`}>{rating}</div>
      </div>

      <div className="mb-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-300 via-teal-500 to-teal-700 transition-all duration-700"
            style={{ width: `${barPct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-[var(--text-subtle)]">
          <span>{isEn ? "0 sec" : "۰ ثانیه"}</span>
          <span>{isEn ? "20 sec" : "۲۰ ثانیه"}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--surface-soft)] p-3 text-xs font-bold text-[var(--text-subtle)]">
        {isEn ? `${totalAnswered} answered questions` : `${totalAnswered} سوال پاسخ داده‌شده`}
      </div>
    </div>
  );
}

export function DashboardCard({
  title,
  value,
  icon,
  tone,
  href,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: "purple" | "blue" | "slate" | "emerald" | "amber" | "red";
  href: string;
}) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const toneClass = {
    purple: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800",
    blue: "bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info-border)]",
    slate: "bg-[var(--surface-soft)] text-[var(--text-muted)] border-[var(--border-soft)]",
    emerald: "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]",
    amber: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]",
    red: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger-border)]",
  }[tone];

  return (
    <Link
      href={href}
      className="ui-card group rounded-2xl p-4 transition hover:border-teal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-muted)] dark:text-[var(--text-subtle)]">{title}</div>
          <div className="mt-3 text-3xl font-semibold tabular-nums text-[var(--foreground)]">{formatNumber(value, locale)}</div>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${toneClass}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--text-subtle)] transition group-hover:text-[var(--color-info-text)]">
        {isEn ? "View details" : "مشاهده جزئیات"}
        <ArrowUpRight size={14} />
      </div>
    </Link>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl bg-[var(--surface-soft)] p-6 text-center text-sm text-[var(--text-subtle)]">
      {text}
    </div>
  );
}
