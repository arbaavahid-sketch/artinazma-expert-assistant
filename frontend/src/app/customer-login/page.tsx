"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  ArrowLeft,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";

export default function CustomerLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("ایمیل و رمز عبور را وارد کنید.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(apiUrl("/customers/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.message || "ورود ناموفق بود.");
        return;
      }

      localStorage.setItem("artin_customer", JSON.stringify(data.customer));
      document.cookie =
        "artin_customer_auth=logged_in; path=/; max-age=86400; samesite=lax";

      const params = new URLSearchParams(window.location.search);
      const nextPath = params.get("next") || "/assistant";

      router.push(nextPath);
    } catch {
      setMessage("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[40px] border border-slate-200 bg-white shadow-sm lg:grid-cols-[1fr_430px]">
          <div className="p-8 lg:p-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
              <LogIn size={17} />
              ورود مشتری
            </div>

            <h1 className="text-3xl font-black leading-[1.5] text-slate-900 md:text-4xl">
              ورود به حساب کاربری آرتین آزما
            </h1>

            <p className="mt-4 max-w-2xl leading-8 text-slate-600">
              برای استفاده از آرتین، مشاهده گفتگوهای قبلی، ثبت درخواست مشاوره و
              ادامه ارتباط با کارشناسان، وارد حساب خود شوید.
            </p>

            <div className="mt-8 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  ایمیل
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full rounded-2xl border border-slate-300 bg-white py-4 pl-4 pr-11 outline-none transition focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  رمز عبور
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
                    placeholder="رمز عبور"
                    className="w-full rounded-2xl border border-slate-300 bg-white py-4 pl-4 pr-11 outline-none transition focus:border-blue-600"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") login();
                    }}
                  />
                </div>
              </div>
            </div>

            {message && (
              <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-700">
                {message}
              </div>
            )}

            <button
              onClick={login}
              disabled={loading}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-4 font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? "در حال ورود..." : "ورود به حساب کاربری"}
              <ArrowLeft size={18} />
            </button>

            <div className="mt-6 text-center text-sm text-slate-600">
              حساب کاربری ندارید؟{" "}
              <Link
                href="/customer-register"
                className="inline-flex items-center gap-1 font-bold text-blue-700"
              >
                ثبت‌نام مشتری
                <UserPlus size={15} />
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-slate-50 p-8">
            <div className="w-full max-w-md rounded-[32px] bg-white p-6 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-[34px] bg-slate-50 p-3">
                <img
                  src="/images/artin-avatar.png"
                  alt="آرتین"
                  className="h-full w-full rounded-full object-cover"
                />
              </div>

              <div className="text-xl font-black text-slate-900">
                آرتین، دستیار تخصصی شما
              </div>

              <p className="mt-3 leading-8 text-slate-600">
                برای سوالات فنی، تحلیل تست، تجهیزات، مواد شیمیایی، کاتالیست‌ها و
                موضوعات مرتبط با آرتین آزما.
              </p>

              <div className="mt-5 grid gap-3 text-right text-sm">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <ShieldCheck size={18} className="text-blue-700" />
                  گفتگوهای شما در حسابتان ذخیره می‌شود.
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <Sparkles size={18} className="text-blue-700" />
                  پاسخ‌گویی تخصصی بر اساس بانک دانش آرتین.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
