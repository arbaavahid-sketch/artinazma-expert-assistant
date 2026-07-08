"use client";

import Link from "next/link";
import { useState } from "react";
import { apiUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, Mail, LogIn, KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const iconSide = isEn ? "left-4" : "right-4";
  const inputPadding = isEn ? "pl-11 pr-4" : "pl-4 pr-11";
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setMessage("");
    if (!email.trim()) {
      setMessage(isEn ? "Please enter your email." : "لطفاً ایمیل خود را وارد کنید.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/customers/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setMessage(data.message || (isEn ? "If the email is valid, a reset link will be sent." : "اگر ایمیل معتبر باشد، لینک بازیابی ارسال می‌شود."));
      } else {
        setSuccess(false);
        setMessage(data.message || (isEn ? "Reset email could not be sent." : "ارسال ایمیل بازیابی انجام نشد."));
      }
    } catch {
      setMessage(isEn ? "Server connection error." : "خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8" dir={dir}>
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-lg items-center justify-center">
        <div className="ui-card w-full rounded-[32px] p-8 shadow-sm lg:p-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
            <KeyRound size={17} />
            {isEn ? "Password Recovery" : "بازیابی رمز عبور"}
          </div>

          <h1 className="text-2xl font-black leading-[1.5] text-slate-900">
            {isEn ? "Forgot password" : "فراموشی رمز عبور"}
          </h1>

          <p className="mt-3 leading-8 text-slate-600">
            {isEn
              ? "Enter the email address you registered with. A password reset link will be sent to you."
              : "ایمیلی که با آن ثبت‌نام کرده‌اید را وارد کنید. لینک بازیابی رمز عبور برایتان ارسال می‌شود."}
          </p>

          {!success ? (
            <>
              <div className="mt-6">
                <label className="mb-2 block text-sm font-bold text-slate-700">{isEn ? "Email" : "ایمیل"}</label>
                <div className="relative">
                  <Mail size={18} className={`absolute ${iconSide} top-1/2 -translate-y-1/2 text-slate-400`} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className={`ui-input rounded-2xl py-4 ${inputPadding}`}
                    dir="ltr"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                  />
                </div>
              </div>

              {message && (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-700">
                  {message}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="ui-btn ui-btn-primary mt-6 inline-flex w-full gap-2 rounded-2xl px-5 py-4"
              >
                {loading ? (isEn ? "Sending..." : "در حال ارسال...") : (isEn ? "Send reset link" : "ارسال لینک بازیابی")}
                <ArrowLeft size={18} />
              </button>
            </>
          ) : (
            <div className="mt-6 rounded-2xl bg-emerald-50 p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
                <Mail size={26} />
              </div>
              <p className="leading-8 text-emerald-800">{message}</p>
              <p className="mt-2 text-sm text-emerald-600">
                {isEn ? "Check your inbox and spam folder." : "صندوق ایمیل خود (و پوشه اسپم) را بررسی کنید."}
              </p>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-slate-600">
            {isEn ? "Remembered your password?" : "رمز عبور را به یاد آوردید؟"}{" "}
            <Link href="/customer-login" className="inline-flex items-center gap-1 font-bold text-blue-700">
              {isEn ? "Customer login" : "ورود مشتری"}
              <LogIn size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
