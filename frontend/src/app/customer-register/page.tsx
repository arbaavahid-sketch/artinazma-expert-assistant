"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/api";

export default function CustomerRegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function register() {
    setMessage("");

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setMessage("نام، ایمیل و رمز عبور الزامی است.");
      return;
    }

    if (password.length < 6) {
      setMessage("رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(apiUrl("/customers/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          company,
          phone,
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.message || "ثبت‌نام انجام نشد.");
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
      <div className="w-full max-w-2xl rounded-[36px] bg-white p-10 shadow-sm">
        <div className="mb-3 text-sm font-bold text-blue-700">
          ثبت‌نام مشتری
        </div>

        <h1 className="text-3xl font-black text-slate-900">
          ساخت حساب کاربری مشتری
        </h1>

        <p className="mt-4 leading-8 text-slate-600">
          با ساخت حساب، گفتگوهای شما با آرتین ذخیره می‌شود و بعداً می‌توانید
          سوالات و پاسخ‌های قبلی را مشاهده کنید.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="نام و نام خانوادگی *"
            className="rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
          />

          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="شرکت / سازمان"
            className="rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="شماره تماس"
            className="rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
          />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ایمیل *"
            className="rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="رمز عبور *"
            className="rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600 md:col-span-2"
          />
        </div>

        {message && (
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-700">
            {message}
          </div>
        )}

        <button
          onClick={register}
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-blue-700 px-5 py-4 font-bold text-white disabled:opacity-50"
        >
          {loading ? "در حال ثبت‌نام..." : "ثبت‌نام و ورود"}
        </button>

        <div className="mt-6 text-center text-sm text-slate-600">
          قبلاً ثبت‌نام کرده‌اید؟{" "}
          <Link href="/customer-login" className="font-bold text-blue-700">
            ورود مشتری
          </Link>
        </div>
      </div>
    </section>
  );
}