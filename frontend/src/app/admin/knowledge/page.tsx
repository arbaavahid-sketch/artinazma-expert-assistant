"use client";

import { useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { apiUrl, adminUrl } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { useI18n } from "@/lib/i18n";
import { categoryOptions, getCategoryLabel } from "./knowledge-constants";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  RefreshCw,
  Search,
  TestTube2,
  UploadCloud,
} from "lucide-react";

import KnowledgeAuditLog from "./KnowledgeAuditLog";
import KnowledgeFileList from "./KnowledgeFileList";
import KnowledgePreviewPanel from "./KnowledgePreviewPanel";
import KnowledgeSearchResults from "./KnowledgeSearchResults";
import {
  buildDriveSyncSummary,
  formatDateTime,
  getDriveStatusLabel,
  type DriveSyncResult,
  type DriveSyncSummary,
  type KnowledgeSearchResult,
  type KnowledgeStats,
} from "./knowledge-types";

export default function KnowledgePage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeCategory, setKnowledgeCategory] = useState("general");
  const [categorySuggested, setCategorySuggested] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [driveSyncMessage, setDriveSyncMessage] = useState("");
  const [driveSyncResults, setDriveSyncResults] = useState<DriveSyncResult[]>(
    [],
  );
  const [driveSyncSummary, setDriveSyncSummary] = useState<DriveSyncSummary | null>(null);
  const [driveSyncFilter, setDriveSyncFilter] = useState<"all" | "added" | "unchanged" | "skipped">("all");
  const [driveMaxFiles, setDriveMaxFiles] = useState(200);
  const [forceDriveResync, setForceDriveResync] = useState(false);
  const { confirm } = useConfirm();
  const [knowledgeResult, setKnowledgeResult] = useState("");
  const [knowledgeResultType, setKnowledgeResultType] = useState<
    "success" | "error" | ""
  >("");

  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState("");
  const [reindexingFile, setReindexingFile] = useState("");

  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<KnowledgeSearchResult[]>([]);
  const [testingSearch, setTestingSearch] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [searchCategory, setSearchCategory] = useState("all");
  const [searchTopK, setSearchTopK] = useState(10);

  const [previewFile, setPreviewFile] = useState<string | null>(null);

  async function loadKnowledgeStats() {
    try {
      const res = await fetch(apiUrl("/knowledge/stats"), {
        cache: "no-store",
      });

      const data = await res.json();
      setStats(data);
    } catch {
      setStats(null);
    }
  }

  useEffect(() => {
    loadKnowledgeStats();
  }, []);

  function suggestCategoryFromFileName(name: string): string {
    const n = name.toLowerCase();
    if (/astm|d\d{3,5}/.test(n)) return "ASTM Standards";
    if (/catalyst|کاتالیست|catal/.test(n)) return "catalyst";
    if (/chrom|hplc|gc[-_]|gas.?chrom/.test(n)) return "chromatography";
    if (/mercury|جیوه|hg/.test(n)) return "mercury-analysis";
    if (/sulfur|سولفور|sulph/.test(n)) return "sulfur-analysis";
    if (/troubleshoot|fault|عیب|repair/.test(n)) return "troubleshooting";
    if (/equipment|device|دستگاه|instrument/.test(n)) return "equipment";
    if (/application.?note|app.?note/.test(n)) return "application-note";
    if (/faq|expert/.test(n)) return "expert-faq";
    return "general";
  }

  function handleFileSelect(file: File | null) {
    setKnowledgeFile(file);
    setCategorySuggested(false);
    if (!file) return;
    const suggested = suggestCategoryFromFileName(file.name);
    if (suggested !== "general") {
      setKnowledgeCategory(suggested);
      setCategorySuggested(true);
    }
  }

  async function uploadKnowledgeFile() {
    if (!knowledgeFile) return;

    setLoading(true);
    setKnowledgeResult("");
    setKnowledgeResultType("");

    const formData = new FormData();
    formData.append("file", knowledgeFile);
    formData.append("title", knowledgeTitle || knowledgeFile.name);
    formData.append("category", knowledgeCategory || "general");
    formData.append("replace_existing", replaceExisting ? "true" : "false");

    try {
      const res = await fetch(adminUrl("/knowledge/upload"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setKnowledgeResultType("success");
        setKnowledgeResult(
          isEn
            ? `File added successfully.\nFile name: ${data.file_name}\nAdded chunks: ${data.chunks_added}`
            : `فایل با موفقیت اضافه شد.\nنام فایل: ${data.file_name}\nتعداد بخش‌های اضافه‌شده: ${data.chunks_added}`,
        );

        setKnowledgeFile(null);
        setKnowledgeTitle("");
        setReplaceExisting(false);
        setCategorySuggested(false);
        setKnowledgeCategory("general");
        await loadKnowledgeStats();
      } else {
        setKnowledgeResultType("error");
        setKnowledgeResult(data.message || (isEn ? "Failed to add the file to the knowledge base." : "خطا در افزودن فایل به بانک دانش."));
      }
    } catch {
      setKnowledgeResultType("error");
      setKnowledgeResult(isEn ? "Knowledge file upload failed." : "خطا در آپلود فایل دانش.");
    } finally {
      setLoading(false);
    }
  }

  async function testKnowledgeSearch() {
    if (!testQuery.trim()) return;

    setTestingSearch(true);
    setTestMessage("");
    setTestResults([]);

    try {
      const res = await fetch(apiUrl("/knowledge/search"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: testQuery,
          domain: "auto",
          history: [],
          category: searchCategory === "all" ? null : searchCategory,
          top_k: searchTopK,
        }),
      });

      const data = await res.json();
      const results = data.results || [];

      setTestResults(results);

      if (results.length === 0) {
        setTestMessage(isEn ? "No results were found in the knowledge base." : "نتیجه‌ای از بانک دانش پیدا نشد.");
      }
    } catch {
      setTestMessage(isEn ? "Knowledge base search failed." : "خطا در جست‌وجوی بانک دانش.");
    } finally {
      setTestingSearch(false);
    }
  }
  async function syncGoogleDrive() {
    setSyncingDrive(true);
    setDriveSyncMessage("");
    setDriveSyncResults([]);
    setDriveSyncSummary(null);
    setDriveSyncFilter("all");

    try {
      // سینک در پس‌زمینهٔ سرور اجرا می‌شود تا درخواست طولانی به timeout پروکسی نخورد؛
      // اینجا فقط شروع می‌کنیم و بعد وضعیت را poll می‌کنیم.
      const startRes = await fetch(adminUrl("/admin/gdrive-sync-now"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          max_files: driveMaxFiles,
          force_resync: forceDriveResync,
        }),
      });

      const startData = await startRes.json();

      if (!startData.success && !startData.already_running) {
        setDriveSyncMessage(startData.message || (isEn ? "Google Drive sync failed to start." : "خطا در شروع همگام‌سازی Google Drive."));
        return;
      }

      const startedAt = Date.now();
      const maxWaitMs = 30 * 60 * 1000; // حداکثر ۳۰ دقیقه انتظار

      // polling وضعیت تا پایان سینک
      let finalStatus = "running";
      let lastResult: Record<string, unknown> | null = null;
      let lastResultText = "";

      while (Date.now() - startedAt < maxWaitMs) {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        setDriveSyncMessage(
          isEn
            ? `Syncing in background… (${elapsed}s)`
            : `در حال همگام‌سازی در پس‌زمینه… (${elapsed} ثانیه)`,
        );

        await new Promise((r) => setTimeout(r, 4000));

        try {
          const st = await fetch(adminUrl("/admin/gdrive-sync-result"));
          const stData = await st.json();
          finalStatus = stData.sync_status || "running";
          lastResult = stData.result || null;
          lastResultText = stData.last_result_text || "";
          if (finalStatus !== "running") break;
        } catch {
          // خطای گذرای شبکه در polling مهم نیست؛ دوباره تلاش می‌کنیم.
        }
      }

      if (finalStatus === "running") {
        setDriveSyncMessage(
          isEn
            ? "Sync is still running in the background. Check back in a few minutes."
            : "همگام‌سازی هنوز در پس‌زمینه ادامه دارد؛ چند دقیقه دیگر همین صفحه را بررسی کنید.",
        );
        return;
      }

      if (finalStatus === "error") {
        setDriveSyncMessage(lastResultText || (isEn ? "Google Drive sync failed." : "خطا در همگام‌سازی Google Drive."));
        return;
      }

      const data = (lastResult || {}) as {
        processed_files?: number;
        added_files?: number;
        unchanged_files?: number;
        skipped_files?: number;
        chunks_added?: number;
        results?: DriveSyncResult[];
        summary?: DriveSyncSummary;
      };

      setDriveSyncMessage(
        isEn
          ? `Sync completed. Processed files: ${data.processed_files ?? "?"}, added files: ${data.added_files ?? "?"}, unchanged: ${data.unchanged_files || 0}, skipped files: ${data.skipped_files ?? "?"}, added text chunks: ${data.chunks_added ?? "?"}`
          : `همگام‌سازی انجام شد. فایل‌های پردازش‌شده: ${data.processed_files ?? "؟"}، فایل‌های اضافه‌شده: ${data.added_files ?? "؟"}، بدون تغییر: ${data.unchanged_files || 0}، فایل‌های ردشده: ${data.skipped_files ?? "؟"}، بخش‌های متنی اضافه‌شده: ${data.chunks_added ?? "؟"}`,
      );

      const results = data.results || [];
      setDriveSyncResults(results);
      setDriveSyncSummary(data.summary || buildDriveSyncSummary(results));

      await loadKnowledgeStats();
    } catch {
      setDriveSyncMessage(isEn ? "Failed to connect to the server for Google Drive sync." : "خطا در اتصال به سرور برای همگام‌سازی Google Drive.");
    } finally {
      setSyncingDrive(false);
    }
  }
  async function deleteKnowledgeFile(fileName: string) {
    if (!await confirm({
      message: isEn
        ? `Are you sure you want to delete "${fileName}" from the knowledge base?`
        : `آیا مطمئن هستید که می‌خواهید فایل "${fileName}" از بانک دانش حذف شود؟`,
      variant: "danger",
      confirmLabel: isEn ? "Delete" : "حذف",
      title: isEn ? "Delete knowledge file" : "حذف فایل دانش",
    })) return;

    setDeletingFile(fileName);
    setKnowledgeResult("");
    setKnowledgeResultType("");

    try {
      const res = await fetch(
        adminUrl(`/knowledge/files/${encodeURIComponent(fileName)}`),
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      if (data.success) {
        setKnowledgeResultType("success");
        setKnowledgeResult(
          isEn
            ? `File removed from the knowledge base.\nFile name: ${data.file_name}\nRemoved chunks: ${data.removed_chunks}`
            : `فایل از بانک دانش حذف شد.\nنام فایل: ${data.file_name}\nتعداد chunk حذف‌شده: ${data.removed_chunks}`,
        );

        await loadKnowledgeStats();
      } else {
        setKnowledgeResultType("error");
        setKnowledgeResult(data.message || (isEn ? "Failed to delete the file from the knowledge base." : "خطا در حذف فایل از بانک دانش."));
      }
    } catch {
      setKnowledgeResultType("error");
      setKnowledgeResult(isEn ? "Failed to connect to the server for file deletion." : "خطا در اتصال به سرور برای حذف فایل.");
    } finally {
      setDeletingFile("");
    }
  }

  async function reindexKnowledgeFile(fileName: string) {
    if (!await confirm({
      message: isEn
        ? `"${fileName}" will be read from the source file and embedded again. Continue?`
        : `فایل "${fileName}" دوباره از روی فایل منبع خوانده و embedding می‌شود. ادامه می‌دهید؟`,
      variant: "warning",
      confirmLabel: isEn ? "Rebuild" : "بازسازی",
      title: isEn ? "Rebuild knowledge file" : "بازسازی فایل دانش",
    })) return;

    setReindexingFile(fileName);
    setKnowledgeResult("");
    setKnowledgeResultType("");

    try {
      const res = await fetch(
        adminUrl(`/knowledge/files/${encodeURIComponent(fileName)}/reindex`),
        { method: "POST" },
      );
      const data = await res.json();

      if (data.success) {
        setKnowledgeResultType("success");
        setKnowledgeResult(
          isEn
            ? `Knowledge file rebuilt.\nFile name: ${data.file_name}\nNew chunks: ${data.chunks_added}\nRemoved old chunks: ${data.removed_old_chunks || 0}`
            : `فایل دانش بازسازی شد.\nنام فایل: ${data.file_name}\nchunk جدید: ${data.chunks_added}\nchunk قبلی حذف‌شده: ${data.removed_old_chunks || 0}`,
        );
        await loadKnowledgeStats();
      } else {
        setKnowledgeResultType("error");
        setKnowledgeResult(data.message || (isEn ? "Knowledge file rebuild did not complete." : "بازسازی فایل دانش انجام نشد."));
      }
    } catch {
      setKnowledgeResultType("error");
      setKnowledgeResult(isEn ? "Failed to connect to the server for rebuilding the knowledge file." : "خطا در اتصال به سرور برای بازسازی فایل دانش.");
    } finally {
      setReindexingFile("");
    }
  }

  const filteredDriveSyncResults = useMemo(() => {
    if (driveSyncFilter === "all") return driveSyncResults;
    return driveSyncResults.filter((item) => (item.status || (item.success ? "added" : "skipped")) === driveSyncFilter);
  }, [driveSyncFilter, driveSyncResults]);

  const driveStatusCounts = driveSyncSummary?.by_status || {};
  const skippedReasons = Object.entries(driveSyncSummary?.skipped_by_reason || {})
    .sort((a, b) => b[1] - a[1]);

  return (
    <section className="min-h-full bg-[var(--background)] px-3 py-6 sm:px-6 sm:py-8" dir={dir}>
      <div className="mx-auto max-w-7xl min-w-0">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-soft)] pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
                <Database size={21} aria-hidden="true" />
              </span>
              <h1 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
                {isEn ? "ArtinAzma Private Knowledge Base" : "بانک دانش اختصاصی آرتین آزما"}
              </h1>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] dark:text-[var(--text-subtle)]">
              {isEn ? "Manage reference files, sync Google Drive, and review search quality." : "فایل‌های مرجع را مدیریت کنید، Google Drive را همگام کنید و کیفیت جست‌وجو را بررسی کنید."}
            </p>
          </div>
          <LanguageSwitcher variant="purple" />
        </header>

        <div role="group" aria-label={isEn ? "Knowledge base actions" : "عملیات بانک دانش"} className="mb-5 flex flex-wrap items-center gap-2">
          <select
            aria-label={isEn ? "Maximum Drive files" : "حداکثر تعداد فایل‌های Drive"}
            value={driveMaxFiles}
            onChange={(e) => setDriveMaxFiles(Number(e.target.value))}
            disabled={syncingDrive}
            className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--text-muted)] shadow-sm outline-none disabled:opacity-50"
          >
            <option value={10}>{isEn ? "10 files" : "۱۰ فایل"}</option>
            <option value={20}>{isEn ? "20 files" : "۲۰ فایل"}</option>
            <option value={50}>{isEn ? "50 files" : "۵۰ فایل"}</option>
            <option value={100}>{isEn ? "100 files" : "۱۰۰ فایل"}</option>
            <option value={200}>{isEn ? "200 files" : "۲۰۰ فایل"}</option>
            <option value={500}>{isEn ? "500 files" : "۵۰۰ فایل"}</option>
            <option value={1000}>{isEn ? "1000 files" : "۱۰۰۰ فایل"}</option>
            <option value={2000}>{isEn ? "2000 files" : "۲۰۰۰ فایل"}</option>
            <option value={5000}>{isEn ? "5000 files" : "۵۰۰۰ فایل"}</option>
            <option value={10000}>{isEn ? "10000 files" : "۱۰۰۰۰ فایل"}</option>
          </select>

          <label className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--text-muted)] shadow-sm">
            <input
              type="checkbox"
              checked={forceDriveResync}
              disabled={syncingDrive}
              onChange={(e) => setForceDriveResync(e.target.checked)}
            />
            {isEn ? "Full rebuild" : "بازسازی کامل"}
          </label>

          <button
            onClick={syncGoogleDrive}
            disabled={syncingDrive}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-fill)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-fill-hover)] disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={syncingDrive ? "animate-spin" : ""}
            />
            {syncingDrive
              ? (isEn ? "Syncing..." : "در حال همگام‌سازی...")
              : (isEn ? "Sync Google Drive" : "همگام‌سازی Google Drive")}
          </button>

          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = adminUrl("/admin/knowledge/export-csv");
              a.download = "knowledge_base.csv";
              a.click();
            }}
            disabled={!stats || stats.total_files === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-5 py-3 text-sm font-bold text-[var(--color-success-text)] shadow-sm transition hover:bg-[var(--color-success-bg)] disabled:opacity-40"
          >
            <Download size={18} />
            {isEn ? "Download CSV" : "دانلود CSV"}
          </button>

          <button
            onClick={loadKnowledgeStats}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-3 text-sm font-bold text-[var(--text-muted)] shadow-sm transition hover:bg-[var(--surface-soft)]"
          >
            <RefreshCw size={18} />
            {isEn ? "Refresh status" : "بروزرسانی وضعیت"}
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 sm:p-4 shadow-sm">
            <div className="text-sm font-bold text-[var(--text-subtle)]">
              {isEn ? "File count" : "تعداد فایل‌ها"}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
              {stats?.total_files || 0}
            </div>
          </div>

          <div className="rounded-[28px] border border-purple-100 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 p-5">
            <div className="text-sm font-bold text-purple-700 dark:text-purple-300">
              {isEn ? "Text chunks" : "تعداد بخش‌های متنی"}
            </div>
            <div className="mt-2 text-3xl font-black text-purple-700 dark:text-purple-300">
              {stats?.total_chunks || 0}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-5">
            <div className="text-sm font-bold text-[var(--color-info-text)]">{isEn ? "Categories" : "دسته‌بندی‌ها"}</div>
            <div className="mt-2 text-3xl font-black text-[var(--color-info-text)]">
              {stats?.categories?.length || 0}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-5">
            <div className="text-sm font-bold text-[var(--color-success-text)]">{isEn ? "Storage engine" : "موتور ذخیره"}</div>
            <div className="mt-2 truncate text-2xl font-black text-[var(--color-success-text)]">
              {stats?.backend || "json"}
            </div>
            <div className="mt-2 truncate text-xs font-bold text-[var(--color-success-text)]">
              {stats?.embedding_model || "-"}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="text-sm font-bold text-[var(--text-subtle)]">Vector store</div>
            <div className="mt-2 text-2xl font-black text-[var(--foreground)]">
              {stats?.vector_store_exists ? `${stats.vector_store_size_mb ?? 0} MB` : (isEn ? "None" : "ندارد")}
            </div>
            <div className="mt-2 text-xs font-bold text-[var(--text-subtle)]">
              {formatDateTime(stats?.vector_store_updated_at, locale)}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-5">
            <div className="text-sm font-bold text-[var(--color-warning-text)]">{isEn ? "Last sync" : "آخرین sync"}</div>
            <div className="mt-2 truncate text-sm font-black leading-7 text-[var(--color-warning-text)]">
              {formatDateTime(stats?.last_sync, locale)}
            </div>
            <div className="mt-1 truncate text-xs font-bold text-[var(--color-warning-text)]">
              {stats?.last_sync_result || "-"}
            </div>
          </div>
        </div>

        {/* Category coverage breakdown */}
        {stats?.category_breakdown && stats.category_breakdown.length > 0 && (
          <div className="mb-6 rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="mb-4 text-sm font-bold text-[var(--text-muted)]">
              {isEn ? "Knowledge Coverage by Domain" : "پوشش دانش به تفکیک حوزه"}
            </div>
            <div className="space-y-2.5">
              {stats.category_breakdown.map((item) => (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-muted)]">{getCategoryLabel(item.category, locale)}</span>
                    <span className="text-[var(--text-subtle)]">{item.chunks} chunk — {item.percent}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand-fill)] transition-all duration-500"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {knowledgeResult && (
          <div
            className={`mb-6 flex items-start gap-3 whitespace-pre-wrap rounded-[28px] p-5 leading-8 ${
              knowledgeResultType === "success"
                ? "border border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                : "border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
            }`}
          >
            {knowledgeResultType === "success" ? (
              <CheckCircle2 className="mt-1 shrink-0" size={20} />
            ) : (
              <AlertCircle className="mt-1 shrink-0" size={20} />
            )}
            <span>{knowledgeResult}</span>
          </div>
        )}
        {driveSyncMessage && (
          <div className="mb-6 rounded-[28px] border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-5 text-sm leading-8 text-[var(--color-info-text)]">
            {driveSyncMessage}
          </div>
        )}
        {driveSyncResults.length > 0 && (
          <div className="mb-6 rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[var(--foreground)]">
                  {isEn ? "Google Drive Sync Report" : "گزارش همگام‌سازی Google Drive"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-[var(--text-subtle)]">
                  {isEn
                    ? "Added, unchanged, and skipped files from the latest sync."
                    : "فایل‌های اضافه‌شده، بدون تغییر و ردشده در آخرین همگام‌سازی."}
                </p>
              </div>

              <button
                onClick={() => {
                  setDriveSyncResults([]);
                  setDriveSyncSummary(null);
                  setDriveSyncFilter("all");
                }}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--surface)]"
              >
                {isEn ? "Clear report" : "پاک کردن گزارش"}
              </button>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-4">
              {[
                ["all", isEn ? "All" : "کل", driveSyncResults.length, "bg-[var(--surface-soft)] text-[var(--text-muted)] border-[var(--border-soft)]"],
                ["added", isEn ? "Added" : "اضافه‌شده", driveStatusCounts.added || 0, "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]"],
                ["unchanged", isEn ? "Unchanged" : "بدون تغییر", driveStatusCounts.unchanged || 0, "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]"],
                ["skipped", isEn ? "Skipped/errors" : "ردشده/خطا", driveStatusCounts.skipped || 0, "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger-border)]"],
              ].map(([status, label, count, classes]) => (
                <button
                  key={String(status)}
                  onClick={() => setDriveSyncFilter(status as "all" | "added" | "unchanged" | "skipped")}
                  className={`rounded-2xl border p-4 text-right transition hover:shadow-sm ${classes} ${
                    driveSyncFilter === status ? "ring-2 ring-offset-2 ring-[var(--brand-focus-ring)]" : ""
                  }`}
                >
                  <div className="text-xs font-bold">{label}</div>
                  <div className="mt-1 text-2xl font-black">{count}</div>
                </button>
              ))}
            </div>

            {skippedReasons.length > 0 && (
              <div className="mb-5 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-[var(--color-danger-text)]">
                  <AlertCircle size={16} />
                  {isEn ? "Skip or error reasons" : "دلایل رد شدن یا خطا"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {skippedReasons.slice(0, 8).map(([reason, count]) => (
                    <span
                      key={reason}
                      className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-bold text-[var(--color-danger-text)]"
                    >
                      {reason}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="max-h-[420px] overflow-y-auto rounded-3xl border border-[var(--border-soft)]">
              <table className="w-full border-collapse text-right text-sm">
                <thead className="sticky top-0 bg-[var(--surface-soft)]">
                  <tr className="border-b border-[var(--border-soft)] text-[var(--text-muted)]">
                    <th className="p-4 font-bold">{isEn ? "Status" : "وضعیت"}</th>
                    <th className="p-4 font-bold">{isEn ? "File" : "فایل"}</th>
                    <th className="p-4 font-bold">{isEn ? "Category" : "دسته‌بندی"}</th>
                    <th className="p-4 font-bold">Chunk</th>
                    <th className="p-4 font-bold">{isEn ? "Note" : "توضیح"}</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDriveSyncResults.map((item, index) => (
                    <tr
                      key={`${item.title}-${index}`}
                      className="border-b border-[var(--border-soft)] hover:bg-[var(--surface-soft)]"
                    >
                      <td className="p-4 align-top">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            item.status === "unchanged"
                              ? "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
                              : item.success
                                ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                                : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
                          }`}
                        >
                          {getDriveStatusLabel(item.status, item.success, locale)}
                        </span>
                      </td>

                      <td className="p-4 align-top">
                        <div className="font-bold text-[var(--foreground)]">
                          {item.title || (isEn ? "Untitled" : "بدون عنوان")}
                        </div>

                        {item.file_name && (
                          <div className="mt-1 break-all text-xs leading-6 text-[var(--text-subtle)]">
                            {item.file_name}
                          </div>
                        )}
                      </td>

                      <td className="p-4 align-top">
                        <span className="rounded-full bg-[var(--color-info-bg)] px-3 py-1 text-xs font-bold text-[var(--color-info-text)]">
                          {getCategoryLabel(item.category || "general", locale)}
                        </span>
                      </td>

                      <td className="p-4 align-top">
                        <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-black text-[var(--text-muted)]">
                          {item.chunks_added || 0}
                        </span>
                      </td>

                      <td className="p-4 align-top text-xs leading-6 text-[var(--text-subtle)]">
                        {item.message ||
                          item.reason ||
                          item.mime_type ||
                          item.source_type ||
                          "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-6">
            <div className="rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                  <UploadCloud size={25} />
                </div>

                <div>
                  <h2 className="text-xl font-black text-[var(--foreground)]">
                    {isEn ? "Add File" : "افزودن فایل"}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-subtle)]">
                    {isEn ? "Import PDF, TXT, or MD files into the knowledge base." : "PDF، TXT یا MD را وارد بانک دانش کنید."}
                  </p>
                </div>
              </div>

              <label className="mb-2 block text-sm font-bold text-[var(--text-muted)]">
                {isEn ? "Choose file" : "انتخاب فایل"}
              </label>

              <input
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm outline-none transition focus:border-purple-600"
              />

              {knowledgeFile && (
                <div className="mt-3 rounded-2xl border border-purple-100 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 p-4 text-sm leading-7">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[var(--foreground)]">{knowledgeFile.name}</p>
                      <p className="text-xs text-[var(--text-subtle)]">
                        {(knowledgeFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="shrink-0 rounded-xl bg-purple-100 dark:bg-purple-900/40 px-3 py-1 text-center">
                      <p className="text-xs font-bold text-purple-700 dark:text-purple-300">{isEn ? "Estimated chunks" : "تخمین chunk"}</p>
                      <p className="text-lg font-black text-purple-800 dark:text-purple-300">
                        {Math.max(1, Math.ceil(
                          Math.max(0, knowledgeFile.size - 200) / (1200 - 200)
                        ))}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-purple-600 dark:text-purple-300">
                    {isEn
                      ? "* Based on file size; the actual count is determined after text extraction."
                      : "* بر اساس اندازه فایل — تعداد واقعی پس از متن‌کشی تعیین می‌شود"}
                  </p>
                </div>
              )}

              <label className="mb-2 mt-4 block text-sm font-bold text-[var(--text-muted)]">
                {isEn ? "File title" : "عنوان فایل"}
              </label>

              <input
                type="text"
                placeholder={isEn ? "Example: ASTM D1151 standard" : "مثلاً: استاندارد ASTM D1151"}
                value={knowledgeTitle}
                onChange={(e) => setKnowledgeTitle(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm outline-none transition focus:border-purple-600"
              />

              <label className="mb-2 mt-4 block text-sm font-bold text-[var(--text-muted)]">
                {isEn ? "Category" : "دسته‌بندی"}
              </label>

              <select
                value={knowledgeCategory}
                onChange={(e) => {
                  setKnowledgeCategory(e.target.value);
                  setCategorySuggested(false);
                }}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm outline-none transition focus:border-purple-600"
              >
                {categoryOptions
                  .filter((item) => item.value !== "expert-faq")
                  .map((item) => (
                    <option key={item.value} value={item.value}>
                      {isEn ? item.labelEn : item.label}
                    </option>
                  ))}
              </select>

              {categorySuggested && (
                <p className="mt-2 text-xs text-purple-600 dark:text-purple-300">
                  {isEn
                    ? "Category suggested from the file name. Change it if needed."
                    : "✨ دسته‌بندی بر اساس نام فایل پیشنهاد شد — در صورت نیاز تغییر دهید."}
                </p>
              )}

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-[var(--surface-soft)] p-4 text-sm leading-7 text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="mt-1"
                />

                <span>
                  {isEn
                    ? "If the file already exists, remove the previous version and replace it with the new file."
                    : "اگر فایل تکراری بود، نسخه قبلی حذف شود و فایل جدید جایگزین شود."}
                </span>
              </label>

              <button
                onClick={uploadKnowledgeFile}
                disabled={loading || !knowledgeFile}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-4 font-bold text-white transition hover:bg-purple-800 disabled:opacity-50"
              >
                <UploadCloud size={18} />
                {loading ? (isEn ? "Adding..." : "در حال افزودن...") : (isEn ? "Add to knowledge base" : "افزودن به بانک دانش")}
              </button>
            </div>

            <div className="rounded-[32px] border border-[var(--color-info-border)] bg-gradient-to-b from-[var(--color-info-bg)] to-[var(--surface)] p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-fill)] text-white shadow-sm">
                  <TestTube2 size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-[var(--foreground)]">
                    {isEn ? "Semantic Search" : "جست‌وجوی معنایی (Semantic Search)"}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-subtle)]">
                    {isEn ? "Search the knowledge base with AI vector search." : "با AI vector search در بانک دانش جست‌وجو کن."}
                  </p>
                </div>
              </div>

              <textarea
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) testKnowledgeSearch(); }}
                className="h-24 w-full resize-none rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm leading-7 outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                placeholder={isEn ? "Example: ASTM D 1151 or sulfur analysis in LPG" : "مثلاً: ASTM D 1151 یا آنالیز سولفور در LPG"}
              />

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                    {isEn ? "Category filter" : "فیلتر دسته‌بندی"}
                  </label>
                  <select
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-xs outline-none transition focus:border-[var(--brand-accent)]"
                  >
                    <option value="all">{isEn ? "All categories" : "همه دسته‌ها"}</option>
                    {(stats?.categories || []).map((cat) => (
                      <option key={cat} value={cat}>{getCategoryLabel(cat, locale)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                    {isEn ? "Results" : "تعداد نتایج"}: <span className="text-[var(--color-info-text)]">{searchTopK}</span>
                  </label>
                  <input
                    type="range" min={5} max={25} step={5}
                    value={searchTopK}
                    onChange={(e) => setSearchTopK(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              <button
                onClick={testKnowledgeSearch}
                disabled={testingSearch || !testQuery.trim()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-fill)] px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-[var(--brand-fill-hover)] disabled:opacity-50"
              >
                {testingSearch ? (
                  <><RefreshCw size={16} className="animate-spin" /> {isEn ? "Searching..." : "در حال جست‌وجو..."}</>
                ) : (
                  <><Search size={16} /> {isEn ? "Semantic search" : "جست‌وجوی معنایی"}</>
                )}
              </button>
              <p className="mt-2 text-center text-xs text-[var(--text-subtle)]">
                {isEn ? "Ctrl+Enter for quick search" : "Ctrl+Enter برای جست‌وجوی سریع"}
              </p>

              {testMessage && (
                <div className="mt-4 rounded-2xl bg-[var(--color-warning-bg)] p-4 text-sm leading-7 text-[var(--color-warning-text)]">
                  {testMessage}
                </div>
              )}
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            {testResults.length > 0 && (
              <KnowledgeSearchResults results={testResults} onClear={() => { setTestResults([]); setTestMessage(""); }} />
            )}

            <KnowledgeFileList
              stats={stats}
              onPreview={setPreviewFile}
              onReindex={reindexKnowledgeFile}
              onDelete={deleteKnowledgeFile}
              reindexingFile={reindexingFile}
              deletingFile={deletingFile}
            />
          </div>
        </div>
      </div>

      <KnowledgeAuditLog />

      {/* Knowledge file preview slide-over */}
      {previewFile && (
        <KnowledgePreviewPanel key={previewFile} fileName={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </section>
  );
}
