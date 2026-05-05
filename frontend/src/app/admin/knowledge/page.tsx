"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  TestTube2,
  Trash2,
  UploadCloud,
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

const categoryOptions = [
  { value: "general", label: "عمومی" },
  { value: "ASTM Standards", label: "استانداردهای ASTM" },
  { value: "catalyst", label: "کاتالیست" },
  { value: "equipment", label: "تجهیزات" },
  { value: "chromatography", label: "کروماتوگرافی" },
  { value: "mercury-analysis", label: "آنالیز جیوه" },
  { value: "sulfur-analysis", label: "آنالیز سولفور" },
  { value: "troubleshooting", label: "عیب‌یابی" },
  { value: "application-note", label: "اپلیکیشن نوت" },
  { value: "expert-faq", label: "FAQ تاییدشده" },
];

function getCategoryLabel(category: string) {
  return (
    categoryOptions.find((item) => item.value === category)?.label ||
    category ||
    "بدون دسته‌بندی"
  );
}

export default function KnowledgePage() {
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeCategory, setKnowledgeCategory] = useState("general");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [driveSyncMessage, setDriveSyncMessage] = useState("");
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
      const res = await fetch(apiUrl("/knowledge/upload"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setKnowledgeResultType("success");
        setKnowledgeResult(
          `فایل با موفقیت اضافه شد.\nنام فایل: ${data.file_name}\nتعداد بخش‌های اضافه‌شده: ${data.chunks_added}`
        );

        setKnowledgeFile(null);
        setKnowledgeTitle("");
        setReplaceExisting(false);
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

  try {
    const res = await fetch(apiUrl("/knowledge/sync-google-drive"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        max_files: 200,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      setDriveSyncMessage(data.message || "خطا در همگام‌سازی Google Drive.");
      return;
    }

    setDriveSyncMessage(
      `همگام‌سازی انجام شد. فایل‌های پردازش‌شده: ${data.processed_files}، فایل‌های اضافه‌شده: ${data.added_files}، فایل‌های ردشده: ${data.skipped_files}، بخش‌های متنی اضافه‌شده: ${data.chunks_added}`
    );

    await loadKnowledgeStats();
  } catch {
    setDriveSyncMessage("خطا در اتصال به سرور برای همگام‌سازی Google Drive.");
  } finally {
    setSyncingDrive(false);
  }
}
  async function deleteKnowledgeFile(fileName: string) {
    const confirmed = window.confirm(
      `آیا مطمئن هستید که می‌خواهید فایل "${fileName}" از بانک دانش حذف شود؟`
    );

    if (!confirmed) return;

    setDeletingFile(fileName);
    setKnowledgeResult("");
    setKnowledgeResultType("");

    try {
      const res = await fetch(
        apiUrl(`/knowledge/files/${encodeURIComponent(fileName)}`),
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (data.success) {
        setKnowledgeResultType("success");
        setKnowledgeResult(
          `فایل از بانک دانش حذف شد.\nنام فایل: ${data.file_name}\nتعداد chunk حذف‌شده: ${data.removed_chunks}`
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

              <div className="flex flex-wrap gap-3">
  <button
    onClick={syncGoogleDrive}
    disabled={syncingDrive}
    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
  >
    <RefreshCw size={18} className={syncingDrive ? "animate-spin" : ""} />
    {syncingDrive ? "در حال همگام‌سازی..." : "همگام‌سازی Google Drive"}
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
            <div className="text-sm font-bold text-slate-500">تعداد فایل‌ها</div>
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
                onChange={(e) => setKnowledgeFile(e.target.files?.[0] || null)}
                className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none transition focus:border-purple-600"
              />

              {knowledgeFile && (
                <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                  فایل انتخاب‌شده:{" "}
                  <span className="font-bold">{knowledgeFile.name}</span>
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
                onChange={(e) => setKnowledgeCategory(e.target.value)}
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

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <TestTube2 size={24} />
                </div>

                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    تست جست‌وجوی بانک دانش
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    ببین آرتین برای یک سوال چه فایل‌هایی را پیدا می‌کند.
                  </p>
                </div>
              </div>

              <textarea
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                className="h-28 w-full resize-none rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-7 outline-none transition focus:border-blue-600"
                placeholder="مثلاً: ASTM D 1151 یا آنالیز سولفور در LPG"
              />

              <button
                onClick={testKnowledgeSearch}
                disabled={testingSearch || !testQuery.trim()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-4 font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
              >
                <Search size={18} />
                {testingSearch ? "در حال جست‌وجو..." : "جست‌وجو در بانک دانش"}
              </button>

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
                      نتیجه تست جست‌وجو
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      نتایج بر اساس فایل گروه‌بندی شده‌اند.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setTestResults([]);
                      setTestMessage("");
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                  >
                    پاک کردن
                  </button>
                </div>

                <div className="space-y-4">
                  {groupedTestResults.map((group) => (
                    <div
                      key={group.file_name}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="text-lg font-black text-slate-900">
                            {group.title || "بدون عنوان"}
                          </div>

                          <div className="mt-1 break-all text-xs leading-6 text-slate-500">
                            فایل: {group.file_name}
                          </div>

                          <div className="text-xs leading-6 text-slate-500">
                            دسته‌بندی: {getCategoryLabel(group.category)}
                          </div>

                          <div className="mt-2 text-xs font-bold text-slate-600">
                            تعداد بخش‌های مرتبط: {group.chunks.length}
                          </div>
                        </div>

                        <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                          {Number(group.bestScore || 0).toFixed(3)}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {group.chunks.slice(0, 3).map((chunk, index) => (
                          <div
                            key={`${group.file_name}-${index}`}
                            className="rounded-2xl bg-white p-4 text-sm leading-7 text-slate-700"
                          >
                            <div className="mb-2 text-xs font-bold text-slate-400">
                              بخش مرتبط {index + 1}
                            </div>

                            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap">
                              {chunk.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
    </section>
  );
}