"use client";

import {
  Bell,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Mail,
  MessageSquareText,
  Phone,
  Send,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  formatDate,
  getActionToneClass,
  getPriorityLabel,
  getRequestStatusLabel,
  type Customer,
  type CustomerSummary,
  type Session,
} from "./customers-types";

/** Selected customer: profile, AI summary, chat sessions and account actions. */
export default function CustomerDetailPanel({
  selected,
  customerSummary,
  summaryLoading,
  sessions,
  sessionsLoading,
  showSessions,
  approvingId,
  blockingId,
  onToggleSessions,
  onApproval,
  onToggleBlock,
  onOpenEmail,
  onOpenNotify,
}: {
  selected: Customer | null;
  customerSummary: CustomerSummary | null;
  summaryLoading: boolean;
  sessions: Session[];
  sessionsLoading: boolean;
  showSessions: boolean;
  approvingId: number | null;
  blockingId: number | null;
  onToggleSessions: () => void;
  onApproval: (customer: Customer, status: "approved" | "rejected") => void;
  onToggleBlock: (customer: Customer) => void;
  onOpenEmail: () => void;
  onOpenNotify: () => void;
}) {
  const { locale } = useI18n();
  const isEn = locale === "en";

  return (
    <>
            {selected ? (
              <div>
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[var(--color-info-bg)] text-xl font-black text-[var(--color-info-text)]">
                    {selected.full_name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-lg font-black text-[var(--foreground)]">
                      {selected.full_name}
                    </div>
                    <div className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                      {isEn ? "ID" : "شناسه"}: #{selected.id}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-2xl bg-[var(--surface-soft)] p-4">
                    <Mail className="mt-0.5 shrink-0 text-[var(--color-info-text)]" size={16} />
                    <div>
                      <div className="text-xs font-bold text-[var(--text-subtle)]">
                        {isEn ? "Email" : "ایمیل"}
                      </div>
                      <div className="mt-1 break-all text-sm font-bold text-[var(--foreground)]">
                        {selected.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-[var(--surface-soft)] p-4">
                    <Phone
                      className="mt-0.5 shrink-0 text-[var(--color-info-text)]"
                      size={16}
                    />
                    <div>
                      <div className="text-xs font-bold text-[var(--text-subtle)]">
                        {isEn ? "Phone" : "شماره تماس"}
                      </div>
                      <div className="mt-1 text-sm font-bold text-[var(--foreground)]">
                        {selected.phone || (isEn ? "Not registered" : "ثبت نشده")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-[var(--surface-soft)] p-4">
                    <Building2
                      className="mt-0.5 shrink-0 text-[var(--color-info-text)]"
                      size={16}
                    />
                    <div>
                      <div className="text-xs font-bold text-[var(--text-subtle)]">
                        {isEn ? "Company / Organization" : "شرکت / سازمان"}
                      </div>
                      <div className="mt-1 text-sm font-bold text-[var(--foreground)]">
                        {selected.company || (isEn ? "Not registered" : "ثبت نشده")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-[var(--surface-soft)] p-4">
                    <Clock3
                      className="mt-0.5 shrink-0 text-[var(--color-info-text)]"
                      size={16}
                    />
                    <div>
                      <div className="text-xs font-bold text-[var(--text-subtle)]">
                        {isEn ? "Join date" : "تاریخ عضویت"}
                      </div>
                      <div className="mt-1 text-sm font-bold text-[var(--foreground)]">
                        {formatDate(selected.created_at, locale)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-[var(--surface-soft)] p-4">
                    <ShieldCheck
                      className="mt-0.5 shrink-0 text-[var(--color-info-text)]"
                      size={16}
                    />
                    <div>
                      <div className="text-xs font-bold text-[var(--text-subtle)]">
                        {isEn ? "Access status" : "وضعیت دسترسی"}
                      </div>
                      <div className="mt-1 text-sm font-bold text-[var(--foreground)]">
                        {(selected.approval_status || "approved") === "pending"
                          ? (isEn ? "Pending admin approval" : "در انتظار تأیید ادمین")
                          : selected.approval_status === "rejected"
                            ? (isEn ? "Rejected" : "رد شده")
                            : (isEn ? "Approved" : "تأیید شده")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-[var(--surface-soft)] p-4">
                    <MessageSquareText
                      className="mt-0.5 shrink-0 text-[var(--color-success-text)]"
                      size={16}
                    />
                    <div>
                      <div className="text-xs font-bold text-[var(--text-subtle)]">
                        {isEn ? "Last activity" : "آخرین فعالیت"}
                      </div>
                      <div className="mt-1 text-sm font-bold text-[var(--foreground)]">
                        {selected.last_active ? formatDate(selected.last_active, locale) : (isEn ? "No messages yet" : "هنوز پیامی ندارد")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[var(--color-info-bg)] p-4 text-center">
                    <div className="text-3xl font-black text-[var(--color-info-text)]">
                      {selected.session_count}
                    </div>
                    <div className="mt-1 text-xs font-bold text-[var(--color-info-text)]">
                      {isEn ? "Chat sessions" : "جلسه گفتگو"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-soft)] p-4 text-center">
                    <div className="text-3xl font-black text-[var(--text-muted)]">
                      {selected.message_count}
                    </div>
                    <div className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                      {isEn ? "Sent messages" : "پیام ارسالی"}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)]/40 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={17} className="text-[var(--color-info-text)]" />
                      <h3 className="text-sm font-black text-[var(--foreground)]">
                        {isEn ? "Smart Customer Summary" : "خلاصه هوشمند مشتری"}
                      </h3>
                    </div>
                    {summaryLoading && (
                      <span className="text-xs font-bold text-[var(--text-subtle)]">
                        {isEn ? "Analyzing..." : "در حال تحلیل..."}
                      </span>
                    )}
                  </div>

                  {customerSummary ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-[var(--surface)] p-3 text-center">
                          <div className="text-xl font-black text-[var(--foreground)]">
                            {customerSummary.summary.total_requests}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-[var(--text-subtle)]">
                            {isEn ? "Requests" : "درخواست"}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-[var(--surface)] p-3 text-center">
                          <div className="text-xl font-black text-[var(--color-warning-text)]">
                            {customerSummary.summary.open_requests}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-[var(--text-subtle)]">
                            {isEn ? "Open" : "باز"}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-[var(--surface)] p-3 text-center">
                          <div className="text-xl font-black text-[var(--color-danger-text)]">
                            {customerSummary.summary.overdue_follow_ups}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-[var(--text-subtle)]">
                            {isEn ? "Overdue" : "عقب‌افتاده"}
                          </div>
                        </div>
                      </div>

                      <div className={`rounded-2xl border p-3 ${getActionToneClass(customerSummary.next_action.tone)}`}>
                        <div className="flex items-start gap-2">
                          <Target size={16} className="mt-0.5 shrink-0" />
                          <div>
                            <div className="text-sm font-black">
                              {customerSummary.next_action.title}
                            </div>
                            <div className="mt-1 text-xs font-bold opacity-80">
                              {customerSummary.next_action.reason}
                            </div>
                          </div>
                        </div>
                      </div>

                      {customerSummary.summary.latest_request && (
                        <div className="rounded-2xl bg-[var(--surface)] p-3">
                          <div className="mb-2 text-xs font-black text-[var(--text-subtle)]">
                            {isEn ? "Latest related request" : "آخرین درخواست مرتبط"}
                          </div>
                          <div className="truncate text-sm font-black text-[var(--foreground)]">
                            #{customerSummary.summary.latest_request.id}{" "}
                            {customerSummary.summary.latest_request.subject || (isEn ? "No subject" : "بدون موضوع")}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                            <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[var(--text-muted)]">
                              {getRequestStatusLabel(customerSummary.summary.latest_request.status, locale)}
                            </span>
                            <span className="rounded-full bg-[var(--color-info-bg)] px-2.5 py-1 text-[var(--color-info-text)]">
                              {getPriorityLabel(customerSummary.summary.latest_request.priority, locale)}
                            </span>
                            {customerSummary.summary.latest_request.follow_up_at && (
                              <span className="rounded-full bg-[var(--color-warning-bg)] px-2.5 py-1 text-[var(--color-warning-text)]">
                                {formatDate(customerSummary.summary.latest_request.follow_up_at, locale)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-[var(--surface)] p-4 text-center text-xs font-bold text-[var(--text-subtle)]">
                      {summaryLoading
                        ? (isEn ? "Preparing summary..." : "در حال آماده‌سازی خلاصه...")
                        : (isEn ? "No summary is available for this customer." : "خلاصه‌ای برای این مشتری در دسترس نیست.")}
                    </div>
                  )}
                </div>

                {/* Sessions list */}
                <div className="mt-5">
                  <button
                    onClick={() => onToggleSessions()}
                    className="flex w-full items-center justify-between rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm font-bold text-[var(--text-muted)] transition hover:bg-[var(--surface-soft)]"
                  >
                    <span className="flex items-center gap-2">
                      <MessageSquareText size={15} className="text-[var(--color-info-text)]" />
                      {isEn ? `Chat sessions (${selected.session_count})` : `جلسات گفتگو (${selected.session_count})`}
                    </span>
                    {showSessions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showSessions && (
                    <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                      {sessionsLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="ui-skeleton h-14 w-full rounded-xl" />
                          ))}
                        </div>
                      ) : sessions.length === 0 ? (
                        <div className="rounded-xl bg-[var(--surface-soft)] p-4 text-center text-xs text-[var(--text-subtle)]">
                          {isEn ? "No sessions have been registered yet" : "هنوز جلسه‌ای ثبت نشده"}
                        </div>
                      ) : (
                        sessions.map((s) => (
                          <div
                            key={s.id}
                            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 transition hover:border-[var(--color-info-border)] hover:shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-black text-[var(--foreground)]">
                                {s.title || (isEn ? "Untitled" : "بدون عنوان")}
                              </span>
                              <span className="shrink-0 rounded-full bg-[var(--color-info-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-info-text)]">
                                {isEn ? `${s.message_count} messages` : `${s.message_count} پیام`}
                              </span>
                            </div>
                            {s.first_user_message && (
                              <p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-[var(--text-subtle)] italic">
                                {s.first_user_message}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--text-subtle)]">
                              <Clock3 size={10} />
                              {formatDate(s.created_at, locale)}
                              {s.last_message_at && s.last_message_at !== s.created_at && (
                                <span className="mr-2">
                                  {isEn ? "— Last" : "— آخرین"}: {formatDate(s.last_message_at, locale)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={onOpenEmail}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-fill)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--brand-fill-hover)]"
                  >
                    <Send size={15} />
                    {isEn ? "Send email" : "ارسال ایمیل"}
                  </button>

                  <button
                    onClick={onOpenNotify}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm font-bold text-[var(--color-warning-text)] transition hover:bg-[var(--color-warning-bg)]"
                  >
                    <Bell size={15} />
                    {isEn ? "In-app notification" : "اعلان داخل اپ"}
                  </button>

                  {(selected.approval_status || "approved") !== "approved" && (
                    <button
                      onClick={() => onApproval(selected, "approved")}
                      disabled={approvingId === selected.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3 text-sm font-bold text-[var(--color-success-text)] transition hover:bg-[var(--color-success-bg)] disabled:opacity-50"
                    >
                      <ShieldCheck size={15} />
                      {approvingId === selected.id ? "..." : (isEn ? "Approve access" : "تأیید ورود")}
                    </button>
                  )}

                  {selected.approval_status !== "rejected" && (
                    <button
                      onClick={() => onApproval(selected, "rejected")}
                      disabled={approvingId === selected.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-bold text-[var(--text-muted)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
                    >
                      <ShieldOff size={15} />
                      {approvingId === selected.id ? "..." : (isEn ? "Reject access" : "رد دسترسی")}
                    </button>
                  )}

                  <button
                    onClick={() => onToggleBlock(selected)}
                    disabled={blockingId === selected.id}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
                      selected.is_blocked
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] hover:bg-[var(--color-success-bg)]"
                        : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] hover:bg-[var(--color-danger-bg)]"
                    }`}
                  >
                    {selected.is_blocked ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}
                    {blockingId === selected.id
                      ? "..."
                      : selected.is_blocked
                        ? (isEn ? "Unblock" : "رفع بلاک")
                        : (isEn ? "Block customer" : "بلاک مشتری")}
                  </button>
                </div>

                {selected.is_blocked && (
                  <div className="mt-3 rounded-2xl bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] p-3 text-xs font-bold text-[var(--color-danger-text)] text-center">
                    {isEn ? "This account is blocked; the customer cannot sign in." : "⛔ این حساب مسدود است — مشتری نمی‌تواند وارد شود."}
                  </div>
                )}
              </div>
            ) : (
              <div className="ui-empty rounded-3xl p-10">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--surface)] text-[var(--text-subtle)] shadow-sm">
                  <Users size={26} strokeWidth={1.8} />
                </div>
                <h3 className="mt-4 text-sm font-black text-[var(--text-muted)]">
                  {isEn ? "Select a customer" : "یک مشتری را انتخاب کنید"}
                </h3>
                <p className="mt-2 text-xs text-[var(--text-subtle)]">
                  {isEn ? "Click a customer name to view details." : "برای مشاهده جزئیات، روی نام مشتری کلیک کنید."}
                </p>
              </div>
            )}
    </>
  );
}
