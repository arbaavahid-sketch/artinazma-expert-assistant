"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { apiUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, ArrowRight, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";

function ResetPasswordInner() {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const Arrow = isEn ? ArrowRight : ArrowLeft;
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    fetch(apiUrl(`/customers/verify-reset-token?token=${token}`))
      .then(async (r) => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => setTokenValid(ok && data.valid))
      .catch(() => setTokenValid(false));
  }, [token]);

  async function handleReset() {
    setMessage("");
    if (!newPassword.trim()) { setMessage(isEn ? "Please enter a new password." : "رمز عبور جدید را وارد کنید."); return; }
    if (newPassword.length < 6) { setMessage(isEn ? "Password must be at least 6 characters." : "رمز عبور باید حداقل ۶ کاراکتر باشد."); return; }
    if (newPassword !== confirmPassword) { setMessage(isEn ? "Passwords do not match." : "رمز عبور و تکرار آن یکسان نیستند."); return; }

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/customers/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setMessage(data.message);
      } else {
        setMessage(data.message || (isEn ? "Error changing password." : "خطا در تغییر رمز عبور."));
      }
    } catch {
      setMessage(isEn ? "Connection error." : "خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  if (tokenValid === null) {
    return (
      <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-lg items-center justify-center">
          <div className="text-slate-500">{isEn ? "Verifying link..." : "در حال بررسی لینک..."}</div>
        </div>
      </section>
    );
  }

  if (!tokenValid) {
    return (
      <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-lg items-center justify-center">
          <div className="ui-card w-full rounded-[32px] p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">⚠️</div>
            <h2 className="text-xl font-black text-slate-900">{isEn ? "Invalid Link" : "لینک نامعتبر"}</h2>
            <p className="mt-3 leading-8 text-slate-600">{isEn ? "This reset link has expired or has already been used." : "این لینک بازیابی منقضی شده یا قبلاً استفاده شده است."}</p>
            <Link href="/forgot-password" className="ui-btn ui-btn-primary mt-6 inline-flex gap-2 rounded-2xl px-6 py-3">
              {isEn ? "Request Again" : "درخواست مجدد"}
              <Arrow size={18} />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-lg items-center justify-center">
        <div className="ui-card w-full rounded-[32px] p-8 shadow-sm lg:p-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
            <ShieldCheck size={17} />
            {isEn ? "Change Password" : "تغییر رمز عبور"}
          </div>

          <h1 className="text-2xl font-black leading-[1.5] text-slate-900">{isEn ? "New Password" : "رمز عبور جدید"}</h1>

          {!success ? (
            <>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">{isEn ? "New Password" : "رمز عبور جدید"}</label>
                  <div className="relative">
                    <LockKeyhole size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={isEn ? "At least 6 characters" : "حداقل ۶ کاراکتر"}
                      className="ui-input rounded-2xl py-4 pl-4 pr-11"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">{isEn ? "Confirm Password" : "تکرار رمز عبور"}</label>
                  <div className="relative">
                    <LockKeyhole size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={isEn ? "Confirm password" : "تکرار رمز عبور"}
                      className="ui-input rounded-2xl py-4 pl-4 pr-11"
                      onKeyDown={(e) => { if (e.key === "Enter") handleReset(); }}
                    />
                  </div>
                </div>
              </div>

              {message && (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-700">{message}</div>
              )}

              <button onClick={handleReset} disabled={loading} className="ui-btn ui-btn-primary mt-6 inline-flex w-full gap-2 rounded-2xl px-5 py-4">
                {loading ? (isEn ? "Changing..." : "در حال تغییر...") : (isEn ? "Change Password" : "تغییر رمز عبور")}
                <Arrow size={18} />
              </button>
            </>
          ) : (
            <div className="mt-6 rounded-2xl bg-emerald-50 p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">&#10004;</div>
              <p className="leading-8 text-emerald-800">{message}</p>
              <Link href="/customer-login" className="ui-btn ui-btn-primary mt-4 inline-flex gap-2 rounded-2xl px-6 py-3">
                {isEn ? "Log In" : "ورود به حساب"}
                <LogIn size={18} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
