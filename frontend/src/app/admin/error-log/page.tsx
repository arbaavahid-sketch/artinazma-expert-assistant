"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type LogEntry = {
  ts: string;
  level: string;
  logger: string;
  msg: string;
  endpoint?: string;
  status_code?: number | null;
  duration_ms?: number | null;
  exc?: string;
  raw?: string;
};

type ErrorLogResponse = {
  entries: LogEntry[];
  count: number;
  summary: Record<"WARNING" | "ERROR" | "CRITICAL", number>;
  log_file: string;
  log_file_exists: boolean;
  sentry_enabled: boolean;
};

const filters = ["ALL", "WARNING", "ERROR", "CRITICAL"] as const;

function toneFor(level: string) {
  if (level === "CRITICAL") return "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]";
  if (level === "ERROR") return "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]";
  if (level === "WARNING") return "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]";
  return "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-muted)]";
}

function formatDate(value: string, locale: "fa" | "en") {
  if (!value) return locale === "en" ? "No timestamp" : "بدون زمان";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const filterLabels: Record<(typeof filters)[number], { fa: string; en: string }> = {
  ALL: { fa: "همه", en: "ALL" },
  WARNING: { fa: "هشدار", en: "WARNING" },
  ERROR: { fa: "خطا", en: "ERROR" },
  CRITICAL: { fa: "بحرانی", en: "CRITICAL" },
};

export default function AdminErrorLogPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [data, setData] = useState<ErrorLogResponse | null>(null);
  const [level, setLevel] = useState<(typeof filters)[number]>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalErrors = useMemo(() => {
    if (!data) return 0;
    return (data.summary.ERROR || 0) + (data.summary.CRITICAL || 0);
  }, [data]);

  const loadLogs = useCallback(async (selectedLevel = level) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (selectedLevel !== "ALL") params.set("level", selectedLevel);
      const res = await fetch(adminUrl(`/admin/error-log?${params}`), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      setError(isEn ? "Could not load backend error log." : "امکان بارگذاری لاگ خطای بک‌اند وجود ندارد.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isEn, level]);

  function selectLevel(nextLevel: (typeof filters)[number]) {
    setLevel(nextLevel);
    loadLogs(nextLevel);
  }

  useEffect(() => {
    loadLogs("ALL");
  }, [loadLogs]);

  return (
    <section className="min-h-full bg-[var(--background)] px-6 py-8" dir={dir}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 overflow-hidden rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <div className="bg-gradient-to-r from-[var(--surface-soft)] via-[var(--surface)] to-[var(--color-danger-bg)] p-8">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher variant="purple" />
            </div>

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-danger-bg)] px-4 py-2 text-sm font-bold text-[var(--color-danger-text)]">
                  <FileWarning size={17} />
                  {isEn ? "Backend Observability" : "پایش بک‌اند"}
                </div>
                <h1 className="text-3xl font-black text-[var(--foreground)]">
                  {isEn ? "Error Log" : "لاگ خطاها"}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
                  {isEn
                    ? "Recent warning, error, and critical events from the backend rotating log file."
                    : "رویدادهای هشدار، خطا و خطای بحرانی اخیر از فایل لاگ چرخشی بک‌اند."}
                </p>
              </div>

              <button
                onClick={() => loadLogs(level)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-3 text-sm font-bold text-[var(--text-muted)] shadow-sm transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                {isEn ? "Refresh" : "بروزرسانی"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-4 text-sm font-bold text-[var(--color-danger-text)]">
            {error}
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <SummaryCard title={isEn ? "Warnings" : "هشدارها"} value={data?.summary.WARNING ?? 0} tone="amber" />
          <SummaryCard title={isEn ? "Errors" : "خطاها"} value={data?.summary.ERROR ?? 0} tone="rose" />
          <SummaryCard title={isEn ? "Critical" : "بحرانی"} value={data?.summary.CRITICAL ?? 0} tone="red" />
          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-[var(--text-muted)]">
              {data?.sentry_enabled ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}
              Sentry
            </div>
            <div className="mt-2 text-2xl font-black text-[var(--foreground)]">
              {data?.sentry_enabled ? (isEn ? "Enabled" : "فعال") : (isEn ? "Local log" : "لاگ محلی")}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-[var(--text-subtle)]" dir="ltr">
              {isEn ? "File" : "فایل"}: <span className="font-mono text-[var(--text-muted)]">{data?.log_file || "storage/app.log"}</span>
              {!data?.log_file_exists && (
                <span className="ml-2 font-bold text-[var(--color-warning-text)]">
                  {isEn ? "not created yet" : "هنوز ساخته نشده"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item}
                  onClick={() => selectLevel(item)}
                  className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                    level === item
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  {filterLabels[item][locale]}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-[var(--surface-soft)] p-10 text-center text-sm font-bold text-[var(--text-subtle)]">
              {isEn ? "Loading logs..." : "در حال بارگذاری لاگ‌ها..."}
            </div>
          ) : !data?.entries.length ? (
            <div className="rounded-2xl bg-[var(--color-success-bg)] p-10 text-center text-sm font-bold text-[var(--color-success-text)]">
              {totalErrors === 0
                ? isEn
                  ? "No recent errors found."
                  : "خطای تازه‌ای پیدا نشد."
                : isEn
                  ? "No entries match this filter."
                  : "موردی با این فیلتر پیدا نشد."}
            </div>
          ) : (
            <div className="space-y-3">
              {data.entries.map((entry, index) => (
                <article key={`${entry.ts}-${index}`} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${toneFor(entry.level)}`}>
                      {entry.level || "LOG"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-subtle)]">
                      <Clock size={13} />
                      {formatDate(entry.ts, locale)}
                    </span>
                    {entry.logger && <span className="text-xs font-bold text-[var(--text-subtle)]">{entry.logger}</span>}
                    {entry.endpoint && <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-bold text-[var(--text-muted)]">{entry.endpoint}</span>}
                    {entry.status_code && <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-bold text-[var(--text-muted)]">HTTP {entry.status_code}</span>}
                    {entry.duration_ms && <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-bold text-[var(--text-muted)]">{entry.duration_ms}ms</span>}
                  </div>
                  <p className="text-sm font-bold leading-7 text-[var(--foreground)]">{entry.msg || entry.raw}</p>
                  {entry.exc && (
                    <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100" dir="ltr">
                      {entry.exc}
                    </pre>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-4 text-sm leading-7 text-[var(--color-warning-text)]">
          <AlertTriangle className="mx-2 inline-block" size={17} />
          {isEn ? (
            <>
              This page shows server-side logs only to authenticated admins. For production alerts, set
              <span className="mx-1 font-mono font-bold">SENTRY_DSN</span>
              to enable Sentry alongside this local dashboard.
            </>
          ) : (
            <>
              این صفحه لاگ‌های سمت سرور را فقط به ادمین‌های احراز هویت شده نشان می‌دهد. برای هشدارهای تولید، مقدار
              <span className="mx-1 font-mono font-bold" dir="ltr">SENTRY_DSN</span>
              را تنظیم کنید تا Sentry کنار این داشبورد محلی فعال شود.
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: number; tone: "amber" | "rose" | "red" }) {
  const colors = {
    amber: "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
    rose: "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
    red: "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
  }[tone];

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${colors}`}>
      <div className="text-sm font-black opacity-80">{title}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}
