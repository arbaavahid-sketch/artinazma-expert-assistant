"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  Building2,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  Phone,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";

type CustomerRequest = {
  id: number;
  full_name: string;
  company: string;
  phone: string;
  email: string;
  request_type: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string | null;
};

const statusOptions = [
  { value: "all", label: "همه وضعیت‌ها" },
  { value: "new", label: "جدید" },
  { value: "in_progress", label: "در حال پیگیری" },
  { value: "done", label: "انجام شده" },
  { value: "closed", label: "بسته شده" },
];

function getStatusLabel(status: string) {
  if (status === "in_progress") return "در حال پیگیری";
  if (status === "done") return "انجام شده";
  if (status === "closed") return "بسته شده";
  return "جدید";
}

function getStatusClass(status: string) {
  if (status === "in_progress") {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  if (status === "done") {
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }

  if (status === "closed") {
    return "bg-slate-100 text-slate-600 border-slate-200";
  }

  return "bg-blue-50 text-blue-700 border-blue-100";
}

function getTypeLabel(type: string) {
  if (type === "equipment") return "تجهیزات";
  if (type === "chemical") return "مواد شیمیایی / افزودنی‌ها";
  if (type === "catalyst") return "کاتالیست / جاذب";
  if (type === "test-analysis") return "تحلیل تست";
  if (type === "troubleshooting") return "عیب‌یابی";
  if (type === "price-inquiry") return "استعلام قیمت";
  return "مشاوره فنی";
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

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return requests.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      const searchableText = [
        item.full_name,
        item.company,
        item.phone,
        item.email,
        item.request_type,
        item.subject,
        item.message,
        getTypeLabel(item.request_type),
        getStatusLabel(item.status),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [requests, searchText, statusFilter]);

  const newCount = requests.filter((item) => item.status === "new").length;
  const inProgressCount = requests.filter(
    (item) => item.status === "in_progress",
  ).length;
  const doneCount = requests.filter((item) => item.status === "done").length;

  async function loadRequests() {
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/customer-requests?limit=100"), {
        cache: "no-store",
      });

      const data = await res.json();
      setRequests(data.requests || []);
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
        apiUrl(`/customer-requests/${requestId}/status`),
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
        setMessage("وضعیت درخواست بروزرسانی شد.");
        await loadRequests();
      } else {
        setMessage(data.message || "خطا در بروزرسانی وضعیت.");
      }
    } catch {
      setMessage("خطا در اتصال به سرور.");
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                  <Inbox size={17} />
                  پنل داخلی آرتین آزما
                </div>

                <h1 className="text-3xl font-black text-slate-900">
                  درخواست‌های مشتریان
                </h1>

                <p className="mt-4 max-w-3xl leading-8 text-slate-600">
                  درخواست‌های ثبت‌شده برای مشاوره، تجهیزات، مواد شیمیایی،
                  کاتالیست، تحلیل تست، عیب‌یابی و استعلام قیمت در این بخش قابل
                  پیگیری هستند.
                </p>
              </div>

              <button
                onClick={loadRequests}
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

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-slate-500">
              کل درخواست‌ها
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {requests.length}
            </div>
          </div>

          <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5">
            <div className="text-sm font-bold text-blue-700">جدید</div>
            <div className="mt-2 text-3xl font-black text-blue-700">
              {newCount}
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-5">
            <div className="text-sm font-bold text-amber-700">
              در حال پیگیری
            </div>
            <div className="mt-2 text-3xl font-black text-amber-700">
              {inProgressCount}
            </div>
          </div>

          <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5">
            <div className="text-sm font-bold text-emerald-700">انجام شده</div>
            <div className="mt-2 text-3xl font-black text-emerald-700">
              {doneCount}
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
                placeholder="جستجو در نام، شرکت، شماره، موضوع یا متن درخواست..."
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

          {message && (
            <div className="mb-5 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-emerald-700">
              <CheckCircle2 size={18} />
              {message}
            </div>
          )}

          {loading ? (
            <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">
              در حال دریافت درخواست‌ها...
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="space-y-4">
              {filteredRequests.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[30px] border border-slate-200 bg-slate-50 p-5 transition hover:bg-white hover:shadow-sm"
                >
                  <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700">
                          #{item.id}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            item.status,
                          )}`}
                        >
                          {getStatusLabel(item.status)}
                        </span>

                        <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                          {getTypeLabel(item.request_type)}
                        </span>
                      </div>

                      <h2 className="mt-3 text-xl font-black text-slate-900">
                        {item.subject || "بدون موضوع"}
                      </h2>

                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                        <Clock3 size={15} />
                        ثبت شده در {formatDate(item.created_at)}
                      </div>
                    </div>

                    <select
                      value={item.status}
                      onChange={(e) => updateStatus(item.id, e.target.value)}
                      className="rounded-2xl border border-slate-300 bg-white p-3 text-sm font-bold outline-none transition focus:border-purple-600"
                    >
                      <option value="new">جدید</option>
                      <option value="in_progress">در حال پیگیری</option>
                      <option value="done">انجام شده</option>
                      <option value="closed">بسته شده</option>
                    </select>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-white p-4">
                        <div className="mb-3 text-sm font-black text-slate-900">
                          اطلاعات مشتری
                        </div>

                        <div className="space-y-3 text-sm leading-7 text-slate-600">
                          <div className="flex items-start gap-2">
                            <UserRound
                              size={17}
                              className="mt-1 shrink-0 text-purple-700"
                            />
                            <span>{item.full_name || "-"}</span>
                          </div>

                          <div className="flex items-start gap-2">
                            <Building2
                              size={17}
                              className="mt-1 shrink-0 text-purple-700"
                            />
                            <span>{item.company || "-"}</span>
                          </div>

                          <div className="flex items-start gap-2">
                            <Phone
                              size={17}
                              className="mt-1 shrink-0 text-purple-700"
                            />
                            <span>{item.phone || "-"}</span>
                          </div>

                          <div className="flex items-start gap-2">
                            <Mail
                              size={17}
                              className="mt-1 shrink-0 text-purple-700"
                            />
                            <span className="break-all">
                              {item.email || "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-4">
                      <div className="mb-3 text-sm font-black text-slate-900">
                        متن درخواست
                      </div>

                      <div className="whitespace-pre-wrap leading-8 text-slate-700">
                        {item.message || "-"}
                      </div>

                      {item.updated_at && (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
                          آخرین بروزرسانی: {formatDate(item.updated_at)}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-slate-50 p-10 text-center text-slate-500">
              درخواستی با این فیلتر یا جستجو پیدا نشد.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
