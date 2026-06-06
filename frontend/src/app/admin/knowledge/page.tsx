"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl, adminUrl } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
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
};

type KnowledgeStats = {
  total_chunks: number;
  total_files: number;
  files: string[];
  categories: string[];
  file_details?: KnowledgeFileDetail[];
  category_breakdown?: { category: string; chunks: number; percent: number }[];
};

type KnowledgeSearchResult = {
  title: string;
  file_name: string;
  category: string;
  score: number;
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
export default function KnowledgePage() {
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
  const [driveMaxFiles, setDriveMaxFiles] = useState(20);
  const [forceDriveResync, setForceDriveResync] = useState(false);
  const { confirm } = useConfirm();
  const [knowledgeResult, setKnowledgeResult] = useState("");
  const [knowledgeResultType, setKnowledgeResultType] = useState<
    "success" | "error" | ""
  >("");

  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState("");

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
        setChunkSaveMsg("ذخیره شد ✓");
        setEditingChunkIndex(null);
        setTimeout(() => setChunkSaveMsg(""), 3000);
      } else {
        setChunkSaveMsg("خطا در ذخیره");
      }
    } catch {
      setChunkSaveMsg("خطا در اتصال");
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
    if (!await confirm({ message: "آیا مطمئنید که می‌خواهید همه لاگ‌ها را پاک کنید؟", variant: "warning", confirmLabel: "پاک کردن", title: "پاک کردن لاگ‌ها" })) return;
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
          `فایل با موفقیت اضافه شد.\nنام فایل: ${data.file_name}\nتعداد بخش‌های اضافه‌شده: ${data.chunks_added}`,
        );

        setKnowledgeFile(null);
        setKnowledgeTitle("");
        setReplaceExisting(false);
        setCategorySuggested(false);
        setKnowledgeCategory("general");
        await loadKnowledgeStats();
      } else {
        setKnowledgeResultType("error");
        setKnowledgeResult(data.message || "خطا در افزودن فایل به بانک دانش.");
      }
    } catch {
      setKnowledgeResultType("error");
      setKnowledgeResult("خطا در آپلود فایل دانش.");
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
        setTestMessage("نتیجه‌ای از بانک دانش پیدا نشد.");
      }
    } catch {
      setTestMessage("خطا در جست‌وجوی بانک دانش.");
    } finally {
      setTestingSearch(false);
    }
  }
  async function syncGoogleDrive() {
    setSyncingDrive(true);
    setDriveSyncMessage("");
    setDriveSyncResults([]);

    try {
      const res = await fetch(adminUrl("/knowledge/sync-google-drive"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          max_files: driveMaxFiles,
          force_resync: forceDriveResync,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setDriveSyncMessage(data.message || "خطا در همگام‌سازی Google Drive.");
        return;
      }

      setDriveSyncMessage(
        `همگام‌سازی انجام شد. فایل‌های پردازش‌شده: ${data.processed_files}، فایل‌های اضافه‌شده: ${data.added_files}، بدون تغییر: ${data.unchanged_files || 0}، فایل‌های ردشده: ${data.skipped_files}، بخش‌های متنی اضافه‌شده: ${data.chunks_added}`,
      );

      setDriveSyncResults(data.results || []);

      await loadKnowledgeStats();
    } catch {
      setDriveSyncMessage("خطا در اتصال به سرور برای همگام‌سازی Google Drive.");
    } finally {
      setSyncingDrive(false);
    }
  }
  async function deleteKnowledgeFile(fileName: string) {
    if (!await confirm({ message: `آیا مطمئن هستید که می‌خواهید فایل "${fileName}" از بانک دانش حذف شود؟`, variant: "danger", confirmLabel: "حذف", title: "حذف فایل دانش" })) return;

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
          `فایل از بانک دانش حذف شد.\nنام فایل: ${data.file_name}\nتعداد chunk حذف‌شده: ${data.removed_chunks}`,
        );

        await loadKnowledgeStats();
      } else {
        setKnowledgeResultType("error");
        setKnowledgeResult(data.message || "خطا در حذف فایل از بانک دانش.");
      }
    } catch {
      setKnowledgeResultType("error");
      setKnowledgeResult("خطا در اتصال به سرور برای حذف فایل.");
    } finally {
      setDeletingFile("");
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
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                  <Database size={17} />
                  مدیریت بانک دانش آرتین
                </div>

                <h1 className="text-3xl font-black text-slate-900">
                  بانک دانش اختصاصی آرتین آزما
                </h1>

                <p className="mt-4 max-w-4xl leading-8 text-slate-600">
                  فایل‌های آموزشی، کاتالوگ‌ها، استانداردها، اپلیکیشن‌نوت‌ها و
                  FAQهای تاییدشده را وارد بانک دانش کنید و کیفیت جست‌وجوی آرتین
                  را بررسی کنید.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={driveMaxFiles}
                  onChange={(e) => setDriveMaxFiles(Number(e.target.value))}
                  disabled={syncingDrive}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm outline-none disabled:opacity-50"
                >
                  <option value={10}>۱۰ فایل</option>
                  <option value={20}>۲۰ فایل</option>
                  <option value={50}>۵۰ فایل</option>
                  <option value={100}>۱۰۰ فایل</option>
                  <option value={200}>۲۰۰ فایل</option>
                </select>

                <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">
                  <input
                    type="checkbox"
                    checked={forceDriveResync}
                    disabled={syncingDrive}
                    onChange={(e) => setForceDriveResync(e.target.checked)}
                  />
                  بازسازی کامل
                </label>

                <button
                  onClick={syncGoogleDrive}
                  disabled={syncingDrive}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
                >
                  <RefreshCw
                    size={18}
                    className={syncingDrive ? "animate-spin" : ""}
                  />
                  {syncingDrive
                    ? "در حال همگام‌سازی..."
                    : "همگام‌سازی Google Drive"}
                </button>

                <button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = adminUrl("/admin/knowledge/export-csv");
                    a.download = "knowledge_base.csv";
                    a.click();
                  }}
                  disabled={!stats || stats.total_files === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:opacity-40"
                >
                  <Download size={18} />
                  دانلود CSV
                </button>

                <button
                  onClick={loadKnowledgeStats}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <RefreshCw size={18} />
                  بروزرسانی وضعیت
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-slate-500">
              تعداد فایل‌ها
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {stats?.total_files || 0}
            </div>
          </div>

          <div className="rounded-[28px] border border-purple-100 bg-purple-50 p-5">
            <div className="text-sm font-bold text-purple-700">
              تعداد بخش‌های متنی
            </div>
            <div className="mt-2 text-3xl font-black text-purple-700">
              {stats?.total_chunks || 0}
            </div>
          </div>

          <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5">
            <div className="text-sm font-bold text-blue-700">دسته‌بندی‌ها</div>
            <div className="mt-2 text-3xl font-black text-blue-700">
              {stats?.categories?.length || 0}
            </div>
          </div>
        </div>

        {/* Category coverage breakdown */}
        {stats?.category_breakdown && stats.category_breakdown.length > 0 && (
          <div className="mb-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-bold text-slate-700">پوشش دانش به تفکیک حوزه</div>
            <div className="space-y-2.5">
              {stats.category_breakdown.map((item) => (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{getCategoryLabel(item.category)}</span>
                    <span className="text-slate-500">{item.chunks} chunk — {item.percent}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
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
                ? "border border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border border-red-100 bg-red-50 text-red-700"
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
          <div className="mb-6 rounded-[28px] border border-blue-100 bg-blue-50 p-5 text-sm leading-8 text-blue-700">
            {driveSyncMessage}
          </div>
        )}
        {driveSyncResults.length > 0 && (
          <div className="mb-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  گزارش همگام‌سازی Google Drive
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  فایل‌های اضافه‌شده، بدون تغییر و ردشده در آخرین همگام‌سازی.
                </p>
              </div>

              <button
                onClick={() => setDriveSyncResults([])}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-white"
              >
                پاک کردن گزارش
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto rounded-3xl border border-slate-200">
              <table className="w-full border-collapse text-right text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="p-4 font-bold">وضعیت</th>
                    <th className="p-4 font-bold">فایل</th>
                    <th className="p-4 font-bold">دسته‌بندی</th>
                    <th className="p-4 font-bold">Chunk</th>
                    <th className="p-4 font-bold">توضیح</th>
                  </tr>
                </thead>

                <tbody>
                  {driveSyncResults.map((item, index) => (
                    <tr
                      key={`${item.title}-${index}`}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="p-4 align-top">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            item.status === "unchanged"
                              ? "bg-amber-50 text-amber-700"
                              : item.success
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {item.status === "unchanged"
                            ? "بدون تغییر"
                            : item.success
                              ? "اضافه شد"
                              : "رد شد"}
                        </span>
                      </td>

                      <td className="p-4 align-top">
                        <div className="font-bold text-slate-900">
                          {item.title || "بدون عنوان"}
                        </div>

                        {item.file_name && (
                          <div className="mt-1 break-all text-xs leading-6 text-slate-500">
                            {item.file_name}
                          </div>
                        )}
                      </td>

                      <td className="p-4 align-top">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                          {getCategoryLabel(item.category || "general")}
                        </span>
                      </td>

                      <td className="p-4 align-top">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                          {item.chunks_added || 0}
                        </span>
                      </td>

                      <td className="p-4 align-top text-xs leading-6 text-slate-500">
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
        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <aside className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                  <UploadCloud size={25} />
                </div>

                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    افزودن فایل
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    PDF، TXT یا MD را وارد بانک دانش کنید.
                  </p>
                </div>
              </div>

              <label className="mb-2 block text-sm font-bold text-slate-700">
                انتخاب فایل
              </label>

              <input
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none transition focus:border-purple-600"
              />

              {knowledgeFile && (
                <div className="mt-3 rounded-2xl border border-purple-100 bg-purple-50 p-4 text-sm leading-7">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-800">{knowledgeFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(knowledgeFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="shrink-0 rounded-xl bg-purple-100 px-3 py-1 text-center">
                      <p className="text-xs font-bold text-purple-700">تخمین chunk</p>
                      <p className="text-lg font-black text-purple-800">
                        {Math.max(1, Math.ceil(
                          Math.max(0, knowledgeFile.size - 200) / (1200 - 200)
                        ))}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-purple-600">
                    * بر اساس اندازه فایل — تعداد واقعی پس از متن‌کشی تعیین می‌شود
                  </p>
                </div>
              )}

              <label className="mb-2 mt-4 block text-sm font-bold text-slate-700">
                عنوان فایل
              </label>

              <input
                type="text"
                placeholder="مثلاً: استاندارد ASTM D1151"
                value={knowledgeTitle}
                onChange={(e) => setKnowledgeTitle(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none transition focus:border-purple-600"
              />

              <label className="mb-2 mt-4 block text-sm font-bold text-slate-700">
                دسته‌بندی
              </label>

              <select
                value={knowledgeCategory}
                onChange={(e) => {
                  setKnowledgeCategory(e.target.value);
                  setCategorySuggested(false);
                }}
                className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none transition focus:border-purple-600"
              >
                {categoryOptions
                  .filter((item) => item.value !== "expert-faq")
                  .map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
              </select>

              {categorySuggested && (
                <p className="mt-2 text-xs text-purple-600">
                  ✨ دسته‌بندی بر اساس نام فایل پیشنهاد شد — در صورت نیاز تغییر دهید.
                </p>
              )}

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="mt-1"
                />

                <span>
                  اگر فایل تکراری بود، نسخه قبلی حذف شود و فایل جدید جایگزین
                  شود.
                </span>
              </label>

              <button
                onClick={uploadKnowledgeFile}
                disabled={loading || !knowledgeFile}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-4 font-bold text-white transition hover:bg-purple-800 disabled:opacity-50"
              >
                <UploadCloud size={18} />
                {loading ? "در حال افزودن..." : "افزودن به بانک دانش"}
              </button>
            </div>

            <div className="rounded-[32px] border border-blue-100 bg-gradient-to-b from-blue-50 to-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                  <TestTube2 size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    جست‌وجوی معنایی (Semantic Search)
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    با AI vector search در بانک دانش جست‌وجو کن.
                  </p>
                </div>
              </div>

              <textarea
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) testKnowledgeSearch(); }}
                className="h-24 w-full resize-none rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-7 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="مثلاً: ASTM D 1151 یا آنالیز سولفور در LPG"
              />

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    فیلتر دسته‌بندی
                  </label>
                  <select
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none transition focus:border-blue-500"
                  >
                    <option value="all">همه دسته‌ها</option>
                    {(stats?.categories || []).map((cat) => (
                      <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    تعداد نتایج: <span className="text-blue-700">{searchTopK}</span>
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
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {testingSearch ? (
                  <><RefreshCw size={16} className="animate-spin" /> در حال جست‌وجو...</>
                ) : (
                  <><Search size={16} /> جست‌وجوی معنایی</>
                )}
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">Ctrl+Enter برای جست‌وجوی سریع</p>

              {testMessage && (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-700">
                  {testMessage}
                </div>
              )}
            </div>
          </aside>

          <div className="space-y-6">
            {groupedTestResults.length > 0 && (
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">
                      نتایج جست‌وجوی معنایی
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {testResults.length} chunk از {groupedTestResults.length} فایل — مرتب‌شده بر اساس شباهت معنایی
                    </p>
                  </div>
                  <button
                    onClick={() => { setTestResults([]); setTestMessage(""); }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                  >
                    پاک کردن
                  </button>
                </div>

                <div className="space-y-4">
                  {groupedTestResults.map((group, gi) => {
                    const scoreColor =
                      group.bestScore >= 0.7 ? "bg-emerald-500" :
                      group.bestScore >= 0.4 ? "bg-blue-500" :
                      group.bestScore >= 0.2 ? "bg-amber-500" : "bg-slate-400";
                    const scorePct = Math.min(100, Math.round(group.bestScore * 100));
                    return (
                      <div
                        key={group.file_name}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                      >
                        {/* Header row */}
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">
                                {gi + 1}
                              </span>
                              <span className="text-base font-black text-slate-900 leading-snug">
                                {group.title || "بدون عنوان"}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                              <span className="break-all">{group.file_name}</span>
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
                                {getCategoryLabel(group.category)}
                              </span>
                              <span className="font-bold text-slate-600">{group.chunks.length} chunk</span>
                            </div>
                          </div>
                          {/* Score badge */}
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <span className="text-xs font-bold text-slate-500">شباهت معنایی</span>
                            <span className="text-lg font-black text-slate-800">
                              {(group.bestScore * 100).toFixed(1)}٪
                            </span>
                          </div>
                        </div>
                        {/* Score bar */}
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
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
                              className="rounded-2xl bg-white p-4 text-sm leading-7 text-slate-700"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-400">بخش {index + 1}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                                  {(Number(chunk.score) * 100).toFixed(1)}٪
                                </span>
                              </div>
                              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-7">
                                {chunk.content}
                              </div>
                            </div>
                          ))}
                          {group.chunks.length > 3 && (
                            <div className="text-center text-xs text-slate-400">
                              +{group.chunks.length - 3} chunk دیگر در این فایل
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
                    <FolderOpen size={17} />
                    فایل‌های ثبت‌شده
                  </div>

                  <h2 className="text-xl font-black text-slate-900">
                    فایل‌های بانک دانش
                  </h2>

                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    فایل‌های واردشده، دسته‌بندی و تعداد chunkهای هر فایل در این
                    بخش نمایش داده می‌شود.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  نمایش:{" "}
                  <span className="font-bold">{filteredFiles.length}</span> از{" "}
                  <span className="font-bold">{fileDetails.length}</span> فایل
                </div>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-[1fr_240px]">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="جست‌وجو بر اساس نام فایل، عنوان یا دسته‌بندی..."
                    className="w-full rounded-2xl border border-slate-300 bg-white py-4 pl-4 pr-11 text-sm outline-none transition focus:border-purple-600"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none transition focus:border-purple-600"
                >
                  <option value="all">همه دسته‌بندی‌ها</option>
                  {(stats?.categories || []).map((category) => (
                    <option key={category} value={category}>
                      {getCategoryLabel(category)}
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
                          : "bg-slate-50 text-slate-600 hover:bg-purple-50 hover:text-purple-700"
                      }`}
                    >
                      {getCategoryLabel(category)}
                    </button>
                  ))}
                </div>
              )}

              {filteredFiles.length > 0 ? (
                <div className="max-h-[720px] overflow-y-auto rounded-3xl border border-slate-200">
                  <table className="w-full border-collapse text-right text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-slate-200 text-slate-600">
                        <th className="p-4 font-bold">فایل</th>
                        <th className="p-4 font-bold">دسته‌بندی</th>
                        <th className="p-4 font-bold">Chunk</th>
                        <th className="p-4 font-bold">عملیات</th>
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
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="p-4 align-top">
                              <div className="flex items-start gap-3">
                                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                                  <FileText size={18} />
                                </div>

                                <div className="min-w-0">
                                  <div className="font-black text-slate-900">
                                    {item.title || item.file_name}
                                  </div>
                                  <div className="mt-1 break-all text-xs leading-6 text-slate-500">
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
                                    className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
                                  >
                                    {getCategoryLabel(category)}
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td className="p-4 align-top">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                                {item.chunks}
                              </span>
                            </td>

                            <td className="p-4 align-top">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => openPreview(item.file_name)}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                                >
                                  <Eye size={15} />
                                  پیش‌نمایش
                                </button>
                                <button
                                  onClick={() =>
                                    deleteKnowledgeFile(item.file_name)
                                  }
                                  disabled={deletingFile === item.file_name}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                >
                                  <Trash2 size={15} />
                                  {deletingFile === item.file_name
                                    ? "در حال حذف..."
                                    : "حذف"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-3xl bg-slate-50 p-10 text-center text-slate-500">
                  فایلی با این فیلتر پیدا نشد.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Audit Log Section ───────────────────────────────────────── */}
      <div className="mt-6 rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <button
          onClick={() => setShowAuditLog((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right transition hover:bg-slate-50 rounded-[32px]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <ClipboardList size={20} />
            </div>
            <div>
              <div className="text-base font-black text-slate-900">تاریخچه عملیات بانک دانش</div>
              <div className="text-sm text-slate-500">آپلود، حذف، ویرایش chunk، و همگام‌سازی Drive</div>
            </div>
          </div>
          <span className="text-slate-400">{showAuditLog ? "▲" : "▼"}</span>
        </button>

        {showAuditLog && (
          <div className="border-t border-slate-100 px-6 pb-6 pt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {["all", "upload", "delete", "chunk_edit", "drive_sync"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setAuditFilter(f)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      auditFilter === f
                        ? "bg-amber-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                    }`}
                  >
                    {f === "all" ? "همه" : f === "upload" ? "آپلود" : f === "delete" ? "حذف" : f === "chunk_edit" ? "ویرایش chunk" : "Drive Sync"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadAuditLog(auditFilter)}
                  disabled={auditLoading}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  <RefreshCw size={12} className={auditLoading ? "animate-spin" : ""} />
                  بروزرسانی
                </button>
                <button
                  onClick={clearAuditLog}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                >
                  <Trash2 size={12} />
                  پاک کردن
                </button>
              </div>
            </div>

            {auditLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />)}
              </div>
            ) : auditLog.length === 0 ? (
              <div className="rounded-3xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                هنوز عملیاتی ثبت نشده است.
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto rounded-3xl border border-slate-200">
                <table className="w-full border-collapse text-right text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="p-3 text-xs font-bold text-slate-600">عملیات</th>
                      <th className="p-3 text-xs font-bold text-slate-600">فایل / عنوان</th>
                      <th className="p-3 text-xs font-bold text-slate-600">جزئیات</th>
                      <th className="p-3 text-xs font-bold text-slate-600">زمان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 align-top">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                            entry.action === "upload" ? "bg-emerald-50 text-emerald-700" :
                            entry.action === "delete" ? "bg-red-50 text-red-700" :
                            entry.action === "chunk_edit" ? "bg-blue-50 text-blue-700" :
                            "bg-purple-50 text-purple-700"
                          }`}>
                            {entry.action === "upload" ? "آپلود" :
                             entry.action === "delete" ? "حذف" :
                             entry.action === "chunk_edit" ? "ویرایش chunk" : "Drive Sync"}
                          </span>
                        </td>
                        <td className="p-3 align-top">
                          <div className="font-bold text-slate-800">{entry.title || entry.file_name || "—"}</div>
                          {entry.file_name && entry.title && entry.file_name !== entry.title && (
                            <div className="text-xs text-slate-400">{entry.file_name}</div>
                          )}
                          {entry.category && (
                            <div className="mt-0.5">
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{getCategoryLabel(entry.category)}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 align-top text-xs text-slate-500">{entry.detail || "—"}</td>
                        <td className="p-3 align-top text-xs text-slate-400 whitespace-nowrap">
                          {entry.created_at
                            ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.created_at + "Z"))
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
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl md:max-w-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <div className="text-sm font-bold text-blue-700">
                  پیش‌نمایش بانک دانش
                </div>
                <div className="mt-1 break-all text-base font-black text-slate-900">
                  {previewFile}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {previewChunks.length} بخش (chunk)
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50"
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
                <div className="py-10 text-center text-sm text-slate-500">
                  محتوایی یافت نشد.
                </div>
              ) : (
                <>
                {chunkSaveMsg && (
                  <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                    {chunkSaveMsg}
                  </div>
                )}
                <div className="space-y-4">
                  {previewChunks.map((chunk) => (
                    <div
                      key={chunk.index}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
                            #{chunk.index + 1}
                          </span>
                          {chunk.category && (
                            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                              {getCategoryLabel(chunk.category)}
                            </span>
                          )}
                        </div>
                        {editingChunkIndex !== chunk.index ? (
                          <button
                            onClick={() => { setEditingChunkIndex(chunk.index); setEditingContent(chunk.content); }}
                            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:border-blue-200 hover:text-blue-700 transition"
                          >
                            <Pencil size={12} /> ویرایش
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveChunk(chunk)}
                              disabled={savingChunk}
                              className="flex items-center gap-1 rounded-xl bg-blue-700 px-2 py-1 text-xs font-bold text-white hover:bg-blue-800 transition disabled:opacity-50"
                            >
                              <Save size={12} /> {savingChunk ? "..." : "ذخیره"}
                            </button>
                            <button
                              onClick={() => setEditingChunkIndex(null)}
                              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
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
                          className="w-full resize-y rounded-xl border border-blue-200 bg-white p-3 text-xs leading-7 text-slate-700 outline-none focus:border-blue-400"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-xs leading-7 text-slate-700">
                          {chunk.content}
                          {chunk.content.length >= 600 && (
                            <span className="text-slate-400"> …</span>
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
