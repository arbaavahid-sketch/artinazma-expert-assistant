"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getCategoryLabel } from "./knowledge-constants";

/**
 * Slide-over showing a knowledge file's chunks, with inline chunk editing.
 * Render it with key={fileName} so each file starts from fresh state.
 */
export default function KnowledgePreviewPanel({
  fileName: previewFile,
  onClose,
}: {
  fileName: string;
  onClose: () => void;
}) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  type ChunkPreview = { index: number; title: string; category: string; content: string };
  const [previewChunks, setPreviewChunks] = useState<ChunkPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [editingChunkIndex, setEditingChunkIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingChunk, setSavingChunk] = useState(false);
  const [chunkSaveMsg, setChunkSaveMsg] = useState("");

  useEffect(() => {
    let active = true;
    fetch(adminUrl(`/knowledge/files/${encodeURIComponent(previewFile)}/chunks`), { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => { if (active) setPreviewChunks(data.chunks || []); })
      .catch(() => { if (active) setPreviewChunks([]); })
      .finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; };
  }, [previewFile]);

  async function saveChunk(chunk: ChunkPreview) {
    if (!previewFile) return;
    setSavingChunk(true);
    setChunkSaveMsg("");
    try {
      const res = await fetch(adminUrl(`/knowledge/files/${encodeURIComponent(previewFile)}/chunks`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunk_index: chunk.index, content: editingContent }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewChunks((prev) => prev.map((c) => c.index === chunk.index ? { ...c, content: editingContent } : c));
        setChunkSaveMsg(isEn ? "Saved ✓" : "ذخیره شد ✓");
        setEditingChunkIndex(null);
        setTimeout(() => setChunkSaveMsg(""), 3000);
      } else {
        setChunkSaveMsg(isEn ? "Save failed" : "خطا در ذخیره");
      }
    } catch {
      setChunkSaveMsg(isEn ? "Connection error" : "خطا در اتصال");
    } finally {
      setSavingChunk(false);
    }
  }

  return (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/30"
            onClick={() => onClose()}
          />
          {/* Panel */}
          <div className="flex h-full w-full max-w-xl flex-col bg-[var(--surface)] shadow-2xl md:max-w-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] p-6">
              <div>
                <div className="text-sm font-bold text-[var(--color-info-text)]">
                  {isEn ? "Knowledge Base Preview" : "پیش‌نمایش بانک دانش"}
                </div>
                <div className="mt-1 break-all text-base font-black text-[var(--foreground)]">
                  {previewFile}
                </div>
                <div className="mt-1 text-xs text-[var(--text-subtle)]">
                  {isEn
                    ? `${previewChunks.length} chunks`
                    : `${previewChunks.length} بخش (chunk)`}
                </div>
              </div>
              <button
                onClick={() => onClose()}
                className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-soft)] text-[var(--text-subtle)] hover:bg-[var(--surface-soft)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {previewLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="ui-skeleton h-28 w-full rounded-2xl" />
                  ))}
                </div>
              ) : previewChunks.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--text-subtle)]">
                  {isEn ? "No content found." : "محتوایی یافت نشد."}
                </div>
              ) : (
                <>
                {chunkSaveMsg && (
                  <div className="mb-4 rounded-2xl bg-[var(--color-success-bg)] px-4 py-2 text-xs font-bold text-[var(--color-success-text)]">
                    {chunkSaveMsg}
                  </div>
                )}
                <div className="space-y-4">
                  {previewChunks.map((chunk) => (
                    <div
                      key={chunk.index}
                      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[var(--color-info-bg)] px-3 py-1 text-xs font-black text-[var(--color-info-text)]">
                            #{chunk.index + 1}
                          </span>
                          {chunk.category && (
                            <span className="rounded-full bg-[var(--color-info-bg)] px-3 py-1 text-xs font-bold text-[var(--color-info-text)]">
                              {getCategoryLabel(chunk.category, locale)}
                            </span>
                          )}
                        </div>
                        {editingChunkIndex !== chunk.index ? (
                          <button
                            onClick={() => { setEditingChunkIndex(chunk.index); setEditingContent(chunk.content); }}
                            className="flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1 text-xs font-bold text-[var(--text-muted)] hover:border-[var(--color-info-border)] hover:text-[var(--color-info-text)] transition"
                          >
                            <Pencil size={12} /> {isEn ? "Edit" : "ویرایش"}
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveChunk(chunk)}
                              disabled={savingChunk}
                              className="flex items-center gap-1 rounded-xl bg-[var(--brand-fill)] px-2 py-1 text-xs font-bold text-white hover:bg-[var(--brand-fill-hover)] transition disabled:opacity-50"
                            >
                              <Save size={12} /> {savingChunk ? "..." : (isEn ? "Save" : "ذخیره")}
                            </button>
                            <button
                              onClick={() => setEditingChunkIndex(null)}
                              className="flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-soft)] transition"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      {editingChunkIndex === chunk.index ? (
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={8}
                          className="w-full resize-y rounded-xl border border-[var(--color-info-border)] bg-[var(--surface)] p-3 text-xs leading-7 text-[var(--text-muted)] outline-none focus:border-[var(--brand-accent)]"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-xs leading-7 text-[var(--text-muted)]">
                          {chunk.content}
                          {chunk.content.length >= 600 && (
                            <span className="text-[var(--text-subtle)]"> …</span>
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>
          </div>
        </div>
  );
}
