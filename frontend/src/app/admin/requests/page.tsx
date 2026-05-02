"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

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

function getStatusLabel(status: string) {
  if (status === "in_progress") return "در حال پیگیری";
  if (status === "done") return "انجام شده";
  if (status === "closed") return "بسته شده";
  return "جدید";
}

function getTypeLabel(type: string) {
  if (type === "equipment") return "تجهیزات";
  if (type === "catalyst") return "کاتالیست";
  if (type === "test-analysis") return "تحلیل تست";
  if (type === "troubleshooting") return "عیب‌یابی";
  if (type === "price-inquiry") return "استعلام قیمت";
  return "مشاوره فنی";
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadRequests() {
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/customer-requests?limit=100"));
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
      const res = await fetch(apiUrl(`/customer-requests/${requestId}/status`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

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
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="rounded-[32px] bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 text-sm font-bold text-blue-700">
              پنل داخلی آرتین آزما
            </div>

            <h1 className="text-3xl font-bold text-slate-900">
              درخواست‌های مشتریان
            </h1>

            <p className="mt-4 max-w-3xl leading-8 text-slate-600">
              درخواست‌های ثبت‌شده توسط مشتریان برای مشاوره، تجهیزات، کاتالیست،
              تحلیل تست و استعلام قیمت در این بخش نمایش داده می‌شود.
            </p>
          </div>

          <button
            onClick={loadRequests}
            className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            بروزرسانی
          </button>
        </div>

        {message && (
          <div className="mb-5 rounded-2xl bg-slate-50 p-4 text-slate-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">
            در حال دریافت درخواست‌ها...
          </div>
        ) : requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-lg font-bold">
                      #{item.id} - {item.full_name}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                      <span>شرکت: {item.company || "-"}</span>
                      <span>نوع: {getTypeLabel(item.request_type)}</span>
                      <span>وضعیت: {getStatusLabel(item.status)}</span>
                      <span>زمان: {item.created_at}</span>
                    </div>
                  </div>

                  <select
                    value={item.status}
                    onChange={(e) => updateStatus(item.id, e.target.value)}
                    className="rounded-2xl border border-slate-300 bg-white p-3 text-sm"
                  >
                    <option value="new">جدید</option>
                    <option value="in_progress">در حال پیگیری</option>
                    <option value="done">انجام شده</option>
                    <option value="closed">بسته شده</option>
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <div className="mb-2 text-sm font-bold text-slate-500">
                      اطلاعات تماس
                    </div>
                    <div className="leading-8">
                      <div>تلفن: {item.phone}</div>
                      <div>ایمیل: {item.email || "-"}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-4">
                    <div className="mb-2 text-sm font-bold text-slate-500">
                      موضوع
                    </div>
                    <div className="leading-8">
                      {item.subject || "-"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white p-4">
                  <div className="mb-2 text-sm font-bold text-slate-500">
                    متن درخواست
                  </div>
                  <div className="whitespace-pre-wrap leading-8">
                    {item.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">
            هنوز درخواستی ثبت نشده است.
          </div>
        )}
      </div>
    </section>
  );
}