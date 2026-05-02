"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";

const testTypes = [
  { value: "general", label: "گزارش عمومی آزمایشگاهی" },
  { value: "catalyst", label: "تست کاتالیست" },
  { value: "chromatography", label: "کروماتوگرافی GC/HPLC" },
  { value: "mercury", label: "آنالیز جیوه" },
  { value: "sulfur", label: "آنالیز سولفور" },
  { value: "metals", label: "آنالیز عنصری / فلزات" },
];

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [testType, setTestType] = useState("general");
  const [userNote, setUserNote] = useState("");
  const [fileAnalysis, setFileAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  async function uploadFile() {
    if (!file) return;

    setLoading(true);
    setFileAnalysis("");

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
        setFileAnalysis(data.ai_analysis);
      } else if (data.error) {
        setFileAnalysis(data.error);
      } else {
        setFileAnalysis(JSON.stringify(data, null, 2));
      }
    } catch {
      setFileAnalysis("خطا در آپلود یا تحلیل فایل.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-[32px] bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="mb-3 text-sm font-bold text-emerald-700">
            Artin Test Analyzer
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            تحلیل تخصصی فایل تست با آرتین
          </h1>

          <p className="mt-4 max-w-3xl leading-8 text-slate-600">
            فایل Excel، CSV یا PDF تست را آپلود کنید. قبل از تحلیل، نوع تست را
            مشخص کنید تا آرتین تحلیل را بر اساس همان حوزه تخصصی انجام دهد.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <label className="mb-2 block text-sm font-bold">
              نوع تست یا گزارش
            </label>

            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-emerald-600"
            >
              {testTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <label className="mb-2 mt-5 block text-sm font-bold">
              توضیح اختیاری درباره نمونه یا شرایط تست
            </label>

            <textarea
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              className="h-36 w-full rounded-2xl border border-slate-300 bg-white p-4 leading-8 outline-none focus:border-emerald-600"
              placeholder="مثلاً: نمونه LPG است، هدف بررسی ترکیبات گوگردی است، یا تست کاتالیست در دمای 350 درجه انجام شده..."
            />

            <label className="mb-2 mt-5 block text-sm font-bold">
              فایل تست
            </label>

            <input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm"
            />

            {file && (
              <div className="mt-3 rounded-2xl bg-white p-3 text-sm text-slate-600">
                فایل انتخاب‌شده: {file.name}
              </div>
            )}

            <button
              onClick={uploadFile}
              disabled={loading || !file}
              className="mt-5 w-full rounded-2xl bg-emerald-700 px-5 py-4 font-medium text-white disabled:opacity-50"
            >
              {loading ? "در حال تحلیل..." : "شروع تحلیل تخصصی"}
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-xl font-bold">نتیجه تحلیل</h2>

            {!fileAnalysis && !loading && (
              <div className="flex min-h-[420px] items-center justify-center rounded-3xl bg-slate-50 p-6 text-center text-slate-500">
                هنوز تحلیلی انجام نشده است.
                <br />
                ابتدا نوع تست را انتخاب کنید، فایل را آپلود کنید و روی شروع
                تحلیل بزنید.
              </div>
            )}

            {loading && (
              <div className="flex min-h-[420px] items-center justify-center rounded-3xl bg-slate-50 p-6 text-center text-slate-500">
                آرتین در حال تحلیل فایل است...
              </div>
            )}

            {fileAnalysis && (
              <div className="min-h-[420px] whitespace-pre-wrap rounded-3xl bg-slate-50 p-6 leading-8 text-slate-800">
                {fileAnalysis}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-blue-50 p-5 text-sm leading-8 text-blue-900">
          این فایل فقط برای تحلیل موقت استفاده می‌شود و به بانک دانش داخلی آرتین
          آزما اضافه نمی‌شود، مگر اینکه کارشناس بعداً آن را تایید و ثبت کند.
        </div>
      </div>
    </section>
  );
}