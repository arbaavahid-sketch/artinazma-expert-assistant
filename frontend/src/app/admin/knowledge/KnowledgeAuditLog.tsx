"use client";

import { useEffect, useState } from "react";
import { ClipboardList, RefreshCw, Trash2 } from "lucide-react";
import { adminUrl } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { useI18n } from "@/lib/i18n";
import { getCategoryLabel } from "./knowledge-constants";
import type { AuditEntry } from "./knowledge-types";

/** Collapsible history of knowledge base operations. Loads only when opened. */
export default function KnowledgeAuditLog() {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const { confirm } = useConfirm();
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState("all");
  const [showAuditLog, setShowAuditLog] = useState(false);

  async function loadAuditLog(filter = auditFilter) {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filter !== "all") params.set("action", filter);
      const res = await fetch(adminUrl(`/knowledge/audit-log?${params}`), { cache: "no-store" });
      const data = await res.json();
      setAuditLog(data.entries || []);
    } catch {
      setAuditLog([]);
    } finally {
      setAuditLoading(false);
    }
  }

  async function clearAuditLog() {
    if (!await confirm({
      message: isEn ? "Are you sure you want to clear all logs?" : "آیا مطمئنید که می‌خواهید همه لاگ‌ها را پاک کنید؟",
      variant: "warning",
      confirmLabel: isEn ? "Clear" : "پاک کردن",
      title: isEn ? "Clear logs" : "پاک کردن لاگ‌ها",
    })) return;
    await fetch(adminUrl("/knowledge/audit-log"), { method: "DELETE" });
    setAuditLog([]);
  }

  useEffect(() => {
    if (showAuditLog) loadAuditLog(auditFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuditLog, auditFilter]);

  return (
      <div className="mt-6 rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
        <button
          onClick={() => setShowAuditLog((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right transition hover:bg-[var(--surface-soft)] rounded-[32px]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]">
              <ClipboardList size={20} />
            </div>
            <div>
              <div className="text-base font-black text-[var(--foreground)]">
                {isEn ? "Knowledge Base Activity History" : "تاریخچه عملیات بانک دانش"}
              </div>
              <div className="text-sm text-[var(--text-subtle)]">
                {isEn ? "Uploads, deletions, chunk edits, and Drive syncs" : "آپلود، حذف، ویرایش chunk، و همگام‌سازی Drive"}
              </div>
            </div>
          </div>
          <span className="text-[var(--text-subtle)]">{showAuditLog ? "▲" : "▼"}</span>
        </button>

        {showAuditLog && (
          <div className="border-t border-[var(--border-soft)] px-6 pb-6 pt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {["all", "upload", "delete", "chunk_edit", "drive_sync"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setAuditFilter(f)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      auditFilter === f
                        ? "bg-amber-600 text-white"
                        : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:bg-[var(--color-warning-bg)] hover:text-[var(--color-warning-text)]"
                    }`}
                  >
                    {f === "all"
                      ? (isEn ? "All" : "همه")
                      : f === "upload"
                        ? (isEn ? "Upload" : "آپلود")
                        : f === "delete"
                          ? (isEn ? "Delete" : "حذف")
                          : f === "chunk_edit"
                            ? (isEn ? "Chunk edit" : "ویرایش chunk")
                            : "Drive Sync"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadAuditLog(auditFilter)}
                  disabled={auditLoading}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
                >
                  <RefreshCw size={12} className={auditLoading ? "animate-spin" : ""} />
                  {isEn ? "Refresh" : "بروزرسانی"}
                </button>
                <button
                  onClick={clearAuditLog}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]"
                >
                  <Trash2 size={12} />
                  {isEn ? "Clear" : "پاک کردن"}
                </button>
              </div>
            </div>

            {auditLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 w-full animate-pulse rounded-2xl bg-[var(--surface-soft)]" />)}
              </div>
            ) : auditLog.length === 0 ? (
              <div className="rounded-3xl bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--text-subtle)]">
                {isEn ? "No activity has been recorded yet." : "هنوز عملیاتی ثبت نشده است."}
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto rounded-3xl border border-[var(--border-soft)]">
                <table className="w-full border-collapse text-right text-sm">
                  <thead className="sticky top-0 bg-[var(--surface-soft)]">
                    <tr className="border-b border-[var(--border-soft)]">
                      <th className="p-3 text-xs font-bold text-[var(--text-muted)]">{isEn ? "Action" : "عملیات"}</th>
                      <th className="p-3 text-xs font-bold text-[var(--text-muted)]">{isEn ? "File / title" : "فایل / عنوان"}</th>
                      <th className="p-3 text-xs font-bold text-[var(--text-muted)]">{isEn ? "Details" : "جزئیات"}</th>
                      <th className="p-3 text-xs font-bold text-[var(--text-muted)]">{isEn ? "Time" : "زمان"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="border-b border-[var(--border-soft)] hover:bg-[var(--surface-soft)]">
                        <td className="p-3 align-top">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                            entry.action === "upload" ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]" :
                            entry.action === "delete" ? "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]" :
                            entry.action === "chunk_edit" ? "bg-[var(--color-info-bg)] text-[var(--color-info-text)]" :
                            "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300"
                          }`}>
                            {entry.action === "upload" ? (isEn ? "Upload" : "آپلود") :
                             entry.action === "delete" ? (isEn ? "Delete" : "حذف") :
                             entry.action === "chunk_edit" ? (isEn ? "Chunk edit" : "ویرایش chunk") : "Drive Sync"}
                          </span>
                        </td>
                        <td className="p-3 align-top">
                          <div className="font-bold text-[var(--foreground)]">{entry.title || entry.file_name || "—"}</div>
                          {entry.file_name && entry.title && entry.file_name !== entry.title && (
                            <div className="text-xs text-[var(--text-subtle)]">{entry.file_name}</div>
                          )}
                          {entry.category && (
                            <div className="mt-0.5">
                              <span className="rounded-full bg-[var(--color-info-bg)] px-2 py-0.5 text-xs font-bold text-[var(--color-info-text)]">{getCategoryLabel(entry.category, locale)}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 align-top text-xs text-[var(--text-subtle)]">{entry.detail || "—"}</td>
                        <td className="p-3 align-top text-xs text-[var(--text-subtle)] whitespace-nowrap">
                          {entry.created_at
                            ? new Intl.DateTimeFormat(isEn ? "en-US" : "fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.created_at + "Z"))
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
  );
}
