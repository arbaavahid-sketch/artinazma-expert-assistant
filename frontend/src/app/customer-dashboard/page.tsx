"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  CircleUserRound,
  LogOut,
  Mail,
  Phone,
  Building2,
  MessageSquareText,
  Plus,
  Clock3,
  Pencil,
  Save,
  X,
  Trash2,
} from "lucide-react";

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

function formatDate(value?: string) {
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

export default function CustomerDashboardPage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);
  const [clearingAllSessions, setClearingAllSessions] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");
  async function loadSessions(customerId: number) {
    try {
      const res = await fetch(apiUrl(`/customers/${customerId}/chat-sessions`), {
        cache: "no-store",
      });

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

    const parsed = JSON.parse(raw) as Customer;

    setCustomer(parsed);
setProfileFullName(parsed.full_name || "");
setProfileCompany(parsed.company || "");
setProfilePhone(parsed.phone || "");
loadSessions(parsed.id).finally(() => setLoading(false));
  }, []);
 async function saveProfile() {
  if (!customer) return;

  setProfileMessage("");

  if (!profileFullName.trim()) {
    setProfileMessage("نام و نام خانوادگی الزامی است.");
    return;
  }

  setSavingProfile(true);

  try {
    const res = await fetch(apiUrl(`/customers/${customer.id}`), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: profileFullName,
        company: profileCompany,
        phone: profilePhone,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      setProfileMessage(data.message || "خطا در بروزرسانی اطلاعات حساب.");
      return;
    }

    setCustomer(data.customer);
    localStorage.setItem("artin_customer", JSON.stringify(data.customer));
    setEditingProfile(false);
    setProfileMessage("اطلاعات حساب با موفقیت بروزرسانی شد.");
  } catch {
    setProfileMessage("خطا در اتصال به سرور.");
  } finally {
    setSavingProfile(false);
  }
}

function cancelProfileEdit() {
  if (!customer) return;

  setProfileFullName(customer.full_name || "");
  setProfileCompany(customer.company || "");
  setProfilePhone(customer.phone || "");
  setProfileMessage("");
  setEditingProfile(false);
}
async function deleteOneSession(sessionId: number) {
  if (!customer) return;

  const confirmed = window.confirm("این گفتگو حذف شود؟");

  if (!confirmed) return;

  setSessionMessage("");
  setDeletingSessionId(sessionId);

  try {
    const res = await fetch(
      apiUrl(`/customers/${customer.id}/chat-sessions/${sessionId}`),
      {
        method: "DELETE",
      }
    );

    const data = await res.json();

    if (!data.success) {
      setSessionMessage(data.message || "خطا در حذف گفتگو.");
      return;
    }

    setSessions((prev) => prev.filter((item) => item.id !== sessionId));
    setSessionMessage("گفتگو با موفقیت حذف شد.");
  } catch {
    setSessionMessage("خطا در اتصال به سرور.");
  } finally {
    setDeletingSessionId(null);
  }
}

async function deleteAllSessions() {
  if (!customer) return;

  const confirmed = window.confirm(
    "همه گفتگوهای شما حذف شود؟ این عملیات قابل بازگشت نیست."
  );

  if (!confirmed) return;

  setSessionMessage("");
  setClearingAllSessions(true);

  try {
    const res = await fetch(apiUrl(`/customers/${customer.id}/chat-sessions`), {
      method: "DELETE",
    });

    const data = await res.json();

    if (!data.success) {
      setSessionMessage(data.message || "خطا در حذف گفتگوها.");
      return;
    }

    setSessions([]);
    setSessionMessage("همه گفتگوها با موفقیت حذف شدند.");
  } catch {
    setSessionMessage("خطا در اتصال به سرور.");
  } finally {
    setClearingAllSessions(false);
  }
}
  function logout() {
  localStorage.removeItem("artin_customer");
  document.cookie = "artin_customer_auth=; path=/; max-age=0";
  window.location.href = "/customer-login";
}

  if (!customer) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-6">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-lg font-black text-slate-900">
            در حال بررسی حساب کاربری...
          </div>
          <div className="mt-3 text-sm text-slate-500">
            لطفاً چند لحظه صبر کنید.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-blue-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-700 text-white shadow-sm">
                  <CircleUserRound size={34} strokeWidth={1.8} />
                </div>

                <div>
                  <div className="mb-2 text-sm font-bold text-blue-700">
                    حساب کاربری مشتری
                  </div>

                  <h1 className="text-3xl font-black text-slate-900">
                    سلام {customer.full_name}
                  </h1>

                  <p className="mt-2 leading-8 text-slate-600">
                    گفتگوهای قبلی، اطلاعات حساب و مسیر ارتباط با آرتین اینجا
                    در دسترس شماست.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/assistant"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
                >
                  <Plus size={18} />
                  گفتگوی جدید
                </Link>

                <button
                  onClick={logout}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
                >
                  <LogOut size={18} />
                  خروج
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
  <div className="mb-5 flex items-center justify-between gap-3">
    <h2 className="text-xl font-black text-slate-900">
      اطلاعات حساب
    </h2>

    {!editingProfile ? (
      <button
        onClick={() => setEditingProfile(true)}
        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white"
      >
        <Pencil size={15} />
        ویرایش
      </button>
    ) : (
      <button
        onClick={cancelProfileEdit}
        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
      >
        <X size={15} />
        انصراف
      </button>
    )}
  </div>

  {!editingProfile ? (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
        <Mail className="mt-1 shrink-0 text-blue-700" size={18} />
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-500">ایمیل</div>
          <div className="mt-1 break-words text-sm font-bold text-slate-900">
            {customer.email}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
        <Phone className="mt-1 shrink-0 text-blue-700" size={18} />
        <div>
          <div className="text-xs font-bold text-slate-500">شماره تماس</div>
          <div className="mt-1 text-sm font-bold text-slate-900">
            {customer.phone || "ثبت نشده"}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
        <Building2 className="mt-1 shrink-0 text-blue-700" size={18} />
        <div>
          <div className="text-xs font-bold text-slate-500">شرکت</div>
          <div className="mt-1 text-sm font-bold text-slate-900">
            {customer.company || "ثبت نشده"}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700">
          نام و نام خانوادگی
        </label>
        <input
          value={profileFullName}
          onChange={(e) => setProfileFullName(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-blue-600"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700">
          شرکت / سازمان
        </label>
        <input
          value={profileCompany}
          onChange={(e) => setProfileCompany(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-blue-600"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700">
          شماره تماس
        </label>
        <input
          value={profilePhone}
          onChange={(e) => setProfilePhone(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-blue-600"
        />
      </div>

      <button
        onClick={saveProfile}
        disabled={savingProfile}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-4 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"
      >
        <Save size={17} />
        {savingProfile ? "در حال ذخیره..." : "ذخیره تغییرات"}
      </button>
    </div>
  )}

  {profileMessage && (
    <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-7 text-blue-700">
      {profileMessage}
    </div>
  )}
</div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-500">
                    تعداد گفتگوها
                  </div>
                  <div className="mt-2 text-4xl font-black text-slate-900">
                    {sessions.length}
                  </div>
                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
                  <MessageSquareText size={28} strokeWidth={1.8} />
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-500">
                گفتگوها به حساب شما متصل هستند و می‌توانید از همین بخش دوباره
                ادامه‌شان دهید.
              </p>
            </div>
          </aside>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  گفتگوهای من
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  برای ادامه هر گفتگو، روی آن کلیک کنید.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
  {sessions.length > 0 && (
    <button
      onClick={deleteAllSessions}
      disabled={clearingAllSessions}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
    >
      <Trash2 size={16} />
      {clearingAllSessions ? "در حال حذف..." : "حذف همه گفتگوها"}
    </button>
  )}

  <Link
    href="/assistant"
    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-white"
  >
    شروع گفتگوی تازه
  </Link>
</div>
            </div>
            {sessionMessage && (
  <div className="mb-5 rounded-2xl bg-blue-50 p-4 text-sm leading-7 text-blue-700">
    {sessionMessage}
  </div>
)}
            {loading ? (
              <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">
                در حال دریافت گفتگوها...
              </div>
            ) : sessions.length > 0 ? (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/assistant?session_id=${session.id}`}
                    className="group block rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-blue-200 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-base font-black text-slate-900 group-hover:text-blue-700">
                          {session.title || "گفتگوی جدید"}
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <Clock3 size={15} />
                          آخرین بروزرسانی:{" "}
                          {formatDate(session.updated_at || session.created_at)}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
  <span className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-blue-700">
    ادامه گفتگو
  </span>

  <button
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteOneSession(session.id);
    }}
    disabled={deletingSessionId === session.id}
    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
    title="حذف گفتگو"
  >
    <Trash2 size={16} />
  </button>
</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-50 p-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-blue-700 shadow-sm">
                  <MessageSquareText size={30} strokeWidth={1.8} />
                </div>

                <h3 className="mt-5 text-lg font-black text-slate-900">
                  هنوز گفتگویی ذخیره نشده است
                </h3>

                <p className="mt-3 leading-7 text-slate-500">
                  اولین سوال خود را از آرتین بپرسید تا گفتگو در حساب شما ذخیره
                  شود.
                </p>

                <Link
  href="/assistant"
  className="mt-6 inline-flex rounded-2xl bg-blue-700 px-6 py-3 font-bold text-white"
>
  شروع گفتگو با آرتین
</Link>

              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}