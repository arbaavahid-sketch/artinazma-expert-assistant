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
  Mail,
  MessageCircle,
  RefreshCw,
  Save,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  Wifi,
  Cloud,
  Play,
  Clock,
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

function getAiStatusLabel(status: string, locale: string) {
  const isEn = locale === "en";
  if (status === "connected") return isEn ? "Connected" : "متصل";
  if (status === "failed") return isEn ? "Connection failed" : "خطا در اتصال";
  if (status === "not_configured") return isEn ? "Not configured" : "تنظیم نشده";
  if (status === "unknown") return isEn ? "Unknown" : "نامشخص";
  return isEn ? "Not tested" : "تست نشده";
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

function getCategoryLabel(category: string, locale: string) {
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

function getHealthTone(check?: DeepHealthCheck) {
  if (!check) return "border-slate-200 bg-slate-50 text-slate-600";
  if (check.ok) return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (check.status === "not_configured") return "border-amber-100 bg-amber-50 text-amber-700";
  return "border-red-100 bg-red-50 text-red-700";
}

function getHealthIcon(check?: DeepHealthCheck) {
  if (!check) return <Clock size={16} />;
  if (check.ok) return <CheckCircle2 size={16} />;
  return <AlertCircle size={16} />;
}

type GDriveSchedule = {
  interval_hours: number;
  enabled: boolean;
  last_sync: string;
  last_sync_result: string;
  folder_id_configured: boolean;
  sync_status?: string;
  sync_started_at?: string;
  sync_finished_at?: string;
};

type DeepHealthCheck = {
  ok: boolean;
  status: string;
  configured?: boolean;
  enabled?: boolean;
  error?: string;
};

type DeepHealth = {
  ok: boolean;
  response_ms: number;
  checks: Record<string, DeepHealthCheck>;
};

export default function AdminSettingsPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAi, setCheckingAi] = useState(false);
  const [message, setMessage] = useState("");
  const [gdriveSchedule, setGdriveSchedule] = useState<GDriveSchedule | null>(null);
  const [gdriveIntervalInput, setGdriveIntervalInput] = useState("24");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [gdriveMessage, setGdriveMessage] = useState("");
  const [deepHealth, setDeepHealth] = useState<DeepHealth | null>(null);
  const [loadingDeepHealth, setLoadingDeepHealth] = useState(false);

  // Qdrant status
  type QdrantStatus = { enabled: boolean; backend: string; points_count?: number; vectors_count?: number; status?: string; error?: string };
  const [qdrantStatus, setQdrantStatus] = useState<QdrantStatus | null>(null);

  // Email settings state
  const [emailSettings, setEmailSettings] = useState({
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_pass: "",
    from_addr: "", to_addr: "", weekly_enabled: false, request_alerts_enabled: true,
  });
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailMessageType, setEmailMessageType] = useState<"success" | "error">("success");

  // Telegram settings state
  const [tgSettings, setTgSettings] = useState({ bot_token: "", chat_id: "", enabled: false });
  const [savingTg, setSavingTg] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [tgMessage, setTgMessage] = useState("");
  const [tgMessageType, setTgMessageType] = useState<"success" | "error">("success");

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

  async function loadGdriveSchedule() {
    try {
      const res = await fetch(adminUrl("/admin/gdrive-schedule"), { cache: "no-store" });
      if (res.ok) {
        const data: GDriveSchedule = await res.json();
        setGdriveSchedule(data);
        if (data.interval_hours > 0) {
          setGdriveIntervalInput(String(data.interval_hours));
        }
      }
    } catch { /* ignore */ }
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

  async function saveGdriveSchedule(enabled: boolean) {
    setSavingSchedule(true);
    setGdriveMessage("");
    try {
      const interval = enabled ? parseFloat(gdriveIntervalInput) || 24 : 0;
      const res = await fetch(adminUrl("/admin/gdrive-schedule"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval_hours: interval }),
      });
      const data = await res.json();
      setGdriveMessage(data.message || (isEn ? "Saved." : "ذخیره شد."));
      await loadGdriveSchedule();
    } catch {
      setGdriveMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setSavingSchedule(false);
    }
  }

  async function runGdriveSyncNow() {
    setSyncingNow(true);
    setGdriveMessage("");

    try {
      const res = await fetch(
        adminUrl("/admin/gdrive-sync-now"),
        { method: "POST" },
      );
      const data = await res.json();

      if (res.ok && data.success) {
        setGdriveMessage(
          data.message || (isEn ? "Background sync started." : "همگام‌سازی در پس‌زمینه آغاز شد."),
        );
      } else {
        setGdriveMessage(
          data.message || data.detail || (isEn ? "Sync failed." : "خطا در همگام‌سازی."),
        );
      }

      await loadGdriveSchedule();
    } catch {
      setGdriveMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setSyncingNow(false);
    }
  }


  async function loadEmailSettings() {
    try {
      const res = await fetch(adminUrl("/admin/email-settings"), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setEmailSettings((prev) => ({ ...prev, ...data }));
      }
    } catch { /* ignore */ }
  }

  async function saveEmailSettings() {
    setSavingEmail(true);
    setEmailMessage("");
    try {
      const res = await fetch(adminUrl("/admin/email-settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailSettings),
      });
      const data = await res.json();
      setEmailMessageType(data.success ? "success" : "error");
      setEmailMessage(data.message || (isEn ? "Saved." : "ذخیره شد."));
    } catch {
      setEmailMessageType("error");
      setEmailMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function sendWeeklyReport() {
    setSendingReport(true);
    setEmailMessage("");
    try {
      const res = await fetch(adminUrl("/admin/send-weekly-report"), { method: "POST" });
      const data = await res.json();
      setEmailMessageType(data.success ? "success" : "error");
      setEmailMessage(data.message || (data.success ? (isEn ? "Sent." : "ارسال شد.") : (isEn ? "Send failed." : "خطا در ارسال.")));
    } catch {
      setEmailMessageType("error");
      setEmailMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setSendingReport(false);
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

  async function loadTgSettings() {
    try {
      const res = await fetch(adminUrl("/admin/telegram-settings"), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTgSettings(data);
      }
    } catch { /* ignore */ }
  }

  async function saveTgSettings() {
    setSavingTg(true);
    setTgMessage("");
    try {
      const res = await fetch(adminUrl("/admin/telegram-settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tgSettings),
      });
      const data = await res.json();
      setTgMessageType(data.success ? "success" : "error");
      setTgMessage(data.message || (isEn ? "Saved." : "ذخیره شد."));
      await loadTgSettings();
    } catch {
      setTgMessageType("error");
      setTgMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setSavingTg(false);
    }
  }

  async function testTg() {
    setTestingTg(true);
    setTgMessage("");
    try {
      const res = await fetch(adminUrl("/admin/telegram-test"), { method: "POST" });
      const data = await res.json();
      setTgMessageType(data.success ? "success" : "error");
      setTgMessage(data.message || (isEn ? "Message sent." : "پیام ارسال شد."));
    } catch {
      setTgMessageType("error");
      setTgMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setTestingTg(false);
    }
  }

  useEffect(() => {
    loadStatus(false);
    loadDeepHealth(false);
    loadGdriveSchedule();
    loadEmailSettings();
    loadQdrantStatus();
    loadTgSettings();
    // This is a one-time settings bootstrap; the loader functions are invoked by explicit refresh actions after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gdriveSchedule?.sync_status !== "running") return;

    const timer = window.setInterval(() => {
      void loadGdriveSchedule();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [gdriveSchedule?.sync_status]);

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
                  <Settings2 size={17} />
                  {isEn ? "Artin System Settings" : "تنظیمات سیستم آرتین"}
                </div>

                <h1 className="text-3xl font-black text-slate-900">
                  {isEn ? "Connection, Knowledge Base, and Response Mode" : "وضعیت اتصال، بانک دانش و حالت پاسخ‌دهی"}
                </h1>

                <p className="mt-4 max-w-4xl leading-8 text-slate-600">
                  {isEn
                    ? "Check backend status, OpenAI connectivity, local fallback, and ArtinAzma knowledge base statistics."
                    : "وضعیت Backend، اتصال OpenAI، پاسخ محلی و آمار بانک دانش آرتین آزما را از این بخش بررسی کنید."}
                </p>
              </div>

              <button
                onClick={() => loadStatus(false)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
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
          <div className="mb-6 flex items-start gap-3 rounded-[28px] border border-red-100 bg-red-50 p-5 text-red-700">
            <AlertCircle className="mt-1 shrink-0" size={20} />
            <span>{message}</span>
          </div>
        )}

        <div className="mb-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {isEn ? "Deep Health Check" : "بررسی عمیق سلامت سیستم"}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
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
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
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
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {isEn ? "OpenAI Connection Test" : "تست اتصال OpenAI"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {isEn ? "This test only runs when you press the button." : "این تست فقط وقتی اجرا می‌شود که روی دکمه بزنید."}
                </p>
              </div>

              <button
                onClick={() => loadStatus(true)}
                disabled={checkingAi}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
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
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-7 text-red-700">
                {status.openai_error}
              </div>
            )}

            <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm leading-7 text-slate-600">
              {isEn
                ? "When OpenAI is available, Artin searches the knowledge base and writes a fuller, more analytical final response with the AI model."
                : "اگر اتصال OpenAI برقرار باشد، آرتین از بانک دانش جست‌وجو می‌کند و پاسخ نهایی را با مدل AI کامل‌تر و تحلیلی‌تر می‌نویسد."}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-black text-slate-900">
              {isEn ? "Knowledge Base Categories" : "دسته‌بندی‌های بانک دانش"}
            </h2>

            {status?.knowledge_stats?.categories?.length ? (
              <div className="flex flex-wrap gap-2">
                {status.knowledge_stats.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700"
                  >
                    {getCategoryLabel(category, locale)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                {isEn ? "No categories have been registered yet." : "هنوز دسته‌بندی‌ای ثبت نشده است."}
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
                {isEn ? "Artin Response Modes" : "حالت‌های پاسخ‌دهی آرتین"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isEn ? "Artin uses AI or local fallback depending on connection status." : "آرتین بسته به وضعیت اتصال، از AI یا پاسخ محلی استفاده می‌کند."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="mb-2 flex items-center gap-2 font-black text-slate-900">
                <CheckCircle2 size={18} className="text-emerald-700" />
                {isEn ? "AI mode" : "حالت AI"}
              </div>
              <p className="text-sm leading-7 text-slate-600">
                {isEn
                  ? "When OpenAI is available, Artin searches the knowledge base and writes the final answer with deeper expert analysis."
                  : "وقتی OpenAI در دسترس باشد، آرتین از بانک دانش جست‌وجو می‌کند و پاسخ نهایی را با تحلیل تخصصی کامل‌تر می‌نویسد."}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="mb-2 flex items-center gap-2 font-black text-slate-900">
                <ShieldCheck size={18} className="text-blue-700" />
                {isEn ? "Local mode" : "حالت محلی"}
              </div>
              <p className="text-sm leading-7 text-slate-600">
                {isEn
                  ? "When OpenAI is unavailable, Artin searches the local knowledge base and answers from the matched text."
                  : "وقتی OpenAI در دسترس نباشد، آرتین داخل بانک دانش محلی جست‌وجو می‌کند و بر اساس متن‌های پیدا شده پاسخ می‌دهد."}
              </p>
            </div>
          </div>
        {/* ─── Google Drive Scheduled Sync ──────────────────────── */}
        <div className="mt-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Cloud size={25} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {isEn ? "Automatic Google Drive Sync" : "همزمان‌سازی خودکار Google Drive"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isEn ? "Sync the knowledge base with Google Drive on a schedule." : "بانک دانش را به صورت زمان‌بندی‌شده با Google Drive همزمان کنید."}
              </p>
            </div>
          </div>

          {!gdriveSchedule?.folder_id_configured && (
            <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-700">
              {isEn
                ? "GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured. Set it in the .env file to enable this feature."
                : "متغیر محیطی GOOGLE_DRIVE_ROOT_FOLDER_ID تنظیم نشده است. برای فعال‌کردن این قابلیت، آن را در فایل .env تنظیم کنید."}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  {isEn ? "Interval (hours)" : "فاصله زمانی (ساعت)"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={gdriveIntervalInput}
                  onChange={(e) => setGdriveIntervalInput(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                  placeholder={isEn ? "24" : "۲۴"}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {isEn ? "For example: 24 = once per day" : "مثلاً ۲۴ = هر روز یک‌بار"}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => saveGdriveSchedule(true)}
                  disabled={savingSchedule || !gdriveSchedule?.folder_id_configured}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
                >
                  <Clock size={16} />
                  {savingSchedule ? (isEn ? "Saving..." : "ذخیره...") : (isEn ? "Enable schedule" : "فعال‌کردن زمان‌بندی")}
                </button>

                <button
                  onClick={() => saveGdriveSchedule(false)}
                  disabled={savingSchedule}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-white disabled:opacity-50"
                >
                  {isEn ? "Disable" : "غیرفعال"}
                </button>
              </div>

              <button
                onClick={runGdriveSyncNow}
                disabled={syncingNow || gdriveSchedule?.sync_status === "running" || !gdriveSchedule?.folder_id_configured}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                <Play size={16} />
                {syncingNow || gdriveSchedule?.sync_status === "running"
                  ? (isEn ? "Syncing..." : "در حال همزمان‌سازی...")
                  : (isEn ? "Sync now" : "همزمان‌سازی فوری")}
              </button>

              {gdriveMessage && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">
                  {gdriveMessage}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500 mb-1">{isEn ? "Schedule status" : "وضعیت زمان‌بندی"}</div>
                <div className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${gdriveSchedule?.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {gdriveSchedule?.enabled
                    ? isEn
                      ? `Every ${gdriveSchedule.interval_hours} hours`
                      : `هر ${gdriveSchedule.interval_hours} ساعت یک‌بار`
                    : isEn ? "Inactive" : "غیرفعال"}
                </div>
              </div>

              {gdriveSchedule?.last_sync && (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-bold text-slate-500 mb-1">{isEn ? "Last sync" : "آخرین همزمان‌سازی"}</div>
                  <div className="text-sm text-slate-700">
                    {new Intl.DateTimeFormat(isEn ? "en-US" : "fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(gdriveSchedule.last_sync))}
                  </div>
                  {gdriveSchedule.last_sync_result && (
                    <div className="mt-1 text-xs text-slate-500">{gdriveSchedule.last_sync_result}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Email Report Settings ────────────────────────────────────────── */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Mail size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {isEn ? "Weekly Email Report" : "گزارش هفتگی ایمیل"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isEn ? "SMTP settings for automatic admin reports" : "تنظیمات SMTP برای ارسال خودکار گزارش به ادمین"}
              </p>
            </div>
          </div>

          {emailMessage && (
            <div className={`mb-5 flex items-center gap-2 rounded-2xl p-4 text-sm font-bold ${
              emailMessageType === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}>
              {emailMessageType === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {emailMessage}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">SMTP Host</label>
              <input
                value={emailSettings.smtp_host}
                onChange={(e) => setEmailSettings((s) => ({ ...s, smtp_host: e.target.value }))}
                placeholder="smtp.gmail.com"
                dir="ltr"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">Port</label>
              <select
                value={emailSettings.smtp_port}
                onChange={(e) => setEmailSettings((s) => ({ ...s, smtp_port: Number(e.target.value) }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              >
                <option value={587}>587 (STARTTLS)</option>
                <option value={465}>465 (SSL)</option>
                <option value={25}>25</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                {isEn ? "SMTP username" : "نام کاربری SMTP"}
              </label>
              <input
                value={emailSettings.smtp_user}
                onChange={(e) => setEmailSettings((s) => ({ ...s, smtp_user: e.target.value }))}
                placeholder="your@email.com"
                dir="ltr"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                {isEn ? "SMTP password" : "رمز عبور SMTP"}
              </label>
              <input
                type="password"
                value={emailSettings.smtp_pass}
                onChange={(e) => setEmailSettings((s) => ({ ...s, smtp_pass: e.target.value }))}
                placeholder={isEn ? "App password or password" : "App password یا رمز عبور"}
                dir="ltr"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                {isEn ? "Sender address" : "آدرس فرستنده"}
              </label>
              <input
                value={emailSettings.from_addr}
                onChange={(e) => setEmailSettings((s) => ({ ...s, from_addr: e.target.value }))}
                placeholder="artin@artinazma.ir"
                dir="ltr"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                {isEn ? "Recipient email (admin)" : "ایمیل گیرنده (ادمین)"}
              </label>
              <input
                value={emailSettings.to_addr}
                onChange={(e) => setEmailSettings((s) => ({ ...s, to_addr: e.target.value }))}
                placeholder="admin@artinazma.ir"
                dir="ltr"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={emailSettings.weekly_enabled}
              onChange={(e) => setEmailSettings((s) => ({ ...s, weekly_enabled: e.target.checked }))}
            />
            <span className="font-bold">
              {isEn ? "Send the report automatically once a week" : "ارسال خودکار گزارش هر هفته یک‌بار"}
            </span>
          </label>

          <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <input
              type="checkbox"
              checked={emailSettings.request_alerts_enabled}
              onChange={(e) => setEmailSettings((s) => ({ ...s, request_alerts_enabled: e.target.checked }))}
            />
            <span className="font-bold">
              {isEn ? "Send instant admin email for new customer requests" : "ارسال ایمیل فوری به ادمین برای درخواست جدید مشتری"}
            </span>
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={saveEmailSettings}
              disabled={savingEmail}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
            >
              <Save size={16} />
              {savingEmail ? (isEn ? "Saving..." : "در حال ذخیره...") : (isEn ? "Save settings" : "ذخیره تنظیمات")}
            </button>

            <button
              onClick={sendWeeklyReport}
              disabled={sendingReport || !emailSettings.to_addr}
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
            >
              <Send size={16} />
              {sendingReport ? (isEn ? "Sending..." : "در حال ارسال...") : (isEn ? "Send report now" : "ارسال گزارش الان")}
            </button>
          </div>
        </div>

        {/* ─── Telegram Settings ─────────────────────────────────────────────── */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <MessageCircle size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {isEn ? "Telegram Notifications" : "اعلان‌های تلگرام"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isEn
                  ? "Receive new customer registrations and contact requests on Telegram."
                  : "ثبت‌نام مشتری جدید و درخواست‌های تماس را روی تلگرام دریافت کن"}
              </p>
            </div>
          </div>

          {tgMessage && (
            <div className={`mb-5 flex items-center gap-2 rounded-2xl p-4 text-sm font-bold ${
              tgMessageType === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}>
              {tgMessageType === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {tgMessage}
            </div>
          )}

          {tgSettings.enabled && (
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
              <CheckCircle2 size={15} />
              {isEn ? "Telegram is active" : "تلگرام فعال است"}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                Bot Token
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="mr-2 font-normal text-sky-600 hover:underline"
                >
                  {isEn ? "(get it from @BotFather)" : "(از @BotFather بگیر)"}
                </a>
              </label>
              <input
                value={tgSettings.bot_token}
                onChange={(e) => setTgSettings((s) => ({ ...s, bot_token: e.target.value }))}
                placeholder="123456789:AABBcc..."
                dir="ltr"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                Chat ID
                <span className="mr-2 font-normal text-slate-400">
                  {isEn ? "(group or channel ID)" : "(شناسه گروه یا کانال)"}
                </span>
              </label>
              <input
                value={tgSettings.chat_id}
                onChange={(e) => setTgSettings((s) => ({ ...s, chat_id: e.target.value }))}
                placeholder="-100123456789"
                dir="ltr"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500"
              />
            </div>
          </div>

          <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-xs leading-7 text-slate-500">
            {isEn ? "To find the Chat ID, add the bot to the group, then use " : "برای پیداکردن Chat ID: ربات را به گروه اضافه کن، سپس از"}{" "}
            <span dir="ltr" className="font-mono text-slate-700">
              https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
            </span>{" "}
            {isEn ? "and copy the " : "استفاده کن و عدد "}
            <span className="font-bold">chat.id</span>
            {isEn ? " value." : " را کپی کن."}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={saveTgSettings}
              disabled={savingTg}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
            >
              <Save size={16} />
              {savingTg ? (isEn ? "Saving..." : "در حال ذخیره...") : (isEn ? "Save settings" : "ذخیره تنظیمات")}
            </button>
            <button
              onClick={testTg}
              disabled={testingTg}
              className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-bold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
            >
              <Send size={16} />
              {testingTg ? (isEn ? "Sending..." : "در حال ارسال...") : (isEn ? "Send test message" : "ارسال پیام آزمایشی")}
            </button>
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
