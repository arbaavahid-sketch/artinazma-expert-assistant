"use client";

import Link from "next/link";
import { useState } from "react";
import { apiUrl, customerFetch } from "@/lib/api";
import {
  clearSavedCustomer,
  createCustomerSession,
  saveCustomer,
} from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
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
  const { locale, setLocale, dir } = useI18n();
  const isEn = locale === "en";
  const iconSide = isEn ? "left-4" : "right-4";
  const inputPadding = isEn ? "pl-11 pr-4" : "pl-4 pr-11";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage(isEn ? "Please enter your email and password." : "ایمیل و رمز عبور را وارد کنید.");
      return;
    }

    setLoading(true);

    try {
      const res = await customerFetch(apiUrl("/customers/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.message || (isEn ? "Login failed." : "ورود ناموفق بود."));
        return;
      }

      saveCustomer(data.customer);
      try {
        await createCustomerSession(data.customer.id);
      } catch (error) {
        clearSavedCustomer();
        throw error;
      }

      const params = new URLSearchParams(window.location.search);
      const requestedPath = params.get("next");
      const nextPath =
        requestedPath &&
        requestedPath.startsWith("/") &&
        !requestedPath.startsWith("//")
          ? requestedPath
          : "/assistant";

      // Full navigation ensures the newly created auth cookies are
      // available to the Next.js route protection immediately.
      window.location.assign(nextPath);
    } catch {
      setMessage(isEn ? "Server connection error." : "خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8" dir={dir}>
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl items-center justify-center">
        <div className="ui-card grid w-full overflow-hidden rounded-[40px] border-slate-200 shadow-sm lg:grid-cols-[1fr_430px]">
          <div className="p-8 lg:p-12">
            <div className="mb-6 flex justify-end">
              <div className="inline-flex rounded-2xl bg-slate-100 p-1 text-sm font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setLocale("fa")}
                  aria-pressed={locale === "fa"}
                  aria-label={isEn ? "Switch to Persian" : "تغییر به فارسی"}
                  title={isEn ? "Persian" : "فارسی"}
                  className={`min-w-14 rounded-xl px-3 py-2 text-lg leading-none transition-colors ${
                    locale === "fa"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "hover:bg-white/70 hover:text-slate-900"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="block h-5 w-8 overflow-hidden rounded-[5px] border border-slate-200 shadow-sm"
                    style={{
                      background:
                        "linear-gradient(to bottom, #239f40 0 33.33%, #ffffff 33.33% 66.66%, #da0000 66.66% 100%)",
                    }}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setLocale("en")}
                  aria-pressed={locale === "en"}
                  aria-label={isEn ? "Switch to English" : "تغییر به انگلیسی"}
                  title={isEn ? "English" : "انگلیسی"}
                  className={`min-w-14 rounded-xl px-3 py-2 text-lg leading-none transition-colors ${
                    locale === "en"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "hover:bg-white/70 hover:text-slate-900"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="block h-5 w-8 overflow-hidden rounded-[5px] border border-slate-200 shadow-sm"
                    style={{
                      background:
                        "linear-gradient(27deg, transparent 0 44%, #ffffff 44% 48%, #c8102e 48% 52%, #ffffff 52% 56%, transparent 56% 100%), linear-gradient(153deg, transparent 0 44%, #ffffff 44% 48%, #c8102e 48% 52%, #ffffff 52% 56%, transparent 56% 100%), linear-gradient(to right, transparent 0 38%, #ffffff 38% 44%, #c8102e 44% 56%, #ffffff 56% 62%, transparent 62% 100%), linear-gradient(to bottom, transparent 0 34%, #ffffff 34% 42%, #c8102e 42% 58%, #ffffff 58% 66%, transparent 66% 100%), #012169",
                    }}
                  />
                </button>
              </div>
            </div>

            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
              <LogIn size={17} />
              {isEn ? "Customer Login" : "ورود مشتری"}
            </div>

            <h1 className="text-3xl font-black leading-[1.5] text-slate-900 md:text-4xl">
              {isEn ? "Log in to your ArtinAzma account" : "ورود به حساب کاربری آرتین آزما"}
            </h1>

            <p className="mt-4 max-w-2xl leading-8 text-slate-600">
              {isEn
                ? "Sign in to use Artin, view previous conversations, submit consultation requests, and continue communication with experts."
                : "برای استفاده از آرتین، مشاهده گفتگوهای قبلی، ثبت درخواست مشاوره و ادامه ارتباط با کارشناسان، وارد حساب خود شوید."}
            </p>

            <div className="mt-8 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  {isEn ? "Email" : "ایمیل"}
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className={`absolute ${iconSide} top-1/2 -translate-y-1/2 text-slate-400`}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className={`ui-input rounded-2xl py-4 ${inputPadding}`}
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  {isEn ? "Password" : "رمز عبور"}
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
                    placeholder={isEn ? "Password" : "رمز عبور"}
                    className={`ui-input rounded-2xl py-4 ${inputPadding}`}
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
              className="ui-btn ui-btn-primary mt-6 inline-flex w-full gap-2 rounded-2xl px-5 py-4"
            >
              {loading ? (isEn ? "Signing in..." : "در حال ورود...") : (isEn ? "Log in" : "ورود به حساب کاربری")}
              <ArrowLeft size={18} />
            </button>

            <div className="mt-4 text-center">
              <Link
                href="/forgot-password"
                className="text-sm font-bold text-slate-500 hover:text-blue-700"
              >
                {isEn ? "Forgot your password?" : "رمز عبور را فراموش کرده‌اید؟"}
              </Link>
            </div>

            <div className="mt-4 text-center text-sm text-slate-600">
              {isEn ? "Don't have an account?" : "حساب کاربری ندارید؟"}{" "}
              <Link
                href="/customer-register"
                className="inline-flex items-center gap-1 font-bold text-blue-700"
              >
                {isEn ? "Register as customer" : "ثبت‌نام مشتری"}
                <UserPlus size={15} />
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-slate-50 p-8">
            <div className="ui-card w-full max-w-md rounded-[32px] p-6 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-[34px] bg-slate-50 p-3">
                <img
                  src="/images/artin-avatar.png"
                  alt="Artin"
                  className="h-full w-full rounded-full object-cover"
                />
              </div>

              <div className="text-xl font-black text-slate-900">
                {isEn ? "Artin, your technical assistant" : "آرتین، دستیار تخصصی شما"}
              </div>

              <p className="mt-3 leading-8 text-slate-600">
                {isEn
                  ? "For technical questions, test analysis, equipment, chemicals, catalysts, and ArtinAzma-related topics."
                  : "برای سوالات فنی، تحلیل تست، تجهیزات، مواد شیمیایی، کاتالیست‌ها و موضوعات مرتبط با آرتین آزما."}
              </p>

              <div className="mt-5 grid gap-3 text-start text-sm">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <ShieldCheck size={18} className="text-blue-700" />
                  {isEn ? "Your conversations are saved in your account." : "گفتگوهای شما در حسابتان ذخیره می‌شود."}
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <Sparkles size={18} className="text-blue-700" />
                  {isEn ? "Specialized answers based on Artin's knowledge base." : "پاسخ‌گویی تخصصی بر اساس بانک دانش آرتین."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
