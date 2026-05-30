"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl, customerFetch } from "@/lib/api";
import { usePushNotifications } from "@/lib/usePushNotifications";
import { useI18n } from "@/lib/i18n";
import {
  User, Building2, Phone, Mail, Lock, Save, ArrowRight,
  Moon, Sun, CheckCircle, AlertCircle, Bell, BellOff, Languages,
} from "lucide-react";

interface Customer {
  id: number;
  full_name: string;
  email: string;
  company?: string;
  phone?: string;
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  // Theme
  const [darkMode, setDarkMode] = useState(false);

  // Push Notifications
  const { permission, isSubscribed, loading: pushLoading, subscribe, unsubscribe, isSupported } = usePushNotifications(customer?.id);

  // i18n
  const { locale, setLocale } = useI18n();

  useEffect(() => {
    // Load theme preference
    const stored = localStorage.getItem("artin_theme");
    if (stored === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("artin_customer");
    if (!stored) {
      router.push("/customer-login");
      return;
    }
    try {
      const c = JSON.parse(stored);
      loadProfile(c.id);
    } catch {
      router.push("/customer-login");
    }
  }, [router]);

  async function loadProfile(id: number) {
    try {
      const res = await customerFetch(apiUrl(`/customers/${id}`));
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomer(data.customer);
        setFullName(data.customer.full_name || "");
        setCompany(data.customer.company || "");
        setPhone(data.customer.phone || "");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setProfileMsg("");
    setProfileErr("");
    setSavingProfile(true);

    try {
      const res = await customerFetch(apiUrl(`/customers/${customer.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, company, phone }),
      });
      const data = await res.json();
      if (data.success) {
        setProfileMsg("اطلاعات با موفقیت ذخیره شد.");
        // Update localStorage
        const stored = localStorage.getItem("artin_customer");
        if (stored) {
          const c = JSON.parse(stored);
          c.full_name = fullName;
          c.company = company;
          c.phone = phone;
          localStorage.setItem("artin_customer", JSON.stringify(c));
        }
      } else {
        setProfileErr(data.message || "خطا در ذخیره اطلاعات");
      }
    } catch {
      setProfileErr("خطای شبکه. لطفاً دوباره تلاش کنید.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setPwdMsg("");
    setPwdErr("");

    if (newPassword.length < 6) {
      setPwdErr("رمز عبور جدید باید حداقل ۶ کاراکتر باشد.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdErr("رمز عبور جدید و تکرار آن مطابقت ندارد.");
      return;
    }

    setSavingPwd(true);
    try {
      const res = await customerFetch(apiUrl(`/customers/${customer.id}/change-password`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPwdMsg("رمز عبور با موفقیت تغییر کرد.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPwdErr(data.message || "خطا در تغییر رمز عبور");
      }
    } catch {
      setPwdErr("خطای شبکه. لطفاً دوباره تلاش کنید.");
    } finally {
      setSavingPwd(false);
    }
  }

  function toggleTheme() {
    const newDark = !darkMode;
    setDarkMode(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("artin_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("artin_theme", "light");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <User className="w-6 h-6 text-blue-600" />
            پروفایل کاربری
          </h1>
          <button
            onClick={() => router.push("/customer-dashboard")}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            بازگشت
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Info Card */}
        <div className="ui-card rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 text-gray-700 dark:text-gray-200">
            اطلاعات شخصی
          </h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                <User className="w-4 h-4 inline ml-1" />
                نام و نام خانوادگی
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="ui-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                <Mail className="w-4 h-4 inline ml-1" />
                ایمیل
              </label>
              <input
                type="email"
                value={customer.email}
                className="ui-input bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                disabled
              />
              <p className="text-xs text-gray-400 mt-1">ایمیل قابل تغییر نیست.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                <Building2 className="w-4 h-4 inline ml-1" />
                شرکت / سازمان
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="ui-input"
                placeholder="اختیاری"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                <Phone className="w-4 h-4 inline ml-1" />
                شماره تماس
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="ui-input"
                placeholder="اختیاری"
                dir="ltr"
              />
            </div>

            {profileMsg && (
              <div className="ui-alert ui-alert-success flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {profileMsg}
              </div>
            )}
            {profileErr && (
              <div className="ui-alert ui-alert-error flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {profileErr}
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="ui-btn ui-btn-primary gap-2 w-full justify-center"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? "در حال ذخیره..." : "ذخیره تغییرات"}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="ui-card rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            تغییر رمز عبور
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                رمز عبور فعلی
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="ui-input"
                required
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                رمز عبور جدید
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="ui-input"
                required
                minLength={6}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                تکرار رمز عبور جدید
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="ui-input"
                required
                dir="ltr"
              />
            </div>

            {pwdMsg && (
              <div className="ui-alert ui-alert-success flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {pwdMsg}
              </div>
            )}
            {pwdErr && (
              <div className="ui-alert ui-alert-error flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {pwdErr}
              </div>
            )}

            <button
              type="submit"
              disabled={savingPwd}
              className="ui-btn ui-btn-ghost gap-2 w-full justify-center"
            >
              <Lock className="w-4 h-4" />
              {savingPwd ? "در حال تغییر..." : "تغییر رمز عبور"}
            </button>
          </form>
        </div>

        {/* Push Notification Card */}
        {isSupported && (
          <div className="ui-card rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              اعلان‌های Push
            </h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isSubscribed ? (
                  <Bell className="w-5 h-5 text-blue-500" />
                ) : (
                  <BellOff className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-200">
                    {isSubscribed ? "اعلان‌ها فعال" : "اعلان‌ها غیرفعال"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {permission === "denied"
                      ? "دسترسی اعلان در مرورگر مسدود شده است"
                      : "دریافت اعلان‌های مهم از آرتین آزما"}
                  </p>
                </div>
              </div>
              <button
                onClick={isSubscribed ? unsubscribe : subscribe}
                disabled={pushLoading || permission === "denied"}
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 disabled:opacity-50 ${
                  isSubscribed ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                    isSubscribed ? "translate-x-0.5" : "translate-x-7.5"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Theme Settings Card */}
        <div className="ui-card rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 text-gray-700 dark:text-gray-200">
            تنظیمات ظاهری
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? (
                <Moon className="w-5 h-5 text-indigo-400" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-200">
                  {darkMode ? "حالت تاریک" : "حالت روشن"}
                </p>
                <p className="text-xs text-gray-400">
                  تغییر تم ظاهری برنامه
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                darkMode ? "bg-indigo-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                  darkMode ? "translate-x-0.5" : "translate-x-7.5"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Language Settings Card */}
        <div className="ui-card rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Languages className="w-5 h-5 text-blue-600" />
            زبان / Language
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Languages className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-200">
                  {locale === "fa" ? "فارسی" : "English"}
                </p>
                <p className="text-xs text-gray-400">
                  تغییر زبان رابط کاربری / Change UI language
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLocale("fa")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  locale === "fa"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                فارسی
              </button>
              <button
                onClick={() => setLocale("en")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  locale === "en"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
