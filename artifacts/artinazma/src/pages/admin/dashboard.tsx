import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  Activity, ArrowUpRight, BarChart3, Clock3, Database,
  FileQuestion, FolderOpen, Inbox, MessageSquareText, RefreshCw,
} from "lucide-react";

type KnowledgeStats = { total_chunks: number; total_files: number; files: string[]; categories: string[]; };
type QuestionDomain = { domain: string; count: number; };
type RecentQuestion = { id: number; question: string; detected_domain: string; created_at: string; };
type QuestionStats = { total_questions: number; domains: QuestionDomain[]; recent_questions: RecentQuestion[]; };
type RequestStatus = { status: string; count: number; };
type RequestType = { request_type: string; count: number; };
type RequestStats = { total_requests: number; statuses: RequestStatus[]; types: RequestType[]; };

function getStatusLabel(s: string) {
  if (s === "in_progress") return "در حال پیگیری";
  if (s === "done") return "انجام شده";
  if (s === "closed") return "بسته شده";
  return "جدید";
}
function getTypeLabel(t: string) {
  if (t === "equipment") return "تجهیزات";
  if (t === "chemical") return "مواد شیمیایی / افزودنی‌ها";
  if (t === "catalyst") return "کاتالیست / جاذب";
  if (t === "test-analysis") return "تحلیل تست";
  if (t === "troubleshooting") return "عیب‌یابی";
  if (t === "price-inquiry") return "استعلام قیمت";
  return "مشاوره فنی";
}
function getDomainLabel(d: string) {
  if (d === "catalyst") return "کاتالیست";
  if (d === "equipment") return "تجهیزات";
  if (d === "chromatography") return "کروماتوگرافی";
  if (d === "mercury-analysis") return "آنالیز جیوه";
  if (d === "sulfur-analysis") return "آنالیز سولفور";
  if (d === "troubleshooting") return "عیب‌یابی";
  if (d === "analysis") return "آنالیز و تست";
  return d || "تشخیص خودکار";
}
function getCategoryLabel(c: string) {
  if (c === "general") return "عمومی";
  if (c === "catalyst") return "کاتالیست";
  if (c === "equipment") return "تجهیزات";
  if (c === "chromatography") return "کروماتوگرافی";
  if (c === "mercury-analysis") return "آنالیز جیوه";
  if (c === "sulfur-analysis") return "آنالیز سولفور";
  if (c === "troubleshooting") return "عیب‌یابی";
  if (c === "application-note") return "اپلیکیشن نوت";
  if (c === "ASTM Standards") return "استانداردهای ASTM";
  if (c === "expert-faq") return "FAQ تاییدشده";
  return c || "بدون دسته‌بندی";
}
function formatDate(value?: string) {
  if (!value) return "نامشخص";
  try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  catch { return value; }
}
function getStatusCount(stats: RequestStats | null, status: string) {
  return stats?.statuses?.find((item) => item.status === status)?.count ?? 0;
}

function DashboardCard({ title, value, icon, tone, href }: { title: string; value: number; icon: React.ReactNode; tone: "purple"|"blue"|"slate"|"emerald"|"amber"|"red"; href: string; }) {
  const toneClass = { purple: "bg-purple-50 text-purple-700 border-purple-100", blue: "bg-blue-50 text-blue-700 border-blue-100", slate: "bg-slate-50 text-slate-700 border-slate-200", emerald: "bg-emerald-50 text-emerald-700 border-emerald-100", amber: "bg-amber-50 text-amber-700 border-amber-100", red: "bg-red-50 text-red-700 border-red-100" }[tone];
  return (
    <Link href={href} className="group rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-500">{title}</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{value}</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${toneClass}`}>{icon}</div>
      </div>
      <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-slate-400 transition group-hover:text-purple-700">مشاهده جزئیات <ArrowUpRight size={14} /></div>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>;
}

export default function DashboardPage() {
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);
  const [requestStats, setRequestStats] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadStats() {
    setLoading(true);
    try {
      const [knowledgeRes, questionRes, requestRes] = await Promise.all([
        fetch(apiUrl("/knowledge/stats"), { cache: "no-store" }),
        fetch(apiUrl("/questions/stats"), { cache: "no-store" }),
        fetch(apiUrl("/customer-requests/stats"), { cache: "no-store" }),
      ]);
      const [knowledgeData, questionData, requestData] = await Promise.all([knowledgeRes.json(), questionRes.json(), requestRes.json()]);
      setKnowledgeStats(knowledgeData);
      setQuestionStats(questionData);
      setRequestStats(requestData);
    } catch {
      setKnowledgeStats(null); setQuestionStats(null); setRequestStats(null);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadStats(); }, []);
  const topDomains = useMemo(() => questionStats?.domains || [], [questionStats]);
  const recentQuestions = useMemo(() => questionStats?.recent_questions || [], [questionStats]);
  const knowledgeCategories = knowledgeStats?.categories || [];
  const knowledgeFiles = knowledgeStats?.files || [];

  return (
    <section className="min-h-screen bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700"><BarChart3 size={17} />داشبورد مدیریتی آرتین آزما</div>
                <h1 className="text-3xl font-black text-slate-900">نمای کلی سیستم</h1>
                <p className="mt-4 max-w-4xl leading-8 text-slate-600">وضعیت بانک دانش، سوالات کاربران، درخواست‌های مشتریان و مسیرهای مهم مدیریتی را از این بخش دنبال کنید.</p>
              </div>
              <button onClick={loadStats} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />بروزرسانی داشبورد
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <DashboardCard title="فایل‌های بانک دانش" value={knowledgeStats?.total_files ?? 0} icon={<Database size={24} />} tone="purple" href="/admin/knowledge" />
          <DashboardCard title="بخش‌های متنی" value={knowledgeStats?.total_chunks ?? 0} icon={<FolderOpen size={24} />} tone="blue" href="/admin/knowledge" />
          <DashboardCard title="کل سوالات" value={questionStats?.total_questions ?? 0} icon={<FileQuestion size={24} />} tone="slate" href="/admin/questions" />
          <DashboardCard title="کل درخواست‌ها" value={requestStats?.total_requests ?? 0} icon={<Inbox size={24} />} tone="emerald" href="/admin/requests" />
          <DashboardCard title="درخواست‌های جدید" value={getStatusCount(requestStats, "new")} icon={<MessageSquareText size={24} />} tone="amber" href="/admin/requests" />
          <DashboardCard title="در حال پیگیری" value={getStatusCount(requestStats, "in_progress")} icon={<Activity size={24} />} tone="red" href="/admin/requests" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div><h2 className="text-xl font-black text-slate-900">وضعیت درخواست‌های مشتریان</h2><p className="mt-2 text-sm text-slate-500">تفکیک درخواست‌ها بر اساس وضعیت پیگیری.</p></div>
                  <Link href="/admin/requests" className="inline-flex items-center gap-2 rounded-2xl bg-purple-700 px-4 py-2 text-sm font-bold text-white hover:bg-purple-800">مشاهده <ArrowUpRight size={16} /></Link>
                </div>
                {requestStats && requestStats.statuses?.length > 0 ? (
                  <div className="space-y-3">
                    {requestStats.statuses.map((item) => (
                      <div key={item.status} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                        <span className="font-bold text-slate-700">{getStatusLabel(item.status)}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-purple-700">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState text="هنوز درخواستی ثبت نشده است." />}
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5"><h2 className="text-xl font-black text-slate-900">نوع درخواست‌های مشتریان</h2><p className="mt-2 text-sm text-slate-500">موضوعاتی که مشتریان بیشتر درباره آن‌ها درخواست ثبت کرده‌اند.</p></div>
                {requestStats && requestStats.types?.length > 0 ? (
                  <div className="space-y-3">
                    {requestStats.types.map((item) => (
                      <div key={item.request_type} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                        <span className="font-bold text-slate-700">{getTypeLabel(item.request_type)}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-emerald-700">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState text="هنوز نوع درخواستی ثبت نشده است." />}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div><h2 className="text-xl font-black text-slate-900">آخرین سوالات کاربران</h2><p className="mt-2 text-sm text-slate-500">سوالات اخیر که توسط کاربران از آرتین پرسیده شده‌اند.</p></div>
                <Link href="/admin/questions" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-white">همه سوالات</Link>
              </div>
              {recentQuestions.length > 0 ? (
                <div className="space-y-3">
                  {recentQuestions.map((item) => (
                    <Link key={item.id} href={`/admin/questions/${item.id}`} className="group block rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-purple-200 hover:bg-white hover:shadow-sm">
                      <div className="line-clamp-2 font-bold leading-8 text-slate-900 group-hover:text-purple-700">{item.question}</div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="rounded-full bg-white px-3 py-1 font-bold text-purple-700">{getDomainLabel(item.detected_domain)}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 size={14} />{formatDate(item.created_at)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : <EmptyState text="هنوز سوالی ثبت نشده است." />}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5"><h2 className="text-xl font-black text-slate-900">حوزه‌های پرتکرار سوالات</h2><p className="mt-2 text-sm text-slate-500">حوزه‌هایی که کاربران بیشتر درباره آن‌ها سوال پرسیده‌اند.</p></div>
              {topDomains.length > 0 ? (
                <div className="space-y-3">
                  {topDomains.map((item) => (
                    <div key={item.domain} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                      <span className="font-bold text-slate-700">{getDomainLabel(item.domain)}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-blue-700">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState text="هنوز سوالی ثبت نشده است." />}
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5"><h2 className="text-xl font-black text-slate-900">دسته‌بندی‌های بانک دانش</h2><p className="mt-2 text-sm text-slate-500">دسته‌بندی‌های فعال در بانک دانش آرتین.</p></div>
              {knowledgeCategories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {knowledgeCategories.map((cat) => (
                    <span key={cat} className="rounded-full bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700">{getCategoryLabel(cat)}</span>
                  ))}
                </div>
              ) : <EmptyState text="هنوز دسته‌بندی ثبت نشده است." />}
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5"><h2 className="text-xl font-black text-slate-900">فایل‌های اخیر بانک دانش</h2><p className="mt-2 text-sm text-slate-500">بخشی از فایل‌های ثبت‌شده در بانک دانش.</p></div>
              {knowledgeFiles.length > 0 ? (
                <div className="space-y-3">
                  {knowledgeFiles.slice(0, 8).map((file) => (
                    <div key={file} className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{file}</div>
                  ))}
                </div>
              ) : <EmptyState text="هنوز فایلی ثبت نشده است." />}
              <Link href="/admin/knowledge" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 text-sm font-bold text-white hover:bg-purple-800">
                مدیریت بانک دانش <ArrowUpRight size={16} />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
