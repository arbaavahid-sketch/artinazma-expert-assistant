import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import { AlertCircle, CheckCircle2, Database, FileText, FolderOpen, RefreshCw, Search, TestTube2, Trash2, UploadCloud } from "lucide-react";

type KnowledgeFileDetail = { file_name: string; title: string; category: string; categories: string[]; chunks: number; };
type KnowledgeStats = { total_chunks: number; total_files: number; files: string[]; categories: string[]; file_details?: KnowledgeFileDetail[]; };
type KnowledgeSearchResult = { title: string; file_name: string; category: string; score: number; content: string; };
type GroupedKnowledgeSearchResult = { title: string; file_name: string; category: string; bestScore: number; chunks: KnowledgeSearchResult[]; };
type DriveSyncResult = { success: boolean; status?: string; title: string; file_name?: string; category?: string; chunks_added?: number; message?: string; reason?: string; };

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
  return categoryOptions.find((item) => item.value === category)?.label || category || "بدون دسته‌بندی";
}

export default function KnowledgePage() {
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeCategory, setKnowledgeCategory] = useState("general");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [driveSyncMessage, setDriveSyncMessage] = useState("");
  const [driveSyncResults, setDriveSyncResults] = useState<DriveSyncResult[]>([]);
  const [driveMaxFiles, setDriveMaxFiles] = useState(20);
  const [forceDriveResync, setForceDriveResync] = useState(false);
  const [knowledgeResult, setKnowledgeResult] = useState("");
  const [knowledgeResultType, setKnowledgeResultType] = useState<"success" | "error" | "">("");
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
    try { const res = await fetch(apiUrl("/knowledge/stats"), { cache: "no-store" }); setStats(await res.json()); }
    catch { setStats(null); }
  }
  useEffect(() => { loadKnowledgeStats(); }, []);

  async function uploadKnowledgeFile() {
    if (!knowledgeFile) return;
    setLoading(true); setKnowledgeResult(""); setKnowledgeResultType("");
    const formData = new FormData();
    formData.append("file", knowledgeFile);
    formData.append("title", knowledgeTitle || knowledgeFile.name);
    formData.append("category", knowledgeCategory || "general");
    formData.append("replace_existing", replaceExisting ? "true" : "false");
    try {
      const res = await fetch(apiUrl("/knowledge/upload"), { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setKnowledgeResultType("success");
        setKnowledgeResult(`فایل با موفقیت اضافه شد.\nنام فایل: ${data.file_name}\nتعداد بخش‌های اضافه‌شده: ${data.chunks_added}`);
        setKnowledgeFile(null); setKnowledgeTitle(""); setReplaceExisting(false);
        await loadKnowledgeStats();
      } else { setKnowledgeResultType("error"); setKnowledgeResult(data.message || "خطا در افزودن فایل به بانک دانش."); }
    } catch { setKnowledgeResultType("error"); setKnowledgeResult("خطا در آپلود فایل دانش."); }
    finally { setLoading(false); }
  }

  async function testKnowledgeSearch() {
    if (!testQuery.trim()) return;
    setTestingSearch(true); setTestMessage(""); setTestResults([]);
    try {
      const res = await fetch(apiUrl("/knowledge/search"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: testQuery, domain: "auto", history: [] }) });
      const data = await res.json();
      const results = data.results || [];
      setTestResults(results);
      if (results.length === 0) setTestMessage("نتیجه‌ای از بانک دانش پیدا نشد.");
    } catch { setTestMessage("خطا در جست‌وجوی بانک دانش."); }
    finally { setTestingSearch(false); }
  }

  async function syncGoogleDrive() {
    setSyncingDrive(true); setDriveSyncMessage(""); setDriveSyncResults([]);
    try {
      const res = await fetch(apiUrl("/knowledge/sync-google-drive"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ max_files: driveMaxFiles, force_resync: forceDriveResync }) });
      const data = await res.json();
      if (!data.success) { setDriveSyncMessage(data.message || "خطا در همگام‌سازی Google Drive."); return; }
      setDriveSyncMessage(`همگام‌سازی انجام شد. فایل‌های پردازش‌شده: ${data.processed_files}، اضافه‌شده: ${data.added_files}، بدون تغییر: ${data.unchanged_files || 0}، ردشده: ${data.skipped_files}، بخش‌های متنی: ${data.chunks_added}`);
      setDriveSyncResults(data.results || []);
      await loadKnowledgeStats();
    } catch { setDriveSyncMessage("خطا در اتصال به سرور برای همگام‌سازی Google Drive."); }
    finally { setSyncingDrive(false); }
  }

  async function deleteKnowledgeFile(fileName: string) {
    if (!window.confirm(`آیا مطمئن هستید که می‌خواهید فایل "${fileName}" از بانک دانش حذف شود؟`)) return;
    setDeletingFile(fileName); setKnowledgeResult(""); setKnowledgeResultType("");
    try {
      const res = await fetch(apiUrl(`/knowledge/files/${encodeURIComponent(fileName)}`), { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setKnowledgeResultType("success");
        setKnowledgeResult(`فایل از بانک دانش حذف شد.\nنام فایل: ${data.file_name}\nتعداد chunk حذف‌شده: ${data.removed_chunks}`);
        await loadKnowledgeStats();
      } else { setKnowledgeResultType("error"); setKnowledgeResult(data.message || "خطا در حذف فایل."); }
    } catch { setKnowledgeResultType("error"); setKnowledgeResult("خطا در اتصال به سرور برای حذف فایل."); }
    finally { setDeletingFile(""); }
  }

  const fileDetails = useMemo(() => stats?.file_details || [], [stats]);
  const filteredFiles = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return fileDetails.filter((item) => {
      const categories = item.categories?.length ? item.categories : [item.category];
      const matchesSearch = !query || item.file_name.toLowerCase().includes(query) || item.title.toLowerCase().includes(query) || item.category.toLowerCase().includes(query) || categories.join(" ").toLowerCase().includes(query);
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory || categories.includes(selectedCategory);
      return matchesSearch && matchesCategory;
    });
  }, [fileDetails, searchText, selectedCategory]);

  const groupedTestResults = useMemo<GroupedKnowledgeSearchResult[]>(() => {
    const map = new Map<string, GroupedKnowledgeSearchResult>();
    for (const item of testResults) {
      const key = item.file_name || item.title;
      if (!map.has(key)) map.set(key, { title: item.title, file_name: item.file_name, category: item.category, bestScore: Number(item.score || 0), chunks: [] });
      const group = map.get(key)!;
      group.bestScore = Math.max(group.bestScore, Number(item.score || 0));
      group.chunks.push(item);
    }
    return Array.from(map.values()).sort((a, b) => b.bestScore - a.bestScore);
  }, [testResults]);

  return (
    <section className="min-h-screen bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700"><Database size={17} />مدیریت بانک دانش آرتین</div>
                <h1 className="text-3xl font-black text-slate-900">بانک دانش اختصاصی آرتین آزما</h1>
                <p className="mt-4 max-w-4xl leading-8 text-slate-600">فایل‌های آموزشی، کاتالوگ‌ها، استانداردها، اپلیکیشن‌نوت‌ها و FAQهای تاییدشده را وارد بانک دانش کنید.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select value={driveMaxFiles} onChange={(e) => setDriveMaxFiles(Number(e.target.value))} disabled={syncingDrive} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none disabled:opacity-50">
                  <option value={10}>۱۰ فایل</option><option value={20}>۲۰ فایل</option><option value={50}>۵۰ فایل</option><option value={100}>۱۰۰ فایل</option>
                </select>
                <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
                  <input type="checkbox" checked={forceDriveResync} disabled={syncingDrive} onChange={(e) => setForceDriveResync(e.target.checked)} />بازسازی کامل
                </label>
                <button onClick={syncGoogleDrive} disabled={syncingDrive} className="inline-flex items-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
                  <RefreshCw size={18} className={syncingDrive ? "animate-spin" : ""} />{syncingDrive ? "در حال همگام‌سازی..." : "همگام‌سازی Google Drive"}
                </button>
                <button onClick={loadKnowledgeStats} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <RefreshCw size={18} />بروزرسانی وضعیت
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-bold text-slate-500">تعداد فایل‌ها</div><div className="mt-2 text-3xl font-black text-slate-900">{stats?.total_files || 0}</div></div>
          <div className="rounded-[28px] border border-purple-100 bg-purple-50 p-5"><div className="text-sm font-bold text-purple-700">تعداد بخش‌های متنی</div><div className="mt-2 text-3xl font-black text-purple-700">{stats?.total_chunks || 0}</div></div>
          <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5"><div className="text-sm font-bold text-blue-700">دسته‌بندی‌ها</div><div className="mt-2 text-3xl font-black text-blue-700">{stats?.categories?.length || 0}</div></div>
        </div>

        {knowledgeResult && (
          <div className={`mb-6 flex items-start gap-3 whitespace-pre-wrap rounded-[28px] p-5 leading-8 ${knowledgeResultType === "success" ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : "border border-red-100 bg-red-50 text-red-700"}`}>
            {knowledgeResultType === "success" ? <CheckCircle2 className="mt-1 shrink-0" size={20} /> : <AlertCircle className="mt-1 shrink-0" size={20} />}
            <span>{knowledgeResult}</span>
          </div>
        )}
        {driveSyncMessage && <div className="mb-6 rounded-[28px] border border-blue-100 bg-blue-50 p-5 text-sm leading-8 text-blue-700">{driveSyncMessage}</div>}

        {driveSyncResults.length > 0 && (
          <div className="mb-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div><h2 className="text-xl font-black text-slate-900">گزارش همگام‌سازی Google Drive</h2><p className="mt-2 text-sm leading-7 text-slate-500">فایل‌های اضافه‌شده، بدون تغییر و ردشده در آخرین همگام‌سازی.</p></div>
              <button onClick={() => setDriveSyncResults([])} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-white">پاک کردن گزارش</button>
            </div>
            <div className="max-h-[420px] overflow-y-auto rounded-3xl border border-slate-200">
              <table className="w-full border-collapse text-right text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="p-4 font-bold">وضعیت</th><th className="p-4 font-bold">فایل</th><th className="p-4 font-bold">دسته‌بندی</th><th className="p-4 font-bold">Chunk</th><th className="p-4 font-bold">توضیح</th>
                  </tr>
                </thead>
                <tbody>
                  {driveSyncResults.map((item, index) => (
                    <tr key={`${item.title}-${index}`} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 align-top">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === "unchanged" ? "bg-amber-50 text-amber-700" : item.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                          {item.status === "unchanged" ? "بدون تغییر" : item.success ? "اضافه شد" : "رد شد"}
                        </span>
                      </td>
                      <td className="p-4 align-top"><div className="font-bold text-slate-900">{item.title || "بدون عنوان"}</div>{item.file_name && <div className="mt-1 break-all text-xs leading-6 text-slate-500">{item.file_name}</div>}</td>
                      <td className="p-4 align-top"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{getCategoryLabel(item.category || "general")}</span></td>
                      <td className="p-4 align-top"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{item.chunks_added || 0}</span></td>
                      <td className="p-4 align-top text-xs leading-6 text-slate-500">{item.message || item.reason || "-"}</td>
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
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700"><UploadCloud size={25} /></div>
                <div><h2 className="text-xl font-black text-slate-900">افزودن فایل</h2><p className="mt-1 text-sm text-slate-500">PDF، TXT یا MD را وارد بانک دانش کنید.</p></div>
              </div>
              <label className="mb-2 block text-sm font-bold text-slate-700">انتخاب فایل</label>
              <input type="file" accept=".pdf,.txt,.md" onChange={(e) => setKnowledgeFile(e.target.files?.[0] || null)} className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-purple-600" />
              {knowledgeFile && <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">فایل انتخاب‌شده: <span className="font-bold">{knowledgeFile.name}</span></div>}
              <label className="mb-2 mt-4 block text-sm font-bold text-slate-700">عنوان فایل</label>
              <input type="text" placeholder="مثلاً: استاندارد ASTM D1151" value={knowledgeTitle} onChange={(e) => setKnowledgeTitle(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-purple-600" />
              <label className="mb-2 mt-4 block text-sm font-bold text-slate-700">دسته‌بندی</label>
              <select value={knowledgeCategory} onChange={(e) => setKnowledgeCategory(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-purple-600">
                {categoryOptions.filter((item) => item.value !== "expert-faq").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <label className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />جایگزینی فایل موجود
              </label>
              <button onClick={uploadKnowledgeFile} disabled={loading || !knowledgeFile} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-4 font-bold text-white hover:bg-purple-800 disabled:opacity-50">
                <UploadCloud size={18} />{loading ? "در حال آپلود..." : "افزودن به بانک دانش"}
              </button>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><TestTube2 size={25} /></div>
                <div><h2 className="text-xl font-black text-slate-900">تست جست‌وجوی بانک دانش</h2><p className="mt-1 text-sm text-slate-500">بررسی کنید آرتین چه نتیجه‌ای برمی‌گرداند.</p></div>
              </div>
              <input value={testQuery} onChange={(e) => setTestQuery(e.target.value)} placeholder="مثلاً: کاتالیست برای فرایند هیدروژن‌زنی" className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-emerald-600" onKeyDown={(e) => { if (e.key === "Enter") testKnowledgeSearch(); }} />
              <button onClick={testKnowledgeSearch} disabled={testingSearch || !testQuery.trim()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                <Search size={18} />{testingSearch ? "در حال جست‌وجو..." : "تست جست‌وجو"}
              </button>
              {testMessage && <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">{testMessage}</div>}
            </div>
          </aside>

          <div className="space-y-6">
            {groupedTestResults.length > 0 && (
              <div className="rounded-[32px] border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="mb-5"><h2 className="text-xl font-black text-slate-900">نتایج تست جست‌وجو</h2><p className="mt-2 text-sm text-slate-500">{groupedTestResults.length} فایل مرتبط پیدا شد.</p></div>
                <div className="space-y-4">
                  {groupedTestResults.map((group) => (
                    <div key={group.file_name} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div><div className="font-black text-slate-900">{group.title}</div><div className="mt-1 text-sm text-slate-500">{group.file_name}</div></div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">امتیاز: {(group.bestScore * 100).toFixed(0)}٪</span>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{getCategoryLabel(group.category)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {group.chunks.map((chunk, i) => (
                          <div key={i} className="rounded-2xl bg-white p-4 text-sm leading-7 text-slate-700">
                            <div className="mb-1 text-xs font-bold text-slate-400">بخش {i + 1} - امتیاز: {(Number(chunk.score) * 100).toFixed(0)}٪</div>
                            <div className="line-clamp-4">{chunk.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div><h2 className="text-xl font-black text-slate-900">فایل‌های بانک دانش</h2><p className="mt-2 text-sm text-slate-500">{filteredFiles.length} از {fileDetails.length} فایل نمایش داده می‌شود.</p></div>
                <div className="flex flex-wrap gap-3">
                  <div className="relative">
                    <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="جستجوی فایل..." className="rounded-2xl border border-slate-300 bg-white py-3 pl-4 pr-9 text-sm outline-none focus:border-purple-600" />
                  </div>
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="rounded-2xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-purple-600">
                    <option value="all">همه دسته‌بندی‌ها</option>
                    {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
              </div>

              {filteredFiles.length > 0 ? (
                <div className="space-y-3">
                  {filteredFiles.map((file) => {
                    const categories = file.categories?.length ? file.categories : [file.category];
                    return (
                      <div key={file.file_name} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 transition hover:bg-white hover:shadow-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-slate-600"><FileText size={20} /></div>
                              <div>
                                <div className="font-black text-slate-900">{file.title || file.file_name}</div>
                                <div className="mt-1 break-all text-sm text-slate-500">{file.file_name}</div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {categories.map((cat) => <span key={cat} className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">{getCategoryLabel(cat)}</span>)}
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{file.chunks} بخش متنی</span>
                            </div>
                          </div>
                          <button onClick={() => deleteKnowledgeFile(file.file_name)} disabled={deletingFile === file.file_name} className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                            <Trash2 size={16} />{deletingFile === file.file_name ? "در حال حذف..." : "حذف"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl bg-slate-50 p-10 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-purple-700 shadow-sm"><FolderOpen size={32} /></div>
                  <h3 className="text-lg font-black text-slate-900">هنوز فایلی در بانک دانش وجود ندارد</h3>
                  <p className="mt-3 leading-7 text-slate-500">از بخش افزودن فایل در سمت چپ، اولین فایل را به بانک دانش اضافه کنید.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
