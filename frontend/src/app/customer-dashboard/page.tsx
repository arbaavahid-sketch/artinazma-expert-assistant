"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl, customerFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import Tooltip from "@/components/Tooltip";
import {
  Bell,
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
  FlaskConical,
  PhoneCall,
  Download,
  Sparkles,
  Search,
  Hash,
  Loader2,
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
  message_count?: number;
  last_message_preview?: string;
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
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [clearingAllSessions, setClearingAllSessions] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");

  // Notifications
  type Notification = { id: number; message: string; sender: string; is_read: number; created_at: string };
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  async function loadSessions(customerId: number) {
    try {
      const res = await customerFetch(
        apiUrl(`/customers/${customerId}/chat-sessions`),
        {
          cache: "no-store",
        },
      );

      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    }
  }

  async function loadNotifications(customerId: number) {
    try {
      const res = await customerFetch(apiUrl(`/customers/${customerId}/notifications`), { cache: "no-store" });
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      /* ignore */
    }
  }

  async function markNotificationsRead(customerId: number) {
    try {
      await customerFetch(apiUrl(`/customers/${customerId}/notifications/read`), { method: "POST" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {
      /* ignore */
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
    loadNotifications(parsed.id);
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
      const res = await customerFetch(apiUrl(`/customers/${customer.id}`), {
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
      setProfileMessage("");
      toast("اطلاعات حساب با موفقیت بروزرسانی شد.", "success");
    } catch {
      setProfileMessage("خطا در اتصال به سرور.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (!customer) return;
    if (newPassword.length < 8) { toast("رمز عبور جدید باید حداقل ۸ کاراکتر باشد.", "warning"); return; }
    if (newPassword !== confirmPassword) { toast("رمز عبور جدید و تکرار آن یکسان نیستند.", "warning"); return; }
    setSavingPassword(true);
    try {
      const res = await customerFetch(apiUrl(`/customers/${customer.id}/change-password`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast("رمز عبور با موفقیت تغییر یافت.", "success");
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        setShowChangePassword(false);
      } else {
        toast(data.message || "خطا در تغییر رمز عبور.", "error");
      }
    } catch {
      toast("خطا در اتصال به سرور.", "error");
    } finally {
      setSavingPassword(false);
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

    const confirmed = await confirm({ message: "این گفتگو حذف شود؟", variant: "danger", confirmLabel: "حذف", title: "حذف گفتگو" });

    if (!confirmed) return;

    setSessionMessage("");
    setDeletingSessionId(sessionId);

    try {
      const res = await customerFetch(
        apiUrl(`/customers/${customer.id}/chat-sessions/${sessionId}`),
        {
          method: "DELETE",
        },
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

    const confirmed = await confirm({ message: "همه گفتگوهای شما حذف شود؟ این عملیات قابل بازگشت نیست.", variant: "danger", confirmLabel: "حذف همه", title: "حذف همه گفتگوها" });

    if (!confirmed) return;

    setSessionMessage("");
    setClearingAllSessions(true);

    try {
      const res = await customerFetch(
        apiUrl(`/customers/${customer.id}/chat-sessions`),
        {
          method: "DELETE",
        },
      );

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
  async function renameSession(sessionId: number) {
    const title = renameValue.trim();
    if (!title || !customer) return;
    setSavingRename(true);
    try {
      const res = await customerFetch(apiUrl(`/customers/chat-sessions/${sessionId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customer.id, title }),
      });
      const data = await res.json();
      if (data.success) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
        );
        toast("نام گفتگو تغییر کرد", "success");
      } else {
        toast(data.message || "خطا در تغییر نام", "error");
      }
    } catch {
      toast("خطا در اتصال به سرور", "error");
    } finally {
      setSavingRename(false);
      setRenamingSessionId(null);
      setRenameValue("");
    }
  }

  async function exportSessionPDF(session: ChatSession) {
    if (!customer) return;
    try {
      const res = await customerFetch(
        apiUrl(`/customers/${customer.id}/chat-sessions/${session.id}/messages`),
        { cache: "no-store" },
      );
      const data = await res.json();
      const msgs: { role: string; content: string }[] = data.messages || [];
      const now = new Date().toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
      const title = session.title || "گفتگوی بدون عنوان";

      const msgHtml = msgs.map((msg) => {
        const safe = (msg.content || "")
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>")
          .replace(/\n/g, "<br/>");
        if (msg.role === "user") {
          return `<div class="bubble user"><div class="label">کاربر</div><p>${safe}</p></div>`;
        }
        return `<div class="bubble artin"><div class="label">آرتین</div><p>${safe}</p></div>`;
      }).join("");

      const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8"/>
<title>${title} — آرتین آزما</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;900&display=swap"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Vazirmatn', sans-serif; background: #fff; color: #1e293b; padding: 40px; font-size: 13px; }
  .header { border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 28px; }
  .header h1 { font-size: 18px; font-weight: 900; color: #1d4ed8; }
  .header .meta { font-size: 11px; color: #64748b; margin-top: 6px; }
  .bubble { margin-bottom: 20px; padding: 14px 16px; border-radius: 16px; page-break-inside: avoid; }
  .bubble.user { background: #dbeafe; border-right: 4px solid #1d4ed8; }
  .bubble.artin { background: #f1f5f9; border-right: 4px solid #0ea5e9; }
  .label { font-size: 10px; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.05em; }
  .bubble.user .label { color: #1d4ed8; }
  .bubble.artin .label { color: #0ea5e9; }
  p { line-height: 2; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
  <div class="meta">مشتری: ${customer.full_name} | تاریخ: ${now}</div>
</div>
${msgHtml}
<div class="footer">آرتین آزما مهر — artinazma.net</div>
<script>window.onload=function(){window.print();}<\/script>
</body>
</html>`;
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
    } catch {
      alert("خطا در بارگذاری پیام‌های گفتگو.");
    }
  }

  async function logout() {
    localStorage.removeItem("artin_customer");

    // Clear JWT cookie (backend) and session cookie (Next.js) simultaneously
    await Promise.allSettled([
      customerFetch(apiUrl("/customers/logout"), { method: "POST" }),
      fetch("/api/customer-session", { method: "DELETE" }),
    ]);

    window.location.href = "/customer-login";
  }

  if (!customer) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-6">
        <div className="ui-card rounded-[32px] p-8 text-center shadow-sm">
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
        <div className="ui-card mb-6 overflow-hidden rounded-[36px] shadow-sm">
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
                    گفتگوهای قبلی، اطلاعات حساب و مسیر ارتباط با آرتین اینجا در
                    دسترس شماست.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Notification bell */}
                <button
                  onClick={() => {
                    setShowNotifications((v) => !v);
                    if (!showNotifications && customer && unreadCount > 0) {
                      markNotificationsRead(customer.id);
                    }
                  }}
                  className="relative inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Bell size={18} />
                  اعلان‌ها
                  {unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-black text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <Link
                  href="/assistant"
                  className="ui-btn ui-btn-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm"
                >
                  <Plus size={18} />
                  گفتگوی جدید
                </Link>

                <Link
                  href="/customer-profile"
                  className="ui-btn ui-btn-ghost inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm"
                >
                  <CircleUserRound size={18} />
                  پروفایل و تنظیمات
                </Link>

                <button
                  onClick={logout}
                  className="ui-btn ui-btn-danger inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 px-5 py-3 text-sm"
                >
                  <LogOut size={18} />
                  خروج
                </button>
              </div>
            </div>
          </div>

          {/* Notifications panel */}
          {showNotifications && (
            <div className="border-t border-blue-100 bg-blue-50 px-8 py-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
                  <Bell size={16} />
                  پیام‌های تیم آرتین آزما
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>
              {notifications.length === 0 ? (
                <div className="rounded-2xl bg-white px-5 py-4 text-center text-sm text-slate-500">
                  پیامی از تیم ما دریافت نکرده‌اید.
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-2xl border px-5 py-3 text-sm leading-7 ${
                        n.is_read
                          ? "border-slate-100 bg-white text-slate-600"
                          : "border-blue-200 bg-white font-bold text-slate-800"
                      }`}
                    >
                      <div>{n.message}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {new Intl.DateTimeFormat("fa-IR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(n.created_at + "Z"))}
                        {!n.is_read && (
                          <span className="mr-2 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            جدید
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick links */}
          <div className="border-t border-slate-100 bg-slate-50 px-8 py-4">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/assistant"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
              >
                <Sparkles size={15} />
                دستیار آرتین
              </Link>
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100"
              >
                <FlaskConical size={15} />
                تحلیل تست
              </Link>
              <Link
                href="/customer-request"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100"
              >
                <PhoneCall size={15} />
                درخواست مشاوره
              </Link>
            </div>
          </div>

        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-6">
            <div className="ui-card rounded-[32px] p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-slate-900">
                  اطلاعات حساب
                </h2>

                {!editingProfile ? (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="ui-btn ui-btn-ghost inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs"
                  >
                    <Pencil size={15} />
                    ویرایش
                  </button>
                ) : (
                  <button
                    onClick={cancelProfileEdit}
                    className="ui-btn ui-btn-ghost inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs text-slate-600"
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
                      <div className="text-xs font-bold text-slate-500">
                        ایمیل
                      </div>
                      <div className="mt-1 break-words text-sm font-bold text-slate-900">
                        {customer.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                    <Phone className="mt-1 shrink-0 text-blue-700" size={18} />
                    <div>
                      <div className="text-xs font-bold text-slate-500">
                        شماره تماس
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {customer.phone || "ثبت نشده"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                    <Building2
                      className="mt-1 shrink-0 text-blue-700"
                      size={18}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-500">
                        شرکت
                      </div>
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
                      className="ui-input rounded-2xl p-4 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      شرکت / سازمان
                    </label>
                    <input
                      value={profileCompany}
                      onChange={(e) => setProfileCompany(e.target.value)}
                      className="ui-input rounded-2xl p-4 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      شماره تماس
                    </label>
                    <input
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="ui-input rounded-2xl p-4 text-sm"
                    />
                  </div>

                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="ui-btn ui-btn-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm"
                  >
                    <Save size={17} />
                    {savingProfile ? "در حال ذخیره..." : "ذخیره تغییرات"}
                  </button>
                </div>
              )}

              {profileMessage && (
                <div className="ui-alert ui-alert-info mt-4">
                  {profileMessage}
                </div>
              )}

              {/* تغییر رمز عبور */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setShowChangePassword((v) => !v)}
                  className="text-sm font-bold text-slate-500 transition hover:text-slate-800"
                >
                  {showChangePassword ? "▲ بستن" : "🔒 تغییر رمز عبور"}
                </button>
                {showChangePassword && (
                  <div className="mt-4 space-y-3">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="ui-input rounded-2xl p-3 text-sm"
                      placeholder="رمز عبور فعلی"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="ui-input rounded-2xl p-3 text-sm"
                      placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="ui-input rounded-2xl p-3 text-sm"
                      placeholder="تکرار رمز عبور جدید"
                    />
                    <button
                      onClick={changePassword}
                      disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                      className="ui-btn ui-btn-primary rounded-2xl px-5 py-3 text-sm disabled:opacity-50"
                    >
                      {savingPassword ? "در حال ذخیره..." : "ذخیره رمز جدید"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="ui-card rounded-[32px] p-6 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-blue-50 p-4 text-center">
                  <div className="text-2xl font-black text-blue-700">{sessions.length}</div>
                  <div className="mt-1 text-xs font-bold text-blue-600">گفتگو</div>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 text-center">
                  <div className="text-2xl font-black text-emerald-700">
                    {sessions.reduce((sum, s) => sum + (s.message_count || 0), 0)}
                  </div>
                  <div className="mt-1 text-xs font-bold text-emerald-600">پیام</div>
                </div>
              </div>
              {sessions.length > 0 && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-center">
                  <div className="text-xs font-bold text-slate-400">آخرین فعالیت</div>
                  <div className="mt-1 text-sm font-black text-slate-700">
                    {formatDate(sessions[0]?.updated_at || sessions[0]?.created_at)}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <div className="ui-card rounded-[32px] p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
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
                    className="ui-btn ui-btn-danger inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-center text-sm"
                  >
                    <Trash2 size={16} />
                    {clearingAllSessions ? "در حال حذف..." : "حذف همه گفتگوها"}
                  </button>
                )}

                <Link
                  href="/assistant"
                  className="ui-btn ui-btn-ghost rounded-2xl px-4 py-3 text-center text-sm"
                >
                  شروع گفتگوی تازه
                </Link>
              </div>
            </div>

            {sessions.length > 1 && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Search size={16} className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder="جستجو در گفتگوها..."
                  className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
                />
                {sessionSearch && (
                  <button
                    onClick={() => setSessionSearch("")}
                    className="shrink-0 text-slate-400 hover:text-slate-600"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            )}
            {sessionMessage && (
              <div className="ui-alert ui-alert-info mb-5">
                {sessionMessage}
              </div>
            )}
            {loading ? (
              <div className="rounded-3xl bg-slate-50 p-6">
                <div className="ui-skeleton h-5 w-44" />
                <div className="mt-4 space-y-3">
                  <div className="ui-skeleton h-16 w-full rounded-2xl" />
                  <div className="ui-skeleton h-16 w-full rounded-2xl" />
                  <div className="ui-skeleton h-16 w-full rounded-2xl" />
                </div>
              </div>
            ) : sessions.length > 0 ? (() => {
              const filteredSessions = sessionSearch.trim()
                ? sessions.filter((s) =>
                    (s.title || "گفتگوی جدید")
                      .toLowerCase()
                      .includes(sessionSearch.toLowerCase())
                  )
                : sessions;
              return filteredSessions.length > 0 ? (
              <div className="space-y-3">
                {filteredSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/assistant?session_id=${session.id}`}
                    className="group block rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-blue-200 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-2">
                      {/* Title / Rename row */}
                      <div className="min-w-0">
                        {renamingSessionId === session.id ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") renameSession(session.id);
                                if (e.key === "Escape") { setRenamingSessionId(null); setRenameValue(""); }
                              }}
                              className="flex-1 rounded-xl border border-blue-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-300"
                              maxLength={120}
                            />
                            <button
                              onClick={() => renameSession(session.id)}
                              disabled={savingRename}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-50"
                            >
                              {savingRename ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            </button>
                            <button
                              onClick={() => { setRenamingSessionId(null); setRenameValue(""); }}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="truncate text-base font-black text-slate-900 group-hover:text-blue-700">
                              {session.title || "گفتگوی جدید"}
                            </div>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setRenamingSessionId(session.id);
                                setRenameValue(session.title || "");
                              }}
                              className="shrink-0 rounded-lg p-1 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                              title="تغییر نام"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        )}

                        {session.last_message_preview && renamingSessionId !== session.id && (
                          <p className="mt-1 truncate text-sm leading-6 text-slate-500">
                            {session.last_message_preview}
                          </p>
                        )}
                      </div>

                      {/* Bottom row: date/count + action buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock3 size={13} />
                            {formatDate(session.updated_at || session.created_at)}
                          </span>
                          {(session.message_count ?? 0) > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-bold text-blue-600">
                              <Hash size={11} />
                              {session.message_count} پیام
                            </span>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.preventDefault()}>
                          <Tooltip label="خروجی PDF" position="top">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                exportSessionPDF(session);
                              }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-blue-700"
                            >
                              <Download size={15} />
                            </button>
                          </Tooltip>

                          <Tooltip label="حذف گفتگو" position="top">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteOneSession(session.id);
                              }}
                              disabled={deletingSessionId === session.id}
                              className="ui-btn ui-btn-danger inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 p-0 text-red-600"
                            >
                              <Trash2 size={15} />
                            </button>
                          </Tooltip>

                          <span className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                            ادامه ←
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ui-empty rounded-3xl p-10">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-slate-400 shadow-sm">
                  <Search size={26} strokeWidth={1.8} />
                </div>
                <h3 className="mt-4 text-base font-black text-slate-700">
                  نتیجه‌ای یافت نشد
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  گفتگویی با عبارت «{sessionSearch}» پیدا نشد.
                </p>
                <button
                  onClick={() => setSessionSearch("")}
                  className="mt-4 text-sm font-bold text-blue-700 hover:underline"
                >
                  پاک کردن جستجو
                </button>
              </div>
            );
            })() : (
              <div className="ui-empty rounded-3xl p-10">
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
                  className="ui-btn ui-btn-primary mt-6 inline-flex rounded-2xl px-6 py-3"
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
