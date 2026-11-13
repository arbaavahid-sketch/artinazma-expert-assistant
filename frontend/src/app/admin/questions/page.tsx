"use client";

import { useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useToast } from "@/components/Toast";
import { adminUrl } from "@/lib/api";
import { formatNumber, useI18n } from "@/lib/i18n";
import {
  FileQuestion,
  RefreshCw,
  Search,
  Download,
  ThumbsUp,
  ThumbsDown,
  Filter,
  X,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Square,
  CheckSquare2,
} from "lucide-react";

import QuestionRow from "./QuestionRow";
import QuestionsPagination from "./QuestionsPagination";
import {
  domainOptions,
  getDomainLabel,
  getStatusLabel,
  ratingOptions,
  statusOptions,
  type QuestionItem,
} from "./questions-types";

export default function QuestionsPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const { toast } = useToast();
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  // شمارنده‌های سراسری از /questions/stats — لیست سقفِ ۲۰۰ دارد و برای کارت‌ها کافی نیست.
  const [globalStats, setGlobalStats] = useState<{
    total_questions?: number;
    status_counts?: Record<string, number>;
    rating_counts?: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  function exportQuery(): string {
    // سوالات تیک‌خورده اولویت دارند؛ وگرنه فیلترهای فعال صفحه اعمال می‌شوند.
    const params = new URLSearchParams();
    if (selectedIds.size > 0) {
      params.set("ids", Array.from(selectedIds).join(","));
    } else {
      if (domainFilter !== "all") params.set("domain", domainFilter);
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  /**
   * خروجی را با fetch می‌گیریم (نه لینک مستقیم) تا وضعیت خطا واقعاً دیده شود؛
   * با لینک ساده، خطای سرور به شکل «دانلود ناموفق» مبهم در مرورگر ظاهر می‌شد.
   */
  async function downloadExport(kind: "csv" | "pdf") {
    const url = adminUrl(`/admin/questions/export-${kind}${exportQuery()}`);
    setExporting(kind);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        let detail = "";
        try {
          detail = (await res.json())?.detail || "";
        } catch {
          /* پاسخ JSON نبود */
        }
        toast(
          detail ||
            (isEn
              ? "Export failed. Please try again."
              : "خطا در تهیه خروجی — دوباره تلاش کنید"),
          "error",
        );
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `questions.${kind}`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast(
        isEn
          ? "Export failed — check your connection."
          : "خطا در تهیه خروجی — اتصال را بررسی کنید",
        "error",
      );
    } finally {
      setExporting(null);
    }
  }

  async function loadQuestions() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (domainFilter !== "all") params.set("domain", domainFilter);
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const [res, statsRes] = await Promise.all([
        fetch(adminUrl(`/questions?${params.toString()}`), { cache: "no-store" }),
        fetch(adminUrl("/questions/stats"), { cache: "no-store" }),
      ]);
      const data = await res.json();
      setQuestions(data.questions || []);
      try {
        setGlobalStats(await statsRes.json());
      } catch {
        setGlobalStats(null);
      }
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainFilter, ratingFilter, dateFrom, dateTo]);

  const filteredQuestions = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return questions.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.expert_status === statusFilter;

      const searchableText = [
        item.id,
        item.question,
        item.detected_domain,
        getDomainLabel(item.detected_domain),
        getStatusLabel(item.expert_status),
        item.created_at,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [questions, searchText, statusFilter]);

  const activeFilterCount = [
    domainFilter !== "all",
    ratingFilter !== "all",
    !!dateFrom,
    !!dateTo,
    statusFilter !== "all",
  ].filter(Boolean).length;

  function clearFilters() {
    setDomainFilter("all");
    setRatingFilter("all");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("all");
    setSearchText("");
  }

  async function quickReview(e: React.MouseEvent, id: number, status: string) {
    e.preventDefault();
    e.stopPropagation();
    setReviewingId(id);
    try {
      await fetch(adminUrl(`/questions/${id}/review`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expert_status: status, expert_notes: "" }),
      });
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === id ? { ...q, expert_status: status } : q,
        ),
      );
      const label =
        status === "approved"
          ? (isEn ? "approved" : "تایید شد")
          : status === "needs_edit"
            ? (isEn ? "marked as needs edit" : "نیازمند اصلاح ثبت شد")
            : (isEn ? "rejected" : "رد شد");
      toast(isEn ? `Question #${id} ${label}` : `سوال #${id} — ${label}`, status === "approved" ? "success" : status === "rejected" ? "error" : "warning");
    } catch {
      toast(isEn ? "Could not save status. Please try again." : "خطا در ثبت وضعیت — دوباره تلاش کنید", "error");
    } finally {
      setReviewingId(null);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (pagedQuestions.every((q) => selectedIds.has(q.id))) {
      // deselect all on page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pagedQuestions.forEach((q) => next.delete(q.id));
        return next;
      });
    } else {
      // select all on page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pagedQuestions.forEach((q) => next.add(q.id));
        return next;
      });
    }
  }

  async function bulkReview(status: string) {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    for (const id of ids) {
      try {
        const res = await fetch(adminUrl(`/questions/${id}/review`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expert_status: status, expert_notes: "" }),
        });
        if (res.ok) {
          successCount++;
          setQuestions((prev) =>
            prev.map((q) => (q.id === id ? { ...q, expert_status: status } : q))
          );
        }
      } catch {
        // continue
      }
    }
    setBulkProcessing(false);
    setSelectedIds(new Set());
    const label =
      status === "approved"
        ? (isEn ? "approved" : "تایید شد")
        : status === "needs_edit"
          ? (isEn ? "marked as needs edit" : "نیازمند اصلاح ثبت شد")
          : (isEn ? "rejected" : "رد شد");
    toast(isEn ? `${successCount} questions ${label}` : `${successCount} سوال — ${label}`, status === "approved" ? "success" : status === "rejected" ? "error" : "warning");
  }

  // Reset to page 1 whenever filter/search changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [searchText, statusFilter, domainFilter, ratingFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const pagedQuestions = filteredQuestions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const pendingCount = questions.filter(
    (item) => !item.expert_status || item.expert_status === "pending",
  ).length;
  const approvedCount = questions.filter(
    (item) => item.expert_status === "approved",
  ).length;
  const needsEditCount = questions.filter(
    (item) => item.expert_status === "needs_edit",
  ).length;
  const upCount = questions.filter((item) => item.user_rating === "up").length;
  const downCount = questions.filter(
    (item) => item.user_rating === "down",
  ).length;

  return (
    <section className="min-h-full bg-[var(--background)] px-6 py-8" dir={dir}>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 overflow-hidden rounded-[36px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <div className="bg-gradient-to-l from-[var(--color-info-bg)] via-[var(--surface)] to-[var(--surface-soft)] p-8">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher variant="purple" />
            </div>
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-info-bg)] px-4 py-2 text-sm font-bold text-[var(--color-info-text)]">
                  <FileQuestion size={17} />
                  {isEn ? "Artin Answer Quality" : "پایش کیفیت پاسخ‌های آرتین"}
                </div>
                <h1 className="text-3xl font-black text-[var(--foreground)]">
                  {isEn ? "User Questions" : "سوالات کاربران"}
                </h1>
                <p className="mt-4 max-w-3xl leading-8 text-[var(--text-muted)]">
                  {isEn
                    ? "Review registered user questions, detected domains, expert review status, and user ratings."
                    : "سوالات ثبت‌شده کاربران، حوزه تشخیص داده‌شده، وضعیت بررسی کارشناسی و امتیاز کاربران در این بخش نمایش داده می‌شود."}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => downloadExport("csv")}
                  disabled={questions.length === 0 || exporting !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-5 py-3 text-sm font-bold text-[var(--color-success-text)] shadow-sm transition hover:bg-[var(--color-success-bg)] disabled:opacity-40"
                >
                  <Download size={18} />
                  {exporting === "csv"
                    ? isEn
                      ? "Preparing…"
                      : "در حال تهیه…"
                    : `${isEn ? "Download CSV" : "دانلود CSV"}${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                </button>

                <button
                  onClick={() => downloadExport("pdf")}
                  disabled={questions.length === 0 || exporting !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-5 py-3 text-sm font-bold text-[var(--color-danger-text)] shadow-sm transition hover:bg-rose-100 disabled:opacity-40"
                >
                  <Download size={18} />
                  {exporting === "pdf"
                    ? isEn
                      ? "Building PDF…"
                      : "در حال ساخت PDF…"
                    : `${isEn ? "Download PDF" : "دانلود PDF"}${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                </button>

                <button
                  onClick={loadQuestions}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-3 text-sm font-bold text-[var(--text-muted)] shadow-sm transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
                >
                  <RefreshCw
                    size={18}
                    className={loading ? "animate-spin" : ""}
                  />
                  {isEn ? "Refresh" : "بروزرسانی"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-5">
          <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="text-sm font-bold text-[var(--text-subtle)]">{isEn ? "Total questions" : "کل سوالات"}</div>
            <div className="mt-2 text-3xl font-black text-[var(--foreground)]">
              {formatNumber(globalStats?.total_questions ?? questions.length, locale)}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-soft)] p-5">
            <div className="text-sm font-bold text-[var(--text-muted)]">
              {isEn ? "Pending review" : "در انتظار بررسی"}
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--text-muted)]">
              {formatNumber(globalStats?.status_counts?.pending ?? pendingCount, locale)}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-5">
            <div className="text-sm font-bold text-[var(--color-success-text)]">{isEn ? "Approved" : "تایید شده"}</div>
            <div className="mt-2 text-3xl font-black text-[var(--color-success-text)]">
              {formatNumber(globalStats?.status_counts?.approved ?? approvedCount, locale)}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-5">
            <div className="text-sm font-bold text-[var(--color-warning-text)]">
              {isEn ? "Needs edit" : "نیازمند اصلاح"}
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--color-warning-text)]">
              {formatNumber(globalStats?.status_counts?.needs_edit ?? needsEditCount, locale)}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="text-sm font-bold text-[var(--text-subtle)]">{isEn ? "User ratings" : "امتیاز کاربران"}</div>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex items-center gap-1 text-lg font-black text-[var(--color-success-text)]">
                <ThumbsUp size={16} />
                {formatNumber(globalStats?.rating_counts?.up ?? upCount, locale)}
              </span>
              <span className="text-[var(--text-subtle)]">|</span>
              <span className="flex items-center gap-1 text-lg font-black text-red-500">
                <ThumbsDown size={16} />
                {formatNumber(globalStats?.rating_counts?.down ?? downCount, locale)}
              </span>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="mb-4 rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="flex flex-col gap-3">
            {/* Search + filter toggle row */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
                />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-4 pl-4 pr-11 outline-none transition focus:border-[var(--color-info-border)]"
                  placeholder={isEn ? "Search question text, domain, ID, or status..." : "جستجو در متن سوال، حوزه، شناسه یا وضعیت..."}
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`relative inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition ${
                  showFilters || activeFilterCount > 0
                    ? "border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]"
                    : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
                }`}
              >
                <Filter size={17} />
                {isEn ? "Filters" : "فیلترها"}
                {activeFilterCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-fill)] text-[11px] font-black text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm font-bold text-[var(--color-danger-text)] transition hover:bg-[var(--color-danger-bg)]"
                >
                  <X size={16} />
                  {isEn ? "Clear" : "پاک‌کردن"}
                </button>
              )}
            </div>

            {/* Expandable filter panel */}
            {showFilters && (
              <div className="grid gap-3 rounded-2xl bg-[var(--surface-soft)] p-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Status */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "Review status" : "وضعیت بررسی"}
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-info-border)]"
                  >
                    {statusOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {isEn ? item.labelEn : item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Domain */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "Domain" : "حوزه تخصصی"}
                  </label>
                  <select
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-info-border)]"
                  >
                    {domainOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {isEn ? item.labelEn : item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rating */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "User rating" : "امتیاز کاربر"}
                  </label>
                  <select
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-info-border)]"
                  >
                    {ratingOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {isEn ? item.labelEn : item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date range */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[var(--text-subtle)]">
                    {isEn ? "Date range" : "بازه تاریخ"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-info-border)]"
                      title={isEn ? "From date" : "از تاریخ"}
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-info-border)]"
                      title={isEn ? "To date" : "تا تاریخ"}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Questions list */}
        <div className="rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            {/* Select-all checkbox */}
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-bold text-[var(--text-subtle)] hover:text-[var(--color-info-text)] transition"
              title={pagedQuestions.every((q) => selectedIds.has(q.id)) ? (isEn ? "Deselect all" : "لغو انتخاب همه") : (isEn ? "Select this page" : "انتخاب همه صفحه")}
            >
              {pagedQuestions.length > 0 && pagedQuestions.every((q) => selectedIds.has(q.id)) ? (
                <CheckSquare2 size={18} className="text-[var(--color-info-text)]" />
              ) : (
                <Square size={18} />
              )}
              {isEn ? `${formatNumber(filteredQuestions.length, locale)} questions` : `${formatNumber(filteredQuestions.length, locale)} سوال`}
            </button>

            {/* Bulk action toolbar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-2">
                <span className="text-xs font-black text-[var(--color-info-text)]">
                  {isEn ? `${formatNumber(selectedIds.size, locale)} selected` : `${formatNumber(selectedIds.size, locale)} انتخاب شده`}
                </span>
                <span className="text-[var(--color-info-text)]">|</span>
                {bulkProcessing ? (
                  <Loader2 size={16} className="animate-spin text-[var(--color-info-text)]" />
                ) : (
                  <>
                    <button
                      onClick={() => bulkReview("approved")}
                      className="flex items-center gap-1 rounded-xl bg-[var(--color-success-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-success-text)] transition hover:bg-emerald-200"
                    >
                      <CheckCircle2 size={13} />
                      {isEn ? "Approve" : "تایید"}
                    </button>
                    <button
                      onClick={() => bulkReview("needs_edit")}
                      className="flex items-center gap-1 rounded-xl bg-[var(--color-warning-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-warning-text)] transition hover:bg-amber-200"
                    >
                      <AlertCircle size={13} />
                      {isEn ? "Edit" : "اصلاح"}
                    </button>
                    <button
                      onClick={() => bulkReview("rejected")}
                      className="flex items-center gap-1 rounded-xl bg-[var(--color-danger-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-danger-text)] transition hover:bg-red-200"
                    >
                      <XCircle size={13} />
                      {isEn ? "Reject" : "رد"}
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="text-[var(--text-subtle)] hover:text-[var(--text-muted)]"
                      title={isEn ? "Clear selection" : "لغو انتخاب"}
                    >
                      <X size={15} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="rounded-3xl bg-[var(--surface-soft)] p-8 text-center text-[var(--text-subtle)]">
              {isEn ? "Loading questions..." : "در حال دریافت سوالات..."}
            </div>
          ) : filteredQuestions.length > 0 ? (
            <div className="space-y-3">
              {pagedQuestions.map((item) => (
                <QuestionRow
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  reviewing={reviewingId === item.id}
                  onToggleSelect={toggleSelect}
                  onQuickReview={quickReview}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-[var(--surface-soft)] p-10 text-center text-[var(--text-subtle)]">
              {isEn ? "No questions matched this filter or search." : "سوالی با این فیلتر یا جستجو پیدا نشد."}
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredQuestions.length > PAGE_SIZE && (
            <QuestionsPagination currentPage={currentPage} totalPages={totalPages} onChange={setCurrentPage} />
          )}
        </div>
      </div>
    </section>
  );
}
