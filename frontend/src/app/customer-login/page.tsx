"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/api";

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

      router.push("/customer-dashboard");
    } catch {
      setMessage("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-[36px] bg-white p-10 shadow-sm">
          <div className="mb-3 text-sm font-bold text-blue-700">
            ورود مشتری
          </div>

          <h1 className="text-3xl font-black text-slate-900">
            ورود به حساب کاربری آرتین آزما
          </h1>

          <p className="mt-4 leading-8 text-slate-600">
            با ورود به حساب کاربری، گفتگوها و سوالات قبلی شما ذخیره می‌شود و
            بعداً می‌توانید دوباره آن‌ها را ببینید.
          </p>

          <div className="mt-8 space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ایمیل"
              className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="رمز عبور"
              className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
              onKeyDown={(e) => {
                if (e.key === "Enter") login();
              }}
            />
          </div>

          {message && (
            <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-700">
              {message}
            </div>
          )}

          <button
            onClick={login}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-blue-700 px-5 py-4 font-bold text-white disabled:opacity-50"
          >
            {loading ? "در حال ورود..." : "ورود به حساب کاربری"}
          </button>

          <div className="mt-6 text-center text-sm text-slate-600">
            حساب کاربری ندارید؟{" "}
            <Link href="/customer-register" className="font-bold text-blue-700">
              ثبت‌نام مشتری
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-center rounded-[36px] bg-slate-50 p-8">
  <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-sm shadow-slate-200/70">
    <div className="flex items-center justify-center gap-4">
      <img
        src="/images/artin-avatar.png"
        alt="آرتین"
        className="h-20 w-20 shrink-0 rounded-full border border-slate-200 bg-white object-cover shadow-sm"
      />

      <div className="min-w-0">
        <div className="whitespace-nowrap text-base font-black text-slate-750 md:text-lg">
          آرتین، دستیار تخصصی شما
        </div>
      </div>
    </div>
  </div>
</div>
      </div>
    </section>
  );
}