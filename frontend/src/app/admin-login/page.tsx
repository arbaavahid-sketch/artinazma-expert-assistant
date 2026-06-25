"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import {
  ArrowLeft,
  Database,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const iconSide = isEn ? "left-4" : "right-4";
  const inputPadding = isEn ? "pl-11 pr-4" : "pl-4 pr-11";

  const [nextPath, setNextPath] = useState("/admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") || "/admin");
  }, []);

  async function login() {
    setError("");

    if (!password.trim()) {
      setError(isEn ? "Please enter the admin password." : "لطفاً رمز ادمین را وارد کنید.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(isEn ? "Admin login failed." : data.message || "ورود ناموفق بود.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError(isEn ? "Could not connect to the admin login system." : "خطا در اتصال به سیستم ورود ادمین.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      login();
    }
  }

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8" dir={dir}>
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl items-center justify-center">
        <div className="ui-card grid w-full overflow-hidden rounded-[40px] border-slate-200 shadow-sm lg:grid-cols-[1fr_420px]">
          <div className="p-8 lg:p-12">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher variant="purple" />
            </div>

            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
              <ShieldCheck size={17} />
              {isEn ? "ArtinAzma Internal Panel" : "پنل داخلی آرتین آزما"}
            </div>

            <h1 className="text-3xl font-black leading-[1.5] text-slate-900 md:text-4xl">
              {isEn ? "Admin Login" : "ورود ادمین"}
            </h1>

            <p className="mt-4 max-w-2xl leading-8 text-slate-600">
              {isEn
                ? "Enter the admin password to access the dashboard, knowledge base, user questions, and customer requests."
                : "برای دسترسی به داشبورد، بانک دانش، سوالات کاربران و درخواست‌های مشتریان، رمز ادمین را وارد کنید."}
            </p>

            <div className="mt-8">
              <label className="mb-2 block text-sm font-bold text-slate-700">
                {isEn ? "Admin password" : "رمز ادمین"}
              </label>

              <div className="relative">
                <LockKeyhole
                  size={18}
                  className={`absolute ${iconSide} top-1/2 -translate-y-1/2 text-slate-400`}
                />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`ui-input rounded-2xl py-4 ${inputPadding} focus:border-purple-600 focus:shadow-[0_0_0_3px_rgba(147,51,234,0.18)]`}
                  placeholder={isEn ? "Enter password" : "رمز را وارد کنید"}
                  dir="ltr"
                />
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm leading-7 text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={login}
              disabled={loading}
              className="ui-btn mt-6 inline-flex w-full gap-2 rounded-2xl bg-purple-700 px-5 py-4 text-white hover:bg-purple-800"
            >
              {loading ? (isEn ? "Signing in..." : "در حال ورود...") : (isEn ? "Enter admin panel" : "ورود به پنل ادمین")}
              <ArrowLeft size={18} className={isEn ? "rotate-180" : ""} />
            </button>
          </div>

          <div className="flex items-center justify-center bg-gradient-to-b from-purple-50 via-white to-slate-50 p-8">
            <div className="ui-card w-full max-w-md rounded-[32px] p-6 shadow-sm">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[34px] bg-purple-50 text-purple-700">
                <KeyRound size={42} strokeWidth={1.7} />
              </div>

              <div className="text-center text-xl font-black text-slate-900">
                {isEn ? "Artin Internal Management" : "مدیریت داخلی آرتین"}
              </div>

              <p className="mt-3 text-center leading-8 text-slate-600">
                {isEn
                  ? "This area is for managing the knowledge base, reviewing answer quality, and following up on customer requests."
                  : "این بخش مخصوص مدیریت بانک دانش، بررسی پاسخ‌ها و پیگیری درخواست‌های مشتریان است."}
              </p>

              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <LayoutDashboard size={18} className="text-purple-700" />
                  {isEn ? "Management dashboard" : "داشبورد مدیریتی"}
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <Database size={18} className="text-purple-700" />
                  {isEn ? "Knowledge base management" : "مدیریت بانک دانش"}
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <Sparkles size={18} className="text-purple-700" />
                  {isEn ? "Artin answer quality monitoring" : "پایش کیفیت پاسخ‌های آرتین"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
