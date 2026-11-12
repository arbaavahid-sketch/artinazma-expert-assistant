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
  ClipboardList,
  Database,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Pencil,
  RefreshCw,
  Save,
  Search,
  TestTube2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

type KnowledgeFileDetail = {
  file_name: string;
  title: string;
  category: string;
  categories: string[];
  chunks: number;
  embedding_status?: "embedded" | "partial" | "missing";
  embedded_chunks?: number;
  missing_embedding_chunks?: number;
  source_exists?: boolean;
  source_size_kb?: number;
  source_updated_at?: string;
};

type KnowledgeStats = {
  total_chunks: number;
  total_files: number;
  files: string[];
  categories: string[];
  file_details?: KnowledgeFileDetail[];
  category_breakdown?: { category: string; chunks: number; percent: number }[];
  backend?: string;
  embedding_model?: string;
  vector_store_exists?: boolean;
  vector_store_size_mb?: number;
  vector_store_updated_at?: string;
  last_sync?: string;
  last_sync_result?: string;
};

type KnowledgeSearchResult = {
  title: string;
  file_name: string;
  category: string;
  score: number;
  score_reason?: string;
  score_breakdown?: Record<string, unknown>;
  content: string;
};

type GroupedKnowledgeSearchResult = {
  title: string;
  file_name: string;
  category: string;
  bestScore: number;
  chunks: KnowledgeSearchResult[];
};
type AuditEntry = {
  id: number;
  action: string;
  file_name: string;
  title: string;
  category: string;
  detail: string;
  performed_by: string;
  created_at: string;
};

type DriveSyncResult = {
  success: boolean;
  status?: "added" | "unchanged" | "skipped";
  title: string;
  file_name?: string;
  category?: string;
  chunks_added?: number;
  message?: string;
  reason?: string;
  mime_type?: string;
  source_type?: string;
};

type DriveSyncSummary = {
  generated_at?: string;
  by_status?: Record<string, number>;
  skipped_by_reason?: Record<string, number>;
  by_category?: Record<string, number>;
  has_errors?: boolean;
};

function formatDateTime(value?: string, locale = "fa") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "en" ? "en-US" : "fa-IR");
}

function getEmbeddingLabel(status?: KnowledgeFileDetail["embedding_status"], locale = "fa") {
  const isEn = locale === "en";
  if (status === "partial") return isEn ? "Partial" : "ناقص";
  if (status === "missing") return isEn ? "Missing" : "ندارد";
  return isEn ? "Ready" : "آماده";
}

function getEmbeddingBadgeClass(status?: KnowledgeFileDetail["embedding_status"]) {
  if (status === "partial") return "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]";
  if (status === "missing") return "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]";
  return "bg-[var(--color-success-bg)] text-[var(--color-success-text)]";
}

function formatScoreBreakdown(breakdown?: Record<string, unknown>) {
  if (!breakdown || Object.keys(breakdown).length === 0) return "";
  const fields = [
    ["algorithm", "alg"],
    ["vector_score", "vector"],
    ["vector_rank", "v-rank"],
    ["keyword_score", "keyword"],
    ["keyword_rank", "k-rank"],
    ["bm25_score", "bm25"],
    ["exact_code_boost", "exact"],
    ["astm_boost", "astm"],
  ];
  return fields
    .filter(([key]) => breakdown[key] !== undefined && breakdown[key] !== null && breakdown[key] !== "")
    .map(([key, label]) => `${label}: ${String(breakdown[key])}`)
    .join(" · ");
}

function normalizeSearchScore(score: number) {
  const value = Number(score || 0);
  return value > 1 ? value : value * 100;
}

function getDriveStatusLabel(status?: string, success?: boolean, locale = "fa") {
  const isEn = locale === "en";
  if (status === "unchanged") return isEn ? "Unchanged" : "بدون تغییر";
  if (status === "added" || success) return isEn ? "Added" : "اضافه شد";
  return isEn ? "Skipped" : "رد شد";
}

function buildDriveSyncSummary(results: DriveSyncResult[]): DriveSyncSummary {
  const by_status: Record<string, number> = {};
  const skipped_by_reason: Record<string, number> = {};
  const by_category: Record<string, number> = {};

  for (const item of results) {
    const status = item.status || (item.success ? "added" : "skipped");
    by_status[status] = (by_status[status] || 0) + 1;
    const category = item.category || "general";
    by_category[category] = (by_category[category] || 0) + 1;
    if (!item.success) {
      const reason = item.reason || item.message || "unknown";
      skipped_by_reason[reason] = (skipped_by_reason[reason] || 0) + 1;
    }
  }

  return {
    by_status,
    skipped_by_reason,
    by_category,
    has_errors: Object.keys(skipped_by_reason).length > 0,
  };
}

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

  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<KnowledgeSearchResult[]>([]);
  const [testingSearch, setTestingSearch] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [searchCategory, setSearchCategory] = useState("all");
  const [searchTopK, setSearchTopK] = useState(10);

  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState("all");
  const [showAuditLog, setShowAuditLog] = useState(false);

  type ChunkPreview = { index: number; title: string; category: string; content: string };
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewChunks, setPreviewChunks] = useState<ChunkPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editingChunkIndex, setEditingChunkIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingChunk, setSavingChunk] = useState(false);
  const [chunkSaveMsg, setChunkSaveMsg] = useState("");

  async function saveChunk(chunk: ChunkPreview) {
    if (!previewFile) return;
    setSavingChunk(true);
    setChunkSaveMsg("");
    try {
      const res = await fetch(adminUrl(`/knowledge/files/${encodeURIComponent(previewFile)}/chunks`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunk_index: chunk.index, content: editingContent }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewChunks((prev) => prev.map((c) => c.index === chunk.index ? { ...c, content: editingContent } : c));
        setChunkSaveMsg(isEn ? "Saved ✓" : "ذخیره شد ✓");
        setEditingChunkIndex(null);
        setTimeout(() => setChunkSaveMsg(""), 3000);
      } else {
        setChunkSaveMsg(isEn ? "Save failed" : "خطا در ذخیره");
      }
    } catch {
      setChunkSaveMsg(isEn ? "Connection error" : "خطا در اتصال");
    } finally {
      setSavingChunk(false);
    }
  }

  async function openPreview(fileName: string) {
    setPreviewFile(fileName);
    setPreviewChunks([]);
    setPreviewLoading(true);
    try {
      const res = await fetch(adminUrl(`/knowledge/files/${encodeURIComponent(fileName)}/chunks`), { cache: "no-store" });
      const data = await res.json();
      setPreviewChunks(data.chunks || []);
    } catch {
      setPreviewChunks([]);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function loadAuditLog(filter = auditFilter) {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filter !== "all") params.set("action", filter);
      const res = await fetch(adminUrl(`/knowledge/audit-log?${params}`), { cache: "no-store" });
      const data = await res.json();
      setAuditLog(data.entries || []);
    } catch {
      setAuditLog([]);
    } finally {
      setAuditLoading(false);
    }
  }

  async function clearAuditLog() {
    if (!await confirm({
      message: isEn ? "Are you sure you want to clear all logs?" : "آیا مطمئنید که می‌خواهید همه لاگ‌ها را پاک کنید؟",
      variant: "warning",
      confirmLabel: isEn ? "Clear" : "پاک کردن",
      title: isEn ? "Clear logs" : "پاک کردن لاگ‌ها",
    })) return;
    await fetch(adminUrl("/knowledge/audit-log"), { method: "DELETE" });
    setAuditLog([]);
  }

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

  useEffect(() => {
    if (showAuditLog) loadAuditLog(auditFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuditLog, auditFilter]);

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

  const fileDetails = useMemo(() => {
    return stats?.file_details || [];
  }, [stats]);

  const filteredFiles = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return fileDetails.filter((item) => {
      const categories = item.categories?.length
        ? item.categories
        : [item.category];

      const matchesSearch =
        !query ||
        item.file_name.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        categories.join(" ").toLowerCase().includes(query);

      const matchesCategory =
        selectedCategory === "all" ||
        item.category === selectedCategory ||
        categories.includes(selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [fileDetails, searchText, selectedCategory]);

  const filteredDriveSyncResults = useMemo(() => {
    if (driveSyncFilter === "all") return driveSyncResults;
    return driveSyncResults.filter((item) => (item.status || (item.success ? "added" : "skipped")) === driveSyncFilter);
  }, [driveSyncFilter, driveSyncResults]);

  const driveStatusCounts = driveSyncSummary?.by_status || {};
  const skippedReasons = Object.entries(driveSyncSummary?.skipped_by_reason || {})
    .sort((a, b) => b[1] - a[1]);

  const groupedTestResults = useMemo<GroupedKnowledgeSearchResult[]>(() => {
    const map = new Map<string, GroupedKnowledgeSearchResult>();

    for (const item of testResults) {
      const key = item.file_name || item.title;

      if (!map.has(key)) {
        map.set(key, {
          title: item.title,
          file_name: item.file_name,
          category: item.category,
          bestScore: Number(item.score || 0),
          chunks: [],
        });
      }

      const group = map.get(key)!;
      group.bestScore = Math.max(group.bestScore, Number(item.score || 0));
      group.chunks.push(item);
    }

    return Array.from(map.values()).sort((a, b) => b.bestScore - a.bestScore);
  }, [testResults]);

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
            {groupedTestResults.length > 0 && (
              <div className="rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[var(--foreground)]">
                      {isEn ? "Semantic Search Results" : "نتایج جست‌وجوی معنایی"}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-subtle)]">
                      {isEn
                        ? `${testResults.length} chunks from ${groupedTestResults.length} files, sorted by semantic similarity`
                        : `${testResults.length} chunk از ${groupedTestResults.length} فایل — مرتب‌شده بر اساس شباهت معنایی`}
                    </p>
                  </div>
                  <button
                    onClick={() => { setTestResults([]); setTestMessage(""); }}
                    className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
                  >
                    {isEn ? "Clear" : "پاک کردن"}
                  </button>
                </div>

                <div className="space-y-4">
                  {groupedTestResults.map((group, gi) => {
                    const normalizedBestScore = normalizeSearchScore(group.bestScore);
                    const scoreColor =
                      normalizedBestScore >= 70 ? "bg-emerald-500" :
                      normalizedBestScore >= 40 ? "bg-[var(--brand-fill)]" :
                      normalizedBestScore >= 20 ? "bg-amber-500" : "bg-slate-400";
                    const scorePct = Math.min(100, Math.round(normalizedBestScore));
                    return (
                      <div
                        key={group.file_name}
                        className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-5"
                      >
                        {/* Header row */}
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-info-bg)] text-xs font-black text-[var(--color-info-text)]">
                                {gi + 1}
                              </span>
                              <span className="text-base font-black text-[var(--foreground)] leading-snug">
                                {group.title || (isEn ? "Untitled" : "بدون عنوان")}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-subtle)]">
                              <span className="break-all">{group.file_name}</span>
                              <span className="rounded-full bg-[var(--color-info-bg)] px-2 py-0.5 font-bold text-[var(--color-info-text)]">
                                {getCategoryLabel(group.category, locale)}
                              </span>
                              <span className="font-bold text-[var(--text-muted)]">
                                {isEn ? `${group.chunks.length} chunks` : `${group.chunks.length} chunk`}
                              </span>
                            </div>
                          </div>
                          {/* Score badge */}
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <span className="text-xs font-bold text-[var(--text-subtle)]">
                              {isEn ? "Semantic similarity" : "شباهت معنایی"}
                            </span>
                            <span className="text-lg font-black text-[var(--foreground)]">
                              {normalizedBestScore.toFixed(1)}{isEn ? "%" : "٪"}
                            </span>
                          </div>
                        </div>
                        {/* Score bar */}
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
                          <div
                            className={`h-full rounded-full transition-all ${scoreColor}`}
                            style={{ width: `${scorePct}%` }}
                          />
                        </div>
                        {/* Chunks */}
                        <div className="mt-4 space-y-3">
                          {group.chunks.slice(0, 3).map((chunk, index) => (
                            <div
                              key={`${group.file_name}-${index}`}
                              className="rounded-2xl bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--text-muted)]"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-[var(--text-subtle)]">
                                  {isEn ? `Section ${index + 1}` : `بخش ${index + 1}`}
                                </span>
                                <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-xs font-bold text-[var(--text-subtle)]">
                                  {normalizeSearchScore(Number(chunk.score)).toFixed(1)}{isEn ? "%" : "٪"}
                                </span>
                              </div>
                              {(chunk.score_reason || chunk.score_breakdown) && (
                                <div className="mb-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-[11px] leading-6 text-[var(--text-subtle)]">
                                  {chunk.score_reason && (
                                    <div className="font-bold text-[var(--text-muted)]">{chunk.score_reason}</div>
                                  )}
                                  {formatScoreBreakdown(chunk.score_breakdown) && (
                                    <div>{formatScoreBreakdown(chunk.score_breakdown)}</div>
                                  )}
                                </div>
                              )}
                              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-7">
                                {chunk.content}
                              </div>
                            </div>
                          ))}
                          {group.chunks.length > 3 && (
                            <div className="text-center text-xs text-[var(--text-subtle)]">
                              {isEn
                                ? `+${group.chunks.length - 3} more chunks in this file`
                                : `+${group.chunks.length - 3} chunk دیگر در این فایل`}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="min-w-0 rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm sm:p-6">
              <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--surface-soft)] px-4 py-2 text-sm font-bold text-[var(--text-muted)]">
                    <FolderOpen size={17} />
                    {isEn ? "Registered Files" : "فایل‌های ثبت‌شده"}
                  </div>

                  <h2 className="text-xl font-black text-[var(--foreground)]">
                    {isEn ? "Knowledge Base Files" : "فایل‌های بانک دانش"}
                  </h2>

                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    {isEn
                      ? "Imported files, categories, and chunk counts are shown here."
                      : "فایل‌های واردشده، دسته‌بندی و تعداد chunkهای هر فایل در این بخش نمایش داده می‌شود."}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">
                  {isEn ? "Showing" : "نمایش"}:{" "}
                  <span className="font-bold">{filteredFiles.length}</span>{" "}
                  {isEn ? "of" : "از"}{" "}
                  <span className="font-bold">{fileDetails.length}</span>{" "}
                  {isEn ? "files" : "فایل"}
                </div>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-[1fr_240px]">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
                  />
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder={isEn ? "Search by file name, title, or category..." : "جست‌وجو بر اساس نام فایل، عنوان یا دسته‌بندی..."}
                    className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-4 pl-4 pr-11 text-sm outline-none transition focus:border-purple-600"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm outline-none transition focus:border-purple-600"
                >
                  <option value="all">{isEn ? "All categories" : "همه دسته‌بندی‌ها"}</option>
                  {(stats?.categories || []).map((category) => (
                    <option key={category} value={category}>
                      {getCategoryLabel(category, locale)}
                    </option>
                  ))}
                </select>
              </div>

              {stats?.categories && stats.categories.length > 0 && (
                <div className="mb-5 flex flex-wrap gap-2">
                  {stats.categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                        selectedCategory === category
                          ? "bg-purple-700 text-white"
                          : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-300"
                      }`}
                    >
                      {getCategoryLabel(category, locale)}
                    </button>
                  ))}
                </div>
              )}

              {filteredFiles.length > 0 ? (
                <div className="max-h-[720px] overflow-y-auto rounded-3xl border border-[var(--border-soft)]">
                  <div className="space-y-3 p-3 2xl:hidden">
                    {filteredFiles.map((item) => {
                      const categories = item.categories?.length
                        ? item.categories
                        : [item.category];

                      return (
                        <div
                          key={item.file_name}
                          className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                              <FileText size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="break-words font-black leading-7 text-[var(--foreground)]">
                                {item.title || item.file_name}
                              </div>
                              <div className="mt-1 break-all text-xs leading-6 text-[var(--text-subtle)]">
                                {item.file_name}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                            <div>
                              <div className="mb-1 font-bold text-[var(--text-subtle)]">{isEn ? "Category" : "دسته‌بندی"}</div>
                              <div className="flex flex-wrap gap-2">
                                {categories.map((category) => (
                                  <span
                                    key={category}
                                    className="rounded-full bg-[var(--color-info-bg)] px-3 py-1 font-bold text-[var(--color-info-text)]"
                                  >
                                    {getCategoryLabel(category, locale)}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="mb-1 font-bold text-[var(--text-subtle)]">Chunk</div>
                              <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 font-black text-[var(--text-muted)]">
                                {item.chunks}
                              </span>
                            </div>

                            <div>
                              <div className="mb-1 font-bold text-[var(--text-subtle)]">Embedding</div>
                              <div className="space-y-1.5">
                                <span className={`rounded-full px-3 py-1 font-black ${getEmbeddingBadgeClass(item.embedding_status)}`}>
                                  {getEmbeddingLabel(item.embedding_status, locale)}
                                </span>
                                <div className="font-bold text-[var(--text-subtle)]">
                                  {item.embedded_chunks ?? item.chunks} / {item.chunks}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => openPreview(item.file_name)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-2 text-xs font-bold text-[var(--color-info-text)] transition hover:bg-[var(--color-info-bg)]"
                            >
                              <Eye size={15} />
                              {isEn ? "Preview" : "پیش‌نمایش"}
                            </button>
                            <button
                              onClick={() => reindexKnowledgeFile(item.file_name)}
                              disabled={!item.source_exists || reindexingFile === item.file_name}
                              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-2 text-xs font-bold text-[var(--color-warning-text)] transition hover:bg-[var(--color-warning-bg)] disabled:opacity-50"
                              title={
                                !item.source_exists
                                  ? (isEn ? "Source file is missing from knowledge_files" : "فایل منبع در knowledge_files موجود نیست")
                                  : (isEn ? "Rebuild chunks and embeddings" : "بازسازی chunk و embedding")
                              }
                            >
                              <RefreshCw
                                size={15}
                                className={reindexingFile === item.file_name ? "animate-spin" : ""}
                              />
                              {reindexingFile === item.file_name
                                ? (isEn ? "Rebuilding..." : "در حال بازسازی...")
                                : (isEn ? "Rebuild" : "بازسازی")}
                            </button>
                            <button
                              onClick={() => deleteKnowledgeFile(item.file_name)}
                              disabled={deletingFile === item.file_name}
                              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-2 text-xs font-bold text-[var(--color-danger-text)] transition hover:bg-[var(--color-danger-bg)] disabled:opacity-50"
                            >
                              <Trash2 size={15} />
                              {deletingFile === item.file_name
                                ? (isEn ? "Deleting..." : "در حال حذف...")
                                : (isEn ? "Delete" : "حذف")}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto 2xl:block" tabIndex={0} role="region"
                    aria-label={isEn ? "Knowledge files table" : "جدول فایل‌های بانک دانش"}>
                  <table className="min-w-[980px] w-full border-collapse text-right text-sm">
                    <thead className="sticky top-0 bg-[var(--surface-soft)]">
                      <tr className="border-b border-[var(--border-soft)] text-[var(--text-muted)]">
                        <th className="p-4 font-bold">{isEn ? "File" : "فایل"}</th>
                        <th className="p-4 font-bold">{isEn ? "Category" : "دسته‌بندی"}</th>
                        <th className="p-4 font-bold">Chunk</th>
                        <th className="p-4 font-bold">Embedding</th>
                        <th className="p-4 font-bold">{isEn ? "Source file" : "فایل منبع"}</th>
                        <th className="p-4 font-bold">{isEn ? "Actions" : "عملیات"}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredFiles.map((item) => {
                        const categories = item.categories?.length
                          ? item.categories
                          : [item.category];

                        return (
                          <tr
                            key={item.file_name}
                            className="border-b border-[var(--border-soft)] hover:bg-[var(--surface-soft)]"
                          >
                            <td className="p-4 align-top">
                              <div className="flex items-start gap-3">
                                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                                  <FileText size={18} />
                                </div>

                                <div className="min-w-0">
                                  <div className="font-black text-[var(--foreground)]">
                                    {item.title || item.file_name}
                                  </div>
                                  <div className="mt-1 break-all text-xs leading-6 text-[var(--text-subtle)]">
                                    {item.file_name}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="p-4 align-top">
                              <div className="flex flex-wrap gap-2">
                                {categories.map((category) => (
                                  <span
                                    key={category}
                                    className="rounded-full bg-[var(--color-info-bg)] px-3 py-1 text-xs font-bold text-[var(--color-info-text)]"
                                  >
                                    {getCategoryLabel(category, locale)}
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td className="p-4 align-top">
                              <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-black text-[var(--text-muted)]">
                                {item.chunks}
                              </span>
                            </td>

                            <td className="p-4 align-top">
                              <div className="space-y-1.5">
                                <span className={`rounded-full px-3 py-1 text-xs font-black ${getEmbeddingBadgeClass(item.embedding_status)}`}>
                                  {getEmbeddingLabel(item.embedding_status, locale)}
                                </span>
                                <div className="text-xs font-bold text-[var(--text-subtle)]">
                                  {item.embedded_chunks ?? item.chunks} / {item.chunks}
                                </div>
                              </div>
                            </td>

                            <td className="p-4 align-top">
                              <div className="space-y-1.5 text-xs leading-6">
                                <span
                                  className={`rounded-full px-3 py-1 font-black ${
                                    item.source_exists
                                      ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                                      : "bg-[var(--surface-soft)] text-[var(--text-subtle)]"
                                  }`}
                                >
                                  {item.source_exists ? (isEn ? "Exists" : "موجود") : (isEn ? "Vector only" : "فقط vector")}
                                </span>
                                {item.source_exists && (
                                  <div className="text-[var(--text-subtle)]">
                                    {item.source_size_kb ?? 0} KB · {formatDateTime(item.source_updated_at, locale)}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="p-4 align-top">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => openPreview(item.file_name)}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-2 text-xs font-bold text-[var(--color-info-text)] transition hover:bg-[var(--color-info-bg)]"
                                >
                                  <Eye size={15} />
                                  {isEn ? "Preview" : "پیش‌نمایش"}
                                </button>
                                <button
                                  onClick={() => reindexKnowledgeFile(item.file_name)}
                                  disabled={!item.source_exists || reindexingFile === item.file_name}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-2 text-xs font-bold text-[var(--color-warning-text)] transition hover:bg-[var(--color-warning-bg)] disabled:opacity-50"
                                  title={
                                    !item.source_exists
                                      ? (isEn ? "Source file is missing from knowledge_files" : "فایل منبع در knowledge_files موجود نیست")
                                      : (isEn ? "Rebuild chunks and embeddings" : "بازسازی chunk و embedding")
                                  }
                                >
                                  <RefreshCw
                                    size={15}
                                    className={reindexingFile === item.file_name ? "animate-spin" : ""}
                                  />
                                  {reindexingFile === item.file_name
                                    ? (isEn ? "Rebuilding..." : "در حال بازسازی...")
                                    : (isEn ? "Rebuild" : "بازسازی")}
                                </button>
                                <button
                                  onClick={() =>
                                    deleteKnowledgeFile(item.file_name)
                                  }
                                  disabled={deletingFile === item.file_name}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-2 text-xs font-bold text-[var(--color-danger-text)] transition hover:bg-[var(--color-danger-bg)] disabled:opacity-50"
                                >
                                  <Trash2 size={15} />
                                  {deletingFile === item.file_name
                                    ? (isEn ? "Deleting..." : "در حال حذف...")
                                    : (isEn ? "Delete" : "حذف")}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl bg-[var(--surface-soft)] p-10 text-center text-[var(--text-subtle)]">
                  {isEn ? "No files matched this filter." : "فایلی با این فیلتر پیدا نشد."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Audit Log Section ───────────────────────────────────────── */}
      <div className="mt-6 rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
        <button
          onClick={() => setShowAuditLog((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right transition hover:bg-[var(--surface-soft)] rounded-[32px]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]">
              <ClipboardList size={20} />
            </div>
            <div>
              <div className="text-base font-black text-[var(--foreground)]">
                {isEn ? "Knowledge Base Activity History" : "تاریخچه عملیات بانک دانش"}
              </div>
              <div className="text-sm text-[var(--text-subtle)]">
                {isEn ? "Uploads, deletions, chunk edits, and Drive syncs" : "آپلود، حذف، ویرایش chunk، و همگام‌سازی Drive"}
              </div>
            </div>
          </div>
          <span className="text-[var(--text-subtle)]">{showAuditLog ? "▲" : "▼"}</span>
        </button>

        {showAuditLog && (
          <div className="border-t border-[var(--border-soft)] px-6 pb-6 pt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {["all", "upload", "delete", "chunk_edit", "drive_sync"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setAuditFilter(f)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      auditFilter === f
                        ? "bg-amber-600 text-white"
                        : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:bg-[var(--color-warning-bg)] hover:text-[var(--color-warning-text)]"
                    }`}
                  >
                    {f === "all"
                      ? (isEn ? "All" : "همه")
                      : f === "upload"
                        ? (isEn ? "Upload" : "آپلود")
                        : f === "delete"
                          ? (isEn ? "Delete" : "حذف")
                          : f === "chunk_edit"
                            ? (isEn ? "Chunk edit" : "ویرایش chunk")
                            : "Drive Sync"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadAuditLog(auditFilter)}
                  disabled={auditLoading}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
                >
                  <RefreshCw size={12} className={auditLoading ? "animate-spin" : ""} />
                  {isEn ? "Refresh" : "بروزرسانی"}
                </button>
                <button
                  onClick={clearAuditLog}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]"
                >
                  <Trash2 size={12} />
                  {isEn ? "Clear" : "پاک کردن"}
                </button>
              </div>
            </div>

            {auditLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 w-full animate-pulse rounded-2xl bg-[var(--surface-soft)]" />)}
              </div>
            ) : auditLog.length === 0 ? (
              <div className="rounded-3xl bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--text-subtle)]">
                {isEn ? "No activity has been recorded yet." : "هنوز عملیاتی ثبت نشده است."}
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto rounded-3xl border border-[var(--border-soft)]">
                <table className="w-full border-collapse text-right text-sm">
                  <thead className="sticky top-0 bg-[var(--surface-soft)]">
                    <tr className="border-b border-[var(--border-soft)]">
                      <th className="p-3 text-xs font-bold text-[var(--text-muted)]">{isEn ? "Action" : "عملیات"}</th>
                      <th className="p-3 text-xs font-bold text-[var(--text-muted)]">{isEn ? "File / title" : "فایل / عنوان"}</th>
                      <th className="p-3 text-xs font-bold text-[var(--text-muted)]">{isEn ? "Details" : "جزئیات"}</th>
                      <th className="p-3 text-xs font-bold text-[var(--text-muted)]">{isEn ? "Time" : "زمان"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="border-b border-[var(--border-soft)] hover:bg-[var(--surface-soft)]">
                        <td className="p-3 align-top">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                            entry.action === "upload" ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]" :
                            entry.action === "delete" ? "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]" :
                            entry.action === "chunk_edit" ? "bg-[var(--color-info-bg)] text-[var(--color-info-text)]" :
                            "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300"
                          }`}>
                            {entry.action === "upload" ? (isEn ? "Upload" : "آپلود") :
                             entry.action === "delete" ? (isEn ? "Delete" : "حذف") :
                             entry.action === "chunk_edit" ? (isEn ? "Chunk edit" : "ویرایش chunk") : "Drive Sync"}
                          </span>
                        </td>
                        <td className="p-3 align-top">
                          <div className="font-bold text-[var(--foreground)]">{entry.title || entry.file_name || "—"}</div>
                          {entry.file_name && entry.title && entry.file_name !== entry.title && (
                            <div className="text-xs text-[var(--text-subtle)]">{entry.file_name}</div>
                          )}
                          {entry.category && (
                            <div className="mt-0.5">
                              <span className="rounded-full bg-[var(--color-info-bg)] px-2 py-0.5 text-xs font-bold text-[var(--color-info-text)]">{getCategoryLabel(entry.category, locale)}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 align-top text-xs text-[var(--text-subtle)]">{entry.detail || "—"}</td>
                        <td className="p-3 align-top text-xs text-[var(--text-subtle)] whitespace-nowrap">
                          {entry.created_at
                            ? new Intl.DateTimeFormat(isEn ? "en-US" : "fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.created_at + "Z"))
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Knowledge file preview slide-over */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/30"
            onClick={() => setPreviewFile(null)}
          />
          {/* Panel */}
          <div className="flex h-full w-full max-w-xl flex-col bg-[var(--surface)] shadow-2xl md:max-w-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] p-6">
              <div>
                <div className="text-sm font-bold text-[var(--color-info-text)]">
                  {isEn ? "Knowledge Base Preview" : "پیش‌نمایش بانک دانش"}
                </div>
                <div className="mt-1 break-all text-base font-black text-[var(--foreground)]">
                  {previewFile}
                </div>
                <div className="mt-1 text-xs text-[var(--text-subtle)]">
                  {isEn
                    ? `${previewChunks.length} chunks`
                    : `${previewChunks.length} بخش (chunk)`}
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-soft)] text-[var(--text-subtle)] hover:bg-[var(--surface-soft)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {previewLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="ui-skeleton h-28 w-full rounded-2xl" />
                  ))}
                </div>
              ) : previewChunks.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--text-subtle)]">
                  {isEn ? "No content found." : "محتوایی یافت نشد."}
                </div>
              ) : (
                <>
                {chunkSaveMsg && (
                  <div className="mb-4 rounded-2xl bg-[var(--color-success-bg)] px-4 py-2 text-xs font-bold text-[var(--color-success-text)]">
                    {chunkSaveMsg}
                  </div>
                )}
                <div className="space-y-4">
                  {previewChunks.map((chunk) => (
                    <div
                      key={chunk.index}
                      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[var(--color-info-bg)] px-3 py-1 text-xs font-black text-[var(--color-info-text)]">
                            #{chunk.index + 1}
                          </span>
                          {chunk.category && (
                            <span className="rounded-full bg-purple-50 dark:bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-700 dark:text-purple-300">
                              {getCategoryLabel(chunk.category, locale)}
                            </span>
                          )}
                        </div>
                        {editingChunkIndex !== chunk.index ? (
                          <button
                            onClick={() => { setEditingChunkIndex(chunk.index); setEditingContent(chunk.content); }}
                            className="flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1 text-xs font-bold text-[var(--text-muted)] hover:border-[var(--color-info-border)] hover:text-[var(--color-info-text)] transition"
                          >
                            <Pencil size={12} /> {isEn ? "Edit" : "ویرایش"}
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveChunk(chunk)}
                              disabled={savingChunk}
                              className="flex items-center gap-1 rounded-xl bg-[var(--brand-fill)] px-2 py-1 text-xs font-bold text-white hover:bg-[var(--brand-fill-hover)] transition disabled:opacity-50"
                            >
                              <Save size={12} /> {savingChunk ? "..." : (isEn ? "Save" : "ذخیره")}
                            </button>
                            <button
                              onClick={() => setEditingChunkIndex(null)}
                              className="flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-soft)] transition"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      {editingChunkIndex === chunk.index ? (
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={8}
                          className="w-full resize-y rounded-xl border border-[var(--color-info-border)] bg-[var(--surface)] p-3 text-xs leading-7 text-[var(--text-muted)] outline-none focus:border-[var(--brand-accent)]"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-xs leading-7 text-[var(--text-muted)]">
                          {chunk.content}
                          {chunk.content.length >= 600 && (
                            <span className="text-[var(--text-subtle)]"> …</span>
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
