"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { adminUrl } from "@/lib/api";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { formatNumber, useI18n } from "@/lib/i18n";
import {
  Users,
  Search,
  X,
  Building2,
  Mail,
  MessageSquareText,
  MessagesSquare,
  Clock3,
  Download,
} from "lucide-react";

import CustomerDetailPanel from "./CustomerDetailPanel";
import CustomerEmailModal from "./CustomerEmailModal";
import CustomerNotifyModal from "./CustomerNotifyModal";
import { formatDate, type Customer, type CustomerSummary, type Session } from "./customers-types";

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
  const [blockingId, setBlockingId] = useState<number | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [notifyModal, setNotifyModal] = useState(false);
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
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--brand-fill)] text-white shadow-sm">
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
                    {formatNumber(total, locale)}
                  </div>
                  <div className="mt-1 text-xs font-bold text-[var(--color-info-text)]">
                    {isEn ? "Total customers" : "کل مشتریان"}
                  </div>
                </div>
                <div className="rounded-2xl bg-[var(--surface-soft)] px-5 py-3 text-center">
                  <div className="text-2xl font-black text-[var(--text-muted)]">
                    {formatNumber(customers.reduce((s, c) => s + c.session_count, 0), locale)}
                  </div>
                  <div className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "Total sessions" : "کل جلسات"}
                  </div>
                </div>
                <div className="rounded-2xl bg-[var(--surface-soft)] px-5 py-3 text-center">
                  <div className="text-2xl font-black text-[var(--text-muted)]">
                    {formatNumber(customers.reduce((s, c) => s + c.message_count, 0), locale)}
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

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
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
            <CustomerDetailPanel
              selected={selected}
              customerSummary={customerSummary}
              summaryLoading={summaryLoading}
              sessions={sessions}
              sessionsLoading={sessionsLoading}
              showSessions={showSessions}
              approvingId={approvingId}
              blockingId={blockingId}
              onToggleSessions={() => setShowSessions(!showSessions)}
              onApproval={setApproval}
              onToggleBlock={toggleBlock}
              onOpenEmail={() => setEmailModal(true)}
              onOpenNotify={() => setNotifyModal(true)}
            />
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {emailModal && selected && (
        <CustomerEmailModal customer={selected} onClose={() => setEmailModal(false)} />
      )}

      {/* Notify Modal */}
      {notifyModal && selected && (
        <CustomerNotifyModal customer={selected} onClose={() => setNotifyModal(false)} />
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
