"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Mail,
  MessageSquareText,
  Phone,
  Send,
  UserRound,
} from "lucide-react";

const requestTypes = [
  { value: "consultation", fa: "مشاوره فنی", en: "Technical consultation" },
  { value: "equipment", fa: "انتخاب یا خرید تجهیزات", en: "Equipment selection or purchase" },
  { value: "chemical", fa: "مواد شیمیایی / افزودنی‌ها", en: "Chemicals / additives" },
  { value: "catalyst", fa: "کاتالیست / جاذب / مواد فرایندی", en: "Catalyst / adsorbent / process material" },
  { value: "test-analysis", fa: "تحلیل تست، گزارش یا داده آزمایشگاهی", en: "Test, report, or lab data analysis" },
  { value: "troubleshooting", fa: "عیب‌یابی دستگاه یا روش آزمون", en: "Instrument or test method troubleshooting" },
  { value: "price-inquiry", fa: "استعلام قیمت یا موجودی", en: "Price or availability inquiry" },
];

type SavedCustomer = {
  id: number;
  full_name?: string;
  email?: string;
  company?: string;
  phone?: string;
};

export default function CustomerRequestPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const iconSide = isEn ? "left-4" : "right-4";
  const inputPadding = isEn ? "pl-11 pr-4" : "pl-4 pr-11";
  const typeLabel = (value: string) =>
    requestTypes.find((item) => item.value === value)?.[locale] ||
    (isEn ? "Technical consultation" : "مشاوره فنی");

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState("consultation");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [resultType, setResultType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("artin_customer");
      if (!raw) return;
      const customer = JSON.parse(raw) as SavedCustomer;
      setFullName(customer.full_name || "");
      setEmail(customer.email || "");
      setCompany(customer.company || "");
      setPhone(customer.phone || "");
    } catch {}
  }, []);

  async function submitRequest() {
    setResultMessage("");
    setResultType("");

    if (!fullName.trim() || !phone.trim() || !message.trim()) {
      setResultType("error");
      setResultMessage(isEn ? "Please enter your name, phone number, and request details." : "لطفاً نام، شماره تماس و توضیحات درخواست را وارد کنید.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(apiUrl("/customer-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          company,
          phone,
          email,
          request_type: requestType,
          subject: subject || typeLabel(requestType),
          message,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResultType("success");
        setResultMessage(data.message || (isEn ? "Your request was submitted successfully. ArtinAzma experts will follow up soon." : "درخواست شما با موفقیت ثبت شد. کارشناسان آرتین آزما در اولین فرصت پیگیری خواهند کرد."));
        setRequestType("consultation");
        setSubject("");
        setMessage("");
      } else {
        setResultType("error");
        setResultMessage(data.message || (isEn ? "Error submitting request." : "خطا در ثبت درخواست."));
      }
    } catch {
      setResultType("error");
      setResultMessage(isEn ? "Server connection error. Please try again." : "خطا در اتصال به سرور. لطفاً دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  const benefits = isEn
    ? ["Initial review by a technical expert", "Structured information for follow-up", "Suitable for equipment, materials, catalysts, and test analysis"]
    : ["بررسی اولیه توسط کارشناس فنی", "ثبت منظم اطلاعات برای پیگیری بعدی", "مناسب انتخاب دستگاه، مواد، کاتالیست و تحلیل تست"];

  const usefulInfo = isEn
    ? ["Sample or process type", "Required range or sensitivity", "Instrument model, brand, or test method", "Issue, error, or final test goal"]
    : ["نوع نمونه یا فرایند", "محدوده اندازه‌گیری یا حساسیت موردنیاز", "مدل دستگاه، برند یا روش آزمون", "مشکل، خطا یا هدف نهایی از تست"];

  return (
    <section className="brand-shell-bg min-h-full px-5 py-6 md:px-8 md:py-8" dir={dir}>
      <div className="mx-auto max-w-7xl">
        <div className="brand-panel hero-grid-bg mb-6 overflow-hidden rounded-[34px]">
          <div className="bg-gradient-to-l from-blue-50/85 via-white/80 to-slate-50/70 p-6 md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_390px] lg:items-center">
              <div>
                <div className="brand-kicker mb-4">
                  <ClipboardList size={17} />
                  {isEn ? "Contact an ArtinAzma expert" : "ارتباط با کارشناس آرتین آزما"}
                </div>

                <h1 className="text-3xl font-black leading-[1.55] text-slate-950 md:text-4xl">
                  {isEn ? "Submit a consultation or follow-up request" : "ثبت درخواست مشاوره یا پیگیری تخصصی"}
                </h1>

                <p className="mt-4 max-w-4xl leading-8 text-slate-600">
                  {isEn
                    ? "If you need a more precise review for equipment selection, chemicals, catalysts, test analysis, troubleshooting, or price inquiry, submit your request so ArtinAzma experts can follow up accurately."
                    : "اگر برای انتخاب دستگاه، مواد شیمیایی، کاتالیست، تحلیل تست، عیب‌یابی یا استعلام قیمت نیاز به بررسی دقیق‌تر دارید، اطلاعات درخواست را ثبت کنید تا کارشناسان آرتین آزما مسیر پیگیری را دقیق‌تر شروع کنند."}
                </p>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  {benefits.map((item) => (
                    <span key={item} className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-4 py-2 text-xs font-black text-slate-700 shadow-sm">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <InfoTile icon={<Mail size={17} />} label={isEn ? "Official company email" : "ایمیل رسمی شرکت"} value="info@artinazma.net" />
                <InfoTile icon={<Clock3 size={17} />} label={isEn ? "Follow-up path" : "مسیر پیگیری"} value={isEn ? "Submit request, technical review, expert contact" : "ثبت درخواست، بررسی فنی، تماس کارشناس"} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="brand-card rounded-[30px] p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
                <MessageSquareText size={24} strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">{isEn ? "Request form" : "فرم درخواست"}</h2>
                <p className="mt-1 text-sm text-slate-500">{isEn ? "Starred fields are required." : "موارد ستاره‌دار برای ثبت درخواست الزامی هستند."}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label={isEn ? "Full name *" : "نام و نام خانوادگی *"} icon={<UserRound size={18} />} iconSide={iconSide}>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={`ui-input rounded-2xl py-4 ${inputPadding}`} placeholder={isEn ? "Full name" : "نام کامل"} />
              </Field>
              <Field label={isEn ? "Company / Organization" : "شرکت / سازمان"} icon={<Building2 size={18} />} iconSide={iconSide}>
                <input value={company} onChange={(e) => setCompany(e.target.value)} className={`ui-input rounded-2xl py-4 ${inputPadding}`} placeholder={isEn ? "Company name" : "نام شرکت"} />
              </Field>
              <Field label={isEn ? "Phone *" : "شماره تماس *"} icon={<Phone size={18} />} iconSide={iconSide}>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`ui-input rounded-2xl py-4 ${inputPadding}`} placeholder={isEn ? "Mobile or phone number" : "شماره موبایل یا تلفن"} dir="ltr" />
              </Field>
              <Field label={isEn ? "Email" : "ایمیل"} icon={<Mail size={18} />} iconSide={iconSide}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`ui-input rounded-2xl py-4 ${inputPadding}`} placeholder="email@example.com" dir="ltr" />
              </Field>
            </div>

            <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">{isEn ? "Request type" : "نوع درخواست"}</label>
            <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className="ui-select rounded-2xl p-4">
              {requestTypes.map((type) => (
                <option key={type.value} value={type.value}>{type[locale]}</option>
              ))}
            </select>

            <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">{isEn ? "Request subject" : "موضوع درخواست"}</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="ui-input rounded-2xl p-4" placeholder={isEn ? "Example: Selecting an instrument for sulfur analysis in LPG" : "مثلاً: انتخاب دستگاه برای آنالیز سولفور در LPG"} />

            <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">{isEn ? "Request details *" : "توضیحات درخواست *"}</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="ui-textarea h-40 rounded-2xl p-4 leading-8" placeholder={isEn ? "Enter sample type, application, issue, device model, measurement range, test file details, or any important technical information..." : "نوع نمونه، کاربرد، مشکل، مدل دستگاه، محدوده اندازه‌گیری، فایل تست یا هر اطلاعات فنی مهم را وارد کنید..."} />

            <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-slate-600">
              {isEn ? "Selected request type:" : "نوع درخواست انتخاب‌شده:"} <span className="font-black text-blue-700">{typeLabel(requestType)}</span>
            </div>

            {resultMessage && (
              <div className={`mt-5 rounded-2xl p-4 text-sm leading-7 ${resultType === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {resultMessage}
              </div>
            )}

            <button onClick={submitRequest} disabled={loading} className="ui-btn ui-btn-primary mt-6 inline-flex w-full justify-center gap-2 rounded-2xl px-5 py-4">
              <Send size={18} />
              {loading ? (isEn ? "Submitting request..." : "در حال ثبت درخواست...") : (isEn ? "Submit request for follow-up" : "ثبت درخواست و ارسال برای پیگیری")}
            </button>
          </div>

          <aside className="space-y-5">
            <div className="brand-card rounded-[30px] p-6">
              <h2 className="text-xl font-black text-slate-950">{isEn ? "When should I submit a request?" : "چه زمانی درخواست ثبت کنم؟"}</h2>
              <p className="mt-3 leading-8 text-slate-600">
                {isEn
                  ? "When you need precise equipment suggestions, material or catalyst selection, test report review, troubleshooting, price inquiry, or expert follow-up."
                  : "وقتی نیاز به پیشنهاد دقیق دستگاه، انتخاب ماده یا کاتالیست، بررسی گزارش تست، عیب‌یابی دستگاه، استعلام قیمت یا پیگیری کارشناسی دارید."}
              </p>
            </div>
            <div className="brand-card rounded-[30px] p-6">
              <h2 className="text-lg font-black text-slate-950">{isEn ? "Useful information for the expert" : "اطلاعات مفید برای کارشناس"}</h2>
              <ul className="mt-4 space-y-3 text-sm font-bold text-slate-600">
                {usefulInfo.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="brand-card rounded-[30px] p-6">
              <h2 className="text-lg font-black text-slate-950">{isEn ? "Direct contact" : "راه ارتباط مستقیم"}</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div><span className="font-black text-slate-950">{isEn ? "Phone:" : "تلفن:"}</span> 02191008898</div>
                <div><span className="font-black text-slate-950">{isEn ? "WhatsApp:" : "واتساپ:"}</span> 09906060910</div>
                <div><span className="font-black text-slate-950">{isEn ? "Email:" : "ایمیل:"}</span> info@artinazma.net</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Field({ label, icon, iconSide, children }: { label: string; icon: ReactNode; iconSide: string; children: ReactNode }) {
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

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/80 bg-white/95 p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-500">{icon}{label}</div>
      <div className="font-black text-slate-950">{value}</div>
    </div>
  );
}
