"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  AlertTriangle,
  FileQuestion,
  RefreshCw,
  SearchX,
  ThumbsDown,
  Unplug,
} from "lucide-react";

type GapExample = {
  id: number;
  question: string;
  domain: string;
  intent: string;
  user_rating: string | null;
  comment: string | null;
  best_score: number | null;
  source_count: number | null;
  web_search_used: boolean;
  reasons: string[];
  created_at: string;
};

type GapReport = {
  window_days: number;
  score_threshold: number;
  questions_in_window: number;
  gap_count: number;
  gap_rate_pct: number | null;
  breakdown: {
    negative_feedback: number;
    weak_retrieval: number;
    no_grounding: number;
  };
  by_domain: { domain: string; count: number }[];
  by_intent: { intent: string; count: number }[];
  top_gap_keywords: { term: string; count: number }[];
  examples: GapExample[];
};

const windows = [7, 30, 90] as const;

const reasonMeta: Record<string, { label: { fa: string; en: string }; cls: string }> = {
  negative_feedback: {
    label: { fa: "رأی منفی", en: "Negative feedback" },
    cls: "border-rose-200 bg-rose-50 text-rose-700",
  },
  weak_retrieval: {
    label: { fa: "بازیابی ضعیف", en: "Weak retrieval" },
    cls: "border-amber-200 bg-amber-50 text-amber-700",
  },
  no_grounding: {
    label: { fa: "بدون منبع", en: "No grounding" },
    cls: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

function formatDate(value: string, locale: "fa" | "en") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminKnowledgeGapsPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [data, setData] = useState<GapReport | null>(null);
  const [days, setDays] = useState<(typeof windows)[number]>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (selectedDays: (typeof windows)[number]) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(adminUrl(`/admin/knowledge-gaps?days=${selectedDays}&limit=50`), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      setError(isEn ? "Could not load the knowledge gap report." : "بارگیری گزارش شکاف دانش ممکن نشد.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  function selectWindow(next: (typeof windows)[number]) {
    setDays(next);
    load(next);
  }

  useEffect(() => {
    load(30);
  }, [load]);

  const maxKeyword = data?.top_gap_keywords?.[0]?.count ?? 1;

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8" dir={dir}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-slate-50 via-white to-amber-50 p-8">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher variant="purple" />
            </div>

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
                  <SearchX size={17} />
                  {isEn ? "Answer Quality" : "کیفیت پاسخ‌گویی"}
                </div>
                <h1 className="text-3xl font-black text-slate-950">
                  {isEn ? "Knowledge Gaps" : "شکاف دانش"}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  {isEn
                    ? "Questions we may have answered poorly, based on negative user feedback, weak retrieval, or lack of grounding, plus topics that should be added to the knowledge base."
                    : "سؤالاتی که احتمالاً بد جواب داده‌ایم، بر اساس رأی منفی کاربر، بازیابی ضعیف، یا نبود منبع، و موضوعاتی که برای پر کردن این شکاف باید به بانک دانش اضافه شوند."}
                </p>
              </div>

              <button
                onClick={() => load(days)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                {isEn ? "Refresh" : "به‌روزرسانی"}
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {windows.map((item) => (
                <button
                  key={item}
                  onClick={() => selectWindow(item)}
                  className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                    days === item
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {isEn ? `Last ${item} days` : `${item} روز اخیر`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard
            title={isEn ? "Total gaps" : "کل شکاف‌ها"}
            value={data?.gap_count ?? 0}
            sub={
              data?.gap_rate_pct != null
                ? isEn
                  ? `${data.gap_rate_pct}% of ${data.questions_in_window} questions`
                  : `${data.gap_rate_pct}% از ${data.questions_in_window} سؤال`
                : "-"
            }
            Icon={SearchX}
            tone="slate"
          />
          <StatCard
            title={isEn ? "Negative feedback" : "رأی منفی"}
            value={data?.breakdown.negative_feedback ?? 0}
            sub={isEn ? "user thumbs-down" : "thumbs-down کاربر"}
            Icon={ThumbsDown}
            tone="rose"
          />
          <StatCard
            title={isEn ? "Weak retrieval" : "بازیابی ضعیف"}
            value={data?.breakdown.weak_retrieval ?? 0}
            sub={`score < ${data?.score_threshold ?? 14}`}
            Icon={FileQuestion}
            tone="amber"
          />
          <StatCard
            title={isEn ? "No grounding" : "بدون منبع"}
            value={data?.breakdown.no_grounding ?? 0}
            sub={isEn ? "no internal or web source" : "نه منبع داخلی، نه وب"}
            Icon={Unplug}
            tone="slate"
          />
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel title={isEn ? "Topics Needing Knowledge" : "موضوعات نیازمند دانش"}>
            {!data?.top_gap_keywords?.length ? (
              <Empty>{isEn ? "No keywords found." : "کلیدواژه‌ای پیدا نشد."}</Empty>
            ) : (
              <ul className="space-y-2">
                {data.top_gap_keywords.map((k) => (
                  <li key={k.term} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm font-bold text-slate-700" title={k.term}>
                      {k.term}
                    </span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-amber-400"
                        style={{ width: `${Math.max(8, (k.count / maxKeyword) * 100)}%` }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-left text-xs font-black text-slate-500">{k.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={isEn ? "Breakdown by Domain and Intent" : "تفکیک بر اساس حوزه و نوع پرسش"}>
            {!data?.by_domain?.length && !data?.by_intent?.length ? (
              <Empty>{isEn ? "No breakdown data available." : "داده‌ای برای تفکیک نیست."}</Empty>
            ) : (
              <div className="space-y-4">
                <Breakdown
                  label={isEn ? "Domain" : "حوزه"}
                  items={data?.by_domain.map((d) => ({ name: d.domain, count: d.count })) ?? []}
                />
                <Breakdown
                  label={isEn ? "Intent" : "نوع پرسش"}
                  items={data?.by_intent.map((d) => ({ name: d.intent, count: d.count })) ?? []}
                />
              </div>
            )}
          </Panel>
        </div>

        <Panel title={isEn ? `Question Examples (${data?.examples.length ?? 0})` : `نمونه سؤال‌ها (${data?.examples.length ?? 0})`}>
          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-10 text-center text-sm font-bold text-slate-500">
              {isEn ? "Loading..." : "در حال بارگیری..."}
            </div>
          ) : !data?.examples.length ? (
            <div className="rounded-2xl bg-emerald-50 p-10 text-center text-sm font-bold text-emerald-700">
              {isEn ? "No knowledge gaps found in this period." : "شکاف دانشی در این بازه پیدا نشد."}
            </div>
          ) : (
            <div className="space-y-3">
              {data.examples.map((ex) => (
                <article key={ex.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {ex.reasons.map((r) => (
                      <span
                        key={r}
                        className={`rounded-full border px-3 py-1 text-xs font-black ${
                          reasonMeta[r]?.cls ?? "border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {reasonMeta[r]?.label[locale] ?? r}
                      </span>
                    ))}
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{ex.domain}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{ex.intent}</span>
                    <span className="text-xs font-bold text-slate-400">{formatDate(ex.created_at, locale)}</span>
                  </div>
                  <p className="text-sm font-bold leading-7 text-slate-900">{ex.question}</p>
                  {ex.comment && (
                    <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs leading-6 text-slate-600">
                      {isEn ? "User comment" : "نظر کاربر"}: {ex.comment}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
                    <span>score: {ex.best_score ?? "-"}</span>
                    <span>{isEn ? "Sources" : "منابع"}: {ex.source_count ?? 0}</span>
                    <span>{isEn ? "Web" : "وب"}: {ex.web_search_used ? (isEn ? "Yes" : "بله") : (isEn ? "No" : "خیر")}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
          <AlertTriangle className="mx-2 inline-block" size={17} />
          {isEn
            ? "Use this list for prioritization: add frequent topics as new knowledge files in the Knowledge Base to reduce the gap rate."
            : "از این فهرست برای تصمیم‌گیری استفاده کنید: موضوعات پرتکرار را به‌عنوان فایل دانش جدید در «بانک دانش» اضافه کنید تا نرخ شکاف کاهش یابد."}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  title,
  value,
  sub,
  Icon,
  tone,
}: {
  title: string;
  value: number;
  sub: string;
  Icon: typeof SearchX;
  tone: "amber" | "rose" | "slate";
}) {
  const colors = {
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    rose: "border-rose-100 bg-rose-50 text-rose-800",
    slate: "border-slate-200 bg-white text-slate-800",
  }[tone];
  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${colors}`}>
      <div className="flex items-center gap-2 text-sm font-black opacity-80">
        <Icon size={16} />
        {title}
      </div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <div className="mt-1 text-xs font-bold opacity-70">{sub}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-black text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">{children}</div>
  );
}

function Breakdown({ label, items }: { label: string; items: { name: string; count: number }[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-black text-slate-400">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <span
            key={it.name}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            {it.name}
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-black text-white">{it.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
