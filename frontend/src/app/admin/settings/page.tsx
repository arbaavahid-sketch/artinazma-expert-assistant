"use client";

import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { adminUrl } from "@/lib/api";
import { apiUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
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
  Play,
} from "lucide-react";

import EmailReportCard from "./EmailReportCard";
import GoogleDriveScheduleCard from "./GoogleDriveScheduleCard";
import TelegramSettingsCard from "./TelegramSettingsCard";
import {
  getAiStatusClass,
  getAiStatusLabel,
  getCategoryLabel,
  getHealthIcon,
  getHealthTone,
  type DeepHealth,
  type SystemStatus,
} from "./settings-types";

export default function AdminSettingsPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAi, setCheckingAi] = useState(false);
  const [message, setMessage] = useState("");
  const [deepHealth, setDeepHealth] = useState<DeepHealth | null>(null);
  const [loadingDeepHealth, setLoadingDeepHealth] = useState(false);

  // Qdrant status
  type QdrantStatus = { enabled: boolean; backend: string; points_count?: number; vectors_count?: number; status?: string; error?: string };
  const [qdrantStatus, setQdrantStatus] = useState<QdrantStatus | null>(null);

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
        },
      );

      const data = await res.json();
      setStatus(data);
    } catch {
      setMessage(isEn ? "Failed to connect to the backend." : "خطا در اتصال به Backend.");
    } finally {
      setLoading(false);
      setCheckingAi(false);
    }
  }

  async function loadDeepHealth(checkExternal = false) {
    setLoadingDeepHealth(true);
    try {
      const res = await fetch(adminUrl(`/admin/deep-health${checkExternal ? "?check_external=true" : ""}`), { cache: "no-store" });
      if (res.ok) {
        const data: DeepHealth = await res.json();
        setDeepHealth(data);
      }
    } catch { /* ignore */ }
    finally {
      setLoadingDeepHealth(false);
    }
  }

  async function loadQdrantStatus() {
    try {
      const res = await fetch(adminUrl("/admin/qdrant-status"), { cache: "no-store" });
      if (res.ok) setQdrantStatus(await res.json());
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    loadStatus(false);
    loadDeepHealth(false);
    loadQdrantStatus();
    // This is a one-time settings bootstrap; the loader functions are invoked by explicit refresh actions after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="min-h-full bg-[var(--background)] px-6 py-8" dir={dir}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 dark:from-purple-950/40 via-[var(--surface)] to-[var(--surface-soft)] p-8">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher variant="purple" />
            </div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 dark:bg-purple-950/40 px-4 py-2 text-sm font-bold text-purple-700 dark:text-purple-300">
                  <Settings2 size={17} />
                  {isEn ? "Artin System Settings" : "تنظیمات سیستم آرتین"}
                </div>

                <h1 className="text-3xl font-black text-[var(--foreground)]">
                  {isEn ? "Connection, Knowledge Base, and Response Mode" : "وضعیت اتصال، بانک دانش و حالت پاسخ‌دهی"}
                </h1>

                <p className="mt-4 max-w-4xl leading-8 text-[var(--text-muted)]">
                  {isEn
                    ? "Check backend status, OpenAI connectivity, local fallback, and ArtinAzma knowledge base statistics."
                    : "وضعیت Backend، اتصال OpenAI، پاسخ محلی و آمار بانک دانش آرتین آزما را از این بخش بررسی کنید."}
                </p>
              </div>

              <button
                onClick={() => loadStatus(false)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-3 text-sm font-bold text-[var(--text-muted)] shadow-sm transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
              >
                <RefreshCw
                  size={18}
                  className={loading ? "animate-spin" : ""}
                />
                {loading
                  ? (isEn ? "Updating..." : "در حال بروزرسانی...")
                  : (isEn ? "Refresh status" : "بروزرسانی وضعیت")}
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="mb-6 flex items-start gap-3 rounded-[28px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-5 text-[var(--color-danger-text)]">
            <AlertCircle className="mt-1 shrink-0" size={20} />
            <span>{message}</span>
          </div>
        )}

        <div className="mb-6 rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">
                {isEn ? "Deep Health Check" : "بررسی عمیق سلامت سیستم"}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                {isEn
                  ? "Database, OpenAI, Qdrant, Google Drive and email readiness."
                  : "آمادگی دیتابیس، OpenAI، Qdrant، Google Drive و ایمیل."}
                {deepHealth ? ` Response: ${deepHealth.response_ms}ms` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => loadDeepHealth(false)}
                disabled={loadingDeepHealth}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm font-bold text-[var(--text-muted)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
              >
                <RefreshCw size={16} className={loadingDeepHealth ? "animate-spin" : ""} />
                {isEn ? "Refresh" : "بروزرسانی"}
              </button>
              <button
                onClick={() => loadDeepHealth(true)}
                disabled={loadingDeepHealth}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-800 disabled:opacity-50"
              >
                <Play size={16} />
                {isEn ? "External check" : "بررسی خارجی"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {["database", "openai", "qdrant", "google_drive", "email"].map((name) => {
              const check = deepHealth?.checks?.[name];
              const healthLabel: Record<string, string> = {
                database: isEn ? "database" : "دیتابیس",
                openai: "OpenAI",
                qdrant: "Qdrant",
                google_drive: "Google Drive",
                email: isEn ? "email" : "ایمیل",
              };
              return (
                <div key={name} className={`rounded-2xl border px-4 py-3 ${getHealthTone(check)}`}>
                  <div className="mb-1 flex items-center gap-2 text-sm font-black">
                    {getHealthIcon(check)}
                    <span>{healthLabel[name] || name.replace("_", " ")}</span>
                  </div>
                  <div className="text-xs font-bold opacity-80">
                    {check?.status || (loadingDeepHealth ? (isEn ? "checking" : "در حال بررسی") : (isEn ? "not checked" : "بررسی نشده"))}
                  </div>
                  {check?.error && (
                    <div className="mt-2 line-clamp-2 text-xs leading-5 opacity-90">
                      {check.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            title="Backend"
            value={status?.backend_status === "running" ? (isEn ? "Active" : "فعال") : (isEn ? "Unknown" : "نامشخص")}
            description={isEn ? "Main application API status" : "وضعیت API اصلی اپلیکیشن"}
            icon={<Server size={24} />}
            tone="emerald"
          />

          <StatusCard
            title="OpenAI API Key"
            value={status?.openai_configured ? (isEn ? "Configured" : "تنظیم شده") : (isEn ? "Inactive" : "غیرفعال")}
            description={isEn ? "OpenAI key configuration status" : "وضعیت تنظیم کلید OpenAI"}
            icon={<Bot size={24} />}
            tone={status?.openai_configured ? "blue" : "amber"}
          />

          <StatusCard
            title="Local Fallback"
            value={status?.local_fallback_enabled ? (isEn ? "Active" : "فعال") : (isEn ? "Inactive" : "غیرفعال")}
            description={isEn ? "Local responses when AI is unavailable" : "پاسخ‌دهی محلی در صورت قطع AI"}
            icon={<ShieldCheck size={24} />}
            tone={status?.local_fallback_enabled ? "purple" : "slate"}
          />

          <StatusCard
            title={isEn ? "Knowledge Base" : "بانک دانش"}
            value={isEn ? `${status?.knowledge_stats?.total_files ?? 0} files` : `${status?.knowledge_stats?.total_files ?? 0} فایل`}
            description={isEn ? `${status?.knowledge_stats?.total_chunks ?? 0} stored text chunks` : `${status?.knowledge_stats?.total_chunks ?? 0} بخش متنی ذخیره شده`}
            icon={<Database size={24} />}
            tone="purple"
          />

          <StatusCard
            title="Qdrant Vector DB"
            value={
              qdrantStatus === null
                ? (isEn ? "Checking..." : "در حال بررسی…")
                : qdrantStatus.enabled
                ? qdrantStatus.error
                  ? (isEn ? "Connection error" : "خطا در اتصال")
                  : isEn
                    ? `${(qdrantStatus.points_count ?? 0).toLocaleString()} vectors`
                    : `${(qdrantStatus.points_count ?? 0).toLocaleString()} بردار`
                : isEn ? "Inactive (JSON)" : "غیرفعال (JSON)"
            }
            description={
              qdrantStatus?.enabled
                ? qdrantStatus.error
                  ? qdrantStatus.error
                  : isEn
                    ? `Status: ${qdrantStatus.status ?? "ok"} | backend: qdrant`
                    : `وضعیت: ${qdrantStatus.status ?? "ok"} | backend: qdrant`
                : isEn
                  ? "QDRANT_URL is not configured; JSON storage is being used."
                  : "متغیر QDRANT_URL تنظیم نشده — از فایل JSON استفاده می‌شود"
            }
            icon={<Server size={24} />}
            tone={
              qdrantStatus?.enabled && !qdrantStatus.error
                ? "blue"
                : "slate"
            }
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-[var(--foreground)]">
                  {isEn ? "OpenAI Connection Test" : "تست اتصال OpenAI"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                  {isEn ? "This test only runs when you press the button." : "این تست فقط وقتی اجرا می‌شود که روی دکمه بزنید."}
                </p>
              </div>

              <button
                onClick={() => loadStatus(true)}
                disabled={checkingAi}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-fill)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--brand-fill-hover)] disabled:opacity-50"
              >
                <Wifi size={18} />
                {checkingAi ? (isEn ? "Testing..." : "در حال تست...") : (isEn ? "Test AI connection" : "تست اتصال AI")}
              </button>
            </div>

            <div
              className={`inline-flex rounded-2xl border px-4 py-2 text-sm font-bold ${getAiStatusClass(
                status?.openai_status || "not_checked",
              )}`}
            >
              {isEn ? "Status" : "وضعیت"}: {getAiStatusLabel(status?.openai_status || "not_checked", locale)}
            </div>

            {status?.openai_error && (
              <div className="mt-4 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-4 text-sm leading-7 text-[var(--color-danger-text)]">
                {status.openai_error}
              </div>
            )}

            <div className="mt-5 rounded-3xl bg-[var(--surface-soft)] p-5 text-sm leading-7 text-[var(--text-muted)]">
              {isEn
                ? "When OpenAI is available, Artin searches the knowledge base and writes a fuller, more analytical final response with the AI model."
                : "اگر اتصال OpenAI برقرار باشد، آرتین از بانک دانش جست‌وجو می‌کند و پاسخ نهایی را با مدل AI کامل‌تر و تحلیلی‌تر می‌نویسد."}
            </div>
          </div>

          <div className="rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-black text-[var(--foreground)]">
              {isEn ? "Knowledge Base Categories" : "دسته‌بندی‌های بانک دانش"}
            </h2>

            {status?.knowledge_stats?.categories?.length ? (
              <div className="flex flex-wrap gap-2">
                {status.knowledge_stats.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-purple-50 dark:bg-purple-950/40 px-4 py-2 text-sm font-bold text-purple-700 dark:text-purple-300"
                  >
                    {getCategoryLabel(category, locale)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl bg-[var(--surface-soft)] p-6 text-center text-sm text-[var(--text-subtle)]">
                {isEn ? "No categories have been registered yet." : "هنوز دسته‌بندی‌ای ثبت نشده است."}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--text-muted)]">
              <Activity size={25} />
            </div>

            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">
                {isEn ? "Artin Response Modes" : "حالت‌های پاسخ‌دهی آرتین"}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-subtle)]">
                {isEn ? "Artin uses AI or local fallback depending on connection status." : "آرتین بسته به وضعیت اتصال، از AI یا پاسخ محلی استفاده می‌کند."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-[var(--surface-soft)] p-5">
              <div className="mb-2 flex items-center gap-2 font-black text-[var(--foreground)]">
                <CheckCircle2 size={18} className="text-[var(--color-success-text)]" />
                {isEn ? "AI mode" : "حالت AI"}
              </div>
              <p className="text-sm leading-7 text-[var(--text-muted)]">
                {isEn
                  ? "When OpenAI is available, Artin searches the knowledge base and writes the final answer with deeper expert analysis."
                  : "وقتی OpenAI در دسترس باشد، آرتین از بانک دانش جست‌وجو می‌کند و پاسخ نهایی را با تحلیل تخصصی کامل‌تر می‌نویسد."}
              </p>
            </div>

            <div className="rounded-3xl bg-[var(--surface-soft)] p-5">
              <div className="mb-2 flex items-center gap-2 font-black text-[var(--foreground)]">
                <ShieldCheck size={18} className="text-[var(--color-info-text)]" />
                {isEn ? "Local mode" : "حالت محلی"}
              </div>
              <p className="text-sm leading-7 text-[var(--text-muted)]">
                {isEn
                  ? "When OpenAI is unavailable, Artin searches the local knowledge base and answers from the matched text."
                  : "وقتی OpenAI در دسترس نباشد، آرتین داخل بانک دانش محلی جست‌وجو می‌کند و بر اساس متن‌های پیدا شده پاسخ می‌دهد."}
              </p>
            </div>
          </div>
        {/* ─── Google Drive Scheduled Sync ──────────────────────── */}
        <GoogleDriveScheduleCard />

        {/* ─── Email Report Settings ────────────────────────────────────────── */}
        <EmailReportCard />

        {/* ─── Telegram Settings ─────────────────────────────────────────────── */}
        <TelegramSettingsCard />
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
    emerald: "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]",
    blue: "bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info-border)]",
    amber: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]",
    purple: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800",
    slate: "bg-[var(--surface-soft)] text-[var(--text-muted)] border-[var(--border-soft)]",
  }[tone];

  return (
    <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-[var(--text-subtle)]">{title}</div>
          <div className="mt-3 text-2xl font-black text-[var(--foreground)]">{value}</div>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${toneClass}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-[var(--text-subtle)]">{description}</p>
    </div>
  );
}
