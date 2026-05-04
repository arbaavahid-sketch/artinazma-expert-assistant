"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import {
  CheckCircle2,
  Clock3,
  FileQuestion,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

type QuestionItem = {
  id: number;
  question: string;
  detected_domain: string;
  expert_status: string;
  created_at: string;
  updated_at: string | null;
};

const statusOptions = [
  { value: "all", label: "همه وضعیت‌ها" },
  { value: "pending", label: "در انتظار بررسی" },
  { value: "approved", label: "تایید شده" },
  { value: "needs_edit", label: "نیازمند اصلاح" },
  { value: "rejected", label: "رد شده" },
];

function getStatusLabel(status: string) {
  if (status === "approved") return "تایید شده";
  if (status === "needs_edit") return "نیازمند اصلاح";
  if (status === "rejected") return "رد شده";
  return "در انتظار بررسی";
}

function getStatusClass(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "needs_edit") return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "rejected") return "bg-red-50 text-red-700 border-red-100";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getDomainLabel(domain: string) {
  if (domain === "catalyst") return "کاتالیست";
  if (domain === "equipment") return "تجهیزات";
  if (domain === "chromatography") return "کروماتوگرافی";
  if (domain === "mercury-analysis") return "آنالیز جیوه";
  if (domain === "sulfur-analysis") return "آنالیز سولفور";
  if (domain === "troubleshooting") return "عیب‌یابی";
  if (domain === "analysis") return "آنالیز و تست";
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

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadQuestions() {
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/questions?limit=100"), {
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
  }, []);

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

  const pendingCount = questions.filter(
    (item) => !item.expert_status || item.expert_status === "pending"
  ).length;

  const approvedCount = questions.filter(
    (item) => item.expert_status === "approved"
  ).length;

  const needsEditCount = questions.filter(
    (item) => item.expert_status === "needs_edit"
  ).length;

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
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
                  سوالات ثبت‌شده کاربران، حوزه تشخیص داده‌شده و وضعیت بررسی
                  کارشناسی در این بخش نمایش داده می‌شود.
                </p>
              </div>

              <button
                onClick={loadQuestions}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                بروزرسانی
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
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
            <div className="text-sm font-bold text-amber-700">نیازمند اصلاح</div>
            <div className="mt-2 text-3xl font-black text-amber-700">
              {needsEditCount}
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_240px]">
            <div className="relative">
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

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-slate-300 bg-white p-4 outline-none transition focus:border-purple-600"
            >
              {statusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">
              در حال دریافت سوالات...
            </div>
          ) : filteredQuestions.length > 0 ? (
            <div className="space-y-3">
              {filteredQuestions.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/questions/${item.id}`}
                  className="group block rounded-[28px] border border-slate-200 bg-slate-50 p-5 transition hover:border-purple-200 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700">
                          #{item.id}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            item.expert_status
                          )}`}
                        >
                          {getStatusLabel(item.expert_status)}
                        </span>

                        <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                          {getDomainLabel(item.detected_domain)}
                        </span>
                      </div>

                      <div className="line-clamp-2 text-base font-bold leading-8 text-slate-900 group-hover:text-purple-700">
                        {item.question}
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

                    <div className="shrink-0 rounded-2xl bg-white px-4 py-2 text-sm font-bold text-purple-700">
                      مشاهده و بررسی
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
        </div>
      </div>
    </section>
  );
}