"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { adminUrl } from "@/lib/api";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import {
  Users,
  Search,
  Bell,
  X,
  Building2,
  Phone,
  Mail,
  MessageSquareText,
  MessagesSquare,
  Clock3,
  Send,
  ShieldOff,
  ShieldCheck,
  Download,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
} from "lucide-react";

type Customer = {
  id: number;
  full_name: string;
  email: string;
  company: string;
  phone: string;
  created_at: string;
  session_count: number;
  message_count: number;
  last_active?: string | null;
  is_blocked?: boolean;
  approval_status?: "pending" | "approved" | "rejected";
  last_message_preview?: string | null;
};

type Session = {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
  last_message_at?: string | null;
  first_user_message?: string | null;
};

type CustomerSummary = {
  summary: {
    session_count: number;
    message_count: number;
    last_active: string | null;
    total_requests: number;
    open_requests: number;
    urgent_requests: number;
    overdue_follow_ups: number;
    due_today: number;
    unassigned_open: number;
    latest_request: {
      id: number;
      subject: string;
      request_type: string;
      status: string;
      priority: string;
      assigned_to: string;
      follow_up_at: string;
      created_at: string;
    } | null;
  };
  next_action: {
    title: string;
    reason: string;
    tone: "urgent" | "warning" | "success" | "neutral";
  };
};

function formatDate(value?: string, locale = "fa") {
  if (!value) return locale === "en" ? "Unknown" : "نامشخص";
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fa-IR", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getActionToneClass(tone?: string) {
  if (tone === "urgent") return "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]";
  if (tone === "warning") return "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]";
  if (tone === "success") return "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]";
  return "border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]";
}

function getRequestStatusLabel(status: string, locale = "fa") {
  const isEn = locale === "en";
  if (status === "reviewing") return isEn ? "Reviewing" : "در حال بررسی";
  if (status === "pricing") return isEn ? "Pricing" : "قیمت‌گذاری";
  if (status === "sent") return isEn ? "Sent" : "ارسال‌شده";
  if (status === "closed") return isEn ? "Closed" : "بسته‌شده";
  return isEn ? "New" : "جدید";
}

function getPriorityLabel(priority: string, locale = "fa") {
  const isEn = locale === "en";
  if (priority === "urgent") return isEn ? "Urgent" : "فوری";
  if (priority === "high") return isEn ? "High" : "بالا";
  if (priority === "low") return isEn ? "Low" : "کم";
  return isEn ? "Normal" : "عادی";
}

function AdminCustomersContent() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const searchParams = useSearchParams();
  const autoSessions = searchParams.get("sessions") === "1";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [blockingId, setBlockingId] = useState<number | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [notifyModal, setNotifyModal] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyStatus, setNotifyStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [sendingNotify, setSendingNotify] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [customerSummary, setCustomerSummary] = useState<CustomerSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadSessions = useCallback(async (customerId: number) => {
    setSessionsLoading(true);
    try {
      const res = await fetch(adminUrl(`/admin/customers/${customerId}/sessions`));
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadCustomerSummary = useCallback(async (customerId: number) => {
    setSummaryLoading(true);
    try {
      const res = await fetch(adminUrl(`/admin/customers/${customerId}/summary`), {
        cache: "no-store",
      });
      const data = await res.json();
      setCustomerSummary(data);
    } catch {
      setCustomerSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  async function sendNotification() {
    if (!selected || !notifyMessage.trim()) return;
    setSendingNotify(true);
    setNotifyStatus(null);
    try {
      const res = await fetch(adminUrl(`/admin/customers/${selected.id}/notify`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: notifyMessage.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifyStatus({ text: isEn ? "Notification sent successfully." : "اعلان با موفقیت ارسال شد.", ok: true });
        setNotifyMessage("");
        setTimeout(() => { setNotifyModal(false); setNotifyStatus(null); }, 1500);
      } else {
        setNotifyStatus({ text: data.message || (isEn ? "Send failed." : "خطا در ارسال."), ok: false });
      }
    } catch {
      setNotifyStatus({ text: isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.", ok: false });
    } finally {
      setSendingNotify(false);
    }
  }

  async function toggleBlock(customer: Customer) {
    setBlockingId(customer.id);
    const action = customer.is_blocked ? "unblock" : "block";
    try {
      const res = await fetch(adminUrl(`/admin/customers/${customer.id}/${action}`), {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customer.id ? { ...c, is_blocked: !customer.is_blocked } : c,
          ),
        );
        if (selected?.id === customer.id) {
          setSelected({ ...selected, is_blocked: !customer.is_blocked });
        }
      }
    } catch {}
    setBlockingId(null);
  }

  async function setApproval(customer: Customer, status: "approved" | "rejected") {
    setApprovingId(customer.id);
    const action = status === "approved" ? "approve" : "reject";
    try {
      const res = await fetch(adminUrl(`/admin/customers/${customer.id}/${action}`), {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customer.id ? { ...c, approval_status: status } : c,
          ),
        );
        if (selected?.id === customer.id) {
          setSelected({ ...selected, approval_status: status });
        }
      }
    } catch {}
    setApprovingId(null);
  }

  useEffect(() => {
    fetch(adminUrl("/admin/customers?limit=200"))
      .then((r) => r.json())
      .then((d) => {
        const list = d.customers || [];
        setCustomers(list);
        setTotal(d.total || 0);
        if (autoSessions && list.length > 0) {
          setSelected(list[0]);
          setShowSessions(true);
          loadSessions(list[0].id);
          loadCustomerSummary(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [autoSessions, loadCustomerSummary, loadSessions]);

  const filtered = search.trim()
    ? customers.filter(
        (c) =>
          c.full_name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          (c.company || "").toLowerCase().includes(search.toLowerCase()),
      )
    : customers;

  return (
    <section className="min-h-full bg-[var(--background)] px-6 py-8" dir={dir}>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="ui-card mb-6 overflow-hidden rounded-[36px] shadow-sm">
          <div className="bg-gradient-to-l from-[var(--color-info-bg)] via-[var(--surface)] to-[var(--surface-soft)] p-8">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher variant="purple" />
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-700 text-white shadow-sm">
                  <Users size={28} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="mb-1 text-sm font-bold text-[var(--color-info-text)]">
                    {isEn ? "Admin Panel" : "پنل ادمین"}
                  </div>
                  <h1 className="text-3xl font-black text-[var(--foreground)]">
                    {isEn ? "Customer Management" : "مدیریت مشتریان"}
                  </h1>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="rounded-2xl bg-[var(--color-info-bg)] px-5 py-3 text-center">
                  <div className="text-2xl font-black text-[var(--color-info-text)]">
                    {total}
                  </div>
                  <div className="mt-1 text-xs font-bold text-[var(--color-info-text)]">
                    {isEn ? "Total customers" : "کل مشتریان"}
                  </div>
                </div>
                <div className="rounded-2xl bg-[var(--surface-soft)] px-5 py-3 text-center">
                  <div className="text-2xl font-black text-[var(--text-muted)]">
                    {customers.reduce((s, c) => s + c.session_count, 0)}
                  </div>
                  <div className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "Total sessions" : "کل جلسات"}
                  </div>
                </div>
                <div className="rounded-2xl bg-[var(--surface-soft)] px-5 py-3 text-center">
                  <div className="text-2xl font-black text-[var(--text-muted)]">
                    {customers.reduce((s, c) => s + c.message_count, 0)}
                  </div>
                  <div className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "Total messages" : "کل پیام‌ها"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = adminUrl("/admin/customers/export-csv");
                  a.download = "customers.csv";
                  a.click();
                }}
                className="ui-btn ui-btn-ghost rounded-2xl px-4 py-2.5 text-sm"
              >
                <Download size={15} className="ml-1.5" />
                {isEn ? "Export CSV" : "خروجی CSV"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Customer list */}
          <div className="ui-card rounded-[32px] p-6 shadow-sm">
            {/* Search */}
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3">
              <Search size={16} className="shrink-0 text-[var(--text-subtle)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isEn ? "Search by name, email, or company..." : "جستجو بر اساس نام، ایمیل یا شرکت..."}
                className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--text-subtle)] outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="shrink-0 text-[var(--text-subtle)] hover:text-[var(--text-muted)]"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="ui-skeleton h-20 w-full rounded-2xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="ui-empty rounded-3xl p-10">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--surface)] text-[var(--text-subtle)] shadow-sm">
                  <Users size={26} strokeWidth={1.8} />
                </div>
                <h3 className="mt-4 text-base font-black text-[var(--text-muted)]">
                  {search
                    ? (isEn ? "No results found" : "نتیجه‌ای یافت نشد")
                    : (isEn ? "No customers have registered yet" : "هنوز مشتری‌ای ثبت نشده")}
                </h3>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="mt-3 text-sm font-bold text-[var(--color-info-text)] hover:underline"
                  >
                    {isEn ? "Clear search" : "پاک کردن جستجو"}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelected(c);
                      setShowSessions(false);
                      setSessions([]);
                      setCustomerSummary(null);
                      loadSessions(c.id);
                      loadCustomerSummary(c.id);
                    }}
                    className={`w-full rounded-2xl border p-4 text-right transition ${
                      selected?.id === c.id
                        ? "border-[var(--color-info-border)] bg-[var(--color-info-bg)]"
                        : "border-[var(--border-soft)] bg-[var(--surface-soft)] hover:border-[var(--color-info-border)] hover:bg-[var(--surface)] hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-black text-[var(--foreground)]">
                            {c.full_name}
                          </span>
                          {c.is_blocked && (
                            <span className="shrink-0 rounded-full bg-[var(--color-danger-bg)] px-2 py-0.5 text-[10px] font-black text-[var(--color-danger-text)]">
                              {isEn ? "Blocked" : "بلاک"}
                            </span>
                          )}
                          {(c.approval_status || "approved") === "pending" && (
                            <span className="shrink-0 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[10px] font-black text-[var(--color-warning-text)]">
                              {isEn ? "Pending approval" : "در انتظار تأیید"}
                            </span>
                          )}
                          {c.approval_status === "rejected" && (
                            <span className="shrink-0 rounded-full bg-[var(--border-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--text-muted)]">
                              {isEn ? "Rejected" : "رد شده"}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-subtle)]">
                          <Mail size={12} />
                          <span className="truncate">{c.email}</span>
                          {c.company && (
                            <>
                              <span className="text-[var(--text-subtle)]">·</span>
                              <Building2 size={12} />
                              <span className="truncate">{c.company}</span>
                            </>
                          )}
                        </div>
                        {c.last_message_preview && (
                          <p className="mt-1 line-clamp-1 text-xs text-[var(--text-subtle)] italic">
                            {c.last_message_preview}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-[var(--text-subtle)]">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <MessageSquareText size={12} />
                            {c.session_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessagesSquare size={12} />
                            {c.message_count}
                          </span>
                        </div>
                        {c.last_active && (
                          <span className="flex items-center gap-1 text-[var(--color-success-text)]">
                            <Clock3 size={11} />
                            {formatDate(c.last_active, locale)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="ui-card rounded-[32px] p-6 shadow-sm">
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
                    onClick={() => setShowSessions(!showSessions)}
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
                    onClick={() => {
                      setEmailSubject(isEn ? `Message from ArtinAzma to ${selected.full_name}` : `پیام از آرتین آزما به ${selected.full_name}`);
                      setEmailBody("");
                      setEmailModal(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
                  >
                    <Send size={15} />
                    {isEn ? "Send email" : "ارسال ایمیل"}
                  </button>

                  <button
                    onClick={() => {
                      setNotifyMessage("");
                      setNotifyStatus(null);
                      setNotifyModal(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm font-bold text-[var(--color-warning-text)] transition hover:bg-[var(--color-warning-bg)]"
                  >
                    <Bell size={15} />
                    {isEn ? "In-app notification" : "اعلان داخل اپ"}
                  </button>

                  {(selected.approval_status || "approved") !== "approved" && (
                    <button
                      onClick={() => setApproval(selected, "approved")}
                      disabled={approvingId === selected.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3 text-sm font-bold text-[var(--color-success-text)] transition hover:bg-[var(--color-success-bg)] disabled:opacity-50"
                    >
                      <ShieldCheck size={15} />
                      {approvingId === selected.id ? "..." : (isEn ? "Approve access" : "تأیید ورود")}
                    </button>
                  )}

                  {selected.approval_status !== "rejected" && (
                    <button
                      onClick={() => setApproval(selected, "rejected")}
                      disabled={approvingId === selected.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-bold text-[var(--text-muted)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
                    >
                      <ShieldOff size={15} />
                      {approvingId === selected.id ? "..." : (isEn ? "Reject access" : "رد دسترسی")}
                    </button>
                  )}

                  <button
                    onClick={() => toggleBlock(selected)}
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
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {emailModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[32px] bg-[var(--surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] p-6">
              <div>
                <h2 className="text-lg font-black text-[var(--foreground)]">{isEn ? "Send Email" : "ارسال ایمیل"}</h2>
                <p className="mt-1 text-sm text-[var(--text-subtle)]">
                  {isEn ? "To" : "به"}: {selected.full_name} — {selected.email}
                </p>
              </div>
              <button
                onClick={() => setEmailModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-subtle)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-muted)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-bold text-[var(--text-muted)]">{isEn ? "Subject" : "موضوع"}</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="ui-input"
                  placeholder={isEn ? "Email subject..." : "موضوع ایمیل..."}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-[var(--text-muted)]">{isEn ? "Email body" : "متن ایمیل"}</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={6}
                  className="ui-textarea w-full resize-none p-3"
                  placeholder={isEn ? "Write your message..." : "متن پیام خود را بنویسید..."}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <a
                  href={`mailto:${selected.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 font-bold text-white transition hover:bg-blue-800"
                  onClick={() => setEmailModal(false)}
                >
                  <Send size={16} />
                  {isEn ? "Open in email app" : "باز کردن در ایمیل"}
                </a>
                <button
                  onClick={() => setEmailModal(false)}
                  className="ui-btn ui-btn-ghost px-5 py-3"
                >
                  {isEn ? "Cancel" : "انصراف"}
                </button>
              </div>
              <p className="text-xs text-[var(--text-subtle)] text-center">
                {isEn
                  ? "This button opens your email client with the filled information."
                  : "این دکمه کلاینت ایمیل شما را با اطلاعات پر‌شده باز می‌کند."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notify Modal */}
      {notifyModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[32px] bg-[var(--surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] p-6">
              <div>
                <h2 className="text-lg font-black text-[var(--foreground)]">{isEn ? "Send In-App Notification" : "ارسال اعلان داخل اپ"}</h2>
                <p className="mt-1 text-sm text-[var(--text-subtle)]">{isEn ? "For" : "برای"}: {selected.full_name}</p>
              </div>
              <button
                onClick={() => setNotifyModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-subtle)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-muted)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              {notifyStatus && (
                <div className={`rounded-2xl p-4 text-sm font-bold ${
                  notifyStatus.ok ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]" : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
                }`}>
                  {notifyStatus.text}
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-bold text-[var(--text-muted)]">{isEn ? "Message text" : "متن پیام"}</label>
                <textarea
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm leading-7 outline-none transition focus:border-amber-500"
                  placeholder={isEn ? "Notification message for the customer..." : "پیام اعلان برای مشتری..."}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={sendNotification}
                  disabled={sendingNotify || !notifyMessage.trim()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  <Bell size={16} />
                  {sendingNotify ? (isEn ? "Sending..." : "در حال ارسال...") : (isEn ? "Send notification" : "ارسال اعلان")}
                </button>
                <button
                  onClick={() => setNotifyModal(false)}
                  className="rounded-2xl border border-[var(--border-soft)] px-5 py-3 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
                >
                  {isEn ? "Cancel" : "انصراف"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={null}>
      <AdminCustomersContent />
    </Suspense>
  );
}
