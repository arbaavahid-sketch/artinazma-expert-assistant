"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

type Customer = {
  id: number;
  full_name: string;
  email: string;
  company: string;
  phone: string;
};

type ChatSession = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export default function CustomerDashboardPage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadSessions(customerId: number) {
    try {
      const res = await fetch(apiUrl(`/customers/${customerId}/chat-sessions`));
      const data = await res.json();

      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    }
  }

  useEffect(() => {
    const raw = localStorage.getItem("artin_customer");

    if (!raw) {
      window.location.href = "/customer-login";
      return;
    }

    const parsed = JSON.parse(raw);
    setCustomer(parsed);

    loadSessions(parsed.id).finally(() => setLoading(false));
  }, []);

  function logout() {
    localStorage.removeItem("artin_customer");
    window.location.href = "/";
  }

  if (!customer) {
    return (
      <section className="flex min-h-screen items-center justify-center">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          در حال بررسی حساب کاربری...
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 rounded-[36px] bg-white p-8 shadow-sm">
        <div className="mb-3 text-sm font-bold text-blue-700">
          پنل مشتری
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900">
              سلام {customer.full_name}
            </h1>

            <p className="mt-3 leading-8 text-slate-600">
              اینجا می‌توانید گفتگوهای قبلی خود با آرتین را ببینید و دوباره
              سوال جدید بپرسید.
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700"
          >
            خروج از حساب مشتری
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">اطلاعات حساب</h2>

          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <div>
              <span className="font-bold text-slate-900">ایمیل:</span>{" "}
              {customer.email}
            </div>

            {customer.company && (
              <div>
                <span className="font-bold text-slate-900">شرکت:</span>{" "}
                {customer.company}
              </div>
            )}

            {customer.phone && (
              <div>
                <span className="font-bold text-slate-900">تماس:</span>{" "}
                {customer.phone}
              </div>
            )}
          </div>

          <Link
            href="/assistant"
            className="mt-6 block rounded-2xl bg-blue-700 px-5 py-4 text-center font-bold text-white"
          >
            شروع گفتگوی جدید با آرتین
          </Link>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">گفتگوهای من</h2>

          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-slate-500">
              در حال دریافت گفتگوها...
            </div>
          ) : sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/assistant?session_id=${session.id}`}
                  className="block rounded-2xl border border-slate-200 bg-slate-50 p-5 hover:bg-white"
                >
                  <div className="font-bold text-slate-900">
                    {session.title}
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    آخرین بروزرسانی: {session.updated_at || session.created_at}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">
              هنوز گفتگویی ذخیره نشده است.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}