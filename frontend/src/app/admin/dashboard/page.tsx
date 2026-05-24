"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiUrl, adminUrl } from "@/lib/api";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Clock3,
  Database,
  Download,
  FileQuestion,
  FolderOpen,
  Inbox,
  MessageSquareText,
  RefreshCw,
  Users,
  MessagesSquare,
  BookOpen,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Star,
} from "lucide-react";

type KnowledgeStats = {
  total_chunks: number;
  total_files: number;
  files: string[];
  categories: string[];
};

type QuestionDomain = {
  domain: string;
  count: number;
};

type RecentQuestion = {
  id: number;
  question: string;
  detected_domain: string;
  created_at: string;
};

type QuestionStats = {
  total_questions: number;
  domains: QuestionDomain[];
  recent_questions: RecentQuestion[];
};

type RequestStatus = {
  status: string;
  count: number;
};

type RequestType = {
  request_type: string;
  count: number;
};

type RequestStats = {
  total_requests: number;
  statuses: RequestStatus[];
  types: RequestType[];
};

type DailyCount = { day: string; count: number };
type Keyword    = { word: string; count: number };
type AnalyticsData = {
  daily:        DailyCount[];
  top_keywords: Keyword[];
  feedback:     { status: string; count: number }[];
  hourly:       { hour: number; count: number }[];
};

type CacheStats = {
  total_entries: number;
  max_entries:   number;
  fill_pct:      number;
  ttl_hours:     number;
};

type FeedbackStats = {
  total_questions: number;
  rated: number;
  up: number;
  down: number;
  unrated: number;
  satisfaction_pct: number | null;
};

type CustomerStats = {
  total_customers: number;
  total_sessions: number;
  total_messages: number;
  new_requests: number;
};

function getStatusLabel(status: string) {
  if (status === "in_progress") return "در حال پیگیری";
  if (status === "done") return "انجام شده";
  if (status === "closed") return "بسته شده";
  return "جدید";
}

function getTypeLabel(type: string) {
  if (type === "equipment") return "تجهیزات";
  if (type === "chemical") return "مواد شیمیایی / افزودنی‌ها";
  if (type === "catalyst") return "کاتالیست / جاذب";
  if (type === "test-analysis") return "تحلیل تست";
  if (type === "troubleshooting") return "عیب‌یابی";
  if (type === "price-inquiry") return "استعلام قیمت";
  return "مشاوره فنی";
}

function getDomainLabel(domain: string) {
  if (domain === "catalyst") return "کاتالیست";
  if (domain === "equipment") return "تجهیزات";
  if (domain === "chromatography") return "کروماتوگرافی";
  if (domain === "mercury-analysis") return "آنالیز جیوه";
  if (domain === "sulfur-analysis") return "آنالیز سولفور";
  if (domain === "troubleshooting") return "عیب‌یابی";
  if (domain === "analysis") return "آنالیز و تست";
  return domain || "تشخیص خودکار";
}

function getCategoryLabel(category: string) {
  if (category === "general") return "عمومی";
  if (category === "catalyst") return "کاتالیست";
  if (category === "equipment") return "تجهیزات";
  if (category === "chromatography") return "کروماتوگرافی";
  if (category === "mercury-analysis") return "آنالیز جیوه";
  if (category === "sulfur-analysis") return "آنالیز سولفور";
  if (category === "troubleshooting") return "عیب‌یابی";
  if (category === "application-note") return "اپلیکیشن نوت";
  if (category === "ASTM Standards") return "استانداردهای ASTM";
  if (category === "expert-faq") return "FAQ تاییدشده";
  return category || "بدون دسته‌بندی";
}

function formatDate(value?: string) {
  if (!value) return "نامشخص";

  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getStatusCount(stats: RequestStats | null, status: string) {
  return stats?.statuses?.find((item) => item.status === status)?.count ?? 0;
}

export default function DashboardPage() {
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);
  const [requestStats, setRequestStats] = useState<RequestStats | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(14);

  async function loadStats() {
    setLoading(true);

    try {
      const [knowledgeRes, questionRes, requestRes, analyticsRes, customerRes, cacheRes, feedbackRes] = await Promise.all([
        fetch(apiUrl("/knowledge/stats"), { cache: "no-store" }),
        fetch(adminUrl("/questions/stats"), { cache: "no-store" }),
        fetch(adminUrl("/customer-requests/stats"), { cache: "no-store" }),
        fetch(apiUrl(`/questions/analytics?days=${analyticsDays}`), { cache: "no-store" }),
        fetch(apiUrl("/customers/stats"), { cache: "no-store" }),
        fetch(adminUrl("/cache/stats"), { cache: "no-store" }),
        fetch(adminUrl("/feedback-stats"), { cache: "no-store" }),
      ]);

      const results = await Promise.allSettled([
        knowledgeRes.json(),
        questionRes.json(),
        requestRes.json(),
        analyticsRes.json(),
        customerRes.json(),
        cacheRes.json(),
        feedbackRes.json(),
      ]);

      setKnowledgeStats(results[0].status === "fulfilled" ? results[0].value : null);
      setQuestionStats(results[1].status === "fulfilled" ? results[1].value : null);
      setRequestStats(results[2].status === "fulfilled" ? results[2].value : null);
      setAnalyticsData(results[3].status === "fulfilled" ? results[3].value : null);
      setCustomerStats(results[4].status === "fulfilled" ? results[4].value : null);
      setCacheStats(results[5].status === "fulfilled" ? results[5].value : null);
      setFeedbackStats(results[6].status === "fulfilled" ? results[6].value : null);
    } catch {
      setKnowledgeStats(null);
      setQuestionStats(null);
      setRequestStats(null);
      setAnalyticsData(null);
      setCustomerStats(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsDays]);

  const topDomains = useMemo(() => {
    return questionStats?.domains || [];
  }, [questionStats]);

  const recentQuestions = useMemo(() => {
    return questionStats?.recent_questions || [];
  }, [questionStats]);

  const knowledgeCategories = knowledgeStats?.categories || [];
  const knowledgeFiles = knowledgeStats?.files || [];

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                  <BarChart3 size={17} />
                  داشبورد مدیریتی آرتین آزما
                </div>

                <h1 className="text-3xl font-black text-slate-900">
                  نمای کلی سیستم
                </h1>

                <p className="mt-4 max-w-4xl leading-8 text-slate-600">
                  وضعیت بانک دانش، سوالات کاربران، درخواست‌های مشتریان و مسیرهای
                  مهم مدیریتی را از این بخش دنبال کنید.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-2">
                  <span className="text-xs font-bold text-purple-700">دانلود گزارش:</span>
                  <a
                    href={adminUrl("/admin/report/export?period=week")}
                    download
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-purple-700 shadow-sm border border-purple-200 hover:bg-purple-100 transition"
                  >
                    <Download size={13} /> هفتگی
                  </a>
                  <a
                    href={adminUrl("/admin/report/export?period=month")}
                    download
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-purple-700 shadow-sm border border-purple-200 hover:bg-purple-100 transition"
                  >
                    <Download size={13} /> ماهانه
                  </a>
                </div>
                <button
                  onClick={loadStats}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw
                    size={18}
                    className={loading ? "animate-spin" : ""}
                  />
                  بروزرسانی داشبورد
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DashboardCard
            title="فایل‌های بانک دانش"
            value={knowledgeStats?.total_files ?? 0}
            icon={<Database size={24} />}
            tone="purple"
            href="/admin/knowledge"
          />

          <DashboardCard
            title="بخش‌های متنی"
            value={knowledgeStats?.total_chunks ?? 0}
            icon={<FolderOpen size={24} />}
            tone="blue"
            href="/admin/knowledge"
          />

          <DashboardCard
            title="کل سوالات"
            value={questionStats?.total_questions ?? 0}
            icon={<FileQuestion size={24} />}
            tone="slate"
            href="/admin/questions"
          />

          <DashboardCard
            title="کل درخواست‌ها"
            value={requestStats?.total_requests ?? 0}
            icon={<Inbox size={24} />}
            tone="emerald"
            href="/admin/requests"
          />

          <DashboardCard
            title="درخواست‌های جدید"
            value={customerStats?.new_requests ?? getStatusCount(requestStats, "new")}
            icon={<MessageSquareText size={24} />}
            tone="amber"
            href="/admin/requests"
          />

          <DashboardCard
            title="در حال پیگیری"
            value={getStatusCount(requestStats, "in_progress")}
            icon={<Activity size={24} />}
            tone="red"
            href="/admin/requests"
          />
        </div>

        {/* ─── Cache Stats Row ────────────────────────────────────── */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <DashboardCard
            title="پاسخ‌های کش‌شده"
            value={cacheStats?.total_entries ?? 0}
            icon={<Zap size={24} />}
            tone="amber"
            href="/admin/dashboard"
          />

          <div className="group rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-500">ظرفیت Cache</div>
                <div className="mt-3 text-4xl font-black text-slate-900">
                  {cacheStats ? `${cacheStats.fill_pct}٪` : "—"}
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-emerald-50 text-emerald-700 border-emerald-100">
                <Database size={24} />
              </div>
            </div>
            {cacheStats && (
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700"
                    style={{ width: `${cacheStats.fill_pct}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-400 font-bold">
                  {cacheStats.total_entries} / {cacheStats.max_entries} — نگهداری تا {cacheStats.ttl_hours} ساعت
                </div>
              </div>
            )}
          </div>

          <div className="group rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-500">صرفه‌جویی API</div>
                <div className="mt-3 text-4xl font-black text-slate-900">
                  {cacheStats?.total_entries ?? "—"}x
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-blue-50 text-blue-700 border-blue-100">
                <Activity size={24} />
              </div>
            </div>
            <div className="mt-4 text-xs font-bold text-slate-400">
              هر سوال تکراری از Cache برگردانده می‌شود بدون صدا زدن OpenAI
            </div>
          </div>
        </div>

        {/* ─── Customer Stats Row ─────────────────────────────────── */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <DashboardCard
            title="مشتریان ثبت‌نام‌شده"
            value={customerStats?.total_customers ?? 0}
            icon={<Users size={24} />}
            tone="purple"
            href="/admin/customers"
          />

          <DashboardCard
            title="جلسات گفتگوی مشتریان"
            value={customerStats?.total_sessions ?? 0}
            icon={<MessagesSquare size={24} />}
            tone="blue"
            href="/admin/customers"
          />

          <DashboardCard
            title="کل پیام‌های مشتریان"
            value={customerStats?.total_messages ?? 0}
            icon={<BookOpen size={24} />}
            tone="emerald"
            href="/admin/customers"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">
                      وضعیت درخواست‌های مشتریان
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      تفکیک درخواست‌ها بر اساس وضعیت پیگیری.
                    </p>
                  </div>

                  <Link
                    href="/admin/requests"
                    className="inline-flex items-center gap-2 rounded-2xl bg-purple-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-purple-800"
                  >
                    مشاهده
                    <ArrowUpRight size={16} />
                  </Link>
                </div>

                {requestStats && requestStats.statuses?.length > 0 ? (
                  <div className="space-y-3">
                    {requestStats.statuses.map((item) => (
                      <div
                        key={item.status}
                        className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"
                      >
                        <span className="font-bold text-slate-700">
                          {getStatusLabel(item.status)}
                        </span>

                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-purple-700">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="هنوز درخواستی ثبت نشده است." />
                )}
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-xl font-black text-slate-900">
                    نوع درخواست‌های مشتریان
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    موضوعاتی که مشتریان بیشتر درباره آن‌ها درخواست ثبت کرده‌اند.
                  </p>
                </div>

                {requestStats && requestStats.types?.length > 0 ? (
                  <div className="space-y-3">
                    {requestStats.types.map((item) => (
                      <div
                        key={item.request_type}
                        className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"
                      >
                        <span className="font-bold text-slate-700">
                          {getTypeLabel(item.request_type)}
                        </span>

                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-emerald-700">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="هنوز نوع درخواستی ثبت نشده است." />
                )}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    آخرین سوالات کاربران
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    سوالات اخیر که توسط کاربران از آرتین پرسیده شده‌اند.
                  </p>
                </div>

                <Link
                  href="/admin/questions"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-white"
                >
                  همه سوالات
                </Link>
              </div>

              {recentQuestions.length > 0 ? (
                <div className="space-y-3">
                  {recentQuestions.map((item) => (
                    <Link
                      key={item.id}
                      href={`/admin/questions/${item.id}`}
                      className="group block rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-purple-200 hover:bg-white hover:shadow-sm"
                    >
                      <div className="line-clamp-2 font-bold leading-8 text-slate-900 group-hover:text-purple-700">
                        {item.question}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="rounded-full bg-white px-3 py-1 font-bold text-purple-700">
                          {getDomainLabel(item.detected_domain)}
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={14} />
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState text="هنوز سوالی ثبت نشده است." />
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    حوزه‌های پرتکرار سوالات
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    حوزه‌هایی که کاربران بیشتر درباره آن‌ها سوال پرسیده‌اند.
                  </p>
                </div>
              </div>

              {topDomains.length > 0 ? (
                <div className="space-y-2.5">
                  {(() => {
                    const maxCount = Math.max(...topDomains.map(d => d.count), 1);
                    return topDomains.map((item) => (
                      <div key={item.domain}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-700">{getDomainLabel(item.domain)}</span>
                          <span className="font-black text-blue-700">{item.count}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
                            style={{ width: `${Math.round((item.count / maxCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <EmptyState text="هنوز سوالی ثبت نشده است." />
              )}
            </div>

            {/* ─── Analytics Date Range Selector ──────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-sm font-bold text-slate-600">بازه زمانی نمودار:</span>
              <div className="flex gap-2">
                {[7, 14, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setAnalyticsDays(d)}
                    className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                      analyticsDays === d
                        ? "bg-purple-600 text-white shadow-sm"
                        : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-purple-50 hover:text-purple-700"
                    }`}
                  >
                    {d} روز
                  </button>
                ))}
              </div>
              {loading && (
                <span className="text-xs text-slate-400">در حال بارگذاری...</span>
              )}
            </div>

            {/* ─── Daily Activity Line Chart ────────────────────────── */}
            {analyticsData?.daily && analyticsData.daily.length > 0 && (
              <DailyLineChart data={analyticsData.daily} />
            )}

            {/* ─── Domain Pie Chart ─────────────────────────────────── */}
            {topDomains.length > 0 && (
              <DomainPieChart domains={topDomains} />
            )}

            {/* ─── Trending Keywords ────────────────────────────────────── */}
            {analyticsData?.top_keywords && analyticsData.top_keywords.length > 0 && (
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-xl font-black text-slate-900">کلمات پرتکرار {analyticsDays} روز اخیر</h2>
                  <p className="mt-2 text-sm text-slate-500">موضوعاتی که کاربران بیشتر جستجو کرده‌اند.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analyticsData.top_keywords.map((kw) => (
                    <span
                      key={kw.word}
                      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700"
                    >
                      {kw.word}
                      <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-black text-indigo-600">
                        {kw.count}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Cache Gauge Widget ──────────────────────────────── */}
            {cacheStats && (
              <CacheGaugeWidget stats={cacheStats} />
            )}

            {/* ─── Feedback Stats Widget ───────────────────────────── */}
            {feedbackStats && (
              <FeedbackStatsWidget stats={feedbackStats} />
            )}

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    دسته‌بندی‌های بانک دانش
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    دسته‌بندی‌های فعال در بانک دانش آرتین.
                  </p>
                </div>
              </div>

              {knowledgeCategories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {knowledgeCategories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700"
                    >
                      {getCategoryLabel(category)}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState text="هنوز دسته‌بندی ثبت نشده است." />
              )}
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    فایل‌های اخیر بانک دانش
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    بخشی از فایل‌های ثبت‌شده در بانک دانش.
                  </p>
                </div>
              </div>

              {knowledgeFiles.length > 0 ? (
                <div className="space-y-3">
                  {knowledgeFiles.slice(0, 8).map((file) => (
                    <div
                      key={file}
                      className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700"
                    >
                      {file}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="هنوز فایلی ثبت نشده است." />
              )}

              <Link
                href="/admin/knowledge"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-800"
              >
                مدیریت بانک دانش
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

// ─── CSV export helper ───────────────────────────────────────────────────────
function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
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
function DailyLineChart({ data }: { data: DailyCount[] }) {
  const W = 360, H = 110, PAD = { top: 12, right: 8, bottom: 28, left: 28 };
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
    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">فعالیت روزانه</h2>
          <p className="mt-1 text-sm text-slate-500">تعداد سوالات ثبت‌شده به تفکیک روز</p>
        </div>
        <button
          onClick={() => downloadCSV("daily-activity.csv", ["تاریخ", "تعداد سوال"], data.map((d) => [d.day, d.count]))}
          className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
          title="دانلود CSV"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          CSV
        </button>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ direction: "ltr", fontFamily: "inherit" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
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
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Data points */}
        {data.map((d, i) => (
          <g key={d.day}>
            <circle cx={xOf(i)} cy={yOf(d.count)} r="3.5" fill="white" stroke="#3b82f6" strokeWidth="2" />
            {d.count > 0 && (
              <title>{`${d.day}: ${d.count} سوال`}</title>
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
const PIE_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function DomainPieChart({ domains }: { domains: QuestionDomain[] }) {
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
    return { path, color, pct, midAngle, label: getDomainLabel(d.domain), count: d.count };
  });

  return (
    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">توزیع حوزه‌های سوالات</h2>
          <p className="mt-1 text-sm text-slate-500">سهم هر حوزه از کل سوالات دریافتی</p>
        </div>
        <button
          onClick={() => downloadCSV("domain-distribution.csv", ["حوزه", "تعداد", "درصد"], domains.map((d) => [d.domain, d.count, total > 0 ? ((d.count / total) * 100).toFixed(1) : 0]))}
          className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
          title="دانلود CSV"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          CSV
        </button>
      </div>
      <div className="flex items-center gap-4" style={{ direction: "ltr" }}>
        <svg viewBox="0 0 160 160" className="w-36 shrink-0" aria-hidden="true">
          {slices.map((s, i) => (
            <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2">
              <title>{`${s.label}: ${s.count} (${s.pct}%)`}</title>
            </path>
          ))}
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1e293b">{total}</text>
          <text x={CX} y={CY + 10} textAnchor="middle" fontSize="7.5" fill="#64748b">سوال</text>
        </svg>
        <div className="flex flex-col gap-1.5" style={{ direction: "rtl" }}>
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="font-bold text-slate-700">{s.label}</span>
              <span className="text-slate-400">{s.pct}٪</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Feedback Stats Widget ───────────────────────────────────────────────────
function FeedbackStatsWidget({ stats }: { stats: FeedbackStats }) {
  const pct = stats.satisfaction_pct;
  const ratedPct = stats.total_questions > 0
    ? Math.round((stats.rated / stats.total_questions) * 100)
    : 0;

  return (
    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Star size={20} />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900">رضایت کاربران</h2>
          <p className="text-xs text-slate-500">بازخورد روی پاسخ‌های آرتین</p>
        </div>
      </div>

      {/* Satisfaction score */}
      <div className="mb-5 flex items-end gap-3">
        <div className="text-5xl font-black text-slate-900">
          {pct !== null ? `${pct}٪` : "—"}
        </div>
        <div className="mb-1 text-sm font-bold text-emerald-600">رضایت</div>
      </div>

      {/* Progress bar */}
      {pct !== null && (
        <div className="mb-5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
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
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3">
          <ThumbsUp size={16} className="text-emerald-600" />
          <div>
            <div className="text-xl font-black text-emerald-700">{stats.up}</div>
            <div className="text-[11px] font-bold text-emerald-500">مفید بود</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3">
          <ThumbsDown size={16} className="text-red-500" />
          <div>
            <div className="text-xl font-black text-red-600">{stats.down}</div>
            <div className="text-[11px] font-bold text-red-400">نیاز به بهبود</div>
          </div>
        </div>
      </div>

      {/* Rated vs unrated */}
      <div className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500 space-y-1">
        <div className="flex justify-between">
          <span>ارزیابی‌شده</span>
          <span className="text-slate-700">{stats.rated} از {stats.total_questions} ({ratedPct}٪)</span>
        </div>
        <div className="flex justify-between">
          <span>بدون نظر</span>
          <span>{stats.unrated}</span>
        </div>
      </div>
    </div>
  );
}


// ─── Cache Gauge Widget ──────────────────────────────────────────────────────
function CacheGaugeWidget({ stats }: { stats: CacheStats }) {
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
    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3">
        <h2 className="text-xl font-black text-slate-900">وضعیت Cache هوشمند</h2>
        <p className="mt-1 text-sm text-slate-500">پاسخ‌های ذخیره‌شده برای کاهش هزینه API</p>
      </div>
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 140 80" className="w-36 shrink-0" aria-hidden="true" style={{ direction: "ltr" }}>
          <path d={bgD} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
          {pct > 0 && (
            <path d={arcD} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
          )}
          <text x={CX} y={CY - 8} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#1e293b">{pct}٪</text>
          <text x={CX} y={CY + 6} textAnchor="middle" fontSize="7.5" fill="#64748b">پر شده</text>
          <text x="8" y={CY + 16} textAnchor="middle" fontSize="7" fill="#94a3b8">۰</text>
          <text x="132" y={CY + 16} textAnchor="middle" fontSize="7" fill="#94a3b8">{stats.max_entries}</text>
        </svg>
        <div className="flex flex-col gap-2 text-sm" style={{ direction: "rtl" }}>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="font-bold text-slate-700">{stats.total_entries} پاسخ کش‌شده</span>
          </div>
          <div className="text-slate-500">حداکثر: {stats.max_entries} ورودی</div>
          <div className="text-slate-500">مدت نگهداری: {stats.ttl_hours} ساعت</div>
          <div className="mt-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            {stats.total_entries} بار صرفه‌جویی API
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({
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
  const toneClass = {
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
  }[tone];

  return (
    <Link
      href={href}
      className="group rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-500">{title}</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{value}</div>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${toneClass}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-slate-400 transition group-hover:text-purple-700">
        مشاهده جزئیات
        <ArrowUpRight size={14} />
      </div>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
