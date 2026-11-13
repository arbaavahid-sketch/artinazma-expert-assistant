"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare2,
  Clock3,
  Loader2,
  ShieldCheck,
  Square,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  formatDate,
  formatMs,
  formatScore,
  getAskerLabel,
  getDomainLabel,
  getIntentLabel,
  getStatusClass,
  getStatusLabel,
  type QuestionItem,
} from "./questions-types";

/** One question in the admin list: badges, metadata chips and quick review actions. */
export default function QuestionRow({
  item,
  selected,
  reviewing,
  onToggleSelect,
  onQuickReview,
}: {
  item: QuestionItem;
  selected: boolean;
  reviewing: boolean;
  onToggleSelect: (id: number) => void;
  onQuickReview: (e: React.MouseEvent, id: number, status: string) => void;
}) {
  const { locale } = useI18n();
  const isEn = locale === "en";

  return (
                <Link
                  href={`/admin/questions/${item.id}`}
                  className={`group block rounded-[28px] border p-5 transition hover:border-[var(--color-info-border)] hover:bg-[var(--surface)] hover:shadow-sm ${
                    selected
                      ? "border-[var(--color-info-border)] bg-[var(--color-info-bg)]"
                      : "border-[var(--border-soft)] bg-[var(--surface-soft)]"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Row checkbox */}
                    <div
                      className="shrink-0 self-start pt-1 lg:self-center"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(item.id); }}
                    >
                      {selected ? (
                        <CheckSquare2 size={18} className="text-[var(--color-info-text)]" />
                      ) : (
                        <Square size={18} className="text-[var(--text-subtle)] group-hover:text-[var(--text-subtle)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-sm font-black text-[var(--text-muted)]">
                          #{item.id}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            item.expert_status,
                          )}`}
                        >
                          {getStatusLabel(item.expert_status, locale)}
                        </span>

                        <span className="rounded-full bg-[var(--color-info-bg)] px-3 py-1 text-xs font-bold text-[var(--color-info-text)]">
                          {getDomainLabel(item.detected_domain, locale)}
                        </span>

                        {item.user_rating === "up" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-bg)] px-3 py-1 text-xs font-bold text-[var(--color-success-text)]">
                            <ThumbsUp size={12} />
                            {isEn ? "Liked" : "پسندیده شده"}
                          </span>
                        )}
                        {item.user_rating === "down" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-danger-bg)] px-3 py-1 text-xs font-bold text-[var(--color-danger-text)]">
                            <ThumbsDown size={12} />
                            {isEn ? "Disliked" : "نپسندیده شده"}
                          </span>
                        )}
                      </div>

                      <div className="line-clamp-2 text-base font-bold leading-8 text-[var(--foreground)] group-hover:text-[var(--color-info-text)]">
                        {item.question}
                      </div>

                      {item.metadata?.image_url && (
                        <a
                          href={apiUrl(item.metadata.image_url)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 inline-block"
                          title={isEn ? "Open image" : "مشاهده تصویر ارسالی مشتری"}
                        >
                          <img
                            src={apiUrl(item.metadata.image_url)}
                            alt={item.metadata.image_type_label || "تصویر"}
                            loading="lazy"
                            className="max-h-40 rounded-xl border border-[var(--border-soft)] object-contain"
                          />
                        </a>
                      )}

                      {item.metadata?.analysis_type === "file" && item.metadata?.file_url && (
                        <a
                          href={apiUrl(item.metadata.file_url)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-bold text-[var(--text-muted)]"
                        >
                          📄 {item.metadata.file_name || (isEn ? "Attached file" : "فایل ارسالی")}
                        </a>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-[var(--text-muted)]">
                          intent: {getIntentLabel(item.metadata, locale)}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 ${
                            item.metadata?.customer_id || item.metadata?.user_id?.startsWith("customer_")
                              ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                              : "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-subtle)]"
                          }`}
                          title={item.metadata?.customer_email || item.metadata?.user_id || ""}
                        >
                          {isEn ? "asker" : "پرسنده"}: {getAskerLabel(item.metadata, locale)}
                        </span>
                        <span className="rounded-full border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-2.5 py-1 text-[var(--color-info-text)]">
                          search: {item.metadata?.search_mode || "-"}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 ${
                          item.metadata?.web_search_used
                            ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                            : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-subtle)]"
                        }`}>
                          web: {item.metadata?.web_search_used ? "on" : "off"}
                        </span>
                        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-[var(--text-muted)]">
                          sources: {item.metadata?.source_count ?? 0}
                        </span>
                        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-[var(--text-muted)]">
                          score: {formatScore(item.metadata?.best_score)}
                        </span>
                        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-[var(--text-muted)]">
                          time: {formatMs(item.metadata?.response_time_ms)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--text-subtle)]">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={14} />
                          {formatDate(item.created_at, locale)}
                        </span>

                        {item.updated_at && (
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck size={14} />
                            {isEn ? "Updated" : "بروزرسانی"}: {formatDate(item.updated_at, locale)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {reviewing ? (
                        <Loader2 size={18} className="animate-spin text-[var(--text-subtle)]" />
                      ) : (
                        <div className="flex gap-1.5" onClick={(e) => e.preventDefault()}>
                          <button
                            onClick={(e) => onQuickReview(e, item.id, "approved")}
                            title={isEn ? "Approve" : "تایید"}
                            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              item.expert_status === "approved"
                                ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                                : "bg-[var(--surface)] text-[var(--text-subtle)] hover:bg-[var(--color-success-bg)] hover:text-[var(--color-success-text)] border border-[var(--border-soft)]"
                            }`}
                          >
                            <CheckCircle2 size={13} />
                            {isEn ? "Approve" : "تایید"}
                          </button>
                          <button
                            onClick={(e) => onQuickReview(e, item.id, "needs_edit")}
                            title={isEn ? "Needs edit" : "نیازمند اصلاح"}
                            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              item.expert_status === "needs_edit"
                                ? "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
                                : "bg-[var(--surface)] text-[var(--text-subtle)] hover:bg-[var(--color-warning-bg)] hover:text-[var(--color-warning-text)] border border-[var(--border-soft)]"
                            }`}
                          >
                            <AlertCircle size={13} />
                            {isEn ? "Edit" : "اصلاح"}
                          </button>
                          <button
                            onClick={(e) => onQuickReview(e, item.id, "rejected")}
                            title={isEn ? "Reject" : "رد"}
                            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              item.expert_status === "rejected"
                                ? "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
                                : "bg-[var(--surface)] text-[var(--text-subtle)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] border border-[var(--border-soft)]"
                            }`}
                          >
                            <XCircle size={13} />
                            {isEn ? "Reject" : "رد"}
                          </button>
                        </div>
                      )}
                      <span className="text-xs text-[var(--color-info-text)] group-hover:underline">
                        {isEn ? "View details ->" : "مشاهده جزئیات ←"}
                      </span>
                    </div>
                  </div>
                </Link>
  );
}
