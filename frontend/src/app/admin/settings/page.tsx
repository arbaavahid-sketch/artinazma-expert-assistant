"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

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
  if (status === "connected") return "bg-emerald-50 text-emerald-700";
  if (status === "failed") return "bg-red-50 text-red-700";
  if (status === "not_configured") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
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
      const res = await fetch(apiUrl(`/system/status${checkAi ? "?check_ai=true" : ""}`));
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
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="rounded-[32px] bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 text-sm font-bold text-blue-700">
              تنظیمات سیستم آرتین
            </div>

            <h1 className="text-3xl font-bold text-slate-900">
              وضعیت اتصال، بانک دانش و حالت پاسخ‌دهی
            </h1>

            <p className="mt-4 max-w-3xl leading-8 text-slate-600">
              در این بخش می‌توانید وضعیت Backend، اتصال OpenAI، فعال بودن پاسخ محلی
              و آمار بانک دانش آرتین آزما را بررسی کنید.
            </p>
          </div>

          <button
            onClick={() => loadStatus(false)}
            disabled={loading}
            className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "در حال بروزرسانی..." : "بروزرسانی وضعیت"}
          </button>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-red-700">
            {message}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-slate-50 p-5">
            <div className="text-sm font-bold text-slate-500">Backend</div>
            <div className="mt-3 text-2xl font-black text-emerald-700">
              {status?.backend_status === "running" ? "فعال" : "نامشخص"}
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              وضعیت API اصلی اپلیکیشن.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-50 p-5">
            <div className="text-sm font-bold text-slate-500">OpenAI API Key</div>
            <div className="mt-3 text-2xl font-black">
              {status?.openai_configured ? "تنظیم شده" : "غیرفعال"}
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              اگر غیرفعال باشد، آرتین از پاسخ محلی استفاده می‌کند.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-50 p-5">
            <div className="text-sm font-bold text-slate-500">Local Fallback</div>
            <div className="mt-3 text-2xl font-black text-blue-700">
              {status?.local_fallback_enabled ? "فعال" : "غیرفعال"}
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              در صورت قطع OpenAI، از بانک دانش محلی پاسخ داده می‌شود.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-50 p-5">
            <div className="text-sm font-bold text-slate-500">بانک دانش</div>
            <div className="mt-3 text-2xl font-black">
              {status?.knowledge_stats?.total_files ?? 0} فایل
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {status?.knowledge_stats?.total_chunks ?? 0} بخش متنی ذخیره شده.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  تست اتصال OpenAI
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  این تست فقط وقتی اجرا می‌شود که روی دکمه بزنید.
                </p>
              </div>

              <button
                onClick={() => loadStatus(true)}
                disabled={checkingAi}
                className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {checkingAi ? "در حال تست..." : "تست اتصال AI"}
              </button>
            </div>

            <div
              className={`inline-flex rounded-2xl px-4 py-2 text-sm font-bold ${getAiStatusClass(
                status?.openai_status || "not_checked"
              )}`}
            >
              وضعیت: {getAiStatusLabel(status?.openai_status || "not_checked")}
            </div>

            {status?.openai_error && (
              <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm leading-7 text-red-700">
                {status.openai_error}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-xl font-bold text-slate-900">
              دسته‌بندی‌های بانک دانش
            </h2>

            {status?.knowledge_stats?.categories?.length ? (
              <div className="flex flex-wrap gap-2">
                {status.knowledge_stats.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
                  >
                    {category}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">هنوز دسته‌بندی‌ای ثبت نشده است.</p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-slate-50 p-6">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            حالت‌های پاسخ‌دهی آرتین
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-5">
              <div className="font-bold text-slate-900">حالت AI</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                وقتی OpenAI در دسترس باشد، آرتین از بانک دانش جست‌وجو می‌کند و
                پاسخ نهایی را با مدل AI کامل‌تر و تحلیلی‌تر می‌نویسد.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5">
              <div className="font-bold text-slate-900">حالت محلی</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">
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