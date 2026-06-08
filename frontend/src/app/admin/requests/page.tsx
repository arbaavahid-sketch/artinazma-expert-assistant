"use client";

import { useEffect, useMemo, useState } from "react";
import { adminUrl } from "@/lib/api";
import {
  Building2,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  Phone,
  Save,
  Flag,
  RefreshCw,
  Search,
  UserRound,
  PlayCircle,
  XCircle,
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
  priority: string;
  internal_note: string;
  created_at: string;
  updated_at: string | null;
};

const REQUEST_PRIORITIES = [
  {
    value: "low",
    label: "کم",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    selectClass: "border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    value: "normal",
    label: "عادی",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-100",
    selectClass: "border-blue-100 bg-blue-50 text-blue-700",
  },
  {
    value: "high",
    label: "بالا",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-100",
    selectClass: "border-amber-100 bg-amber-50 text-amber-700",
  },
  {
    value: "urgent",
    label: "فوری",
    badgeClass: "bg-red-50 text-red-700 border-red-100",
    selectClass: "border-red-100 bg-red-50 text-red-700",
  },
] as const;

type RequestPriorityValue = (typeof REQUEST_PRIORITIES)[number]["value"];

const REQUEST_WORKFLOW = [
  {
    value: "new",
    label: "جدید",
    actionLabel: "شروع بررسی",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-100",
    filterClass: "bg-blue-50 text-blue-700 hover:bg-blue-100",
    activeClass: "bg-blue-600 text-white",
    cardClass: "border-blue-200 bg-blue-50/40 hover:bg-blue-50",
  },
  {
    value: "reviewing",
    label: "در حال بررسی",
    actionLabel: "ارسال به قیمت‌گذاری",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-100",
    filterClass: "bg-amber-50 text-amber-700 hover:bg-amber-100",
    activeClass: "bg-amber-500 text-white",
    cardClass: "border-amber-200 bg-amber-50/40 hover:bg-amber-50",
  },
  {
    value: "pricing",
    label: "قیمت‌گذاری",
    actionLabel: "ثبت ارسال پیشنهاد",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-100",
    filterClass: "bg-purple-50 text-purple-700 hover:bg-purple-100",
    activeClass: "bg-purple-600 text-white",
    cardClass: "border-purple-200 bg-purple-50/30 hover:bg-purple-50",
  },
  {
    value: "sent",
    label: "ارسال‌شده",
    actionLabel: "بستن درخواست",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
    filterClass: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    activeClass: "bg-emerald-600 text-white",
    cardClass: "border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50",
  },
  {
    value: "closed",
    label: "بسته‌شده",
    actionLabel: "بازگشایی",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    filterClass: "bg-slate-50 text-slate-500 hover:bg-slate-100",
    activeClass: "bg-slate-500 text-white",
    cardClass: "border-slate-200 bg-slate-50 hover:bg-white",
  },
] as const;

type RequestStatusValue = (typeof REQUEST_WORKFLOW)[number]["value"];

const NEXT_STATUS: Partial<Record<RequestStatusValue, RequestStatusValue>> = {
  new: "reviewing",
  reviewing: "pricing",
  pricing: "sent",
  sent: "closed",
  closed: "new",
};

function normalizeStatus(status: string): RequestStatusValue {
  if (status === "in_progress") return "reviewing";
  if (status === "done") return "sent";
  return REQUEST_WORKFLOW.some((item) => item.value === status)
    ? (status as RequestStatusValue)
    : "new";
}

function getStatusMeta(status: string) {
  const normalized = normalizeStatus(status);
  return REQUEST_WORKFLOW.find((item) => item.value === normalized) || REQUEST_WORKFLOW[0];
}

function getStatusLabel(status: string) {
  return getStatusMeta(status).label;
}

function getStatusClass(status: string) {
  return getStatusMeta(status).badgeClass;
}

function normalizePriority(priority?: string): RequestPriorityValue {
  return REQUEST_PRIORITIES.some((item) => item.value === priority)
    ? (priority as RequestPriorityValue)
    : "normal";
}

function getPriorityMeta(priority?: string) {
  const normalized = normalizePriority(priority);
  return REQUEST_PRIORITIES.find((item) => item.value === normalized) || REQUEST_PRIORITIES[1];
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
  const [crmDrafts, setCrmDrafts] = useState<Record<number, { priority: string; internal_note: string }>>({});
  const [savingCrmId, setSavingCrmId] = useState<number | null>(null);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return requests.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || normalizeStatus(item.status) === statusFilter;

      const searchableText = [
        item.full_name,
        item.company,
        item.phone,
        item.email,
        item.request_type,
        item.subject,
        item.message,
        item.internal_note,
        getPriorityMeta(item.priority).label,
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
        setMessage("وضعیت درخواست بروزرسانی شد.");
        await loadRequests();
      } else {
        setMessage(data.message || "خطا در بروزرسانی وضعیت.");
      }
    } catch {
      setMessage("خطا در اتصال به سرور.");
    }
  }

  function updateCrmDraft(requestId: number, patch: Partial<{ priority: string; internal_note: string }>) {
    setCrmDrafts((prev) => ({
      ...prev,
      [requestId]: {
        priority: prev[requestId]?.priority || "normal",
        internal_note: prev[requestId]?.internal_note || "",
        ...patch,
      },
    }));
  }

  async function saveCrmFields(requestId: number) {
    const draft = crmDrafts[requestId] || { priority: "normal", internal_note: "" };
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
        setMessage("اطلاعات پیگیری داخلی ذخیره شد.");
        await loadRequests();
      } else {
        setMessage(data.message || "خطا در ذخیره اطلاعات پیگیری.");
      }
    } catch {
      setMessage("خطا در اتصال به سرور.");
    } finally {
      setSavingCrmId(null);
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

        <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
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
              {statusCounts.new}
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-5">
            <div className="text-sm font-bold text-amber-700">
              در حال بررسی
            </div>
            <div className="mt-2 text-3xl font-black text-amber-700">
              {statusCounts.reviewing}
            </div>
          </div>

          <div className="rounded-[28px] border border-purple-100 bg-purple-50 p-5">
            <div className="text-sm font-bold text-purple-700">
              قیمت‌گذاری
            </div>
            <div className="mt-2 text-3xl font-black text-purple-700">
              {statusCounts.pricing}
            </div>
          </div>

          <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5">
            <div className="text-sm font-bold text-emerald-700">ارسال‌شده</div>
            <div className="mt-2 text-3xl font-black text-emerald-700">
              {statusCounts.sent}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-bold text-slate-600">بسته‌شده</div>
            <div className="mt-2 text-3xl font-black text-slate-600">
              {statusCounts.closed}
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          {/* ─── Search bar ─────────────────────────────────────── */}
          <div className="mb-4 relative">
            <Search
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-11 outline-none transition focus:border-purple-500 focus:bg-white"
              placeholder="جستجو در نام، شرکت، شماره، موضوع یا متن درخواست..."
            />
          </div>

          {/* ─── Quick filter pills ──────────────────────────────────── */}
          <div className="mb-5 flex flex-wrap gap-2">
            {[
              {
                value: "all",
                label: "همه",
                count: requests.length,
                cls: "bg-slate-100 text-slate-700 hover:bg-slate-200",
                active: "bg-slate-800 text-white",
              },
              ...REQUEST_WORKFLOW.map((item) => ({
                value: item.value,
                label: item.label,
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
                <span className={`rounded-full px-2 py-0.5 text-xs font-black ${statusFilter === value ? "bg-white/20" : "bg-white"}`}>
                  {count}
                </span>
              </button>
            ))}
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
              {filteredRequests.map((item) => {
                const statusMeta = getStatusMeta(item.status);
                const normalizedStatus = normalizeStatus(item.status);
                const nextStatus = NEXT_STATUS[normalizedStatus];

                return (
                <article
                  key={item.id}
                  className={`rounded-[30px] border p-5 transition hover:shadow-md ${statusMeta.cardClass}`}
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

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${getPriorityMeta(item.priority).badgeClass}`}
                        >
                          <Flag size={13} />
                          {getPriorityMeta(item.priority).label}
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

                    <div className="flex flex-wrap gap-2">
                      {nextStatus && (
                        <button
                          onClick={() => updateStatus(item.id, nextStatus)}
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
                          {statusMeta.actionLabel}
                        </button>
                      )}
                      {false && item.status === "new" && (
                        <button
                          onClick={() => updateStatus(item.id, "in_progress")}
                          className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 transition hover:bg-amber-100 border border-amber-100"
                        >
                          <PlayCircle size={15} />
                          شروع پیگیری
                        </button>
                      )}
                      {false && item.status === "in_progress" && (
                        <button
                          onClick={() => updateStatus(item.id, "done")}
                          className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 border border-emerald-100"
                        >
                          <CheckCircle2 size={15} />
                          انجام شد
                        </button>
                      )}
                      {false && item.status !== "closed" && (
                        <button
                          onClick={() => updateStatus(item.id, "closed")}
                          className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-200"
                        >
                          <XCircle size={15} />
                          بستن
                        </button>
                      )}
                      {false && item.status === "closed" && (
                        <button
                          onClick={() => updateStatus(item.id, "new")}
                          className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-600 transition hover:bg-blue-100"
                        >
                          بازگشایی
                        </button>
                      )}
                    </div>
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

                      <div className="rounded-2xl bg-white p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                          <Flag size={16} className="text-purple-700" />
                          پیگیری داخلی
                        </div>

                        <label className="mb-2 block text-xs font-bold text-slate-500">
                          اولویت
                        </label>
                        <select
                          value={crmDrafts[item.id]?.priority || normalizePriority(item.priority)}
                          onChange={(event) => updateCrmDraft(item.id, { priority: event.target.value })}
                          className={`mb-3 w-full rounded-2xl border px-3 py-2 text-sm font-bold outline-none transition focus:border-purple-400 ${getPriorityMeta(crmDrafts[item.id]?.priority || item.priority).selectClass}`}
                        >
                          {REQUEST_PRIORITIES.map((priority) => (
                            <option key={priority.value} value={priority.value}>
                              {priority.label}
                            </option>
                          ))}
                        </select>

                        <label className="mb-2 block text-xs font-bold text-slate-500">
                          یادداشت داخلی
                        </label>
                        <textarea
                          value={crmDrafts[item.id]?.internal_note ?? item.internal_note ?? ""}
                          onChange={(event) => updateCrmDraft(item.id, { internal_note: event.target.value })}
                          rows={4}
                          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-purple-400 focus:bg-white"
                          placeholder="مثلا: با مشتری تماس گرفته شد، نیاز به پیش‌فاکتور GC دارد..."
                        />

                        <button
                          onClick={() => saveCrmFields(item.id)}
                          disabled={savingCrmId === item.id}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-700 disabled:opacity-50"
                        >
                          <Save size={15} />
                          {savingCrmId === item.id ? "در حال ذخیره..." : "ذخیره پیگیری"}
                        </button>
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
                );
              })}
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
