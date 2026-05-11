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
  return testTypes.find((item) => item.value === value)?.label || "گزارش عمومی آزمایشگاهی";
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
      const res = await fetch(apiUrl("/analyze-file"), { method: "POST", body: formData });
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
    <section className="min-h-screen bg-[#f7f7f8] px-5 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-emerald-50 via-white to-blue-50 p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 border border-emerald-200">
                  <FlaskConical size={17} />
                  Artin Test Analyzer
                </div>
                <h1 className="text-3xl font-black leading-[1.55] text-slate-900 md:text-4xl">
                  تحلیل تخصصی فایل تست با آرتین
                </h1>
                <p className="mt-4 max-w-4xl leading-8 text-slate-600">
                  فایل تست، گزارش آزمایشگاهی یا داده خام را آپلود کنید تا آرتین بر اساس نوع آزمون، داده‌ها را بررسی و نکات فنی، خطاهای احتمالی و پیشنهاد اقدام بعدی را ارائه کند.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-bold text-slate-500">فرمت‌های قابل تحلیل</div>
                  <div className="mt-2 font-black text-slate-900">PDF، Excel، CSV</div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-bold text-slate-500">خروجی پیشنهادی</div>
                  <div className="mt-2 font-black text-slate-900">تحلیل فنی و اقدام بعدی</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
          <aside className="space-y-6">
            <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <UploadCloud size={25} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">اطلاعات تحلیل</h2>
                  <p className="mt-1 text-sm text-slate-500">نوع تست و توضیحات نمونه را مشخص کنید.</p>
                </div>
              </div>

              <label className="mb-2 block text-sm font-bold text-slate-700">نوع تست یا گزارش</label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none transition focus:border-emerald-600"
              >
                {testTypes.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>

              <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">توضیح اختیاری درباره نمونه یا شرایط تست</label>
              <textarea
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                className="h-36 w-full resize-none rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-8 outline-none transition focus:border-emerald-600"
                placeholder="مثلاً: نمونه LPG است، هدف بررسی ترکیبات گوگردی است..."
              />

              <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">فایل تست</label>
              <label className="group block cursor-pointer rounded-[26px] border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-emerald-300 hover:bg-emerald-50">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                  <UploadCloud size={30} />
                </div>
                <div className="font-black text-slate-900">فایل را انتخاب کنید</div>
                <div className="mt-2 text-sm text-slate-500">PDF، Excel یا CSV</div>
              </label>

              {file && (
                <div className="mt-4 rounded-[24px] border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <FileSpreadsheet size={24} className="mt-1 shrink-0 text-emerald-700" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-emerald-700">فایل آماده تحلیل</div>
                      <div className="mt-1 break-all text-sm font-black text-slate-900">{file.name}</div>
                      <div className="mt-2 flex gap-2 text-xs font-bold text-slate-600">
                        <span className="rounded-full bg-white px-3 py-1">{formatFileSize(file.size)}</span>
                        <span className="rounded-full bg-white px-3 py-1">{getTestTypeLabel(testType)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={uploadFile}
                disabled={loading || !file}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Beaker size={18} />}
                {loading ? "در حال تحلیل..." : "شروع تحلیل تخصصی"}
              </button>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <ShieldCheck size={21} />
                </div>
                <h3 className="text-lg font-black text-slate-900">نکات بهتر برای تحلیل دقیق‌تر</h3>
              </div>
              <div className="space-y-3 text-sm leading-7 text-slate-600">
                <div className="rounded-2xl bg-slate-50 p-3">نوع نمونه، ماتریس و هدف آزمون را در توضیحات بنویسید.</div>
                <div className="rounded-2xl bg-slate-50 p-3">اگر فایل کروماتوگرام یا QC است، نوع دستگاه و روش آزمون را اضافه کنید.</div>
                <div className="rounded-2xl bg-slate-50 p-3">برای تصمیم نهایی، نتیجه باید با شرایط واقعی آزمایشگاه بررسی شود.</div>
              </div>
            </div>
          </aside>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-700">
                  <FileText size={25} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">نتیجه تحلیل</h2>
                  <p className="mt-1 text-sm text-slate-500">خروجی تخصصی آرتین بعد از تحلیل فایل اینجا نمایش داده می‌شود.</p>
                </div>
              </div>
              {fileAnalysis && (
                <button
                  onClick={copyResult}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-white"
                >
                  <ClipboardCopy size={16} />
                  کپی نتیجه
                </button>
              )}
            </div>

            {!fileAnalysis && !loading && (
              <div className="flex min-h-[520px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-emerald-700 shadow-sm">
                    <UploadCloud size={32} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">هنوز تحلیلی انجام نشده است</h3>
                  <p className="mt-3 max-w-md leading-8 text-slate-500">ابتدا نوع تست را انتخاب کنید، فایل را آپلود کنید و روی شروع تحلیل تخصصی بزنید.</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[520px] items-center justify-center rounded-[28px] bg-slate-50 p-8 text-center">
                <div>
                  <Loader2 size={34} className="mx-auto mb-4 animate-spin text-emerald-700" />
                  <h3 className="text-lg font-black text-slate-900">آرتین در حال تحلیل فایل است...</h3>
                  <p className="mt-3 leading-8 text-slate-500">بسته به حجم فایل، تحلیل ممکن است کمی زمان ببرد.</p>
                </div>
              </div>
            )}

            {fileAnalysis && (
              <div className={`min-h-[520px] whitespace-pre-wrap rounded-[28px] border p-6 leading-9 ${resultType === "error" ? "border-red-100 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
                <div className="mb-4 flex items-center gap-2 text-sm font-black">
                  {resultType === "error" ? (
                    <><AlertCircle size={18} />خطا در تحلیل</>
                  ) : (
                    <><CheckCircle2 size={18} className="text-emerald-700" />تحلیل آماده شد</>
                  )}
                </div>
                {fileAnalysis}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[26px] border border-blue-100 bg-blue-50 p-5 text-sm leading-8 text-blue-900">
          این فایل فقط برای تحلیل موقت استفاده می‌شود و به بانک دانش داخلی آرتین آزما اضافه نمی‌شود، مگر اینکه کارشناس بعداً آن را تایید و ثبت کند.
        </div>
      </div>
    </section>
  );
}
