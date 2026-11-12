"use client";

import { useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import { adminUrl, apiUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  Clock3,
  FileQuestion,
  RefreshCw,
  Search,
  ShieldCheck,
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

type QuestionItem = {
  id: number;
  question: string;
  detected_domain: string;
  metadata?: QuestionMetadata;
  expert_status: string;
  user_rating: string;
  created_at: string;
  updated_at: string | null;
};

type QuestionMetadata = {
  question_intent?: string;
  question_intent_label?: string;
  search_mode?: string;
  best_score?: number;
  web_search_used?: boolean;
  source_count?: number;
  answer_mode?: string;
  response_time_ms?: number;
  // Asker identity (set at save time from /chat and /analyze-*).
  user_id?: string;
  customer_id?: number | null;
  customer_name?: string;
  customer_email?: string;
  // Set for image/file analyses submitted from the assistant (analyze-image / analyze-file).
  analysis_type?: "image" | "file";
  image_url?: string;
  image_type_label?: string;
  file_url?: string;
  file_name?: string;
  test_type_label?: string;
};

const statusOptions = [
  { value: "all", label: "همه وضعیت‌ها", labelEn: "All statuses" },
  { value: "pending", label: "در انتظار بررسی", labelEn: "Pending review" },
  { value: "approved", label: "تایید شده", labelEn: "Approved" },
  { value: "needs_edit", label: "نیازمند اصلاح", labelEn: "Needs edit" },
  { value: "rejected", label: "رد شده", labelEn: "Rejected" },
];

const domainOptions = [
  { value: "all", label: "همه حوزه‌ها", labelEn: "All domains" },
  { value: "general", label: "عمومی", labelEn: "General" },
  { value: "catalyst", label: "کاتالیست", labelEn: "Catalyst" },
  { value: "equipment", label: "تجهیزات", labelEn: "Equipment" },
  { value: "chromatography", label: "کروماتوگرافی", labelEn: "Chromatography" },
  { value: "mercury-analysis", label: "آنالیز جیوه", labelEn: "Mercury analysis" },
  { value: "sulfur-analysis", label: "آنالیز سولفور", labelEn: "Sulfur analysis" },
  { value: "troubleshooting", label: "عیب‌یابی", labelEn: "Troubleshooting" },
  { value: "analysis", label: "آنالیز و تست", labelEn: "Analysis and testing" },
  { value: "sales", label: "فروش", labelEn: "Sales" },
  { value: "petroleum", label: "نفت و پتروشیمی", labelEn: "Petroleum" },
  { value: "technical_general", label: "فنی عمومی", labelEn: "Technical general" },
];

const ratingOptions = [
  { value: "all", label: "همه امتیازها", labelEn: "All ratings" },
  { value: "up", label: "پسندیده شده", labelEn: "Liked" },
  { value: "down", label: "نپسندیده شده", labelEn: "Disliked" },
  { value: "unrated", label: "بدون امتیاز", labelEn: "Unrated" },
];

function getStatusLabel(status: string, locale: "fa" | "en" = "fa") {
  if (status === "approved") return locale === "en" ? "Approved" : "تایید شده";
  if (status === "needs_edit") return locale === "en" ? "Needs edit" : "نیازمند اصلاح";
  if (status === "rejected") return locale === "en" ? "Rejected" : "رد شده";
  return locale === "en" ? "Pending review" : "در انتظار بررسی";
}

function getStatusClass(status: string) {
  if (status === "approved")
    return "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]";
  if (status === "needs_edit")
    return "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]";
  if (status === "rejected") return "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger-border)]";
  return "bg-[var(--surface-soft)] text-[var(--text-muted)] border-[var(--border-soft)]";
}

function getDomainLabel(domain: string, locale: "fa" | "en" = "fa") {
  const found = domainOptions.find((d) => d.value === domain);
  if (found && found.value !== "all") return locale === "en" ? found.labelEn : found.label;
  return domain || (locale === "en" ? "Auto detected" : "تشخیص خودکار");
}

function getAskerLabel(metadata?: QuestionMetadata, locale: "fa" | "en" = "fa") {
  if (metadata?.customer_name) return metadata.customer_name;
  if (metadata?.customer_email) return metadata.customer_email;
  if (metadata?.customer_id) return locale === "en" ? `Customer #${metadata.customer_id}` : `مشتری #${metadata.customer_id}`;
  const uid = metadata?.user_id || "";
  if (uid.startsWith("customer_")) return locale === "en" ? `Customer #${uid.slice(9)}` : `مشتری #${uid.slice(9)}`;
  if (!uid || uid === "anonymous") return locale === "en" ? "Guest" : "مهمان";
  return uid.length > 14 ? `${uid.slice(0, 12)}…` : uid;
}

function getIntentLabel(metadata?: QuestionMetadata, locale: "fa" | "en" = "fa") {
  const intent = metadata?.question_intent || "";
  if (locale === "fa") return metadata?.question_intent_label || intent || "-";

  const labels: Record<string, string> = {
    sales: "Sales",
    technical_general: "Technical general",
    equipment_recommendation: "Equipment recommendation",
    troubleshooting: "Troubleshooting",
    lab_analysis: "Lab analysis",
    product_info: "Product information",
    price_inquiry: "Price inquiry",
    customer_request: "Customer request",
    general: "General",
  };

  return labels[intent] || intent.replace(/_/g, " ") || "-";
}

function formatDate(value?: string | null, locale: "fa" | "en" = "fa") {
  if (!value) return locale === "en" ? "Unknown" : "نامشخص";
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatScore(value?: number) {
  if (typeof value !== "number") return "-";
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function formatMs(value?: number) {
  if (typeof value !== "number") return "-";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

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
          <div className="bg-gradient-to-l from-purple-50 dark:from-purple-950/40 via-[var(--surface)] to-[var(--surface-soft)] p-8">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher variant="purple" />
            </div>
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 dark:bg-purple-950/40 px-4 py-2 text-sm font-bold text-purple-700 dark:text-purple-300">
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
              {globalStats?.total_questions ?? questions.length}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-soft)] p-5">
            <div className="text-sm font-bold text-[var(--text-muted)]">
              {isEn ? "Pending review" : "در انتظار بررسی"}
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--text-muted)]">
              {globalStats?.status_counts?.pending ?? pendingCount}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-5">
            <div className="text-sm font-bold text-[var(--color-success-text)]">{isEn ? "Approved" : "تایید شده"}</div>
            <div className="mt-2 text-3xl font-black text-[var(--color-success-text)]">
              {globalStats?.status_counts?.approved ?? approvedCount}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-5">
            <div className="text-sm font-bold text-[var(--color-warning-text)]">
              {isEn ? "Needs edit" : "نیازمند اصلاح"}
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--color-warning-text)]">
              {globalStats?.status_counts?.needs_edit ?? needsEditCount}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="text-sm font-bold text-[var(--text-subtle)]">{isEn ? "User ratings" : "امتیاز کاربران"}</div>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex items-center gap-1 text-lg font-black text-[var(--color-success-text)]">
                <ThumbsUp size={16} />
                {globalStats?.rating_counts?.up ?? upCount}
              </span>
              <span className="text-[var(--text-subtle)]">|</span>
              <span className="flex items-center gap-1 text-lg font-black text-red-500">
                <ThumbsDown size={16} />
                {globalStats?.rating_counts?.down ?? downCount}
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
                  className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-4 pl-4 pr-11 outline-none transition focus:border-purple-600"
                  placeholder={isEn ? "Search question text, domain, ID, or status..." : "جستجو در متن سوال، حوزه، شناسه یا وضعیت..."}
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`relative inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition ${
                  showFilters || activeFilterCount > 0
                    ? "border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300"
                    : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
                }`}
              >
                <Filter size={17} />
                {isEn ? "Filters" : "فیلترها"}
                {activeFilterCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[11px] font-black text-white">
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
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-purple-600"
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
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-purple-600"
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
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-purple-600"
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
                      className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-purple-600"
                      title={isEn ? "From date" : "از تاریخ"}
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-purple-600"
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
              className="flex items-center gap-2 text-sm font-bold text-[var(--text-subtle)] hover:text-purple-700 dark:hover:text-purple-300 transition"
              title={pagedQuestions.every((q) => selectedIds.has(q.id)) ? (isEn ? "Deselect all" : "لغو انتخاب همه") : (isEn ? "Select this page" : "انتخاب همه صفحه")}
            >
              {pagedQuestions.length > 0 && pagedQuestions.every((q) => selectedIds.has(q.id)) ? (
                <CheckSquare2 size={18} className="text-purple-600 dark:text-purple-300" />
              ) : (
                <Square size={18} />
              )}
              {isEn ? `${filteredQuestions.length} questions` : `${filteredQuestions.length} سوال`}
            </button>

            {/* Bulk action toolbar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 px-4 py-2">
                <span className="text-xs font-black text-purple-700 dark:text-purple-300">
                  {isEn ? `${selectedIds.size} selected` : `${selectedIds.size} انتخاب شده`}
                </span>
                <span className="text-purple-200">|</span>
                {bulkProcessing ? (
                  <Loader2 size={16} className="animate-spin text-purple-500 dark:text-purple-300" />
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
                <Link
                  key={item.id}
                  href={`/admin/questions/${item.id}`}
                  className={`group block rounded-[28px] border p-5 transition hover:border-purple-200 dark:hover:border-purple-800 hover:bg-[var(--surface)] hover:shadow-sm ${
                    selectedIds.has(item.id)
                      ? "border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40"
                      : "border-[var(--border-soft)] bg-[var(--surface-soft)]"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Row checkbox */}
                    <div
                      className="shrink-0 self-start pt-1 lg:self-center"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(item.id); }}
                    >
                      {selectedIds.has(item.id) ? (
                        <CheckSquare2 size={18} className="text-purple-600 dark:text-purple-300" />
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

                        <span className="rounded-full bg-purple-50 dark:bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-700 dark:text-purple-300">
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

                      <div className="line-clamp-2 text-base font-bold leading-8 text-[var(--foreground)] group-hover:text-purple-700 dark:group-hover:text-purple-300">
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
                      {reviewingId === item.id ? (
                        <Loader2 size={18} className="animate-spin text-[var(--text-subtle)]" />
                      ) : (
                        <div className="flex gap-1.5" onClick={(e) => e.preventDefault()}>
                          <button
                            onClick={(e) => quickReview(e, item.id, "approved")}
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
                            onClick={(e) => quickReview(e, item.id, "needs_edit")}
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
                            onClick={(e) => quickReview(e, item.id, "rejected")}
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
                      <span className="text-xs text-purple-600 dark:text-purple-300 group-hover:underline">
                        {isEn ? "View details ->" : "مشاهده جزئیات ←"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-[var(--surface-soft)] p-10 text-center text-[var(--text-subtle)]">
              {isEn ? "No questions matched this filter or search." : "سوالی با این فیلتر یا جستجو پیدا نشد."}
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredQuestions.length > PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-muted)] shadow-sm transition hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 2,
                )
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                    acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "…" ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-[var(--text-subtle)]">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-bold shadow-sm transition ${
                        currentPage === p
                          ? "border-purple-300 dark:border-purple-800 bg-purple-600 text-white"
                          : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-300"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-muted)] shadow-sm transition hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>

              <span className="mr-2 text-sm text-[var(--text-subtle)]">
                {isEn ? `Page ${currentPage} of ${totalPages}` : `صفحه ${currentPage} از ${totalPages}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
