"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Wifi,
} from "lucide-react";

type KnowledgeStats = {
  total_chunks: number;
  total_files: number;
  files: string[];
  categories: string[];
};

type SystemStatus = {
  backend_status: string;
  openai_configured: boolean;
  openai_status: string;
  openai_error: string;
  local_fallback_enabled: boolean;
  knowledge_stats: KnowledgeStats;
};

function getAiStatusLabel(status: string) {
  if (status === "connected") return "متصل";
  if (status === "failed") return "خطا در اتصال";
  if (status === "not_configured") return "تنظیم نشده";
  if (status === "unknown") return "نامشخص";
  return "تست نشده";
}

function getAiStatusClass(status: string) {
  if (status === "connected") {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "border-red-100 bg-red-50 text-red-700";
  }

  if (status === "not_configured") {
    return "border-amber-100 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
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

export default function AdminSettingsPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAi, setCheckingAi] = useState(false);
  const [message, setMessage] = useState("");

  async function loadStatus(checkAi = false) {
    if (checkAi) {
      setCheckingAi(true);
    } else {
      setLoading(true);
    }

    setMessage("");

    try {
      const res = await fetch(
        apiUrl(`/system/status${checkAi ? "?check_ai=true" : ""}`),
        {
          cache: "no-store",
        }
      );

      const data = await res.json();
      setStatus(data);
    } catch {
      setMessage("خطا در اتصال به Backend.");
    } finally {
      setLoading(false);
      setCheckingAi(false);
    }
  }

  useEffect(() => {
    loadStatus(false);
  }, []);

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                  <Settings2 size={17} />
                  تنظیمات سیستم آرتین
                </div>

                <h1 className="text-3xl font-black text-slate-900">
                  وضعیت اتصال، بانک دانش و حالت پاسخ‌دهی
                </h1>

                <p className="mt-4 max-w-4xl leading-8 text-slate-600">
                  وضعیت Backend، اتصال OpenAI، پاسخ محلی و آمار بانک دانش آرتین
                  آزما را از این بخش بررسی کنید.
                </p>
              </div>

              <button
                onClick={() => loadStatus(false)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                {loading ? "در حال بروزرسانی..." : "بروزرسانی وضعیت"}
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="mb-6 flex items-start gap-3 rounded-[28px] border border-red-100 bg-red-50 p-5 text-red-700">
            <AlertCircle className="mt-1 shrink-0" size={20} />
            <span>{message}</span>
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            title="Backend"
            value={status?.backend_status === "running" ? "فعال" : "نامشخص"}
            description="وضعیت API اصلی اپلیکیشن"
            icon={<Server size={24} />}
            tone="emerald"
          />

          <StatusCard
            title="OpenAI API Key"
            value={status?.openai_configured ? "تنظیم شده" : "غیرفعال"}
            description="وضعیت تنظیم کلید OpenAI"
            icon={<Bot size={24} />}
            tone={status?.openai_configured ? "blue" : "amber"}
          />

          <StatusCard
            title="Local Fallback"
            value={status?.local_fallback_enabled ? "فعال" : "غیرفعال"}
            description="پاسخ‌دهی محلی در صورت قطع AI"
            icon={<ShieldCheck size={24} />}
            tone={status?.local_fallback_enabled ? "purple" : "slate"}
          />

          <StatusCard
            title="بانک دانش"
            value={`${status?.knowledge_stats?.total_files ?? 0} فایل`}
            description={`${status?.knowledge_stats?.total_chunks ?? 0} بخش متنی ذخیره شده`}
            icon={<Database size={24} />}
            tone="purple"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  تست اتصال OpenAI
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  این تست فقط وقتی اجرا می‌شود که روی دکمه بزنید.
                </p>
              </div>

              <button
                onClick={() => loadStatus(true)}
                disabled={checkingAi}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
              >
                <Wifi size={18} />
                {checkingAi ? "در حال تست..." : "تست اتصال AI"}
              </button>
            </div>

            <div
              className={`inline-flex rounded-2xl border px-4 py-2 text-sm font-bold ${getAiStatusClass(
                status?.openai_status || "not_checked"
              )}`}
            >
              وضعیت: {getAiStatusLabel(status?.openai_status || "not_checked")}
            </div>

            {status?.openai_error && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-7 text-red-700">
                {status.openai_error}
              </div>
            )}

            <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm leading-7 text-slate-600">
              اگر اتصال OpenAI برقرار باشد، آرتین از بانک دانش جست‌وجو می‌کند و
              پاسخ نهایی را با مدل AI کامل‌تر و تحلیلی‌تر می‌نویسد.
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-black text-slate-900">
              دسته‌بندی‌های بانک دانش
            </h2>

            {status?.knowledge_stats?.categories?.length ? (
              <div className="flex flex-wrap gap-2">
                {status.knowledge_stats.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700"
                  >
                    {getCategoryLabel(category)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                هنوز دسته‌بندی‌ای ثبت نشده است.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-700">
              <Activity size={25} />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900">
                حالت‌های پاسخ‌دهی آرتین
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                آرتین بسته به وضعیت اتصال، از AI یا پاسخ محلی استفاده می‌کند.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="mb-2 flex items-center gap-2 font-black text-slate-900">
                <CheckCircle2 size={18} className="text-emerald-700" />
                حالت AI
              </div>
              <p className="text-sm leading-7 text-slate-600">
                وقتی OpenAI در دسترس باشد، آرتین از بانک دانش جست‌وجو می‌کند و
                پاسخ نهایی را با تحلیل تخصصی کامل‌تر می‌نویسد.
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="mb-2 flex items-center gap-2 font-black text-slate-900">
                <ShieldCheck size={18} className="text-blue-700" />
                حالت محلی
              </div>
              <p className="text-sm leading-7 text-slate-600">
                وقتی OpenAI در دسترس نباشد، آرتین داخل بانک دانش محلی جست‌وجو
                می‌کند و بر اساس متن‌های پیدا شده پاسخ می‌دهد.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusCard({
  title,
  value,
  description,
  icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  tone: "emerald" | "blue" | "amber" | "purple" | "slate";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  }[tone];

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-500">{title}</div>
          <div className="mt-3 text-2xl font-black text-slate-900">{value}</div>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${toneClass}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-500">{description}</p>
    </div>
  );
}