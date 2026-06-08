"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl, customerFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  Phone,
  Printer,
  Send,
  UserRound,
} from "lucide-react";

type Customer = {
  id: number;
  full_name: string;
  email: string;
  company: string;
  phone: string;
};

type CustomerRequestDetail = {
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
  assigned_to: string;
  follow_up_at: string;
  created_at: string;
  updated_at?: string | null;
};

type TimelineItem = {
  key: string;
  label: string;
  description: string;
  at: string;
  state: "done" | "current" | "planned";
};

type RequestUpdate = {
  id: number;
  message: string;
  file_name: string;
  file_url: string;
  created_at: string;
};

function formatDate(value?: string, locale: "fa" | "en" = "fa") {
  if (!value) return locale === "en" ? "Not set" : "ثبت نشده";
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fa-IR", {
      dateStyle: "medium",
      timeStyle: value.length > 10 ? "short" : undefined,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getStatusLabel(status: string, isEn: boolean) {
  if (status === "reviewing") return isEn ? "Under review" : "در حال بررسی";
  if (status === "pricing") return isEn ? "Pricing" : "قیمت‌گذاری";
  if (status === "sent") return isEn ? "Sent" : "ارسال‌شده";
  if (status === "closed") return isEn ? "Closed" : "بسته‌شده";
  return isEn ? "New" : "جدید";
}

function getStatusClass(status: string) {
  if (status === "closed") return "border-slate-200 bg-slate-100 text-slate-700";
  if (status === "sent") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (status === "pricing") return "border-purple-100 bg-purple-50 text-purple-700";
  if (status === "reviewing") return "border-amber-100 bg-amber-50 text-amber-700";
  return "border-blue-100 bg-blue-50 text-blue-700";
}

function getPriorityLabel(priority: string, isEn: boolean) {
  if (priority === "urgent") return isEn ? "Urgent" : "فوری";
  if (priority === "high") return isEn ? "High" : "بالا";
  if (priority === "low") return isEn ? "Low" : "کم";
  return isEn ? "Normal" : "عادی";
}

function localizeTimeline(item: TimelineItem, isEn: boolean) {
  if (!isEn) return item;
  const labels: Record<string, { label: string; description: string }> = {
    created: {
      label: "Request submitted",
      description: "Your request was registered in the ArtinAzma system.",
    },
    status: {
      label: item.label === "در انتظار بررسی" ? "Waiting for review" : "Status updated",
      description: "The ArtinAzma team has updated this request status.",
    },
    follow_up: {
      label: "Follow-up date",
      description: "An internal follow-up date has been set for this request.",
    },
    closed: {
      label: "Case closed",
      description: "Follow-up for this request has been completed.",
    },
  };
  return labels[item.key] ? { ...item, ...labels[item.key] } : item;
}

function safeFilePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80) || "request";
}

export default function CustomerRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [request, setRequest] = useState<CustomerRequestDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [updates, setUpdates] = useState<RequestUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [sendingUpdate, setSendingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");

  async function loadRequestDetail(nextCustomerId: number, requestId: number) {
    const res = await customerFetch(apiUrl(`/customers/${nextCustomerId}/requests/${requestId}`), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setRequest(data.request || null);
    setTimeline(data.timeline || []);
    setUpdates(data.updates || []);
  }

  useEffect(() => {
    const raw = localStorage.getItem("artin_customer");
    if (!raw) {
      window.location.href = "/customer-login";
      return;
    }

    const customer = JSON.parse(raw) as Customer;
    setCustomerId(customer.id);
    const requestId = Number(params.id);
    if (!requestId) {
      setError(isEn ? "Invalid request id." : "شناسه درخواست معتبر نیست.");
      setLoading(false);
      return;
    }

    loadRequestDetail(customer.id, requestId)
      .catch(() => {
        setError(isEn ? "Request not found or access denied." : "درخواست پیدا نشد یا دسترسی مجاز نیست.");
      })
      .finally(() => setLoading(false));
  }, [isEn, params.id]);

  async function submitUpdate() {
    if (!customerId || !request) return;
    if (!updateMessage.trim() && !updateFile) {
      setUpdateStatus(isEn ? "Write a note or attach a file." : "یک توضیح بنویسید یا فایل ضمیمه کنید.");
      return;
    }

    setSendingUpdate(true);
    setUpdateStatus("");
    try {
      const formData = new FormData();
      formData.append("message", updateMessage.trim());
      if (updateFile) formData.append("file", updateFile);

      const res = await customerFetch(
        apiUrl(`/customers/${customerId}/requests/${request.id}/updates`),
        {
          method: "POST",
          body: formData,
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setUpdateMessage("");
      setUpdateFile(null);
      setUpdateStatus(isEn ? "Your update was submitted." : "توضیح تکمیلی شما ثبت شد.");
      await loadRequestDetail(customerId, request.id);
    } catch {
      setUpdateStatus(isEn ? "Could not submit update." : "ثبت توضیح تکمیلی انجام نشد.");
    } finally {
      setSendingUpdate(false);
    }
  }

  function buildSummaryText() {
    if (!request) return "";
    const localizedTimeline = timeline.map((item) => localizeTimeline(item, isEn));
    const lines = [
      isEn ? "ArtinAzma Request Summary" : "خلاصه درخواست آرتین آزما",
      "----------------------------------------",
      `${isEn ? "Request ID" : "شناسه درخواست"}: #${request.id}`,
      `${isEn ? "Subject" : "موضوع"}: ${request.subject || "-"}`,
      `${isEn ? "Status" : "وضعیت"}: ${getStatusLabel(request.status, isEn)}`,
      `${isEn ? "Priority" : "اولویت"}: ${getPriorityLabel(request.priority, isEn)}`,
      `${isEn ? "Created at" : "تاریخ ثبت"}: ${formatDate(request.created_at, locale)}`,
      `${isEn ? "Follow-up" : "موعد پیگیری"}: ${formatDate(request.follow_up_at, locale)}`,
      "",
      isEn ? "Customer" : "اطلاعات مشتری",
      `${isEn ? "Name" : "نام"}: ${request.full_name || "-"}`,
      `${isEn ? "Company" : "شرکت"}: ${request.company || "-"}`,
      `${isEn ? "Phone" : "شماره تماس"}: ${request.phone || "-"}`,
      `${isEn ? "Email" : "ایمیل"}: ${request.email || "-"}`,
      "",
      isEn ? "Request text" : "متن درخواست",
      request.message || "-",
      "",
      isEn ? "Timeline" : "خط زمانی",
      ...localizedTimeline.map((item) => {
        const at = item.at ? ` - ${formatDate(item.at, locale)}` : "";
        return `${item.label}${at}: ${item.description}`;
      }),
      "",
      isEn ? "Additional information" : "توضیحات تکمیلی",
      ...(updates.length
        ? updates.map((item) => {
            const file = item.file_name ? ` (${isEn ? "file" : "فایل"}: ${item.file_name})` : "";
            return `${formatDate(item.created_at, locale)}${file}: ${item.message}`;
          })
        : [isEn ? "No additional information." : "توضیح تکمیلی ثبت نشده است."]),
    ];

    return lines.join("\n");
  }

  function downloadSummary() {
    if (!request) return;
    const blob = new Blob([buildSummaryText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `artinazma-request-${request.id}-${safeFilePart(request.subject || "summary")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href="/customer-dashboard"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowRight size={16} />
            {isEn ? "Back to dashboard" : "بازگشت به داشبورد"}
          </Link>

          {request && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Printer size={16} />
                {isEn ? "Print" : "چاپ"}
              </button>
              <button
                onClick={downloadSummary}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800"
              >
                <Download size={16} />
                {isEn ? "Download summary" : "دانلود خلاصه"}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="rounded-[32px] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            <Loader2 className="mx-auto mb-3 animate-spin text-blue-700" size={28} />
            {isEn ? "Loading request..." : "در حال دریافت درخواست..."}
          </div>
        ) : error || !request ? (
          <div className="rounded-[32px] border border-red-100 bg-white p-10 text-center text-red-700 shadow-sm">
            {error || (isEn ? "Request not found." : "درخواست پیدا نشد.")}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
              <div className="bg-gradient-to-l from-blue-50 via-white to-slate-50 p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                      <FileText size={17} />
                      #{request.id}
                    </div>
                    <h1 className="text-3xl font-black text-slate-900">
                      {request.subject || (isEn ? "Request details" : "جزئیات درخواست")}
                    </h1>
                    <p className="mt-3 leading-8 text-slate-600">
                      {request.message}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-4 py-2 text-sm font-black ${getStatusClass(request.status)}`}>
                      {getStatusLabel(request.status, isEn)}
                    </span>
                    <span className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-black text-blue-700">
                      {getPriorityLabel(request.priority, isEn)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <aside className="space-y-4">
                <InfoRow icon={<UserRound size={17} />} label={isEn ? "Name" : "نام"} value={request.full_name} />
                <InfoRow icon={<Building2 size={17} />} label={isEn ? "Company" : "شرکت"} value={request.company || "-"} />
                <InfoRow icon={<Phone size={17} />} label={isEn ? "Phone" : "شماره تماس"} value={request.phone || "-"} />
                <InfoRow icon={<Mail size={17} />} label={isEn ? "Email" : "ایمیل"} value={request.email || "-"} />
                <InfoRow icon={<CalendarDays size={17} />} label={isEn ? "Follow-up" : "موعد پیگیری"} value={formatDate(request.follow_up_at, locale)} />
              </aside>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <Clock3 size={20} className="text-blue-700" />
                  <h2 className="text-xl font-black text-slate-900">
                    {isEn ? "Request timeline" : "خط زمانی درخواست"}
                  </h2>
                </div>

                <div className="space-y-4">
                  {timeline.map((rawItem) => {
                    const item = localizeTimeline(rawItem, isEn);
                    return (
                      <div key={`${item.key}-${item.at}`} className="flex gap-3">
                        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                          <CheckCircle2 size={18} />
                        </div>
                        <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 p-4">
                          <div className="font-black text-slate-900">{item.label}</div>
                          <div className="mt-1 text-sm leading-7 text-slate-600">{item.description}</div>
                          {item.at && (
                            <div className="mt-2 text-xs font-bold text-slate-400">
                              {formatDate(item.at, locale)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <Paperclip size={20} className="text-blue-700" />
                  <h2 className="text-xl font-black text-slate-900">
                    {isEn ? "Additional information" : "توضیحات تکمیلی"}
                  </h2>
                </div>

                {updates.length > 0 ? (
                  <div className="max-h-80 space-y-3 overflow-y-auto">
                    {updates.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                        <div className="text-sm leading-7 text-slate-700">{item.message}</div>
                        {item.file_url && (
                          <a
                            href={apiUrl(item.file_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
                          >
                            <Paperclip size={14} />
                            {item.file_name || (isEn ? "Attachment" : "فایل پیوست")}
                          </a>
                        )}
                        <div className="mt-2 text-xs font-bold text-slate-400">
                          {formatDate(item.created_at, locale)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                    {isEn ? "No additional information has been submitted yet." : "هنوز توضیح تکمیلی برای این درخواست ثبت نشده است."}
                  </div>
                )}
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-xl font-black text-slate-900">
                    {isEn ? "Send an update" : "ارسال توضیح تکمیلی"}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {isEn
                      ? "Add a note or attach a supporting file for the ArtinAzma team."
                      : "برای تیم آرتین آزما توضیح، تصویر، فایل تست یا مدرک تکمیلی ارسال کنید."}
                  </p>
                </div>

                {request.status === "closed" ? (
                  <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">
                    {isEn ? "This request is closed." : "این درخواست بسته شده است."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <textarea
                      value={updateMessage}
                      onChange={(event) => setUpdateMessage(event.target.value)}
                      rows={5}
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                      placeholder={isEn ? "Write additional details..." : "توضیحات تکمیلی را بنویسید..."}
                    />

                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-600 transition hover:bg-white">
                      <span className="flex min-w-0 items-center gap-2">
                        <Paperclip size={17} className="shrink-0 text-blue-700" />
                        <span className="truncate">
                          {updateFile?.name || (isEn ? "Attach file" : "انتخاب فایل")}
                        </span>
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(event) => setUpdateFile(event.target.files?.[0] || null)}
                      />
                    </label>

                    <button
                      onClick={submitUpdate}
                      disabled={sendingUpdate}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
                    >
                      {sendingUpdate ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                      {sendingUpdate ? (isEn ? "Sending..." : "در حال ارسال...") : (isEn ? "Submit update" : "ثبت توضیح تکمیلی")}
                    </button>

                    {updateStatus && (
                      <div className="rounded-2xl bg-blue-50 p-3 text-center text-sm font-bold text-blue-700">
                        {updateStatus}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500">
        <span className="text-blue-700">{icon}</span>
        {label}
      </div>
      <div className="break-words text-sm font-black text-slate-900">{value}</div>
    </div>
  );
}
