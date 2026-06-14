"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { apiUrl, customerFetch } from "@/lib/api";
import {
  clearSavedCustomer,
  createCustomerSession,
  saveCustomer,
} from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
import {
  ArrowLeft,
  Building2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  LogIn,
} from "lucide-react";

export default function CustomerRegisterPage() {
  const router = useRouter();
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const iconSide = isEn ? "left-4" : "right-4";
  const inputPadding = isEn ? "pl-11 pr-4" : "pl-4 pr-11";

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
      setMessage(isEn ? "Name, email, and password are required." : "نام، ایمیل و رمز عبور الزامی است.");
      return;
    }

    if (password.length < 6) {
      setMessage(isEn ? "Password must be at least 6 characters." : "رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    setLoading(true);

    try {
      const res = await customerFetch(apiUrl("/customers/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, company, phone, email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.message || (isEn ? "Registration failed." : "ثبت‌نام انجام نشد."));
        return;
      }

      saveCustomer(data.customer);
      try {
        await createCustomerSession(data.customer.id);
      } catch (error) {
        clearSavedCustomer();
        throw error;
      }

      router.replace("/assistant");
      router.refresh();
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
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
              <UserPlus size={17} />
              {isEn ? "Customer Registration" : "ثبت‌نام مشتری"}
            </div>

            <h1 className="text-3xl font-black leading-[1.5] text-slate-900 md:text-4xl">
              {isEn ? "Create a customer account" : "ساخت حساب کاربری مشتری"}
            </h1>

            <p className="mt-4 max-w-2xl leading-8 text-slate-600">
              {isEn
                ? "Create an account to save your Artin conversations and review previous questions, requests, and follow-up paths later."
                : "با ساخت حساب، گفتگوهای شما با آرتین ذخیره می‌شود و می‌توانید سوالات قبلی، درخواست‌ها و مسیر پیگیری خود را بعداً مشاهده کنید."}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Field
                label={isEn ? "Full name *" : "نام و نام خانوادگی *"}
                icon={<UserRound size={18} />}
                iconSide={iconSide}
              >
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={isEn ? "Full name" : "نام کامل"} className={`ui-input rounded-2xl py-4 ${inputPadding}`} />
              </Field>

              <Field
                label={isEn ? "Company / Organization" : "شرکت / سازمان"}
                icon={<Building2 size={18} />}
                iconSide={iconSide}
              >
                <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={isEn ? "Company name" : "نام شرکت"} className={`ui-input rounded-2xl py-4 ${inputPadding}`} />
              </Field>

              <Field label={isEn ? "Phone" : "شماره تماس"} icon={<Phone size={18} />} iconSide={iconSide}>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={isEn ? "Mobile or phone number" : "شماره موبایل یا تلفن"} className={`ui-input rounded-2xl py-4 ${inputPadding}`} dir="ltr" />
              </Field>

              <Field label={isEn ? "Email *" : "ایمیل *"} icon={<Mail size={18} />} iconSide={iconSide}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className={`ui-input rounded-2xl py-4 ${inputPadding}`} dir="ltr" />
              </Field>

              <div className="md:col-span-2">
                <Field label={isEn ? "Password *" : "رمز عبور *"} icon={<LockKeyhole size={18} />} iconSide={iconSide}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEn ? "At least 6 characters" : "حداقل ۶ کاراکتر"}
                    className={`ui-input rounded-2xl py-4 ${inputPadding}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") register();
                    }}
                  />
                </Field>
              </div>
            </div>

            {message && (
              <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-700">
                {message}
              </div>
            )}

            <button onClick={register} disabled={loading} className="ui-btn ui-btn-primary mt-6 inline-flex w-full gap-2 rounded-2xl px-5 py-4">
              {loading ? (isEn ? "Registering..." : "در حال ثبت‌نام...") : (isEn ? "Register and log in" : "ثبت‌نام و ورود")}
              <ArrowLeft size={18} />
            </button>

            <div className="mt-6 text-center text-sm text-slate-600">
              {isEn ? "Already registered?" : "قبلاً ثبت‌نام کرده‌اید؟"}{" "}
              <Link href="/customer-login" className="inline-flex items-center gap-1 font-bold text-blue-700">
                {isEn ? "Customer login" : "ورود مشتری"}
                <LogIn size={15} />
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-slate-50 p-8">
            <div className="ui-card w-full max-w-md rounded-[32px] p-6 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-[34px] bg-slate-50 p-3">
                <img src="/images/artin-avatar.png" alt={isEn ? "Artin" : "آرتین"} className="h-full w-full rounded-full object-cover" />
              </div>

              <div className="text-xl font-black text-slate-900">
                {isEn ? "Artin, your technical assistant" : "آرتین، دستیار تخصصی شما"}
              </div>

              <p className="mt-3 leading-8 text-slate-600">
                {isEn
                  ? "Your account keeps conversations, analyses, and technical requests organized and easy to follow."
                  : "حساب کاربری شما کمک می‌کند گفتگوها، تحلیل‌ها و درخواست‌های فنی مرتب و قابل پیگیری بمانند."}
              </p>

              <div className="mt-5 grid gap-3 text-start text-sm">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <ShieldCheck size={18} className="text-blue-700" />
                  {isEn ? "Access saved conversations" : "دسترسی به گفتگوهای ذخیره‌شده"}
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <Sparkles size={18} className="text-blue-700" />
                  {isEn ? "Better follow-up for technical requests" : "پیگیری بهتر درخواست‌های فنی"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  icon,
  iconSide,
  children,
}: {
  label: string;
  icon: ReactNode;
  iconSide: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <div className="relative">
        <span className={`absolute ${iconSide} top-1/2 -translate-y-1/2 text-slate-400`}>{icon}</span>
        {children}
      </div>
    </div>
  );
}
