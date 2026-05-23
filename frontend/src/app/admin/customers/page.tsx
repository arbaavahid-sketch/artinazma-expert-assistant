"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
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

  useEffect(() => {
    fetch(apiUrl("/admin/customers?limit=200"), {
      headers: { "X-Admin-Key": "" },
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
                        <div className="truncate text-sm font-black text-slate-900">
                          {c.full_name}
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
                      <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MessageSquareText size={13} />
                          {c.session_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessagesSquare size={13} />
                          {c.message_count}
                        </span>
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
    </section>
  );
}
