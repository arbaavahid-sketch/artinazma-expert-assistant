"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Search,
  X,
  Building2,
  Phone,
  Mail,
  MessageSquareText,
  MessagesSquare,
  Clock3,
  Send,
  ShieldOff,
  ShieldCheck,
} from "lucide-react";

type Customer = {
  id: number;
  full_name: string;
  email: string;
  company: string;
  phone: string;
  created_at: string;
  session_count: number;
  message_count: number;
  last_active?: string | null;
  is_blocked?: boolean;
};

function formatDate(value?: string) {
  if (!value) return "نامشخص";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [blockingId, setBlockingId] = useState<number | null>(null);

  async function toggleBlock(customer: Customer) {
    setBlockingId(customer.id);
    const action = customer.is_blocked ? "unblock" : "block";
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/${action}`, {
        method: "POST",
        credentials: "include",
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

  useEffect(() => {
    fetch("/api/admin/customers?limit=200", {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        setCustomers(d.customers || []);
        setTotal(d.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? customers.filter(
        (c) =>
          c.full_name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          (c.company || "").toLowerCase().includes(search.toLowerCase()),
      )
    : customers;

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="ui-card mb-6 overflow-hidden rounded-[36px] shadow-sm">
          <div className="bg-gradient-to-l from-blue-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-700 text-white shadow-sm">
                  <Users size={28} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="mb-1 text-sm font-bold text-blue-700">
                    پنل ادمین
                  </div>
                  <h1 className="text-3xl font-black text-slate-900">
                    مدیریت مشتریان
                  </h1>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="rounded-2xl bg-blue-50 px-5 py-3 text-center">
                  <div className="text-2xl font-black text-blue-700">
                    {total}
                  </div>
                  <div className="mt-1 text-xs font-bold text-blue-500">
                    کل مشتریان
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-5 py-3 text-center">
                  <div className="text-2xl font-black text-slate-700">
                    {customers.reduce((s, c) => s + c.session_count, 0)}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-500">
                    کل جلسات
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-5 py-3 text-center">
                  <div className="text-2xl font-black text-slate-700">
                    {customers.reduce((s, c) => s + c.message_count, 0)}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-500">
                    کل پیام‌ها
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Customer list */}
          <div className="ui-card rounded-[32px] p-6 shadow-sm">
            {/* Search */}
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو بر اساس نام، ایمیل یا شرکت..."
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="shrink-0 text-slate-400 hover:text-slate-600"
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
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-slate-400 shadow-sm">
                  <Users size={26} strokeWidth={1.8} />
                </div>
                <h3 className="mt-4 text-base font-black text-slate-700">
                  {search ? "نتیجه‌ای یافت نشد" : "هنوز مشتری‌ای ثبت نشده"}
                </h3>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="mt-3 text-sm font-bold text-blue-700 hover:underline"
                  >
                    پاک کردن جستجو
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`w-full rounded-2xl border p-4 text-right transition ${
                      selected?.id === c.id
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-200 bg-slate-50 hover:border-blue-100 hover:bg-white hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-black text-slate-900">
                            {c.full_name}
                          </span>
                          {c.is_blocked && (
                            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-600">
                              بلاک
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <Mail size={12} />
                          <span className="truncate">{c.email}</span>
                          {c.company && (
                            <>
                              <span className="text-slate-300">·</span>
                              <Building2 size={12} />
                              <span className="truncate">{c.company}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-500">
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
                          <span className="flex items-center gap-1 text-emerald-600">
                            <Clock3 size={11} />
                            {formatDate(c.last_active)}
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
            {selected ? (
              <div>
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-blue-100 text-xl font-black text-blue-700">
                    {selected.full_name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-lg font-black text-slate-900">
                      {selected.full_name}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-500">
                      شناسه: #{selected.id}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                    <Mail className="mt-0.5 shrink-0 text-blue-700" size={16} />
                    <div>
                      <div className="text-xs font-bold text-slate-500">
                        ایمیل
                      </div>
                      <div className="mt-1 break-all text-sm font-bold text-slate-900">
                        {selected.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                    <Phone
                      className="mt-0.5 shrink-0 text-blue-700"
                      size={16}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-500">
                        شماره تماس
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {selected.phone || "ثبت نشده"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                    <Building2
                      className="mt-0.5 shrink-0 text-blue-700"
                      size={16}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-500">
                        شرکت / سازمان
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {selected.company || "ثبت نشده"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                    <Clock3
                      className="mt-0.5 shrink-0 text-blue-700"
                      size={16}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-500">
                        تاریخ عضویت
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {formatDate(selected.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                    <MessageSquareText
                      className="mt-0.5 shrink-0 text-emerald-600"
                      size={16}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-500">
                        آخرین فعالیت
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {selected.last_active ? formatDate(selected.last_active) : "هنوز پیامی ندارد"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-blue-50 p-4 text-center">
                    <div className="text-3xl font-black text-blue-700">
                      {selected.session_count}
                    </div>
                    <div className="mt-1 text-xs font-bold text-blue-500">
                      جلسه گفتگو
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-center">
                    <div className="text-3xl font-black text-slate-700">
                      {selected.message_count}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-500">
                      پیام ارسالی
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => {
                      setEmailSubject(`پیام از آرتین آزما به ${selected.full_name}`);
                      setEmailBody("");
                      setEmailModal(true);
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
                  >
                    <Send size={15} />
                    ارسال ایمیل
                  </button>
                  <button
                    onClick={() => toggleBlock(selected)}
                    disabled={blockingId === selected.id}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
                      selected.is_blocked
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                    }`}
                  >
                    {selected.is_blocked ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}
                    {blockingId === selected.id ? "..." : selected.is_blocked ? "رفع بلاک" : "بلاک مشتری"}
                  </button>
                </div>

                {selected.is_blocked && (
                  <div className="mt-3 rounded-2xl bg-red-50 border border-red-100 p-3 text-xs font-bold text-red-700 text-center">
                    ⛔ این حساب مسدود است — مشتری نمی‌تواند وارد شود.
                  </div>
                )}
              </div>
            ) : (
              <div className="ui-empty rounded-3xl p-10">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-slate-400 shadow-sm">
                  <Users size={26} strokeWidth={1.8} />
                </div>
                <h3 className="mt-4 text-sm font-black text-slate-600">
                  یک مشتری را انتخاب کنید
                </h3>
                <p className="mt-2 text-xs text-slate-500">
                  برای مشاهده جزئیات، روی نام مشتری کلیک کنید.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {emailModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">ارسال ایمیل</h2>
                <p className="mt-1 text-sm text-slate-500">به: {selected.full_name} — {selected.email}</p>
              </div>
              <button
                onClick={() => setEmailModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">موضوع</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="ui-input"
                  placeholder="موضوع ایمیل..."
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">متن ایمیل</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={6}
                  className="ui-textarea w-full resize-none p-3"
                  placeholder="متن پیام خود را بنویسید..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <a
                  href={`mailto:${selected.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 font-bold text-white transition hover:bg-blue-800"
                  onClick={() => setEmailModal(false)}
                >
                  <Send size={16} />
                  باز کردن در ایمیل
                </a>
                <button
                  onClick={() => setEmailModal(false)}
                  className="ui-btn ui-btn-ghost px-5 py-3"
                >
                  انصراف
                </button>
              </div>
              <p className="text-xs text-slate-400 text-center">
                این دکمه کلاینت ایمیل شما را با اطلاعات پر‌شده باز می‌کند.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
