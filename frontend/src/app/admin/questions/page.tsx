"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import { adminUrl } from "@/lib/api";
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
};

const statusOptions = [
  { value: "all", label: "همه وضعیت‌ها" },
  { value: "pending", label: "در انتظار بررسی" },
  { value: "approved", label: "تایید شده" },
  { value: "needs_edit", label: "نیازمند اصلاح" },
  { value: "rejected", label: "رد شده" },
];

const domainOptions = [
  { value: "all", label: "همه حوزه‌ها" },
  { value: "catalyst", label: "کاتالیست" },
  { value: "equipment", label: "تجهیزات" },
  { value: "chromatography", label: "کروماتوگرافی" },
  { value: "mercury-analysis", label: "آنالیز جیوه" },
  { value: "sulfur-analysis", label: "آنالیز سولفور" },
  { value: "troubleshooting", label: "عیب‌یابی" },
  { value: "analysis", label: "آنالیز و تست" },
];

const ratingOptions = [
  { value: "all", label: "همه امتیازها" },
  { value: "up", label: "👍 پسندیده شده" },
  { value: "down", label: "👎 نپسندیده شده" },
  { value: "unrated", label: "بدون امتیاز" },
];

function getStatusLabel(status: string) {
  if (status === "approved") return "تایید شده";
  if (status === "needs_edit") return "نیازمند اصلاح";
  if (status === "rejected") return "رد شده";
  return "در انتظار بررسی";
}

function getStatusClass(status: string) {
  if (status === "approved")
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "needs_edit")
    return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "rejected") return "bg-red-50 text-red-700 border-red-100";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getDomainLabel(domain: string) {
  const found = domainOptions.find((d) => d.value === domain);
  if (found && found.value !== "all") return found.label;
  return domain || "تشخیص خودکار";
}

function formatDate(value?: string | null) {
  if (!value) return "نامشخص";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
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
  const { toast } = useToast();
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
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
  const [bulkProcessing, setBulkProcessing] = useState(false);

  function downloadCsv() {
    const url = adminUrl("/admin/questions/export-csv");
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions.csv";
    a.click();
  }

  async function loadQuestions() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (domainFilter !== "all") params.set("domain", domainFilter);
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(adminUrl(`/questions?${params.toString()}`), {
        cache: "no-store",
      });
      const data = await res.json();
      setQuestions(data.questions || []);
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
      const label = status === "approved" ? "تایید شد" : status === "needs_edit" ? "نیازمند اصلاح ثبت شد" : "رد شد";
      toast(`سوال #${id} — ${label}`, status === "approved" ? "success" : status === "rejected" ? "error" : "warning");
    } catch {
      toast("خطا در ثبت وضعیت — دوباره تلاش کنید", "error");
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
      status === "approved" ? "تایید شد" : status === "needs_edit" ? "نیازمند اصلاح ثبت شد" : "رد شد";
    toast(`${successCount} سوال — ${label}`, status === "approved" ? "success" : status === "rejected" ? "error" : "warning");
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
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                  <FileQuestion size={17} />
                  پایش کیفیت پاسخ‌های آرتین
                </div>
                <h1 className="text-3xl font-black text-slate-900">
                  سوالات کاربران
                </h1>
                <p className="mt-4 max-w-3xl leading-8 text-slate-600">
                  سوالات ثبت‌شده کاربران، حوزه تشخیص داده‌شده، وضعیت بررسی
                  کارشناسی و امتیاز کاربران در این بخش نمایش داده می‌شود.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={downloadCsv}
                  disabled={questions.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:opacity-40"
                >
                  <Download size={18} />
                  دانلود CSV
                </button>

                <button
                  onClick={loadQuestions}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw
                    size={18}
                    className={loading ? "animate-spin" : ""}
                  />
                  بروزرسانی
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-5">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-slate-500">کل سوالات</div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {questions.length}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-bold text-slate-600">
              در انتظار بررسی
            </div>
            <div className="mt-2 text-3xl font-black text-slate-700">
              {pendingCount}
            </div>
          </div>

          <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5">
            <div className="text-sm font-bold text-emerald-700">تایید شده</div>
            <div className="mt-2 text-3xl font-black text-emerald-700">
              {approvedCount}
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-5">
            <div className="text-sm font-bold text-amber-700">
              نیازمند اصلاح
            </div>
            <div className="mt-2 text-3xl font-black text-amber-700">
              {needsEditCount}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-slate-500">امتیاز کاربران</div>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex items-center gap-1 text-lg font-black text-emerald-600">
                <ThumbsUp size={16} />
                {upCount}
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1 text-lg font-black text-red-500">
                <ThumbsDown size={16} />
                {downCount}
              </span>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="mb-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3">
            {/* Search + filter toggle row */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white py-4 pl-4 pr-11 outline-none transition focus:border-purple-600"
                  placeholder="جستجو در متن سوال، حوزه، شناسه یا وضعیت..."
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`relative inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition ${
                  showFilters || activeFilterCount > 0
                    ? "border-purple-300 bg-purple-50 text-purple-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Filter size={17} />
                فیلترها
                {activeFilterCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[11px] font-black text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100"
                >
                  <X size={16} />
                  پاک‌کردن
                </button>
              )}
            </div>

            {/* Expandable filter panel */}
            {showFilters && (
              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Status */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">
                    وضعیت بررسی
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-purple-600"
                  >
                    {statusOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Domain */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">
                    حوزه تخصصی
                  </label>
                  <select
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-purple-600"
                  >
                    {domainOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rating */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">
                    امتیاز کاربر
                  </label>
                  <select
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-purple-600"
                  >
                    {ratingOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date range */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">
                    بازه تاریخ
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-purple-600"
                      title="از تاریخ"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-purple-600"
                      title="تا تاریخ"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Questions list */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            {/* Select-all checkbox */}
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-purple-700 transition"
              title={pagedQuestions.every((q) => selectedIds.has(q.id)) ? "لغو انتخاب همه" : "انتخاب همه صفحه"}
            >
              {pagedQuestions.length > 0 && pagedQuestions.every((q) => selectedIds.has(q.id)) ? (
                <CheckSquare2 size={18} className="text-purple-600" />
              ) : (
                <Square size={18} />
              )}
              {filteredQuestions.length} سوال
            </button>

            {/* Bulk action toolbar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-2">
                <span className="text-xs font-black text-purple-700">
                  {selectedIds.size} انتخاب شده
                </span>
                <span className="text-purple-200">|</span>
                {bulkProcessing ? (
                  <Loader2 size={16} className="animate-spin text-purple-500" />
                ) : (
                  <>
                    <button
                      onClick={() => bulkReview("approved")}
                      className="flex items-center gap-1 rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-200"
                    >
                      <CheckCircle2 size={13} />
                      تایید
                    </button>
                    <button
                      onClick={() => bulkReview("needs_edit")}
                      className="flex items-center gap-1 rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-200"
                    >
                      <AlertCircle size={13} />
                      اصلاح
                    </button>
                    <button
                      onClick={() => bulkReview("rejected")}
                      className="flex items-center gap-1 rounded-xl bg-red-100 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-200"
                    >
                      <XCircle size={13} />
                      رد
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="text-slate-400 hover:text-slate-600"
                      title="لغو انتخاب"
                    >
                      <X size={15} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">
              در حال دریافت سوالات...
            </div>
          ) : filteredQuestions.length > 0 ? (
            <div className="space-y-3">
              {pagedQuestions.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/questions/${item.id}`}
                  className={`group block rounded-[28px] border p-5 transition hover:border-purple-200 hover:bg-white hover:shadow-sm ${
                    selectedIds.has(item.id)
                      ? "border-purple-300 bg-purple-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Row checkbox */}
                    <div
                      className="shrink-0 self-start pt-1 lg:self-center"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(item.id); }}
                    >
                      {selectedIds.has(item.id) ? (
                        <CheckSquare2 size={18} className="text-purple-600" />
                      ) : (
                        <Square size={18} className="text-slate-300 group-hover:text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700">
                          #{item.id}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            item.expert_status,
                          )}`}
                        >
                          {getStatusLabel(item.expert_status)}
                        </span>

                        <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                          {getDomainLabel(item.detected_domain)}
                        </span>

                        {item.user_rating === "up" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            <ThumbsUp size={12} />
                            پسندیده شده
                          </span>
                        )}
                        {item.user_rating === "down" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                            <ThumbsDown size={12} />
                            نپسندیده شده
                          </span>
                        )}
                      </div>

                      <div className="line-clamp-2 text-base font-bold leading-8 text-slate-900 group-hover:text-purple-700">
                        {item.question}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                          intent: {item.metadata?.question_intent_label || item.metadata?.question_intent || "-"}
                        </span>
                        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-blue-700">
                          search: {item.metadata?.search_mode || "-"}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 ${
                          item.metadata?.web_search_used
                            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-500"
                        }`}>
                          web: {item.metadata?.web_search_used ? "on" : "off"}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                          sources: {item.metadata?.source_count ?? 0}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                          score: {formatScore(item.metadata?.best_score)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                          time: {formatMs(item.metadata?.response_time_ms)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={14} />
                          {formatDate(item.created_at)}
                        </span>

                        {item.updated_at && (
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck size={14} />
                            بروزرسانی: {formatDate(item.updated_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {reviewingId === item.id ? (
                        <Loader2 size={18} className="animate-spin text-slate-400" />
                      ) : (
                        <div className="flex gap-1.5" onClick={(e) => e.preventDefault()}>
                          <button
                            onClick={(e) => quickReview(e, item.id, "approved")}
                            title="تایید"
                            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              item.expert_status === "approved"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200"
                            }`}
                          >
                            <CheckCircle2 size={13} />
                            تایید
                          </button>
                          <button
                            onClick={(e) => quickReview(e, item.id, "needs_edit")}
                            title="نیازمند اصلاح"
                            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              item.expert_status === "needs_edit"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-white text-slate-500 hover:bg-amber-50 hover:text-amber-700 border border-slate-200"
                            }`}
                          >
                            <AlertCircle size={13} />
                            اصلاح
                          </button>
                          <button
                            onClick={(e) => quickReview(e, item.id, "rejected")}
                            title="رد"
                            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              item.expert_status === "rejected"
                                ? "bg-red-100 text-red-600"
                                : "bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 border border-slate-200"
                            }`}
                          >
                            <XCircle size={13} />
                            رد
                          </button>
                        </div>
                      )}
                      <span className="text-xs text-purple-600 group-hover:underline">مشاهده جزئیات ←</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-slate-50 p-10 text-center text-slate-500">
              سوالی با این فیلتر یا جستجو پیدا نشد.
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredQuestions.length > PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-purple-50 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
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
                    <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-bold shadow-sm transition ${
                        currentPage === p
                          ? "border-purple-300 bg-purple-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-purple-50 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>

              <span className="mr-2 text-sm text-slate-500">
                صفحه {currentPage} از {totalPages}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
