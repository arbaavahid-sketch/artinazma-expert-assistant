"use client";

import {
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Flag,
  Mail,
  Phone,
  PlayCircle,
  RefreshCw,
  Save,
  UserRound,
  XCircle,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  NEXT_STATUS,
  REQUEST_PRIORITIES,
  formatDate,
  getPriorityMeta,
  getStatusClass,
  getStatusLabel,
  getStatusMeta,
  getTypeLabel,
  normalizePriority,
  normalizeStatus,
  type CrmDraft,
  type CustomerRequest,
} from "./requests-types";

/** One customer request: contact details, status workflow actions and internal CRM fields. */
export default function RequestCard({
  item,
  draft,
  saving,
  onUpdateStatus,
  onUpdateDraft,
  onSaveCrm,
}: {
  item: CustomerRequest;
  draft: CrmDraft | undefined;
  saving: boolean;
  onUpdateStatus: (requestId: number, status: string) => void;
  onUpdateDraft: (requestId: number, patch: Partial<CrmDraft>) => void;
  onSaveCrm: (requestId: number) => void;
}) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const statusMeta = getStatusMeta(item.status);
  const normalizedStatus = normalizeStatus(item.status);
  const nextStatus = NEXT_STATUS[normalizedStatus];

  return (
                <article
                  className={`rounded-[30px] border p-5 transition hover:shadow-md ${statusMeta.cardClass}`}
                >
                  <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-sm font-black text-[var(--text-muted)]">
                          #{item.id}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            item.status,
                          )}`}
                        >
                          {getStatusLabel(item.status, locale)}
                        </span>

                        <span className="rounded-full bg-purple-50 dark:bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-700 dark:text-purple-300">
                          {getTypeLabel(item.request_type, locale)}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${getPriorityMeta(item.priority).badgeClass}`}
                        >
                          <Flag size={13} />
                          {isEn ? getPriorityMeta(item.priority).labelEn : getPriorityMeta(item.priority).label}
                        </span>
                      </div>

                      <h2 className="mt-3 text-xl font-black text-[var(--foreground)]">
                        {item.subject || (isEn ? "No subject" : "بدون موضوع")}
                      </h2>

                      <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-subtle)]">
                        <Clock3 size={15} />
                        {isEn ? "Created at" : "ثبت شده در"} {formatDate(item.created_at, locale)}
                      </div>

                      {(item.assigned_to || item.follow_up_at) && (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-[var(--text-subtle)]">
                          {item.assigned_to && (
                            <span className="rounded-full bg-[var(--surface)] px-3 py-1">
                              {isEn ? "Owner" : "مسئول"}: {item.assigned_to}
                            </span>
                          )}
                          {item.follow_up_at && (
                            <span className="rounded-full bg-[var(--surface)] px-3 py-1">
                              {isEn ? "Follow-up" : "پیگیری"}: {formatDate(item.follow_up_at, locale)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {nextStatus && (
                        <button
                          onClick={() => onUpdateStatus(item.id, nextStatus)}
                          className={`inline-flex items-center gap-1.5 rounded-2xl border px-4 py-2 text-sm font-bold transition ${statusMeta.badgeClass}`}
                        >
                          {normalizedStatus === "closed" ? (
                            <RefreshCw size={15} />
                          ) : normalizedStatus === "sent" ? (
                            <XCircle size={15} />
                          ) : normalizedStatus === "pricing" ? (
                            <CheckCircle2 size={15} />
                          ) : (
                            <PlayCircle size={15} />
                          )}
                          {isEn ? statusMeta.actionLabelEn : statusMeta.actionLabel}
                        </button>
                      )}
                      {false && item.status === "new" && (
                        <button
                          onClick={() => onUpdateStatus(item.id, "in_progress")}
                          className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--color-warning-bg)] px-4 py-2 text-sm font-bold text-[var(--color-warning-text)] transition hover:bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]"
                        >
                          <PlayCircle size={15} />
                          {isEn ? "Start follow-up" : "شروع پیگیری"}
                        </button>
                      )}
                      {false && item.status === "in_progress" && (
                        <button
                          onClick={() => onUpdateStatus(item.id, "done")}
                          className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--color-success-bg)] px-4 py-2 text-sm font-bold text-[var(--color-success-text)] transition hover:bg-[var(--color-success-bg)] border border-[var(--color-success-border)]"
                        >
                          <CheckCircle2 size={15} />
                          {isEn ? "Done" : "انجام شد"}
                        </button>
                      )}
                      {false && item.status !== "closed" && (
                        <button
                          onClick={() => onUpdateStatus(item.id, "closed")}
                          className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-sm font-bold text-[var(--text-subtle)] transition hover:bg-[var(--border-soft)]"
                        >
                          <XCircle size={15} />
                          {isEn ? "Close" : "بستن"}
                        </button>
                      )}
                      {false && item.status === "closed" && (
                        <button
                          onClick={() => onUpdateStatus(item.id, "new")}
                          className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--color-info-bg)] px-3 py-2 text-sm font-bold text-[var(--color-info-text)] transition hover:bg-[var(--color-info-bg)]"
                        >
                          {isEn ? "Reopen" : "بازگشایی"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-[var(--surface)] p-4">
                        <div className="mb-3 text-sm font-black text-[var(--foreground)]">
                          {isEn ? "Customer information" : "اطلاعات مشتری"}
                        </div>

                        <div className="space-y-3 text-sm leading-7 text-[var(--text-muted)]">
                          <div className="flex items-start gap-2">
                            <UserRound
                              size={17}
                              className="mt-1 shrink-0 text-purple-700 dark:text-purple-300"
                            />
                            <span>{item.full_name || "-"}</span>
                          </div>

                          <div className="flex items-start gap-2">
                            <Building2
                              size={17}
                              className="mt-1 shrink-0 text-purple-700 dark:text-purple-300"
                            />
                            <span>{item.company || "-"}</span>
                          </div>

                          <div className="flex items-start gap-2">
                            <Phone
                              size={17}
                              className="mt-1 shrink-0 text-purple-700 dark:text-purple-300"
                            />
                            <span>{item.phone || "-"}</span>
                          </div>

                          <div className="flex items-start gap-2">
                            <Mail
                              size={17}
                              className="mt-1 shrink-0 text-purple-700 dark:text-purple-300"
                            />
                            <span className="break-all">
                              {item.email || "-"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[var(--surface)] p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-black text-[var(--foreground)]">
                          <Flag size={16} className="text-purple-700 dark:text-purple-300" />
                          {isEn ? "Internal follow-up" : "پیگیری داخلی"}
                        </div>

                        <label className="mb-2 block text-xs font-bold text-[var(--text-subtle)]">
                          {isEn ? "Priority" : "اولویت"}
                        </label>
                        <select
                          value={draft?.priority || normalizePriority(item.priority)}
                          onChange={(event) => onUpdateDraft(item.id, { priority: event.target.value })}
                          className={`mb-3 w-full rounded-2xl border px-3 py-2 text-sm font-bold outline-none transition focus:border-purple-400 ${getPriorityMeta(draft?.priority || item.priority).selectClass}`}
                        >
                          {REQUEST_PRIORITIES.map((priority) => (
                            <option key={priority.value} value={priority.value}>
                              {isEn ? priority.labelEn : priority.label}
                            </option>
                          ))}
                        </select>

                        <label className="mb-2 block text-xs font-bold text-[var(--text-subtle)]">
                          {isEn ? "Internal note" : "یادداشت داخلی"}
                        </label>
                        <textarea
                          value={draft?.internal_note ?? item.internal_note ?? ""}
                          onChange={(event) => onUpdateDraft(item.id, { internal_note: event.target.value })}
                          rows={4}
                          className="w-full resize-none rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-sm leading-7 text-[var(--text-muted)] outline-none transition focus:border-purple-400 focus:bg-[var(--surface)]"
                          placeholder={isEn ? "Example: contacted the customer; needs a GC proforma..." : "مثلا: با مشتری تماس گرفته شد، نیاز به پیش‌فاکتور GC دارد..."}
                        />

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-xs font-bold text-[var(--text-subtle)]">
                              {isEn ? "Owner" : "مسئول پیگیری"}
                            </label>
                            <input
                              value={draft?.assigned_to ?? item.assigned_to ?? ""}
                              onChange={(event) => onUpdateDraft(item.id, { assigned_to: event.target.value })}
                              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-bold text-[var(--text-muted)] outline-none transition focus:border-purple-400 focus:bg-[var(--surface)]"
                              placeholder={isEn ? "Example: Sales team" : "مثلا: واحد فروش"}
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-bold text-[var(--text-subtle)]">
                              {isEn ? "Next follow-up" : "پیگیری بعدی"}
                            </label>
                            <input
                              type="date"
                              value={draft?.follow_up_at ?? item.follow_up_at ?? ""}
                              onChange={(event) => onUpdateDraft(item.id, { follow_up_at: event.target.value })}
                              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-bold text-[var(--text-muted)] outline-none transition focus:border-purple-400 focus:bg-[var(--surface)]"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => onSaveCrm(item.id)}
                          disabled={saving}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-700 disabled:opacity-50"
                        >
                          <Save size={15} />
                          {saving
                            ? (isEn ? "Saving..." : "در حال ذخیره...")
                            : (isEn ? "Save follow-up" : "ذخیره پیگیری")}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[var(--surface)] p-4">
                      <div className="mb-3 text-sm font-black text-[var(--foreground)]">
                        {isEn ? "Request text" : "متن درخواست"}
                      </div>

                      <div className="whitespace-pre-wrap leading-8 text-[var(--text-muted)]">
                        {item.message || "-"}
                      </div>

                      {!!item.updates?.length && (
                        <div className="mt-4 rounded-2xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)]/60 p-4">
                          <div className="mb-3 text-sm font-black text-[var(--color-info-text)]">
                            {isEn ? "Customer follow-up notes" : "توضیحات تکمیلی مشتری"} ({item.updates.length})
                          </div>

                          <div className="max-h-64 space-y-2 overflow-y-auto">
                            {item.updates.map((update) => (
                              <div
                                key={update.id}
                                className="rounded-2xl bg-[var(--surface)] p-3 text-sm leading-7 text-[var(--text-muted)]"
                              >
                                <div className="whitespace-pre-wrap">
                                  {update.message}
                                </div>
                                {update.file_url && (
                                  <a
                                    href={apiUrl(update.file_url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--color-info-text)] transition hover:bg-[var(--color-info-bg)]"
                                  >
                                    <FileText size={14} />
                                    {update.file_name || (isEn ? "Attached file" : "فایل پیوست")}
                                  </a>
                                )}
                                <div className="mt-2 text-xs font-bold text-[var(--text-subtle)]">
                                  {formatDate(update.created_at, locale)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.updated_at && (
                        <div className="mt-4 rounded-2xl bg-[var(--surface-soft)] p-3 text-xs text-[var(--text-subtle)]">
                          {isEn ? "Last updated" : "آخرین بروزرسانی"}: {formatDate(item.updated_at, locale)}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
  );
}
