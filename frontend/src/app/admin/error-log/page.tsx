"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminUrl } from "@/lib/api";
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
  if (level === "CRITICAL") return "border-red-200 bg-red-50 text-red-800";
  if (level === "ERROR") return "border-rose-200 bg-rose-50 text-rose-800";
  if (level === "WARNING") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatDate(value: string) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminErrorLogPage() {
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
      setError("Could not load backend error log.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [level]);

  function selectLevel(nextLevel: (typeof filters)[number]) {
    setLevel(nextLevel);
    loadLogs(nextLevel);
  }

  useEffect(() => {
    loadLogs("ALL");
  }, [loadLogs]);

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8" dir="ltr">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-50 via-white to-red-50 p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
                  <FileWarning size={17} />
                  Backend Observability
                </div>
                <h1 className="text-3xl font-black text-slate-950">Error Log</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Recent warning, error, and critical events from the backend rotating log file.
                </p>
              </div>

              <button
                onClick={() => loadLogs(level)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <SummaryCard title="Warnings" value={data?.summary.WARNING ?? 0} tone="amber" />
          <SummaryCard title="Errors" value={data?.summary.ERROR ?? 0} tone="rose" />
          <SummaryCard title="Critical" value={data?.summary.CRITICAL ?? 0} tone="red" />
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-slate-600">
              {data?.sentry_enabled ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}
              Sentry
            </div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              {data?.sentry_enabled ? "Enabled" : "Local log"}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-500">
              File: <span className="font-mono text-slate-700">{data?.log_file || "storage/app.log"}</span>
              {!data?.log_file_exists && <span className="ml-2 font-bold text-amber-700">not created yet</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item}
                  onClick={() => selectLevel(item)}
                  className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                    level === item
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-10 text-center text-sm font-bold text-slate-500">
              Loading logs...
            </div>
          ) : !data?.entries.length ? (
            <div className="rounded-2xl bg-emerald-50 p-10 text-center text-sm font-bold text-emerald-700">
              {totalErrors === 0 ? "No recent errors found." : "No entries match this filter."}
            </div>
          ) : (
            <div className="space-y-3">
              {data.entries.map((entry, index) => (
                <article key={`${entry.ts}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${toneFor(entry.level)}`}>
                      {entry.level || "LOG"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                      <Clock size={13} />
                      {formatDate(entry.ts)}
                    </span>
                    {entry.logger && <span className="text-xs font-bold text-slate-500">{entry.logger}</span>}
                    {entry.endpoint && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{entry.endpoint}</span>}
                    {entry.status_code && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">HTTP {entry.status_code}</span>}
                    {entry.duration_ms && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{entry.duration_ms}ms</span>}
                  </div>
                  <p className="text-sm font-bold leading-7 text-slate-900">{entry.msg || entry.raw}</p>
                  {entry.exc && (
                    <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                      {entry.exc}
                    </pre>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
          <AlertTriangle className="mr-2 inline-block" size={17} />
          This page shows server-side logs only to authenticated admins. For production alerts, set
          <span className="mx-1 font-mono font-bold">SENTRY_DSN</span>
          to enable Sentry alongside this local dashboard.
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: number; tone: "amber" | "rose" | "red" }) {
  const colors = {
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    rose: "border-rose-100 bg-rose-50 text-rose-800",
    red: "border-red-100 bg-red-50 text-red-800",
  }[tone];

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${colors}`}>
      <div className="text-sm font-black opacity-80">{title}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}
