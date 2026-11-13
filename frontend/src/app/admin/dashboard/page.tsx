"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { apiUrl, adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  Activity,
  Calculator,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BellRing,
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
} from "lucide-react";

import {
  CacheGaugeWidget,
  DailyLineChart,
  DashboardCard,
  DomainPieChart,
  EmptyState,
  FeedbackStatsWidget,
  HourlyHeatmap,
  ResponseTimeWidget,
} from "./dashboard-widgets";
import {
  formatDate,
  getCategoryLabel,
  getDomainLabel,
  getPriorityLabel,
  getReminderReasonClass,
  getReminderReasonLabel,
  getStatusCount,
  getStatusLabel,
  getTypeLabel,
  type AnalyticsData,
  type BusinessAnalytics,
  type CacheStats,
  type CustomerStats,
  type FeedbackStats,
  type KnowledgeStats,
  type QuestionStats,
  type RequestStats,
  type ResponseTimeStats,
} from "./dashboard-types";

export default function DashboardPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);
  const [requestStats, setRequestStats] = useState<RequestStats | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [responseTimeStats, setResponseTimeStats] = useState<ResponseTimeStats | null>(null);
  const [businessAnalytics, setBusinessAnalytics] = useState<BusinessAnalytics | null>(null);
  const [calculationStats,setCalculationStats]=useState<{total:number;today:number;customers:number}|null>(null);
  const [loading, setLoading] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(14);

  async function loadStats() {
    setLoading(true);

    try {
      const [knowledgeRes, questionRes, requestRes, analyticsRes, customerRes, cacheRes, feedbackRes, responseTimeRes, businessRes, calculationRes] = await Promise.all([
        fetch(apiUrl("/knowledge/stats"), { cache: "no-store" }),
        fetch(adminUrl("/questions/stats"), { cache: "no-store" }),
        fetch(adminUrl("/customer-requests/stats"), { cache: "no-store" }),
        fetch(apiUrl(`/questions/analytics?days=${analyticsDays}`), { cache: "no-store" }),
        fetch(apiUrl("/customers/stats"), { cache: "no-store" }),
        fetch(adminUrl("/admin/cache/stats"), { cache: "no-store" }),
        fetch(adminUrl("/admin/feedback-stats"), { cache: "no-store" }),
        fetch(adminUrl("/admin/response-time-stats"), { cache: "no-store" }),
        fetch(adminUrl(`/admin/business-analytics?days=${analyticsDays}`), { cache: "no-store" }),
        fetch(adminUrl("/admin/calculation-activity/stats"), {cache:"no-store"}),
      ]);

      const results = await Promise.allSettled([
        knowledgeRes.json(),
        questionRes.json(),
        requestRes.json(),
        analyticsRes.json(),
        customerRes.json(),
        cacheRes.json(),
        feedbackRes.json(),
        responseTimeRes.json(),
        businessRes.json(),
        calculationRes.ok?calculationRes.json():Promise.reject(new Error("usage unavailable")),
      ]);

      setKnowledgeStats(results[0].status === "fulfilled" ? results[0].value : null);
      setQuestionStats(results[1].status === "fulfilled" ? results[1].value : null);
      setRequestStats(results[2].status === "fulfilled" ? results[2].value : null);
      setAnalyticsData(results[3].status === "fulfilled" ? results[3].value : null);
      setCustomerStats(results[4].status === "fulfilled" ? results[4].value : null);
      setCacheStats(results[5].status === "fulfilled" ? results[5].value : null);
      setFeedbackStats(results[6].status === "fulfilled" ? results[6].value : null);
      setResponseTimeStats(results[7]?.status === "fulfilled" ? results[7].value : null);
      setBusinessAnalytics(results[8]?.status === "fulfilled" ? results[8].value : null);
      setCalculationStats(results[9]?.status === "fulfilled" ? results[9].value : null);
    } catch {
      setCalculationStats(null);
      setKnowledgeStats(null);
      setQuestionStats(null);
      setRequestStats(null);
      setAnalyticsData(null);
      setCustomerStats(null);
      setBusinessAnalytics(null);
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
  const currentMonthParam = useMemo(() => new Date().toISOString().slice(0, 7), []);

  return (
    <section className="min-h-full bg-[var(--background)] px-3 py-5 sm:px-6 sm:py-8" dir={dir}>
      <div className="mx-auto max-w-7xl">
        <div className="ui-card mb-6 overflow-hidden rounded-2xl">
          <div className="border-s-4 border-teal-700 bg-[var(--surface)] p-4 sm:p-7">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher variant="purple" />
            </div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 dark:bg-purple-950/40 px-4 py-2 text-sm font-bold text-purple-700 dark:text-purple-300">
                  <BarChart3 size={17} />
                  {isEn ? "ArtinAzma Management Dashboard" : "داشبورد مدیریتی آرتین آزما"}
                </div>

                <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                  {isEn ? "System Overview" : "نمای کلی سیستم"}
                </h1>

                <p className="mt-4 max-w-4xl leading-8 text-[var(--text-muted)]">
                  {isEn
                    ? "Track knowledge base status, user questions, customer requests, and key management workflows."
                    : "وضعیت بانک دانش، سوالات کاربران، درخواست‌های مشتریان و مسیرهای مهم مدیریتی را از این بخش دنبال کنید."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 px-4 py-2">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300">{isEn ? "Management export:" : "خروجی مدیریتی:"}</span>
                  <a
                    href={adminUrl("/admin/report/export?period=week")}
                    download
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 shadow-sm border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition"
                  >
                    <Download size={13} /> {isEn ? "Weekly" : "هفتگی"}
                  </a>
                  <a
                    href={adminUrl(`/admin/report/export?period=month&month=${currentMonthParam}`)}
                    download
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 shadow-sm border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition"
                  >
                    <Download size={13} /> {isEn ? "Current month" : "ماه جاری"}
                  </a>
                </div>
                <button
                  onClick={loadStats}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-3 text-sm font-bold text-[var(--text-muted)] shadow-sm transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
                >
                  <RefreshCw
                    size={18}
                    className={loading ? "animate-spin" : ""}
                  />
                  {isEn ? "Refresh dashboard" : "بروزرسانی داشبورد"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DashboardCard
            title={isEn ? "Knowledge files" : "فایل‌های بانک دانش"}
            value={knowledgeStats?.total_files ?? 0}
            icon={<Database size={24} />}
            tone="purple"
            href="/admin/knowledge"
          />

          <DashboardCard
            title={isEn ? "Text chunks" : "بخش‌های متنی"}
            value={knowledgeStats?.total_chunks ?? 0}
            icon={<FolderOpen size={24} />}
            tone="blue"
            href="/admin/knowledge"
          />

          <DashboardCard title={isEn?"Calculation usage":"استفاده از محاسبات"} value={calculationStats?.total??0} icon={<Calculator size={24}/>} tone="blue" href="/admin/calculations"/>

          <DashboardCard
            title={isEn ? "Total questions" : "کل سوالات"}
            value={questionStats?.total_questions ?? 0}
            icon={<FileQuestion size={24} />}
            tone="slate"
            href="/admin/questions"
          />

          <DashboardCard
            title={isEn ? "Total requests" : "کل درخواست‌ها"}
            value={requestStats?.total_requests ?? 0}
            icon={<Inbox size={24} />}
            tone="emerald"
            href="/admin/requests"
          />

          <DashboardCard
            title={isEn ? "New requests" : "درخواست‌های جدید"}
            value={customerStats?.new_requests ?? getStatusCount(requestStats, "new")}
            icon={<MessageSquareText size={24} />}
            tone="amber"
            href="/admin/requests"
          />

          <DashboardCard
            title={isEn ? "Reviewing" : "در حال بررسی"}
            value={getStatusCount(requestStats, "reviewing")}
            icon={<Activity size={24} />}
            tone="red"
            href="/admin/requests"
          />

          <DashboardCard
            title={isEn ? "Needs follow-up" : "نیازمند پیگیری"}
            value={requestStats?.reminder_summary?.total_attention ?? 0}
            icon={<BellRing size={24} />}
            tone="red"
            href="/admin/requests"
          />
        </div>

        {requestStats?.reminder_summary && (
          <div className="mb-6 overflow-hidden rounded-[28px] border border-[var(--color-warning-border)] bg-[var(--surface)] shadow-sm">
            <div className="flex flex-col gap-4 border-b border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]/70 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-warning-border)] bg-[var(--surface)] text-[var(--color-warning-text)]">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-[var(--foreground)]">
                    {isEn ? "Request Follow-Up Reminders" : "یادآوری پیگیری درخواست‌ها"}
                  </h2>
                  <p className="mt-1 text-sm font-bold leading-7 text-[var(--text-muted)]">
                    {isEn
                      ? "Requests that are overdue, due today, or have been left open without a follow-up time."
                      : "درخواست‌هایی که موعدشان گذشته، امروز باید پیگیری شوند، یا چند روز بدون موعد مانده‌اند."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-2xl bg-[var(--surface)] px-4 py-3">
                  <div className="text-2xl font-black text-[var(--color-danger-text)]">
                    {requestStats.reminder_summary.overdue_follow_ups}
                  </div>
                  <div className="text-xs font-bold text-[var(--text-subtle)]">{isEn ? "Overdue" : "گذشته"}</div>
                </div>
                <div className="rounded-2xl bg-[var(--surface)] px-4 py-3">
                  <div className="text-2xl font-black text-[var(--color-warning-text)]">
                    {requestStats.reminder_summary.due_today}
                  </div>
                  <div className="text-xs font-bold text-[var(--text-subtle)]">{isEn ? "Today" : "امروز"}</div>
                </div>
                <div className="rounded-2xl bg-[var(--surface)] px-4 py-3">
                  <div className="text-2xl font-black text-[var(--text-muted)]">
                    {requestStats.reminder_summary.stale_open}
                  </div>
                  <div className="text-xs font-bold text-[var(--text-subtle)]">{isEn ? "Stale" : "معطل"}</div>
                </div>
                <div className="rounded-2xl bg-[var(--surface)] px-4 py-3">
                  <div className="text-2xl font-black text-purple-700 dark:text-purple-300">
                    {requestStats.reminder_summary.unassigned_open}
                  </div>
                  <div className="text-xs font-bold text-[var(--text-subtle)]">{isEn ? "Unassigned" : "بدون مسئول"}</div>
                </div>
              </div>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto p-4">
              {requestStats.reminders?.length ? (
                requestStats.reminders.map((item) => (
                  <Link
                    key={`${item.reason}-${item.id}`}
                    href="/admin/requests"
                    className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4 transition hover:bg-[var(--surface)] hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-black text-[var(--text-muted)]">
                            #{item.id}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${getReminderReasonClass(item.reason)}`}>
                            {getReminderReasonLabel(item.reason, locale)}
                          </span>
                          <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-black text-[var(--color-info-text)]">
                            {getPriorityLabel(item.priority, locale)}
                          </span>
                        </div>
                        <div className="mt-2 truncate text-sm font-black text-[var(--foreground)]">
                          {item.subject || item.full_name}
                        </div>
                        <div className="mt-1 truncate text-xs font-bold text-[var(--text-subtle)]">
                          {item.full_name} {item.company ? `• ${item.company}` : ""}
                        </div>
                      </div>

                      <div className="shrink-0 text-xs font-bold leading-6 text-[var(--text-subtle)] lg:text-left">
                        <div>{isEn ? "Owner" : "مسئول"}: {item.assigned_to || (isEn ? "Unassigned" : "تعیین نشده")}</div>
                        <div>{isEn ? "Due" : "موعد"}: {item.follow_up_at ? formatDate(item.follow_up_at, locale) : (isEn ? "No due date" : "بدون موعد")}</div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState text={isEn ? "No urgent follow-up requests are visible right now." : "فعلاً درخواست نیازمند پیگیری فوری دیده نمی‌شود."} />
              )}
            </div>
          </div>
        )}

        {/* ─── Cache Stats Row ────────────────────────────────────── */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <DashboardCard
            title={isEn ? "Cached responses" : "پاسخ‌های کش‌شده"}
            value={cacheStats?.total_entries ?? 0}
            icon={<Zap size={24} />}
            tone="amber"
            href="/admin/dashboard"
          />

          <div className="group rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-bold text-[var(--text-subtle)]">{isEn ? "Cache capacity" : "ظرفیت Cache"}</div>
                <div className="mt-3 text-4xl font-black text-[var(--foreground)]">
                  {cacheStats ? `${cacheStats.fill_pct}${isEn ? "%" : "٪"}` : "—"}
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]">
                <Database size={24} />
              </div>
            </div>
            {cacheStats && (
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700"
                    style={{ width: `${cacheStats.fill_pct}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-[var(--text-subtle)] font-bold">
                  {isEn
                    ? `${cacheStats.total_entries} / ${cacheStats.max_entries}, retained for ${cacheStats.ttl_hours} hours`
                    : `${cacheStats.total_entries} / ${cacheStats.max_entries} — نگهداری تا ${cacheStats.ttl_hours} ساعت`}
                </div>
              </div>
            )}
          </div>

          <div className="group rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-[var(--text-subtle)]">{isEn ? "API savings" : "صرفه‌جویی API"}</div>
                <div className="mt-3 text-4xl font-black text-[var(--foreground)]">
                  {cacheStats?.total_entries ?? "—"}x
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info-border)]">
                <Activity size={24} />
              </div>
            </div>
            <div className="mt-4 text-xs font-bold text-[var(--text-subtle)]">
              {isEn
                ? "Repeated questions are returned from cache without calling OpenAI."
                : "هر سوال تکراری از Cache برگردانده می‌شود بدون صدا زدن OpenAI"}
            </div>
          </div>
        </div>

        {/* ─── Customer Stats Row ─────────────────────────────────── */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <DashboardCard
            title={isEn ? "Registered customers" : "مشتریان ثبت‌نام‌شده"}
            value={customerStats?.total_customers ?? 0}
            icon={<Users size={24} />}
            tone="purple"
            href="/admin/customers"
          />

          <DashboardCard
            title={isEn ? "Customer chat sessions" : "جلسات گفتگوی مشتریان"}
            value={customerStats?.total_sessions ?? 0}
            icon={<MessagesSquare size={24} />}
            tone="blue"
            href="/admin/customers?sessions=1"
          />

          <DashboardCard
            title={isEn ? "Total customer messages" : "کل پیام‌های مشتریان"}
            value={customerStats?.total_messages ?? 0}
            icon={<BookOpen size={24} />}
            tone="emerald"
            href="/admin/questions"
          />
        </div>

        <div className="mb-5 grid auto-rows-[340px] gap-4 xl:grid-cols-3">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="mb-3 shrink-0">
              <h2 className="text-lg font-black text-[var(--foreground)]">{isEn ? "Frequent Questions" : "سوالات پرتکرار"}</h2>
              <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                {isEn
                  ? "Questions with similar wording that were asked multiple times in the selected period."
                  : "سوال‌هایی که در بازه انتخاب‌شده با متن مشابه چندبار پرسیده شده‌اند."}
              </p>
            </div>
            {businessAnalytics?.frequent_questions?.length ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pl-1">
                {businessAnalytics.frequent_questions.map((item) => (
                  <Link
                    key={`${item.latest_question_id}-${item.question}`}
                    href={`/admin/questions/${item.latest_question_id}`}
                    className="block rounded-2xl bg-[var(--surface-soft)] p-3 transition hover:bg-[var(--surface)] hover:shadow-sm"
                  >
                    <div className="line-clamp-2 text-xs font-bold leading-6 text-[var(--foreground)]">
                      {item.question}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-info-text)]">
                        {getDomainLabel(item.domain, locale)}
                      </span>
                      <span className="rounded-full bg-[var(--brand-fill)] px-2.5 py-1 text-[11px] font-black text-white">
                        {isEn ? `${item.count} times` : `${item.count} بار`}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState text={isEn ? "Not enough repeated questions have appeared in this period yet." : "هنوز سوال تکراری کافی در این بازه دیده نشده است."} />
            )}
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="mb-3 shrink-0">
              <h2 className="text-lg font-black text-[var(--foreground)]">{isEn ? "Frequent Products and Topics" : "محصولات و موضوعات پرتکرار"}</h2>
              <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                {isEn ? "Extracted from user questions and customer requests." : "استخراج‌شده از متن سوال‌ها و درخواست‌های مشتریان."}
              </p>
            </div>
            {businessAnalytics?.top_products?.length ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pl-1">
                {(() => {
                  const visibleProducts = businessAnalytics.top_products;
                  const maxCount = Math.max(...visibleProducts.map((item) => item.count), 1);
                  return visibleProducts.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-black text-[var(--foreground)]">{item.label}</span>
                        <span className="font-black text-[var(--color-success-text)]">{item.count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                          style={{ width: `${Math.max(12, Math.round((item.count / maxCount) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <EmptyState text={isEn ? "No frequent product or topic has been identified yet." : "هنوز محصول یا موضوع پرتکراری شناسایی نشده است."} />
            )}
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[var(--foreground)]">{isEn ? "Active Customers" : "مشتریان فعال"}</h2>
                <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                  {isEn ? "Based on messages, chat sessions, and registered requests." : "بر اساس پیام‌ها، جلسات گفتگو و درخواست‌های ثبت‌شده."}
                </p>
              </div>
              <Link
                href="/admin/customers"
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-black text-[var(--text-muted)] transition hover:bg-[var(--surface)]"
              >
                {isEn ? "All" : "همه"}
              </Link>
            </div>
            {businessAnalytics?.active_customers?.length ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pl-1">
                {businessAnalytics.active_customers.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/admin/customers?customer=${customer.id}`}
                    className="block rounded-2xl bg-[var(--surface-soft)] p-3 transition hover:bg-[var(--surface)] hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-black text-[var(--foreground)]">{customer.full_name}</div>
                        <div className="mt-1 truncate text-xs font-bold text-[var(--text-subtle)]">
                          {customer.company || customer.email}
                        </div>
                      </div>
                      <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 px-3 py-1 text-xs font-black text-purple-700 dark:text-purple-300">
                        {customer.score}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-[var(--text-subtle)]">
                      <span>{isEn ? `${customer.message_count} messages` : `${customer.message_count} پیام`}</span>
                      <span>{isEn ? `${customer.session_count} sessions` : `${customer.session_count} جلسه`}</span>
                      <span>{isEn ? `${customer.request_count} requests` : `${customer.request_count} درخواست`}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState text={isEn ? "No active customers are visible in this period yet." : "هنوز مشتری فعالی در این بازه دیده نشده است."} />
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-[var(--foreground)]">
                      {isEn ? "Customer Request Status" : "وضعیت درخواست‌های مشتریان"}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                      {isEn ? "Requests broken down by follow-up status." : "تفکیک درخواست‌ها بر اساس وضعیت پیگیری."}
                    </p>
                  </div>

                  <Link
                    href="/admin/requests"
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-purple-800"
                  >
                    {isEn ? "View" : "مشاهده"}
                    <ArrowUpRight size={16} />
                  </Link>
                </div>

                {requestStats && requestStats.statuses?.length > 0 ? (
                  <div className="space-y-2">
                    {requestStats.statuses.map((item) => (
                      <div
                        key={item.status}
                        className="flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] p-3"
                      >
                        <span className="text-sm font-bold text-[var(--text-muted)]">
                          {getStatusLabel(item.status, locale)}
                        </span>

                        <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-black text-purple-700 dark:text-purple-300">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text={isEn ? "No requests have been registered yet." : "هنوز درخواستی ثبت نشده است."} />
                )}
              </div>

              <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-lg font-black text-[var(--foreground)]">
                    {isEn ? "Customer Request Types" : "نوع درخواست‌های مشتریان"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "Topics customers most often submit requests about." : "موضوعاتی که مشتریان بیشتر درباره آن‌ها درخواست ثبت کرده‌اند."}
                  </p>
                </div>

                {requestStats && requestStats.types?.length > 0 ? (
                  <div className="space-y-2">
                    {requestStats.types.map((item) => (
                      <div
                        key={item.request_type}
                        className="flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] p-3"
                      >
                        <span className="text-sm font-bold text-[var(--text-muted)]">
                          {getTypeLabel(item.request_type, locale)}
                        </span>

                        <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-black text-[var(--color-success-text)]">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text={isEn ? "No request type has been registered yet." : "هنوز نوع درخواستی ثبت نشده است."} />
                )}
              </div>
            </div>

            <div className="flex h-[380px] min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[var(--foreground)]">
                    {isEn ? "Latest User Questions" : "آخرین سوالات کاربران"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "Recent questions users have asked Artin." : "سوالات اخیر که توسط کاربران از آرتین پرسیده شده‌اند."}
                  </p>
                </div>

                <Link
                  href="/admin/questions"
                  className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--text-muted)] transition hover:bg-[var(--surface)]"
                >
                  {isEn ? "All questions" : "همه سوالات"}
                </Link>
              </div>

              {recentQuestions.length > 0 ? (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pl-1">
                  {recentQuestions.map((item) => (
                    <Link
                      key={item.id}
                      href={`/admin/questions/${item.id}`}
                      className="group block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4 transition hover:border-purple-200 dark:hover:border-purple-800 hover:bg-[var(--surface)] hover:shadow-sm"
                    >
                      <div className="line-clamp-2 text-sm font-bold leading-7 text-[var(--foreground)] group-hover:text-purple-700 dark:group-hover:text-purple-300">
                        {item.question}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--text-subtle)]">
                        <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 font-bold text-purple-700 dark:text-purple-300">
                          {getDomainLabel(item.detected_domain, locale)}
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={14} />
                          {formatDate(item.created_at, locale)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState text={isEn ? "No questions have been registered yet." : "هنوز سوالی ثبت نشده است."} />
              )}
            </div>
          </div>

          <aside className="grid auto-rows-[260px] items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[var(--foreground)]">
                    {isEn ? "Frequent Question Domains" : "حوزه‌های پرتکرار سوالات"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "Domains users ask about most often." : "حوزه‌هایی که کاربران بیشتر درباره آن‌ها سوال پرسیده‌اند."}
                  </p>
                </div>
              </div>

              {topDomains.length > 0 ? (
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pl-1">
                  {(() => {
                    const maxCount = Math.max(...topDomains.map(d => d.count), 1);
                    return topDomains.map((item) => (
                      <div key={item.domain}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-bold text-[var(--text-muted)]">{getDomainLabel(item.domain, locale)}</span>
                          <span className="font-black text-[var(--color-info-text)]">{item.count}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400 transition-all duration-700"
                            style={{ width: `${Math.round((item.count / maxCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <EmptyState text={isEn ? "No questions have been registered yet." : "هنوز سوالی ثبت نشده است."} />
              )}
            </div>

            {/* ─── Daily Activity Line Chart ────────────────────────── */}
            {analyticsData?.daily && analyticsData.daily.length > 0 && (
              <DailyLineChart
                data={analyticsData.daily}
                analyticsDays={analyticsDays}
                loading={loading}
                onDaysChange={setAnalyticsDays}
                locale={locale}
              />
            )}

            {/* ─── Domain Pie Chart ─────────────────────────────────── */}
            {topDomains.length > 0 && (
              <DomainPieChart domains={topDomains} locale={locale} />
            )}

            {/* ─── Hourly Heatmap ──────────────────────────────────────── */}
            {analyticsData?.hourly && analyticsData.hourly.length > 0 && (
              <HourlyHeatmap data={analyticsData.hourly} locale={locale} />
            )}

            {/* ─── Response Time Widget ───────────────────────────────── */}
            {responseTimeStats && responseTimeStats.total_answered > 0 && (
              <ResponseTimeWidget
                avgMs={responseTimeStats.avg_ms}
                totalAnswered={responseTimeStats.total_answered}
                locale={locale}
              />
            )}

            {/* ─── Trending Keywords ────────────────────────────────────── */}
            {analyticsData?.top_keywords && analyticsData.top_keywords.length > 0 && (
              <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
                <div className="mb-3 shrink-0">
                  <h2 className="text-lg font-black text-[var(--foreground)]">
                    {isEn ? `Frequent keywords in the last ${analyticsDays} days` : `کلمات پرتکرار ${analyticsDays} روز اخیر`}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "Topics users have searched most often." : "موضوعاتی که کاربران بیشتر جستجو کرده‌اند."}
                  </p>
                </div>
                <div className="flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-y-auto pl-1">
                  {analyticsData.top_keywords.map((kw) => (
                    <span
                      key={kw.word}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--color-info-bg)] px-2.5 py-1 text-xs font-bold text-[var(--color-info-text)]"
                    >
                      {kw.word}
                      <span className="rounded-full bg-[var(--color-info-bg)] px-1.5 py-0.5 text-[11px] font-black text-[var(--color-info-text)]">
                        {kw.count}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Cache Gauge Widget ──────────────────────────────── */}
            {cacheStats && (
              <CacheGaugeWidget stats={cacheStats} locale={locale} />
            )}

            {/* ─── Feedback Stats Widget ───────────────────────────── */}
            {feedbackStats && (
              <FeedbackStatsWidget stats={feedbackStats} locale={locale} />
            )}

            <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[var(--foreground)]">
                    {isEn ? "Knowledge Base Categories" : "دسته‌بندی‌های بانک دانش"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "Active categories in Artin's knowledge base." : "دسته‌بندی‌های فعال در بانک دانش آرتین."}
                  </p>
                </div>
              </div>

              {knowledgeCategories.length > 0 ? (
                <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto pl-1">
                  {knowledgeCategories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300"
                    >
                      {getCategoryLabel(category, locale)}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState text={isEn ? "No category has been registered yet." : "هنوز دسته‌بندی ثبت نشده است."} />
              )}
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[var(--foreground)]">
                    {isEn ? "Recent Knowledge Base Files" : "فایل‌های اخیر بانک دانش"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "A subset of files registered in the knowledge base." : "بخشی از فایل‌های ثبت‌شده در بانک دانش."}
                  </p>
                </div>
              </div>

              {knowledgeFiles.length > 0 ? (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pl-1">
                  {knowledgeFiles.map((file) => (
                    <div
                      key={file}
                      className="rounded-2xl bg-[var(--surface-soft)] p-3 text-xs font-bold leading-6 text-[var(--text-muted)]"
                    >
                      {file}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text={isEn ? "No file has been registered yet." : "هنوز فایلی ثبت نشده است."} />
              )}

              <Link
                href="/admin/knowledge"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-800"
              >
                {isEn ? "Manage knowledge base" : "مدیریت بانک دانش"}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
