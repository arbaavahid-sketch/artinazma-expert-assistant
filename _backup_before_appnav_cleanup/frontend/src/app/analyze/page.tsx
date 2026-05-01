"use client";

import { useState } from "react";
import AppNav from "@/components/AppNav";
import { apiUrl } from "@/lib/api";
export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileAnalysis, setFileAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  async function uploadFile() {
    if (!file) return;

    setLoading(true);
    setFileAnalysis("");

    const formData = new FormData();
    formData.append("file", file);

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
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AppNav />

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold">تحلیل فایل تست</h1>
          <p className="mb-6 text-slate-600">
            فایل Excel، CSV یا PDF تست را آپلود کنید تا سیستم تحلیل اولیه، روندها،
            شاخص‌ها و پیشنهادهای فنی را ارائه کند.
          </p>

          <input
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full rounded-2xl border border-slate-300 bg-white p-4"
          />

          <button
            onClick={uploadFile}
            disabled={loading || !file}
            className="mt-4 rounded-2xl bg-emerald-700 px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "در حال تحلیل..." : "آپلود و تحلیل"}
          </button>

          {fileAnalysis && (
            <div className="mt-6 whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 leading-8">
              {fileAnalysis}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}