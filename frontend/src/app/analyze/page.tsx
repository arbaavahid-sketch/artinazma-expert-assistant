"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  AlertCircle,
  Beaker,
  CheckCircle2,
  ClipboardCopy,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Loader2,
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

function getTestTypeLabel(value: string) {
  return (
    testTypes.find((item) => item.value === value)?.label ||
    "گزارش عمومی آزمایشگاهی"
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [testType, setTestType] = useState("general");
  const [userNote, setUserNote] = useState("");
  const [fileAnalysis, setFileAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultType, setResultType] = useState<"success" | "error" | "">("");

  async function uploadFile() {
    if (!file) return;

    setLoading(true);
    setFileAnalysis("");
    setResultType("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("test_type", testType);
    formData.append("user_note", userNote);

    try {
      const res = await fetch(apiUrl("/analyze-file"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.ai_analysis) {
        setResultType("success");
        setFileAnalysis(data.ai_analysis);
      } else if (data.error) {
        setResultType("error");
        setFileAnalysis(data.error);
      } else {
        setResultType("success");
        setFileAnalysis(JSON.stringify(data, null, 2));
      }
    } catch {
      setResultType("error");
      setFileAnalysis("خطا در آپلود یا تحلیل فایل.");
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!fileAnalysis) return;
    await navigator.clipboard.writeText(fileAnalysis);
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
                    PDF، Excel، CSV
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
                نوع تست یا گزارش
              </label>

              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="ui-select rounded-2xl p-4 focus:border-emerald-600 focus:shadow-[0_0_0_4px_rgba(5,150,105,0.12)]"
              >
                {testTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">
                توضیح اختیاری درباره نمونه یا شرایط تست
              </label>

              <textarea
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                className="ui-textarea h-36 resize-none rounded-2xl p-4 leading-8 focus:border-emerald-600 focus:shadow-[0_0_0_4px_rgba(5,150,105,0.12)]"
                placeholder="مثلاً: نمونه LPG است، هدف بررسی ترکیبات گوگردی است، یا تست کاتالیست در دمای 350 درجه انجام شده..."
              />

              <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">
                فایل تست
              </label>

              <label className="group block cursor-pointer rounded-[26px] border-2 border-dashed border-slate-300 bg-slate-50/80 p-6 text-center transition hover:border-emerald-300 hover:bg-emerald-50/60">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />

                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm transition group-hover:scale-105">
                  <UploadCloud size={30} />
                </div>

                <div className="font-black text-slate-950">
                  فایل را انتخاب کنید یا اینجا رها کنید
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-500">
                  PDF، Excel یا CSV برای تحلیل تخصصی آرتین
                </div>
              </label>

              {file && (
                <div className="mt-4 rounded-[24px] border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <FileSpreadsheet
                      size={24}
                      className="mt-1 shrink-0 text-emerald-700"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-emerald-700">
                        فایل آماده تحلیل
                      </div>
                      <div className="mt-1 break-all text-sm font-black text-slate-950">
                        {file.name}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                        <span className="rounded-full bg-white px-3 py-1">
                          {formatFileSize(file.size)}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1">
                          {getTestTypeLabel(testType)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={uploadFile}
                disabled={loading || !file}
                className="ui-btn mt-5 w-full gap-2 rounded-2xl bg-gradient-to-l from-emerald-700 to-teal-700 px-5 py-4 text-white shadow-lg shadow-emerald-700/15 transition hover:from-emerald-800 hover:to-teal-800 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Beaker size={18} />
                )}
                {loading ? "در حال تحلیل..." : "شروع تحلیل تخصصی"}
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

              {fileAnalysis && (
                <button
                  onClick={copyResult}
                  className="ui-btn ui-btn-ghost gap-2 rounded-2xl px-4 py-2 text-sm"
                >
                  <ClipboardCopy size={16} />
                  کپی نتیجه
                </button>
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
                <div>
                  <Loader2
                    size={34}
                    className="mx-auto mb-4 animate-spin text-emerald-700"
                  />
                  <h3 className="text-lg font-black text-slate-950">
                    آرتین در حال تحلیل فایل است...
                  </h3>
                  <p className="mt-3 leading-8 text-slate-500">
                    بسته به حجم فایل، تحلیل ممکن است کمی زمان ببرد.
                  </p>
                </div>
              </div>
            )}

            {fileAnalysis && (
              <div
                className={`min-h-[520px] whitespace-pre-wrap rounded-[28px] border p-6 leading-9 shadow-inner ${
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
