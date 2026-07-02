"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type PrivacyConsentProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  context: "register" | "request";
};

export default function PrivacyConsent({ checked, onChange, context }: PrivacyConsentProps) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const id = `privacy-consent-${context}`;

  return (
    <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm leading-7 text-slate-700">
      <div className="flex items-start gap-3">
        <ShieldCheck size={20} className="mt-1 shrink-0 text-blue-700" />
        <div>
          <p className="font-bold">
            {isEn
              ? "Before submitting, review how your personal information is used."
              : "پیش از ارسال، نحوه استفاده از اطلاعات شخصی خود را مطالعه کنید."}
          </p>
          <p className="mt-1 text-slate-600">
            {context === "register"
              ? isEn
                ? "Registration may collect your name, company, phone number, email, password, and account activity for account creation, support, security, and request follow-up."
                : "در ثبت‌نام ممکن است نام، شرکت، شماره تماس، ایمیل، رمز عبور و فعالیت حساب شما برای ایجاد حساب، پشتیبانی، امنیت و پیگیری درخواست‌ها دریافت شود."
              : isEn
                ? "This request form collects your name, phone number, email, company, request type, subject, and request details so ArtinAzma experts can follow up."
                : "این فرم نام، شماره تماس، ایمیل، شرکت، نوع درخواست، موضوع و توضیحات شما را برای پیگیری کارشناسان آرتین آزما دریافت می‌کند."}
          </p>
          <label htmlFor={id} className="mt-3 flex cursor-pointer items-start gap-2 font-bold text-slate-800">
            <input
              id={id}
              type="checkbox"
              checked={checked}
              onChange={(event) => onChange(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 accent-blue-700"
            />
            <span>
              {isEn ? "I have read and accept the " : "متن "}
              <Link href="/privacy" className="text-blue-700 underline-offset-4 hover:underline">
                {isEn ? "Privacy Policy" : "سیاست حفظ حریم خصوصی"}
              </Link>
              {isEn ? "." : " را مطالعه کرده‌ام و می‌پذیرم."}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
