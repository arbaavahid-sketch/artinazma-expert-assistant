"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
type KnowledgeStats = {
  total_chunks: number;
  total_files: number;
  files: string[];
  categories: string[];
};

export default function KnowledgePage() {
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeCategory, setKnowledgeCategory] = useState("general");
  const [knowledgeResult, setKnowledgeResult] = useState("");
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadKnowledgeStats() {
    try {
      const res = await fetch(apiUrl("/knowledge/stats"))
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

    const formData = new FormData();
    formData.append("file", knowledgeFile);
    formData.append("title", knowledgeTitle || knowledgeFile.name);
    formData.append("category", knowledgeCategory || "general");

    try {
      const res = await fetch(apiUrl("/knowledge/upload"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setKnowledgeResult(
          `فایل با موفقیت اضافه شد.\nنام فایل: ${data.file_name}\nتعداد بخش‌های اضافه‌شده: ${data.chunks_added}`
        );
        setKnowledgeFile(null);
        setKnowledgeTitle("");
        await loadKnowledgeStats();
      } else {
        setKnowledgeResult(data.message || "خطا در افزودن فایل به بانک دانش.");
      }
    } catch {
      setKnowledgeResult("خطا در آپلود فایل دانش.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h1 className="mb-2 text-2xl font-bold">افزودن فایل به بانک دانش</h1>
            <p className="mb-6 text-slate-600">
              کاتالوگ، اپلیکیشن‌نوت، فایل آموزشی، راهنمای دستگاه یا FAQ را وارد
              کنید تا دستیار بتواند بر اساس دانش اختصاصی آرتین آزما پاسخ بدهد.
            </p>

            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={(e) => setKnowledgeFile(e.target.files?.[0] || null)}
              className="w-full rounded-2xl border border-slate-300 bg-white p-4"
            />

            <input
              type="text"
              placeholder="عنوان فایل، مثلاً کاتالوگ دستگاه آنالیز جیوه"
              value={knowledgeTitle}
              onChange={(e) => setKnowledgeTitle(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-300 p-4 outline-none focus:border-blue-500"
            />

            <select
              value={knowledgeCategory}
              onChange={(e) => setKnowledgeCategory(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-300 p-4 outline-none focus:border-blue-500"
            >
              <option value="general">عمومی</option>
              <option value="catalyst">کاتالیست</option>
              <option value="equipment">تجهیزات</option>
              <option value="chromatography">کروماتوگرافی</option>
              <option value="mercury-analysis">آنالیز جیوه</option>
              <option value="sulfur-analysis">آنالیز سولفور</option>
              <option value="troubleshooting">عیب‌یابی</option>
              <option value="application-note">اپلیکیشن نوت</option>
            </select>

            <button
              onClick={uploadKnowledgeFile}
              disabled={loading || !knowledgeFile}
              className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-medium text-white disabled:opacity-50"
            >
              {loading ? "در حال افزودن..." : "افزودن به بانک دانش"}
            </button>

            {knowledgeResult && (
              <div className="mt-6 whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 leading-8">
                {knowledgeResult}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">وضعیت بانک دانش</h2>

            {stats ? (
              <div className="space-y-4 text-sm">
                <div className="rounded-2xl bg-slate-50 p-4">
                  تعداد فایل‌ها:{" "}
                  <span className="font-bold">{stats.total_files}</span>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  تعداد بخش‌های متنی:{" "}
                  <span className="font-bold">{stats.total_chunks}</span>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-2 font-bold">دسته‌بندی‌ها</div>
                  {stats.categories.length > 0
                    ? stats.categories.join("، ")
                    : "هنوز دسته‌بندی ثبت نشده"}
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-2 font-bold">فایل‌ها</div>
                  {stats.files.length > 0 ? (
                    <ul className="list-inside list-disc space-y-1">
                      {stats.files.map((file) => (
                        <li key={file}>{file}</li>
                      ))}
                    </ul>
                  ) : (
                    "هنوز فایلی ثبت نشده"
                  )}
                </div>
              </div>
            ) : (
              <p className="text-slate-500">اطلاعات بانک دانش دریافت نشد.</p>
            )}

            <button
              onClick={loadKnowledgeStats}
              className="mt-4 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-medium text-white"
            >
              بروزرسانی وضعیت
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
