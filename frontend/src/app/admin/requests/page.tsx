"use client";

import { useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  ArrowDownUp,
  CalendarDays,
  CheckCircle2,
  Inbox,
  Flag,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";

import RequestCard from "./RequestCard";
import {
  ASSIGNMENT_FILTERS,
  FOLLOW_UP_FILTERS,
  PRIORITY_WEIGHT,
  REQUEST_PRIORITIES,
  REQUEST_SORT_OPTIONS,
  REQUEST_WORKFLOW,
  getDateDayKey,
  getPriorityMeta,
  getStatusLabel,
  getTypeLabel,
  getFollowUpSortValue,
  getTodayDayKey,
  normalizePriority,
  normalizeStatus,
  type AssignmentFilterValue,
  type CustomerRequest,
  type FollowUpFilterValue,
  type RequestPriorityValue,
  type RequestStatusValue,
  type RequestSortValue,
} from "./requests-types";

export default function AdminRequestsPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | RequestPriorityValue>("all");
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilterValue>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilterValue>("all");
  const [sortMode, setSortMode] = useState<RequestSortValue>("follow_up_asc");
  const [searchText, setSearchText] = useState("");
  const [crmDrafts, setCrmDrafts] = useState<Record<number, {
    priority: string;
    internal_note: string;
    assigned_to: string;
    follow_up_at: string;
  }>>({});
  const [savingCrmId, setSavingCrmId] = useState<number | null>(null);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const todayKey = getTodayDayKey();

    return requests.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || normalizeStatus(item.status) === statusFilter;
      const itemPriority = normalizePriority(item.priority);
      const matchesPriority =
        priorityFilter === "all" || itemPriority === priorityFilter;
      const followUpKey = getDateDayKey(item.follow_up_at);
      const matchesFollowUp =
        followUpFilter === "all" ||
        (followUpFilter === "empty" && !item.follow_up_at) ||
        (followUpFilter === "today" && followUpKey === todayKey) ||
        (followUpFilter === "overdue" && !!item.follow_up_at && followUpKey < todayKey) ||
        (followUpFilter === "upcoming" && !!item.follow_up_at && followUpKey > todayKey);
      const hasAssignee = !!item.assigned_to?.trim();
      const matchesAssignment =
        assignmentFilter === "all" ||
        (assignmentFilter === "assigned" && hasAssignee) ||
        (assignmentFilter === "unassigned" && !hasAssignee);

      const searchableText = [
        item.full_name,
        item.company,
        item.phone,
        item.email,
        item.request_type,
        item.subject,
        item.message,
        item.internal_note,
        item.assigned_to,
        item.follow_up_at,
        getPriorityMeta(item.priority).label,
        getTypeLabel(item.request_type),
        getStatusLabel(item.status),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesStatus && matchesPriority && matchesFollowUp && matchesAssignment && matchesSearch;
    }).sort((a, b) => {
      if (sortMode === "priority_desc") {
        return (
          PRIORITY_WEIGHT[normalizePriority(b.priority)] -
          PRIORITY_WEIGHT[normalizePriority(a.priority)]
        );
      }

      if (sortMode === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      if (sortMode === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      const followUpDiff =
        getFollowUpSortValue(a.follow_up_at) - getFollowUpSortValue(b.follow_up_at);
      if (followUpDiff !== 0) return followUpDiff;

      return (
        PRIORITY_WEIGHT[normalizePriority(b.priority)] -
        PRIORITY_WEIGHT[normalizePriority(a.priority)]
      );
    });
  }, [requests, searchText, statusFilter, priorityFilter, followUpFilter, assignmentFilter, sortMode]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      REQUEST_WORKFLOW.map((item) => [item.value, 0]),
    ) as Record<RequestStatusValue, number>;

    requests.forEach((item) => {
      counts[normalizeStatus(item.status)] += 1;
    });

    return counts;
  }, [requests]);

  async function loadRequests() {
    setLoading(true);

    try {
      const res = await fetch(adminUrl("/customer-requests?limit=100"), {
        cache: "no-store",
      });

      const data = await res.json();
      const loadedRequests = data.requests || [];
      setRequests(loadedRequests);
      setCrmDrafts(
        Object.fromEntries(
          loadedRequests.map((item: CustomerRequest) => [
            item.id,
            {
              priority: normalizePriority(item.priority),
              internal_note: item.internal_note || "",
              assigned_to: item.assigned_to || "",
              follow_up_at: item.follow_up_at || "",
            },
          ]),
        ),
      );
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(requestId: number, status: string) {
    setMessage("");

    try {
      const res = await fetch(
        adminUrl(`/customer-requests/${requestId}/status`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      const data = await res.json();

      if (data.success) {
        setMessage(isEn ? "Request status updated." : "وضعیت درخواست بروزرسانی شد.");
        await loadRequests();
      } else {
        setMessage(data.message || (isEn ? "Could not update request status." : "خطا در بروزرسانی وضعیت."));
      }
    } catch {
      setMessage(isEn ? "Server connection error." : "خطا در اتصال به سرور.");
    }
  }

  function updateCrmDraft(
    requestId: number,
    patch: Partial<{
      priority: string;
      internal_note: string;
      assigned_to: string;
      follow_up_at: string;
    }>,
  ) {
    setCrmDrafts((prev) => ({
      ...prev,
      [requestId]: {
        priority: prev[requestId]?.priority || "normal",
        internal_note: prev[requestId]?.internal_note || "",
        assigned_to: prev[requestId]?.assigned_to || "",
        follow_up_at: prev[requestId]?.follow_up_at || "",
        ...patch,
      },
    }));
  }

  async function saveCrmFields(requestId: number) {
    const draft = crmDrafts[requestId] || {
      priority: "normal",
      internal_note: "",
      assigned_to: "",
      follow_up_at: "",
    };
    setMessage("");
    setSavingCrmId(requestId);

    try {
      const res = await fetch(adminUrl(`/customer-requests/${requestId}/crm`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const data = await res.json();

      if (data.success) {
        setMessage(isEn ? "Internal follow-up information saved." : "اطلاعات پیگیری داخلی ذخیره شد.");
        await loadRequests();
      } else {
        setMessage(data.message || (isEn ? "Could not save follow-up information." : "خطا در ذخیره اطلاعات پیگیری."));
      }
    } catch {
      setMessage(isEn ? "Server connection error." : "خطا در اتصال به سرور.");
    } finally {
      setSavingCrmId(null);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  return (
    <section className="min-h-full bg-[var(--background)] px-4 py-6 sm:px-6 sm:py-8" dir={dir}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
                <Inbox size={21} aria-hidden="true" />
              </span>
              <h1 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
                {isEn ? "Customer Requests" : "درخواست‌های مشتریان"}
              </h1>
            </div>
            <p className="mt-2 text-sm leading-7 text-[var(--text-muted)] dark:text-[var(--text-subtle)]">
              {isEn ? "Review inquiries and track their status." : "درخواست‌ها را بررسی و وضعیت پیگیری آن‌ها را ثبت کنید."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher variant="purple" />
            <button type="button" onClick={loadRequests} disabled={loading} className="ui-btn ui-btn-ghost gap-2">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              {isEn ? "Refresh" : "بروزرسانی"}
            </button>
          </div>
        </header>

        <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 sm:p-4 shadow-sm">
            <div className="text-sm font-bold text-[var(--text-subtle)]">
              {isEn ? "Total requests" : "کل درخواست‌ها"}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
              {requests.length}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-3 sm:p-4">
            <div className="text-sm font-bold text-[var(--color-info-text)]">{isEn ? "New" : "جدید"}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-info-text)]">
              {statusCounts.new}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 sm:p-4">
            <div className="text-sm font-bold text-[var(--color-warning-text)]">
              {isEn ? "Reviewing" : "در حال بررسی"}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-warning-text)]">
              {statusCounts.reviewing}
            </div>
          </div>

          <div className="rounded-xl border border-purple-100 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 p-3 sm:p-4">
            <div className="text-sm font-bold text-purple-700 dark:text-purple-300">
              {isEn ? "Pricing" : "قیمت‌گذاری"}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-purple-700 dark:text-purple-300">
              {statusCounts.pricing}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-3 sm:p-4">
            <div className="text-sm font-bold text-[var(--color-success-text)]">{isEn ? "Sent" : "ارسال‌شده"}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-success-text)]">
              {statusCounts.sent}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 sm:p-4">
            <div className="text-sm font-bold text-[var(--text-muted)]">{isEn ? "Closed" : "بسته‌شده"}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-muted)]">
              {statusCounts.closed}
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
          {/* ─── Search bar ─────────────────────────────────────── */}
          <div className="mb-4 relative">
            <Search
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
            />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] py-3.5 pl-4 pr-11 outline-none transition focus:border-purple-500 focus:bg-[var(--surface)]"
              placeholder={isEn ? "Search by name, company, phone, subject, or request text..." : "جستجو در نام، شرکت، شماره، موضوع یا متن درخواست..."}
            />
          </div>

          {/* ─── Quick filter pills ──────────────────────────────────── */}
          <div className="mb-5 flex flex-wrap gap-2">
            {[
              {
                value: "all",
                label: isEn ? "All" : "همه",
                count: requests.length,
                cls: "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:bg-[var(--border-soft)]",
                active: "bg-slate-800 text-white",
              },
              ...REQUEST_WORKFLOW.map((item) => ({
                value: item.value,
                label: isEn ? item.labelEn : item.label,
                count: statusCounts[item.value],
                cls: item.filterClass,
                active: item.activeClass,
              })),
            ].map(({ value, label, count, cls, active }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${statusFilter === value ? active : cls}`}
              >
                {label}
                <span className={`rounded-full px-2 py-0.5 text-xs font-black ${statusFilter === value ? "bg-white/20" : "bg-[var(--surface)]"}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--text-subtle)]">
                <Flag size={15} />
                {isEn ? "Priority" : "اولویت"}
              </span>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as "all" | RequestPriorityValue)}
                className="w-full bg-transparent text-sm font-black text-[var(--foreground)] outline-none"
              >
                <option value="all">{isEn ? "All priorities" : "همه اولویت‌ها"}</option>
                {REQUEST_PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {isEn ? priority.labelEn : priority.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--text-subtle)]">
                <CalendarDays size={15} />
                {isEn ? "Follow-up date" : "موعد پیگیری"}
              </span>
              <select
                value={followUpFilter}
                onChange={(event) => setFollowUpFilter(event.target.value as FollowUpFilterValue)}
                className="w-full bg-transparent text-sm font-black text-[var(--foreground)] outline-none"
              >
                {FOLLOW_UP_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {isEn ? filter.labelEn : filter.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--text-subtle)]">
                <UserRound size={15} />
                {isEn ? "Owner" : "مسئول پیگیری"}
              </span>
              <select
                value={assignmentFilter}
                onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilterValue)}
                className="w-full bg-transparent text-sm font-black text-[var(--foreground)] outline-none"
              >
                {ASSIGNMENT_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {isEn ? filter.labelEn : filter.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--text-subtle)]">
                <ArrowDownUp size={15} />
                {isEn ? "Sort" : "مرتب‌سازی"}
              </span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as RequestSortValue)}
                className="w-full bg-transparent text-sm font-black text-[var(--foreground)] outline-none"
              >
                {REQUEST_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {isEn ? option.labelEn : option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mb-5 text-sm font-bold text-[var(--text-subtle)]">
            {isEn
              ? `Showing ${filteredRequests.length} of ${requests.length} requests`
              : `نمایش ${filteredRequests.length} درخواست از ${requests.length} درخواست`}
          </div>

          {message && (
            <div className="mb-5 flex items-center gap-2 rounded-2xl bg-[var(--color-success-bg)] p-4 text-[var(--color-success-text)]">
              <CheckCircle2 size={18} />
              {message}
            </div>
          )}

          {loading ? (
            <div className="rounded-3xl bg-[var(--surface-soft)] p-8 text-center text-[var(--text-subtle)]">
              {isEn ? "Loading requests..." : "در حال دریافت درخواست‌ها..."}
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="space-y-4">
              {filteredRequests.map((item) => (
                <RequestCard
                  key={item.id}
                  item={item}
                  draft={crmDrafts[item.id]}
                  saving={savingCrmId === item.id}
                  onUpdateStatus={updateStatus}
                  onUpdateDraft={updateCrmDraft}
                  onSaveCrm={saveCrmFields}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-[var(--surface-soft)] p-10 text-center text-[var(--text-subtle)]">
              {isEn ? "No requests matched this filter or search." : "درخواستی با این فیلتر یا جستجو پیدا نشد."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
