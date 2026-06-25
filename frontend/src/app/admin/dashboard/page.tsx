"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { apiUrl, adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  Activity,
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
  reminder_summary?: {
    overdue_follow_ups: number;
    due_today: number;
    stale_open: number;
    unassigned_open: number;
    total_attention: number;
  };
  reminders?: RequestReminder[];
};

type RequestReminder = {
  id: number;
  full_name: string;
  company: string;
  request_type: string;
  subject: string;
  status: string;
  priority: string;
  assigned_to: string;
  follow_up_at: string;
  created_at: string;
  updated_at: string;
  reason: string;
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

type ResponseTimeStats = {
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  total_answered: number;
};

type CustomerStats = {
  total_customers: number;
  total_sessions: number;
  total_messages: number;
  new_requests: number;
};

type BusinessAnalytics = {
  days: number;
  frequent_questions: {
    question: string;
    count: number;
    domain: string;
    latest_question_id: number;
    latest_at: string;
  }[];
  top_products: { label: string; count: number }[];
  active_customers: {
    id: number;
    full_name: string;
    email: string;
    company: string;
    session_count: number;
    message_count: number;
    request_count: number;
    last_active: string | null;
    score: number;
  }[];
};

const REQUEST_STATUS_LABELS: Record<string, { fa: string; en: string }> = {
  new: { fa: "جدید", en: "New" },
  reviewing: { fa: "در حال بررسی", en: "Reviewing" },
  pricing: { fa: "قیمت‌گذاری", en: "Pricing" },
  sent: { fa: "ارسال‌شده", en: "Sent" },
  closed: { fa: "بسته‌شده", en: "Closed" },
};

function normalizeRequestStatus(status: string) {
  if (status === "in_progress") return "reviewing";
  if (status === "done") return "sent";
  return REQUEST_STATUS_LABELS[status] ? status : "new";
}

function getStatusLabel(status: string, locale = "fa") {
  const label = REQUEST_STATUS_LABELS[normalizeRequestStatus(status)] || REQUEST_STATUS_LABELS.new;
  return locale === "en" ? label.en : label.fa;
}

function getTypeLabel(type: string, locale = "fa") {
  const isEn = locale === "en";
  if (type === "equipment") return isEn ? "Equipment" : "تجهیزات";
  if (type === "chemical") return isEn ? "Chemicals / additives" : "مواد شیمیایی / افزودنی‌ها";
  if (type === "catalyst") return isEn ? "Catalyst / adsorbent" : "کاتالیست / جاذب";
  if (type === "test-analysis") return isEn ? "Test analysis" : "تحلیل تست";
  if (type === "troubleshooting") return isEn ? "Troubleshooting" : "عیب‌یابی";
  if (type === "price-inquiry") return isEn ? "Price inquiry" : "استعلام قیمت";
  return isEn ? "Technical consultation" : "مشاوره فنی";
}

function getDomainLabel(domain: string, locale = "fa") {
  const isEn = locale === "en";
  if (domain === "general") return isEn ? "General" : "عمومی";
  if (domain === "catalyst") return isEn ? "Catalyst" : "کاتالیست";
  if (domain === "equipment") return isEn ? "Equipment" : "تجهیزات";
  if (domain === "chromatography") return isEn ? "Chromatography" : "کروماتوگرافی";
  if (domain === "mercury-analysis") return isEn ? "Mercury analysis" : "آنالیز جیوه";
  if (domain === "sulfur-analysis") return isEn ? "Sulfur analysis" : "آنالیز سولفور";
  if (domain === "troubleshooting") return isEn ? "Troubleshooting" : "عیب‌یابی";
  if (domain === "analysis") return isEn ? "Analysis and testing" : "آنالیز و تست";
  if (domain === "sales") return isEn ? "Sales" : "فروش";
  if (domain === "petroleum") return isEn ? "Petroleum" : "نفت و پتروشیمی";
  if (domain === "technical_general") return isEn ? "Technical general" : "فنی عمومی";
  return domain || (isEn ? "Auto detected" : "تشخیص خودکار");
}

function getCategoryLabel(category: string, locale = "fa") {
  const isEn = locale === "en";
  if (category === "general") return isEn ? "General" : "عمومی";
  if (category === "catalyst") return isEn ? "Catalyst" : "کاتالیست";
  if (category === "equipment") return isEn ? "Equipment" : "تجهیزات";
  if (category === "chromatography") return isEn ? "Chromatography" : "کروماتوگرافی";
  if (category === "mercury-analysis") return isEn ? "Mercury analysis" : "آنالیز جیوه";
  if (category === "sulfur-analysis") return isEn ? "Sulfur analysis" : "آنالیز سولفور";
  if (category === "troubleshooting") return isEn ? "Troubleshooting" : "عیب‌یابی";
  if (category === "application-note") return isEn ? "Application note" : "اپلیکیشن نوت";
  if (category === "ASTM Standards") return isEn ? "ASTM Standards" : "استانداردهای ASTM";
  if (category === "expert-faq") return isEn ? "Approved FAQ" : "FAQ تاییدشده";
  return category || (isEn ? "Uncategorized" : "بدون دسته‌بندی");
}

function formatDate(value?: string, locale = "fa") {
  if (!value) return locale === "en" ? "Unknown" : "نامشخص";

  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getStatusCount(stats: RequestStats | null, status: string) {
  const normalizedTarget = normalizeRequestStatus(status);
  return stats?.statuses?.reduce((total, item) => {
    return normalizeRequestStatus(item.status) === normalizedTarget
      ? total + item.count
      : total;
  }, 0) ?? 0;
}

function getReminderReasonLabel(reason: string, locale = "fa") {
  const isEn = locale === "en";
  if (reason === "overdue_follow_up") return isEn ? "Overdue" : "موعد گذشته";
  if (reason === "due_today") return isEn ? "Due today" : "پیگیری امروز";
  if (reason === "stale_open") return isEn ? "Stale" : "معطل‌مانده";
  return isEn ? "Needs follow-up" : "نیازمند پیگیری";
}

function getReminderReasonClass(reason: string) {
  if (reason === "overdue_follow_up") return "bg-red-50 text-red-700 border-red-100";
  if (reason === "due_today") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getPriorityLabel(priority: string, locale = "fa") {
  const isEn = locale === "en";
  if (priority === "urgent") return isEn ? "Urgent" : "فوری";
  if (priority === "high") return isEn ? "High" : "بالا";
  if (priority === "low") return isEn ? "Low" : "کم";
  return isEn ? "Normal" : "عادی";
}

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
  const [loading, setLoading] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(14);

  async function loadStats() {
    setLoading(true);

    try {
      const [knowledgeRes, questionRes, requestRes, analyticsRes, customerRes, cacheRes, feedbackRes, responseTimeRes, businessRes] = await Promise.all([
        fetch(apiUrl("/knowledge/stats"), { cache: "no-store" }),
        fetch(adminUrl("/questions/stats"), { cache: "no-store" }),
        fetch(adminUrl("/customer-requests/stats"), { cache: "no-store" }),
        fetch(apiUrl(`/questions/analytics?days=${analyticsDays}`), { cache: "no-store" }),
        fetch(apiUrl("/customers/stats"), { cache: "no-store" }),
        fetch(adminUrl("/admin/cache/stats"), { cache: "no-store" }),
        fetch(adminUrl("/admin/feedback-stats"), { cache: "no-store" }),
        fetch(adminUrl("/admin/response-time-stats"), { cache: "no-store" }),
        fetch(adminUrl(`/admin/business-analytics?days=${analyticsDays}`), { cache: "no-store" }),
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
    } catch {
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
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8" dir={dir}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 via-white to-slate-50 p-8">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher variant="purple" />
            </div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                  <BarChart3 size={17} />
                  {isEn ? "ArtinAzma Management Dashboard" : "داشبورد مدیریتی آرتین آزما"}
                </div>

                <h1 className="text-3xl font-black text-slate-900">
                  {isEn ? "System Overview" : "نمای کلی سیستم"}
                </h1>

                <p className="mt-4 max-w-4xl leading-8 text-slate-600">
                  {isEn
                    ? "Track knowledge base status, user questions, customer requests, and key management workflows."
                    : "وضعیت بانک دانش، سوالات کاربران، درخواست‌های مشتریان و مسیرهای مهم مدیریتی را از این بخش دنبال کنید."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-2">
                  <span className="text-xs font-bold text-purple-700">{isEn ? "Management export:" : "خروجی مدیریتی:"}</span>
                  <a
                    href={adminUrl("/admin/report/export?period=week")}
                    download
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-purple-700 shadow-sm border border-purple-200 hover:bg-purple-100 transition"
                  >
                    <Download size={13} /> {isEn ? "Weekly" : "هفتگی"}
                  </a>
                  <a
                    href={adminUrl(`/admin/report/export?period=month&month=${currentMonthParam}`)}
                    download
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-purple-700 shadow-sm border border-purple-200 hover:bg-purple-100 transition"
                  >
                    <Download size={13} /> {isEn ? "Current month" : "ماه جاری"}
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
          <div className="mb-6 overflow-hidden rounded-[28px] border border-amber-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-amber-100 bg-amber-50/70 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-white text-amber-700">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {isEn ? "Request Follow-Up Reminders" : "یادآوری پیگیری درخواست‌ها"}
                  </h2>
                  <p className="mt-1 text-sm font-bold leading-7 text-slate-600">
                    {isEn
                      ? "Requests that are overdue, due today, or have been left open without a follow-up time."
                      : "درخواست‌هایی که موعدشان گذشته، امروز باید پیگیری شوند، یا چند روز بدون موعد مانده‌اند."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <div className="text-2xl font-black text-red-700">
                    {requestStats.reminder_summary.overdue_follow_ups}
                  </div>
                  <div className="text-xs font-bold text-slate-500">{isEn ? "Overdue" : "گذشته"}</div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <div className="text-2xl font-black text-amber-700">
                    {requestStats.reminder_summary.due_today}
                  </div>
                  <div className="text-xs font-bold text-slate-500">{isEn ? "Today" : "امروز"}</div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <div className="text-2xl font-black text-slate-700">
                    {requestStats.reminder_summary.stale_open}
                  </div>
                  <div className="text-xs font-bold text-slate-500">{isEn ? "Stale" : "معطل"}</div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <div className="text-2xl font-black text-purple-700">
                    {requestStats.reminder_summary.unassigned_open}
                  </div>
                  <div className="text-xs font-bold text-slate-500">{isEn ? "Unassigned" : "بدون مسئول"}</div>
                </div>
              </div>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto p-4">
              {requestStats.reminders?.length ? (
                requestStats.reminders.map((item) => (
                  <Link
                    key={`${item.reason}-${item.id}`}
                    href="/admin/requests"
                    className="block rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                            #{item.id}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${getReminderReasonClass(item.reason)}`}>
                            {getReminderReasonLabel(item.reason, locale)}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700">
                            {getPriorityLabel(item.priority, locale)}
                          </span>
                        </div>
                        <div className="mt-2 truncate text-sm font-black text-slate-900">
                          {item.subject || item.full_name}
                        </div>
                        <div className="mt-1 truncate text-xs font-bold text-slate-500">
                          {item.full_name} {item.company ? `• ${item.company}` : ""}
                        </div>
                      </div>

                      <div className="shrink-0 text-xs font-bold leading-6 text-slate-500 lg:text-left">
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

          <div className="group rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-500">{isEn ? "Cache capacity" : "ظرفیت Cache"}</div>
                <div className="mt-3 text-4xl font-black text-slate-900">
                  {cacheStats ? `${cacheStats.fill_pct}${isEn ? "%" : "٪"}` : "—"}
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
                  {isEn
                    ? `${cacheStats.total_entries} / ${cacheStats.max_entries}, retained for ${cacheStats.ttl_hours} hours`
                    : `${cacheStats.total_entries} / ${cacheStats.max_entries} — نگهداری تا ${cacheStats.ttl_hours} ساعت`}
                </div>
              </div>
            )}
          </div>

          <div className="group rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-500">{isEn ? "API savings" : "صرفه‌جویی API"}</div>
                <div className="mt-3 text-4xl font-black text-slate-900">
                  {cacheStats?.total_entries ?? "—"}x
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-blue-50 text-blue-700 border-blue-100">
                <Activity size={24} />
              </div>
            </div>
            <div className="mt-4 text-xs font-bold text-slate-400">
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
          <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 shrink-0">
              <h2 className="text-lg font-black text-slate-900">{isEn ? "Frequent Questions" : "سوالات پرتکرار"}</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">
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
                    className="block rounded-2xl bg-slate-50 p-3 transition hover:bg-white hover:shadow-sm"
                  >
                    <div className="line-clamp-2 text-xs font-bold leading-6 text-slate-800">
                      {item.question}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700">
                        {getDomainLabel(item.domain, locale)}
                      </span>
                      <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-black text-white">
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

          <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 shrink-0">
              <h2 className="text-lg font-black text-slate-900">{isEn ? "Frequent Products and Topics" : "محصولات و موضوعات پرتکرار"}</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">
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
                        <span className="font-black text-slate-800">{item.label}</span>
                        <span className="font-black text-emerald-700">{item.count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
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

          <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">{isEn ? "Active Customers" : "مشتریان فعال"}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {isEn ? "Based on messages, chat sessions, and registered requests." : "بر اساس پیام‌ها، جلسات گفتگو و درخواست‌های ثبت‌شده."}
                </p>
              </div>
              <Link
                href="/admin/customers"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-white"
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
                    className="block rounded-2xl bg-slate-50 p-3 transition hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-black text-slate-900">{customer.full_name}</div>
                        <div className="mt-1 truncate text-xs font-bold text-slate-500">
                          {customer.company || customer.email}
                        </div>
                      </div>
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-700">
                        {customer.score}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
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
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      {isEn ? "Customer Request Status" : "وضعیت درخواست‌های مشتریان"}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-slate-500">
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
                        className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"
                      >
                        <span className="text-sm font-bold text-slate-700">
                          {getStatusLabel(item.status, locale)}
                        </span>

                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-purple-700">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text={isEn ? "No requests have been registered yet." : "هنوز درخواستی ثبت نشده است."} />
                )}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-lg font-black text-slate-900">
                    {isEn ? "Customer Request Types" : "نوع درخواست‌های مشتریان"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {isEn ? "Topics customers most often submit requests about." : "موضوعاتی که مشتریان بیشتر درباره آن‌ها درخواست ثبت کرده‌اند."}
                  </p>
                </div>

                {requestStats && requestStats.types?.length > 0 ? (
                  <div className="space-y-2">
                    {requestStats.types.map((item) => (
                      <div
                        key={item.request_type}
                        className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"
                      >
                        <span className="text-sm font-bold text-slate-700">
                          {getTypeLabel(item.request_type, locale)}
                        </span>

                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-700">
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

            <div className="flex h-[380px] min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {isEn ? "Latest User Questions" : "آخرین سوالات کاربران"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {isEn ? "Recent questions users have asked Artin." : "سوالات اخیر که توسط کاربران از آرتین پرسیده شده‌اند."}
                  </p>
                </div>

                <Link
                  href="/admin/questions"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-white"
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
                      className="group block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-purple-200 hover:bg-white hover:shadow-sm"
                    >
                      <div className="line-clamp-2 text-sm font-bold leading-7 text-slate-900 group-hover:text-purple-700">
                        {item.question}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-white px-2.5 py-1 font-bold text-purple-700">
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
            <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {isEn ? "Frequent Question Domains" : "حوزه‌های پرتکرار سوالات"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
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
                          <span className="font-bold text-slate-700">{getDomainLabel(item.domain, locale)}</span>
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
              <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 shrink-0">
                  <h2 className="text-lg font-black text-slate-900">
                    {isEn ? `Frequent keywords in the last ${analyticsDays} days` : `کلمات پرتکرار ${analyticsDays} روز اخیر`}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {isEn ? "Topics users have searched most often." : "موضوعاتی که کاربران بیشتر جستجو کرده‌اند."}
                  </p>
                </div>
                <div className="flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-y-auto pl-1">
                  {analyticsData.top_keywords.map((kw) => (
                    <span
                      key={kw.word}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700"
                    >
                      {kw.word}
                      <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[11px] font-black text-indigo-600">
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

            <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {isEn ? "Knowledge Base Categories" : "دسته‌بندی‌های بانک دانش"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {isEn ? "Active categories in Artin's knowledge base." : "دسته‌بندی‌های فعال در بانک دانش آرتین."}
                  </p>
                </div>
              </div>

              {knowledgeCategories.length > 0 ? (
                <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto pl-1">
                  {knowledgeCategories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-purple-50 px-2.5 py-1.5 text-xs font-bold text-purple-700"
                    >
                      {getCategoryLabel(category, locale)}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState text={isEn ? "No category has been registered yet." : "هنوز دسته‌بندی ثبت نشده است."} />
              )}
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {isEn ? "Recent Knowledge Base Files" : "فایل‌های اخیر بانک دانش"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {isEn ? "A subset of files registered in the knowledge base." : "بخشی از فایل‌های ثبت‌شده در بانک دانش."}
                  </p>
                </div>
              </div>

              {knowledgeFiles.length > 0 ? (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pl-1">
                  {knowledgeFiles.map((file) => (
                    <div
                      key={file}
                      className="rounded-2xl bg-slate-50 p-3 text-xs font-bold leading-6 text-slate-700"
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
function DailyLineChart({
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900">{isEn ? "Daily Activity" : "فعالیت روزانه"}</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {isEn ? "Registered questions by day" : "تعداد سوالات ثبت‌شده به تفکیک روز"}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="text-xs font-black text-slate-500">{isEn ? "Range" : "بازه"}:</span>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
              className={`rounded-xl px-2.5 py-1.5 text-xs font-black transition ${
                analyticsDays === d
                  ? "bg-purple-600 text-white shadow-sm"
                  : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-purple-50 hover:text-purple-700"
              }`}
            >
              {isEn ? `${d} days` : `${d} روز`}
            </button>
          ))}
          <button
            onClick={() => downloadCSV("daily-activity.csv", [isEn ? "Date" : "تاریخ", isEn ? "Question count" : "تعداد سوال"], data.map((d) => [d.day, d.count]))}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
            title={isEn ? "Download CSV" : "دانلود CSV"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          {loading && <span className="text-xs font-bold text-slate-400">{isEn ? "Loading..." : "در حال بارگذاری..."}</span>}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="min-h-0 w-full flex-1"
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
const PIE_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function DomainPieChart({ domains, locale }: { domains: QuestionDomain[]; locale: string }) {
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-black leading-6 text-slate-900">
            {isEn ? "Question Domains" : "حوزه‌های سوالات"}
          </h2>
          <p className="mt-1 max-w-[180px] text-[11px] font-bold leading-4 text-slate-500">
            {isEn ? "Share of all questions" : "سهم از کل سوالات"}
          </p>
        </div>
        <button
          onClick={() => downloadCSV("domain-distribution.csv", [isEn ? "Domain" : "حوزه", isEn ? "Count" : "تعداد", isEn ? "Percent" : "درصد"], domains.map((d) => [d.domain, d.count, total > 0 ? ((d.count / total) * 100).toFixed(1) : 0]))}
          className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
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
                <span className="min-w-0 flex-1 truncate font-bold text-slate-700">{s.label}</span>
                <span className="shrink-0 tabular-nums text-slate-400">{s.pct}{isEn ? "%" : "٪"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feedback Stats Widget ───────────────────────────────────────────────────
function FeedbackStatsWidget({ stats, locale }: { stats: FeedbackStats; locale: string }) {
  const isEn = locale === "en";
  const pct = stats.satisfaction_pct;
  const ratedPct = stats.total_questions > 0
    ? Math.round((stats.rated / stats.total_questions) * 100)
    : 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Star size={20} />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900">{isEn ? "User Satisfaction" : "رضایت کاربران"}</h2>
          <p className="text-xs text-slate-500">{isEn ? "Feedback on Artin's answers" : "بازخورد روی پاسخ‌های آرتین"}</p>
        </div>
      </div>

      {/* Satisfaction score */}
      <div className="mb-3 flex items-end gap-3">
        <div className="text-3xl font-black text-slate-900">
          {pct !== null ? `${pct}${isEn ? "%" : "٪"}` : "—"}
        </div>
        <div className="mb-1 text-sm font-bold text-emerald-600">{isEn ? "Satisfaction" : "رضایت"}</div>
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
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3">
          <ThumbsUp size={16} className="text-emerald-600" />
          <div>
            <div className="text-xl font-black text-emerald-700">{stats.up}</div>
            <div className="text-[11px] font-bold text-emerald-500">{isEn ? "Helpful" : "مفید بود"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3">
          <ThumbsDown size={16} className="text-red-500" />
          <div>
            <div className="text-xl font-black text-red-600">{stats.down}</div>
            <div className="text-[11px] font-bold text-red-400">{isEn ? "Needs improvement" : "نیاز به بهبود"}</div>
          </div>
        </div>
      </div>

      {/* Rated vs unrated */}
      <div className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500 space-y-1">
        <div className="flex justify-between">
          <span>{isEn ? "Rated" : "ارزیابی‌شده"}</span>
          <span className="text-slate-700">
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
function CacheGaugeWidget({ stats, locale }: { stats: CacheStats; locale: string }) {
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2">
        <h2 className="text-base font-black text-slate-900">{isEn ? "Smart Cache Status" : "وضعیت Cache هوشمند"}</h2>
        <p className="mt-1 text-xs font-bold text-slate-500">
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
            <span className="font-bold text-slate-700">
              {isEn ? `${stats.total_entries} cached responses` : `${stats.total_entries} پاسخ کش‌شده`}
            </span>
          </div>
          <div className="text-slate-500">{isEn ? `Maximum: ${stats.max_entries} entries` : `حداکثر: ${stats.max_entries} ورودی`}</div>
          <div className="text-slate-500">{isEn ? `Retention: ${stats.ttl_hours} hours` : `مدت نگهداری: ${stats.ttl_hours} ساعت`}</div>
          <div className="mt-1 w-fit rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            {isEn ? `${stats.total_entries} API calls saved` : `${stats.total_entries} بار صرفه‌جویی API`}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Hourly Activity Heatmap ───────────────────────────────────────────────
function HourlyHeatmap({ data, locale }: { data: { hour: number; count: number }[]; locale: string }) {
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2">
        <h2 className="text-base font-black text-slate-900">{isEn ? "Peak Hours" : "ساعات پرتردد"}</h2>
        <p className="mt-1 text-xs font-bold text-slate-500">{isEn ? "User activity by hour of day" : "فعالیت کاربران به تفکیک ساعت روز"}</p>
      </div>
      <div className="grid grid-cols-12 gap-1.5" style={{ direction: "ltr" }}>
        {data.map((d) => (
          <div key={d.hour} className="flex flex-col items-center gap-1">
            <div
              className="aspect-square w-full rounded-md transition-all hover:scale-110"
              style={{ background: getColor(d.count) }}
              title={isEn ? `Hour ${d.hour}: ${d.count} questions` : `ساعت ${d.hour}: ${d.count} سوال`}
            />
            <span className="text-[9px] font-bold text-slate-400">
              {d.hour}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-slate-400">
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
function ResponseTimeWidget({ avgMs, totalAnswered, locale }: { avgMs: number; totalAnswered: number; locale: string }) {
  const isEn = locale === "en";
  const avgSec = (avgMs / 1000).toFixed(1);
  const rating = avgMs < 3000
    ? (isEn ? "Excellent" : "عالی")
    : avgMs < 8000
      ? (isEn ? "Good" : "خوب")
      : avgMs < 15000
        ? (isEn ? "Average" : "متوسط")
        : (isEn ? "Slow" : "کند");
  const ratingColor = avgMs < 3000 ? "text-emerald-600" : avgMs < 8000 ? "text-blue-600" : avgMs < 15000 ? "text-amber-600" : "text-red-600";
  const barPct = Math.min(100, Math.round((avgMs / 20000) * 100));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Clock3 size={20} />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900">{isEn ? "Response Time" : "زمان پاسخ"}</h2>
          <p className="text-xs text-slate-500">{isEn ? "Average AI answer generation time" : "میانگین زمان تولید پاسخ AI"}</p>
        </div>
      </div>

      <div className="mb-3 flex items-end gap-3">
        <div className="text-3xl font-black text-slate-900">{avgSec}</div>
        <div className="mb-1 text-sm font-bold text-slate-500">{isEn ? "seconds" : "ثانیه"}</div>
        <div className={`mb-1 mr-2 text-sm font-black ${ratingColor}`}>{rating}</div>
      </div>

      <div className="mb-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-400 to-indigo-500 transition-all duration-700"
            style={{ width: `${barPct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-400">
          <span>{isEn ? "0 sec" : "۰ ثانیه"}</span>
          <span>{isEn ? "20 sec" : "۲۰ ثانیه"}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">
        {isEn ? `${totalAnswered} answered questions` : `${totalAnswered} سوال پاسخ داده‌شده`}
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
  const { locale } = useI18n();
  const isEn = locale === "en";
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
        {isEn ? "View details" : "مشاهده جزئیات"}
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
