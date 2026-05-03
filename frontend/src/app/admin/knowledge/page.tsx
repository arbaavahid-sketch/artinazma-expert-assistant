"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";

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

function getCategoryLabel(category: string) {
  if (category === "general") return "عمومی";
  if (category === "catalyst") return "کاتالیست";
  if (category === "equipment") return "تجهیزات";
  if (category === "chromatography") return "کروماتوگرافی";
  if (category === "mercury-analysis") return "آنالیز جیوه";
  if (category === "sulfur-analysis") return "آنالیز سولفور";
  if (category === "troubleshooting") return "عیب‌یابی";
  if (category === "application-note") return "اپلیکیشن نوت";
  if (category === "ASTM Standards") return "استانداردهای ASTM";
  if (category === "expert-faq") return "FAQ تاییدشده";
  return category || "بدون دسته‌بندی";
}

export default function KnowledgePage() {
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeCategory, setKnowledgeCategory] = useState("general");
  const [knowledgeResult, setKnowledgeResult] = useState("");
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [deletingFile, setDeletingFile] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  async function loadKnowledgeStats() {
    try {
      const res = await fetch(apiUrl("/knowledge/stats"));
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
    formData.append("replace_existing", replaceExisting ? "true" : "false");
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
        setReplaceExisting(false);
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
  async function deleteKnowledgeFile(fileName: string) {
  const confirmed = window.confirm(
    `آیا مطمئن هستید که می‌خواهید فایل "${fileName}" از بانک دانش حذف شود؟`
  );

  if (!confirmed) return;

  setDeletingFile(fileName);
  setKnowledgeResult("");

  try {
    const res = await fetch(
      apiUrl(`/knowledge/files/${encodeURIComponent(fileName)}`),
      {
        method: "DELETE",
      }
    );

    const data = await res.json();

    if (data.success) {
      setKnowledgeResult(
        `فایل از بانک دانش حذف شد.\nنام فایل: ${data.file_name}\nتعداد chunk حذف‌شده: ${data.removed_chunks}`
      );
      await loadKnowledgeStats();
    } else {
      setKnowledgeResult(data.message || "خطا در حذف فایل از بانک دانش.");
    }
  } catch {
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
      const matchesSearch =
        !query ||
        item.file_name.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      const matchesCategory =
        selectedCategory === "all" ||
        item.category === selectedCategory ||
        item.categories?.includes(selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [fileDetails, searchText, selectedCategory]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 rounded-[32px] bg-white p-8 shadow-sm">
          <div className="mb-2 text-sm font-bold text-blue-700">
            مدیریت بانک دانش آرتین
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            بانک دانش اختصاصی آرتین آزما
          </h1>

          <p className="mt-4 max-w-4xl leading-8 text-slate-600">
            در این بخش می‌توانید فایل‌های آموزشی، کاتالوگ‌ها، استانداردها،
            اپلیکیشن‌نوت‌ها و FAQهای تاییدشده را وارد بانک دانش کنید و وضعیت
            فایل‌های ثبت‌شده را بررسی کنید.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-xl font-bold">
                افزودن فایل به بانک دانش
              </h2>

              <p className="mb-6 text-sm leading-7 text-slate-600">
                فایل PDF، TXT یا MD را وارد کنید تا آرتین بتواند در پاسخ‌های
                بعدی از محتوای آن استفاده کند.
              </p>

              <label className="mb-2 block text-sm font-bold">
                انتخاب فایل
              </label>

              <input
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(e) => setKnowledgeFile(e.target.files?.[0] || null)}
                className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm"
              />

              {knowledgeFile && (
                <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                  فایل انتخاب‌شده:{" "}
                  <span className="font-bold">{knowledgeFile.name}</span>
                </div>
              )}

              <label className="mb-2 mt-4 block text-sm font-bold">
                عنوان فایل
              </label>

              <input
                type="text"
                placeholder="مثلاً: استاندارد ASTM D1151"
                value={knowledgeTitle}
                onChange={(e) => setKnowledgeTitle(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-4 text-sm outline-none focus:border-blue-500"
              />

              <label className="mb-2 mt-4 block text-sm font-bold">
                دسته‌بندی
              </label>

              <select
                value={knowledgeCategory}
                onChange={(e) => setKnowledgeCategory(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-4 text-sm outline-none focus:border-blue-500"
              >
                <option value="general">عمومی</option>
                <option value="ASTM Standards">استانداردهای ASTM</option>
                <option value="catalyst">کاتالیست</option>
                <option value="equipment">تجهیزات</option>
                <option value="chromatography">کروماتوگرافی</option>
                <option value="mercury-analysis">آنالیز جیوه</option>
                <option value="sulfur-analysis">آنالیز سولفور</option>
                <option value="troubleshooting">عیب‌یابی</option>
                <option value="application-note">اپلیکیشن نوت</option>
              </select>
               <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
  <input
    type="checkbox"
    checked={replaceExisting}
    onChange={(e) => setReplaceExisting(e.target.checked)}
    className="mt-1"
  />

  <span>
    اگر فایل تکراری بود، نسخه قبلی از بانک دانش حذف شود و همین فایل جدید جایگزین شود.
  </span>
</label>
              <button
                onClick={uploadKnowledgeFile}
                disabled={loading || !knowledgeFile}
                className="mt-5 w-full rounded-2xl bg-purple-700 px-5 py-4 font-bold text-white disabled:opacity-50"
              >
                {loading ? "در حال افزودن..." : "افزودن به بانک دانش"}
              </button>

              {knowledgeResult && (
                <div className="mt-6 whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 text-sm leading-8">
                  {knowledgeResult}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold">خلاصه وضعیت</h2>

              {stats ? (
                <div className="grid gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">تعداد فایل‌ها</div>
                    <div className="mt-2 text-3xl font-black">
                      {stats.total_files}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">
                      تعداد بخش‌های متنی
                    </div>
                    <div className="mt-2 text-3xl font-black">
                      {stats.total_chunks}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="mb-3 text-sm font-bold text-slate-600">
                      دسته‌بندی‌ها
                    </div>

                    {stats.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {stats.categories.map((category) => (
                          <span
                            key={category}
                            className="rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-700"
                          >
                            {getCategoryLabel(category)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">
                        هنوز دسته‌بندی ثبت نشده است.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">
                  اطلاعات بانک دانش دریافت نشد.
                </p>
              )}

              <button
                onClick={loadKnowledgeStats}
                className="mt-5 w-full rounded-2xl bg-slate-800 px-4 py-3 text-sm font-bold text-white"
              >
                بروزرسانی وضعیت
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  فایل‌های ثبت‌شده در بانک دانش
                </h2>

                <p className="mt-2 text-sm leading-7 text-slate-600">
                  در این بخش می‌توانید فایل‌های واردشده، دسته‌بندی و تعداد
                  chunkهای هر فایل را ببینید.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                نمایش:{" "}
                <span className="font-bold">{filteredFiles.length}</span> از{" "}
                <span className="font-bold">{fileDetails.length}</span> فایل
              </div>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-[1fr_240px]">
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="جست‌وجو بر اساس نام فایل، عنوان یا دسته‌بندی..."
                className="rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-blue-500"
              />

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">همه دسته‌بندی‌ها</option>
                {stats?.categories.map((category) => (
                  <option key={category} value={category}>
                    {getCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>

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
                    {filteredFiles.map((item) => (
                      <tr
                        key={item.file_name}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="p-4 align-top">
                          <div className="font-bold text-slate-900">
                            {item.title || item.file_name}
                          </div>
                          <div className="mt-1 break-all text-xs leading-6 text-slate-500">
                            {item.file_name}
                          </div>
                        </td>

                        <td className="p-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            {(item.categories?.length
                              ? item.categories
                              : [item.category]
                            ).map((category) => (
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
    onClick={() => deleteKnowledgeFile(item.file_name)}
    disabled={deletingFile === item.file_name}
    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
  >
    {deletingFile === item.file_name ? "در حال حذف..." : "حذف"}
  </button>
</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">
                فایلی با این فیلتر پیدا نشد.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}