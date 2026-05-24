"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  AlertCircle,
  Beaker,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  ImageIcon,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

const testTypes = [
  { value: "general", label: "گزارش عمومی آزمایشگاهی" },
  { value: "catalyst", label: "تست کاتالیست" },
  { value: "chromatography", label: "کروماتوگرافی GC/HPLC" },
  { value: "mercury", label: "آنالیز جیوه" },
  { value: "sulfur", label: "آنالیز سولفور" },
  { value: "metals", label: "آنالیز عنصری / فلزات" },
];

const imageTypes = [
  { value: "general", label: "تصویر عمومی" },
  { value: "device-error", label: "خطای دستگاه" },
  { value: "chromatogram", label: "کروماتوگرام" },
  { value: "chart", label: "نمودار تست" },
  { value: "software-screen", label: "صفحه نرم‌افزار دستگاه" },
  { value: "lab-report", label: "گزارش تصویری آزمایشگاهی" },
];

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];

function getTestTypeLabel(value: string) {
  return (
    testTypes.find((item) => item.value === value)?.label ||
    "گزارش عمومی آزمایشگاهی"
  );
}

function getImageTypeLabel(value: string) {
  return imageTypes.find((item) => item.value === value)?.label || "تصویر عمومی";
}

function isImageFile(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTS.includes(ext);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const PROGRESS_STEPS_IMAGE = [
  "در حال آپلود تصویر…",
  "استخراج متن با OCR…",
  "ارسال به آرتین برای تحلیل…",
  "در حال تحلیل تخصصی…",
];
const PROGRESS_STEPS_FILE = [
  "در حال آپلود فایل…",
  "پردازش و خواندن داده‌ها…",
  "ارسال به آرتین برای تحلیل…",
  "در حال تحلیل تخصصی…",
];

function friendlyError(raw: string): string {
  if (!raw) return "خطای ناشناخته رخ داد.";
  if (raw.includes("Connection") || raw.includes("RemoteDisconnected"))
    return "اتصال به سرویس هوش مصنوعی برقرار نشد. لطفاً چند ثانیه صبر کنید و دوباره امتحان کنید.";
  if (raw.includes("timeout") || raw.includes("Timeout"))
    return "زمان پاسخ سرویس هوش مصنوعی به پایان رسید. لطفاً دوباره امتحان کنید.";
  if (raw.includes("فرمت") || raw.includes("پشتیبانی نمی‌شود"))
    return raw;
  if (raw.startsWith("خطا در تحلیل"))
    return raw.replace(/^خطا در تحلیل (تصویر|فایل): /, "مشکل در تحلیل: ");
  return raw;
}

export default function AnalyzePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [testType, setTestType] = useState("general");
  const [imageType, setImageType] = useState("general");
  const [userNote, setUserNote] = useState("");
  const [fileAnalysis, setFileAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [resultType, setResultType] = useState<"success" | "error" | "">("");
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [followUpQ, setFollowUpQ] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpHistory, setFollowUpHistory] = useState<{q: string; a: string}[]>([]);

  const ALLOWED_EXTS = [...IMAGE_EXTS, "xlsx", "xls", "csv", "pdf"];
  const allImages = files.length > 0 && files.every(isImageFile);

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const valid = arr.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return ALLOWED_EXTS.includes(ext);
    });
    const invalid = arr.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return !ALLOWED_EXTS.includes(ext);
    });
    if (invalid.length) {
      setResultType("error");
      setFileAnalysis(`فرمت پشتیبانی نمی‌شود: ${invalid.map((f) => f.name).join(", ")}`);
    }
    const next = [...files, ...valid].slice(0, 5); // max 5 files
    setFiles(next);
    setFileAnalysis("");
    setResultType("");
    setFollowUpHistory([]);

    // generate previews for images
    const previews: string[] = [];
    next.forEach((f, i) => {
      if (isImageFile(f)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previews[i] = e.target?.result as string;
          if (previews.filter(Boolean).length === next.filter(isImageFile).length) {
            setImagePreviews([...previews]);
          }
        };
        reader.readAsDataURL(f);
      }
    });
    if (!next.some(isImageFile)) setImagePreviews([]);
  }

  function removeFile(idx: number) {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  async function analyzeSingleFile(f: File, idx: number, total: number): Promise<string> {
    const img = isImageFile(f);
    const steps = img ? PROGRESS_STEPS_IMAGE : PROGRESS_STEPS_FILE;
    setProgressLabel(`فایل ${idx + 1} از ${total}: ${f.name}`);
    setProgressStep(0);

    const interval = setInterval(() => {
      setProgressStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, img ? 4000 : 2500);

    const formData = new FormData();
    formData.append("file", f);
    formData.append("user_note", userNote);
    const endpoint = img ? "/analyze-image" : "/analyze-file";
    if (img) formData.append("image_type", imageType);
    else formData.append("test_type", testType);

    try {
      const res = await fetch(apiUrl(endpoint), { method: "POST", body: formData });
      const data = await res.json();
      clearInterval(interval);
      if (data.ai_analysis) return data.ai_analysis;
      if (data.error) return `⚠️ خطا: ${friendlyError(data.error)}`;
      return JSON.stringify(data, null, 2);
    } catch {
      clearInterval(interval);
      return "⚠️ اتصال به سرور برقرار نشد.";
    }
  }

  async function uploadFile() {
    if (!files.length) return;
    setLoading(true);
    setFileAnalysis("");
    setResultType("");
    setFollowUpHistory([]);

    const results: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const result = await analyzeSingleFile(files[i], i, files.length);
      results.push(
        files.length > 1
          ? `━━━ فایل ${i + 1}: ${files[i].name} ━━━\n${result}`
          : result
      );
    }

    const combined = results.join("\n\n");
    const hasError = combined.includes("⚠️");
    setResultType(hasError && results.every((r) => r.includes("⚠️")) ? "error" : "success");
    setFileAnalysis(combined);
    setLoading(false);
    setProgressLabel("");
  }

  async function copyResult() {
    if (!fileAnalysis) return;
    await navigator.clipboard.writeText(fileAnalysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportPDF() {
    if (!fileAnalysis) return;
    const now = new Date().toLocaleString("fa-IR");
    const fileNames = files.map((f) => f.name).join("، ");
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="utf-8"/>
<title>گزارش تحلیل آرتین</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap');
  body { font-family: 'Vazirmatn', Tahoma, sans-serif; padding: 40px; color: #1e293b; line-height: 2; direction: rtl; }
  h1 { font-size: 22px; font-weight: 900; color: #065f46; border-bottom: 2px solid #065f46; padding-bottom: 10px; }
  .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
  .content { white-space: pre-wrap; font-size: 14px; background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; }
  .followup { margin-top: 32px; }
  .followup h2 { font-size: 16px; font-weight: 900; color: #1e293b; }
  .q { background: #f1f5f9; border-radius: 10px; padding: 10px 14px; margin-top: 12px; font-weight: 700; font-size: 13px; }
  .a { background: #ecfdf5; border-radius: 10px; padding: 10px 14px; margin-top: 6px; font-size: 13px; white-space: pre-wrap; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<h1>گزارش تحلیل تخصصی آرتین</h1>
<div class="meta">
  <div>تاریخ: ${now}</div>
  <div>فایل‌ها: ${fileNames}</div>
</div>
<div class="content">${fileAnalysis.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
${followUpHistory.length ? `
<div class="followup">
  <h2>سوالات پیگیری</h2>
  ${followUpHistory.map((item) => `
    <div class="q">سوال: ${item.q.replace(/</g, "&lt;")}</div>
    <div class="a">${item.a.replace(/</g, "&lt;")}</div>
  `).join("")}
</div>` : ""}
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  async function sendFollowUp() {
    if (!followUpQ.trim() || !fileAnalysis) return;
    const question = followUpQ.trim();
    setFollowUpLoading(true);
    setFollowUpQ("");

    const fileNames = files.map((f) => f.name).join("، ");
    // Build context: file analysis result as system context
    const context = `آرتین، فایل(های) زیر توسط کاربر آپلود و قبلاً تحلیل شده‌اند:\nنام فایل: ${fileNames}\n\nخلاصه تحلیل:\n${fileAnalysis.slice(0, 3000)}`;

    // Build conversation history from previous follow-up exchanges
    const history = followUpHistory.flatMap((item) => [
      { role: "user", content: item.q },
      { role: "assistant", content: item.a },
    ]);

    try {
      const res = await fetch(apiUrl("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, context, history }),
      });
      const data = await res.json();
      const answer = data.answer || data.response || "پاسخی دریافت نشد.";
      setFollowUpHistory((prev) => [...prev, { q: question, a: answer }]);
    } catch {
      setFollowUpHistory((prev) => [...prev, { q: question, a: "خطا در دریافت پاسخ." }]);
    } finally {
      setFollowUpLoading(false);
    }
  }

  return (
    <section className="brand-shell-bg min-h-full px-5 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="brand-panel hero-grid-bg mb-6 overflow-hidden rounded-[34px]">
          <div className="bg-gradient-to-l from-emerald-50/80 via-white/80 to-blue-50/50 p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="brand-kicker mb-4 border-emerald-200 bg-emerald-50 text-emerald-700">
                  <FlaskConical size={17} />
                  Artin Test Analyzer
                </div>

                <h1 className="text-3xl font-black leading-[1.55] text-slate-950 md:text-4xl">
                  تحلیل تخصصی فایل تست با آرتین
                </h1>

                <p className="mt-4 max-w-4xl leading-8 text-slate-600">
                  فایل تست، گزارش آزمایشگاهی یا داده خام را آپلود کنید تا آرتین
                  بر اساس نوع آزمون، داده‌ها را بررسی و نکات فنی، خطاهای احتمالی
                  و پیشنهاد اقدام بعدی را ارائه کند.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
                <div className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-sm">
                  <div className="text-sm font-bold text-slate-500">
                    فرمت‌های قابل تحلیل
                  </div>
                  <div className="mt-2 font-black text-slate-950">
                    PDF، Excel، CSV، JPG، PNG
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-sm">
                  <div className="text-sm font-bold text-slate-500">
                    خروجی پیشنهادی
                  </div>
                  <div className="mt-2 font-black text-slate-950">
                    تحلیل فنی و اقدام بعدی
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
          <aside className="space-y-6">
            <div className="brand-card rounded-[30px] p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <UploadCloud size={25} />
                </div>

                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    اطلاعات تحلیل
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    نوع تست و توضیحات نمونه را مشخص کنید.
                  </p>
                </div>
              </div>

              <label className="mb-2 block text-sm font-bold text-slate-700">
                {allImages ? "نوع تصویر" : "نوع تست یا گزارش"}
              </label>

              {allImages ? (
                <select value={imageType} onChange={(e) => setImageType(e.target.value)}
                  className="ui-select rounded-2xl p-4 focus:border-emerald-600 focus:shadow-[0_0_0_4px_rgba(5,150,105,0.12)]">
                  {imageTypes.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              ) : (
                <select value={testType} onChange={(e) => setTestType(e.target.value)}
                  className="ui-select rounded-2xl p-4 focus:border-emerald-600 focus:shadow-[0_0_0_4px_rgba(5,150,105,0.12)]">
                  {testTypes.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              )}

              <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">
                توضیح اختیاری درباره نمونه یا شرایط تست
              </label>
              <textarea
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                className="ui-textarea h-28 resize-none rounded-2xl p-4 leading-8 focus:border-emerald-600 focus:shadow-[0_0_0_4px_rgba(5,150,105,0.12)]"
                placeholder="مثلاً: نمونه LPG است، هدف بررسی ترکیبات گوگردی است..."
              />

              <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">
                فایل یا تصویر
                <span className="mr-2 font-normal text-slate-400">(تا ۵ فایل)</span>
              </label>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative rounded-[26px] border-2 border-dashed p-5 text-center transition ${
                  isDragging ? "border-emerald-400 bg-emerald-50 scale-[1.01]"
                  : "border-slate-300 bg-slate-50/80 hover:border-emerald-300 hover:bg-emerald-50/60"
                }`}
              >
                <label className="group block cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp"
                    multiple
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                    className="hidden"
                  />
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm transition group-hover:scale-105">
                    <UploadCloud size={26} />
                  </div>
                  <div className="font-black text-slate-950">
                    {isDragging ? "رها کنید…" : "فایل‌ها را انتخاب یا اینجا رها کنید"}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    PDF، Excel، CSV یا تصویر — تا ۵ فایل با هم
                  </div>
                </label>
              </div>

              {/* image previews grid */}
              {imagePreviews.filter(Boolean).length > 0 && (
                <div className={`mt-3 grid gap-2 ${imagePreviews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {imagePreviews.map((src, i) => src && (
                    <div key={i} className="overflow-hidden rounded-[18px] border border-emerald-100 bg-emerald-50">
                      <img src={src} alt={`preview-${i}`} className="max-h-36 w-full object-contain" />
                    </div>
                  ))}
                </div>
              )}

              {/* file list */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                      {isImageFile(f)
                        ? <ImageIcon size={18} className="shrink-0 text-emerald-700" />
                        : <FileSpreadsheet size={18} className="shrink-0 text-emerald-700" />
                      }
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-slate-950">{f.name}</div>
                        <div className="text-xs text-slate-500">{formatFileSize(f.size)}</div>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="shrink-0 rounded-xl p-1 text-slate-400 hover:bg-white hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={uploadFile}
                disabled={loading || !files.length}
                className="ui-btn mt-5 w-full gap-2 rounded-2xl bg-gradient-to-l from-emerald-700 to-teal-700 px-5 py-4 text-white shadow-lg shadow-emerald-700/15 transition hover:from-emerald-800 hover:to-teal-800 disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Beaker size={18} />}
                {loading
                  ? `در حال تحلیل ${files.length > 1 ? `(${files.length} فایل)` : ""}…`
                  : `شروع تحلیل${files.length > 1 ? ` (${files.length} فایل)` : " تخصصی"}`
                }
              </button>
            </div>

            <div className="brand-card rounded-[30px] p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <ShieldCheck size={21} />
                </div>
                <h3 className="text-lg font-black text-slate-950">
                  نکات بهتر برای تحلیل دقیق‌تر
                </h3>
              </div>

              <div className="space-y-3 text-sm leading-7 text-slate-600">
                <div className="rounded-2xl bg-slate-50 p-3">
                  نوع نمونه، ماتریس و هدف آزمون را در توضیحات بنویسید.
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  برای عکس دستگاه، نوع تصویر مناسب را از منوی بالا انتخاب کنید.
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  اگر فایل کروماتوگرام یا QC است، نوع دستگاه و روش آزمون را اضافه کنید.
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  برای تصمیم نهایی، نتیجه باید با شرایط واقعی آزمایشگاه بررسی شود.
                </div>
              </div>
            </div>
          </aside>

          <div className="brand-card rounded-[30px] p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-700">
                  <FileText size={25} />
                </div>

                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    نتیجه تحلیل
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    خروجی تخصصی آرتین بعد از تحلیل فایل اینجا نمایش داده می‌شود.
                  </p>
                </div>
              </div>

              {fileAnalysis && resultType === "success" && (
                <div className="flex gap-2">
                  <button
                    onClick={copyResult}
                    className={`ui-btn ui-btn-ghost gap-2 rounded-2xl px-4 py-2 text-sm transition-all ${copied ? "text-emerald-700" : ""}`}
                  >
                    {copied ? <CheckCircle2 size={16} /> : <ClipboardCopy size={16} />}
                    {copied ? "کپی شد!" : "کپی"}
                  </button>
                  <button
                    onClick={exportPDF}
                    className="ui-btn ui-btn-ghost gap-2 rounded-2xl px-4 py-2 text-sm"
                  >
                    <Download size={16} />
                    PDF
                  </button>
                </div>
              )}
            </div>

            {!fileAnalysis && !loading && (
              <div className="flex min-h-[520px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-emerald-700 shadow-sm">
                    <UploadCloud size={32} />
                  </div>

                  <h3 className="text-lg font-black text-slate-950">
                    هنوز تحلیلی انجام نشده است
                  </h3>

                  <p className="mt-3 max-w-md leading-8 text-slate-500">
                    ابتدا نوع تست را انتخاب کنید، فایل را آپلود کنید و روی شروع
                    تحلیل تخصصی بزنید.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[520px] items-center justify-center rounded-[28px] bg-slate-50 p-8 text-center">
                <div className="w-full max-w-sm">
                  <Loader2 size={34} className="mx-auto mb-5 animate-spin text-emerald-700" />
                  <h3 className="text-lg font-black text-slate-950">
                    آرتین در حال تحلیل است…
                  </h3>
                  {progressLabel && (
                    <p className="mt-1 text-sm text-slate-500">{progressLabel}</p>
                  )}
                  <div className="mt-6 space-y-2">
                    {(allImages ? PROGRESS_STEPS_IMAGE : PROGRESS_STEPS_FILE).map((step, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                          i < progressStep
                            ? "bg-emerald-50 text-emerald-700"
                            : i === progressStep
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-400"
                        }`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                          i < progressStep
                            ? "bg-emerald-600 text-white"
                            : i === progressStep
                            ? "bg-slate-900 text-white"
                            : "bg-slate-200 text-slate-400"
                        }`}>
                          {i < progressStep ? "✓" : i + 1}
                        </span>
                        {step}
                        {i === progressStep && (
                          <Loader2 size={14} className="mr-auto animate-spin text-emerald-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {fileAnalysis && (
              <>
                <div
                  className={`whitespace-pre-wrap rounded-[28px] border p-6 leading-9 shadow-inner ${
                    resultType === "error"
                      ? "border-red-100 bg-red-50 text-red-700"
                      : "border-slate-200 bg-slate-50/90 text-slate-800"
                  }`}
                >
                  <div className="mb-4 flex items-center gap-2 text-sm font-black">
                    {resultType === "error" ? (
                      <>
                        <AlertCircle size={18} />
                        خطا در تحلیل
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} className="text-emerald-700" />
                        تحلیل آماده شد
                      </>
                    )}
                  </div>
                  {fileAnalysis}
                </div>

                {resultType === "success" && (
                  <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <div className="font-black text-slate-950">سوال پیگیری</div>
                        <div className="text-sm text-slate-500">درباره این نتیجه از آرتین بپرسید</div>
                      </div>
                    </div>

                    {followUpHistory.map((item, i) => (
                      <div key={i} className="mb-4 space-y-2">
                        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">
                          {item.q}
                        </div>
                        <div className="whitespace-pre-wrap rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-8 text-slate-800">
                          {item.a}
                        </div>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <textarea
                        value={followUpQ}
                        onChange={(e) => setFollowUpQ(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendFollowUp();
                          }
                        }}
                        placeholder="مثلاً: این نتیجه برای استاندارد ASTM قابل قبوله؟"
                        className="ui-textarea h-14 flex-1 resize-none rounded-2xl p-3 text-sm leading-7 focus:border-emerald-600"
                        disabled={followUpLoading}
                      />
                      <button
                        onClick={sendFollowUp}
                        disabled={followUpLoading || !followUpQ.trim()}
                        className="ui-btn flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow disabled:opacity-40"
                      >
                        {followUpLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[26px] border border-blue-100 bg-blue-50/90 p-5 text-sm leading-8 text-blue-900 shadow-sm">
          این فایل فقط برای تحلیل موقت استفاده می‌شود و به بانک دانش داخلی آرتین
          آزما اضافه نمی‌شود، مگر اینکه کارشناس بعداً آن را تایید و ثبت کند.
        </div>
      </div>
    </section>
  );
}
