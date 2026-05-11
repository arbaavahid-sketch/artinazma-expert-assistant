"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
      setError("لطفاً رمز ادمین را وارد کنید.");
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
        setError(data.message || "ورود ناموفق بود.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("خطا در اتصال به سیستم ورود ادمین.");
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
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl items-center justify-center">
        <div className="ui-card grid w-full overflow-hidden rounded-[40px] border-slate-200 shadow-sm lg:grid-cols-[1fr_420px]">
          <div className="p-8 lg:p-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
              <ShieldCheck size={17} />
              پنل داخلی آرتین آزما
            </div>

            <h1 className="text-3xl font-black leading-[1.5] text-slate-900 md:text-4xl">
              ورود ادمین
            </h1>

            <p className="mt-4 max-w-2xl leading-8 text-slate-600">
              برای دسترسی به داشبورد، بانک دانش، سوالات کاربران و درخواست‌های
              مشتریان، رمز ادمین را وارد کنید.
            </p>

            <div className="mt-8">
              <label className="mb-2 block text-sm font-bold text-slate-700">
                رمز ادمین
              </label>

              <div className="relative">
                <LockKeyhole
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="ui-input rounded-2xl py-4 pl-4 pr-11 focus:border-purple-600 focus:shadow-[0_0_0_3px_rgba(147,51,234,0.18)]"
                  placeholder="رمز را وارد کنید"
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
              {loading ? "در حال ورود..." : "ورود به پنل ادمین"}
              <ArrowLeft size={18} />
            </button>
          </div>

          <div className="flex items-center justify-center bg-gradient-to-b from-purple-50 via-white to-slate-50 p-8">
            <div className="ui-card w-full max-w-md rounded-[32px] p-6 shadow-sm">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[34px] bg-purple-50 text-purple-700">
                <KeyRound size={42} strokeWidth={1.7} />
              </div>

              <div className="text-center text-xl font-black text-slate-900">
                مدیریت داخلی آرتین
              </div>

              <p className="mt-3 text-center leading-8 text-slate-600">
                این بخش مخصوص مدیریت بانک دانش، بررسی پاسخ‌ها و پیگیری
                درخواست‌های مشتریان است.
              </p>

              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <LayoutDashboard size={18} className="text-purple-700" />
                  داشبورد مدیریتی
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <Database size={18} className="text-purple-700" />
                  مدیریت بانک دانش
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <Sparkles size={18} className="text-purple-700" />
                  پایش کیفیت پاسخ‌های آرتین
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
