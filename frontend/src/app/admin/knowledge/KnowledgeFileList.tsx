"use client";

import { useMemo, useState } from "react";
import { Eye, FileText, FolderOpen, RefreshCw, Search, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getCategoryLabel } from "./knowledge-constants";
import {
  formatDateTime,
  getEmbeddingBadgeClass,
  getEmbeddingLabel,
  type KnowledgeFileDetail,
  type KnowledgeStats,
} from "./knowledge-types";

/** Searchable list of knowledge files with preview, rebuild and delete actions. */
export default function KnowledgeFileList({
  stats,
  onPreview,
  onReindex,
  onDelete,
  reindexingFile,
  deletingFile,
}: {
  stats: KnowledgeStats | null;
  onPreview: (fileName: string) => void;
  onReindex: (fileName: string) => void;
  onDelete: (fileName: string) => void;
  reindexingFile: string;
  deletingFile: string;
}) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

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

  // Same actions in the card layout (narrow screens) and the table (wide screens).
  const renderActions = (item: KnowledgeFileDetail, className: string) => (
                          <div className={className}>
                            <button
                              onClick={() => onPreview(item.file_name)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-2 text-xs font-bold text-[var(--color-info-text)] transition hover:bg-[var(--color-info-bg)]"
                            >
                              <Eye size={15} />
                              {isEn ? "Preview" : "پیش‌نمایش"}
                            </button>
                            <button
                              onClick={() => onReindex(item.file_name)}
                              disabled={!item.source_exists || reindexingFile === item.file_name}
                              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-2 text-xs font-bold text-[var(--color-warning-text)] transition hover:bg-[var(--color-warning-bg)] disabled:opacity-50"
                              title={
                                !item.source_exists
                                  ? (isEn ? "Source file is missing from knowledge_files" : "فایل منبع در knowledge_files موجود نیست")
                                  : (isEn ? "Rebuild chunks and embeddings" : "بازسازی chunk و embedding")
                              }
                            >
                              <RefreshCw
                                size={15}
                                className={reindexingFile === item.file_name ? "animate-spin" : ""}
                              />
                              {reindexingFile === item.file_name
                                ? (isEn ? "Rebuilding..." : "در حال بازسازی...")
                                : (isEn ? "Rebuild" : "بازسازی")}
                            </button>
                            <button
                              onClick={() => onDelete(item.file_name)}
                              disabled={deletingFile === item.file_name}
                              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-2 text-xs font-bold text-[var(--color-danger-text)] transition hover:bg-[var(--color-danger-bg)] disabled:opacity-50"
                            >
                              <Trash2 size={15} />
                              {deletingFile === item.file_name
                                ? (isEn ? "Deleting..." : "در حال حذف...")
                                : (isEn ? "Delete" : "حذف")}
                            </button>
                          </div>
  );

  return (
            <div className="min-w-0 rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm sm:p-6">
              <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--surface-soft)] px-4 py-2 text-sm font-bold text-[var(--text-muted)]">
                    <FolderOpen size={17} />
                    {isEn ? "Registered Files" : "فایل‌های ثبت‌شده"}
                  </div>

                  <h2 className="text-xl font-black text-[var(--foreground)]">
                    {isEn ? "Knowledge Base Files" : "فایل‌های بانک دانش"}
                  </h2>

                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    {isEn
                      ? "Imported files, categories, and chunk counts are shown here."
                      : "فایل‌های واردشده، دسته‌بندی و تعداد chunkهای هر فایل در این بخش نمایش داده می‌شود."}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">
                  {isEn ? "Showing" : "نمایش"}:{" "}
                  <span className="font-bold">{filteredFiles.length}</span>{" "}
                  {isEn ? "of" : "از"}{" "}
                  <span className="font-bold">{fileDetails.length}</span>{" "}
                  {isEn ? "files" : "فایل"}
                </div>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-[1fr_240px]">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
                  />
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder={isEn ? "Search by file name, title, or category..." : "جست‌وجو بر اساس نام فایل، عنوان یا دسته‌بندی..."}
                    className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-4 pl-4 pr-11 text-sm outline-none transition focus:border-[var(--color-info-border)]"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm outline-none transition focus:border-[var(--color-info-border)]"
                >
                  <option value="all">{isEn ? "All categories" : "همه دسته‌بندی‌ها"}</option>
                  {(stats?.categories || []).map((category) => (
                    <option key={category} value={category}>
                      {getCategoryLabel(category, locale)}
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
                          ? "bg-[var(--brand-fill)] text-white"
                          : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-text)]"
                      }`}
                    >
                      {getCategoryLabel(category, locale)}
                    </button>
                  ))}
                </div>
              )}

              {filteredFiles.length > 0 ? (
                <div className="max-h-[720px] overflow-y-auto rounded-3xl border border-[var(--border-soft)]">
                  <div className="space-y-3 p-3 2xl:hidden">
                    {filteredFiles.map((item) => {
                      const categories = item.categories?.length
                        ? item.categories
                        : [item.category];

                      return (
                        <div
                          key={item.file_name}
                          className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
                              <FileText size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="break-words font-black leading-7 text-[var(--foreground)]">
                                {item.title || item.file_name}
                              </div>
                              <div className="mt-1 break-all text-xs leading-6 text-[var(--text-subtle)]">
                                {item.file_name}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                            <div>
                              <div className="mb-1 font-bold text-[var(--text-subtle)]">{isEn ? "Category" : "دسته‌بندی"}</div>
                              <div className="flex flex-wrap gap-2">
                                {categories.map((category) => (
                                  <span
                                    key={category}
                                    className="rounded-full bg-[var(--color-info-bg)] px-3 py-1 font-bold text-[var(--color-info-text)]"
                                  >
                                    {getCategoryLabel(category, locale)}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="mb-1 font-bold text-[var(--text-subtle)]">Chunk</div>
                              <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 font-black text-[var(--text-muted)]">
                                {item.chunks}
                              </span>
                            </div>

                            <div>
                              <div className="mb-1 font-bold text-[var(--text-subtle)]">Embedding</div>
                              <div className="space-y-1.5">
                                <span className={`rounded-full px-3 py-1 font-black ${getEmbeddingBadgeClass(item.embedding_status)}`}>
                                  {getEmbeddingLabel(item.embedding_status, locale)}
                                </span>
                                <div className="font-bold text-[var(--text-subtle)]">
                                  {item.embedded_chunks ?? item.chunks} / {item.chunks}
                                </div>
                              </div>
                            </div>
                          </div>

                          {renderActions(item, "mt-4 flex flex-wrap gap-2")}
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto 2xl:block" tabIndex={0} role="region"
                    aria-label={isEn ? "Knowledge files table" : "جدول فایل‌های بانک دانش"}>
                  <table className="min-w-[980px] w-full border-collapse text-right text-sm">
                    <thead className="sticky top-0 bg-[var(--surface-soft)]">
                      <tr className="border-b border-[var(--border-soft)] text-[var(--text-muted)]">
                        <th className="p-4 font-bold">{isEn ? "File" : "فایل"}</th>
                        <th className="p-4 font-bold">{isEn ? "Category" : "دسته‌بندی"}</th>
                        <th className="p-4 font-bold">Chunk</th>
                        <th className="p-4 font-bold">Embedding</th>
                        <th className="p-4 font-bold">{isEn ? "Source file" : "فایل منبع"}</th>
                        <th className="p-4 font-bold">{isEn ? "Actions" : "عملیات"}</th>
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
                            className="border-b border-[var(--border-soft)] hover:bg-[var(--surface-soft)]"
                          >
                            <td className="p-4 align-top">
                              <div className="flex items-start gap-3">
                                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
                                  <FileText size={18} />
                                </div>

                                <div className="min-w-0">
                                  <div className="font-black text-[var(--foreground)]">
                                    {item.title || item.file_name}
                                  </div>
                                  <div className="mt-1 break-all text-xs leading-6 text-[var(--text-subtle)]">
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
                                    className="rounded-full bg-[var(--color-info-bg)] px-3 py-1 text-xs font-bold text-[var(--color-info-text)]"
                                  >
                                    {getCategoryLabel(category, locale)}
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td className="p-4 align-top">
                              <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-black text-[var(--text-muted)]">
                                {item.chunks}
                              </span>
                            </td>

                            <td className="p-4 align-top">
                              <div className="space-y-1.5">
                                <span className={`rounded-full px-3 py-1 text-xs font-black ${getEmbeddingBadgeClass(item.embedding_status)}`}>
                                  {getEmbeddingLabel(item.embedding_status, locale)}
                                </span>
                                <div className="text-xs font-bold text-[var(--text-subtle)]">
                                  {item.embedded_chunks ?? item.chunks} / {item.chunks}
                                </div>
                              </div>
                            </td>

                            <td className="p-4 align-top">
                              <div className="space-y-1.5 text-xs leading-6">
                                <span
                                  className={`rounded-full px-3 py-1 font-black ${
                                    item.source_exists
                                      ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                                      : "bg-[var(--surface-soft)] text-[var(--text-subtle)]"
                                  }`}
                                >
                                  {item.source_exists ? (isEn ? "Exists" : "موجود") : (isEn ? "Vector only" : "فقط vector")}
                                </span>
                                {item.source_exists && (
                                  <div className="text-[var(--text-subtle)]">
                                    {item.source_size_kb ?? 0} KB · {formatDateTime(item.source_updated_at, locale)}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="p-4 align-top">
                              {renderActions(item, "flex flex-wrap gap-2")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl bg-[var(--surface-soft)] p-10 text-center text-[var(--text-subtle)]">
                  {isEn ? "No files matched this filter." : "فایلی با این فیلتر پیدا نشد."}
                </div>
              )}
            </div>
  );
}
