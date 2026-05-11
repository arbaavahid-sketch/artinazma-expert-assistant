import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Mail,
  MessageSquareText,
  Phone,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const requestTypes = [
  { value: "consultation", label: "مشاوره فنی" },
  { value: "equipment", label: "انتخاب یا خرید تجهیزات" },
  { value: "chemical", label: "مواد شیمیایی / افزودنی‌ها" },
  { value: "catalyst", label: "کاتالیست / جاذب / مواد فرایندی" },
  { value: "test-analysis", label: "تحلیل تست، گزارش یا داده آزمایشگاهی" },
  { value: "troubleshooting", label: "عیب‌یابی دستگاه یا روش آزمون" },
  { value: "price-inquiry", label: "استعلام قیمت یا موجودی" },
];

const requestBenefits = [
  "بررسی اولیه توسط کارشناس فنی",
  "ثبت منظم اطلاعات برای پیگیری بعدی",
  "مناسب انتخاب دستگاه، مواد، کاتالیست و تحلیل تست",
];

const usefulInfo = [
  "نوع نمونه یا فرایند",
  "محدوده اندازه‌گیری یا حساسیت موردنیاز",
  "مدل دستگاه، برند یا روش آزمون",
  "مشکل، خطا یا هدف نهایی از تست",
];

type SavedCustomer = { id: number; full_name?: string; email?: string; company?: string; phone?: string; };

function getRequestTypeLabel(value: string) {
  return requestTypes.find((item) => item.value === value)?.label || "مشاوره فنی";
}

export default function CustomerRequestPage() {
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
      setResultMessage("لطفاً نام، شماره تماس و توضیحات درخواست را وارد کنید.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/customer-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, company, phone, email, request_type: requestType, subject: subject || getRequestTypeLabel(requestType), message }),
      });
      const data = await res.json();
      if (data.success) {
        setResultType("success");
        setResultMessage(data.message || "درخواست شما با موفقیت ثبت شد. کارشناسان آرتین آزما در اولین فرصت پیگیری خواهند کرد.");
        setRequestType("consultation");
        setSubject("");
        setMessage("");
      } else {
        setResultType("error");
        setResultMessage(data.message || "خطا در ثبت درخواست.");
      }
    } catch {
      setResultType("error");
      setResultMessage("خطا در اتصال به سرور. لطفاً دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-screen bg-[#f7f7f8] px-5 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-blue-50 via-white to-slate-50 p-6 md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_390px] lg:items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                  <ClipboardList size={17} />
                  ارتباط با کارشناس آرتین آزما
                </div>
                <h1 className="text-3xl font-black leading-[1.55] text-slate-900 md:text-4xl">
                  ثبت درخواست مشاوره یا پیگیری تخصصی
                </h1>
                <p className="mt-4 max-w-4xl leading-8 text-slate-600">
                  اگر برای انتخاب دستگاه، مواد شیمیایی، کاتالیست، تحلیل تست، عیب‌یابی یا استعلام قیمت نیاز به بررسی دقیق‌تر دارید، اطلاعات درخواست را ثبت کنید.
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {requestBenefits.map((item) => (
                    <span key={item} className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm">
                      <CheckCircle2 size={15} className="text-emerald-600" />{item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-500"><Mail size={17} />ایمیل رسمی شرکت</div>
                  <div className="font-black text-slate-900">info@artinazma.net</div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-500"><Clock3 size={17} />مسیر پیگیری</div>
                  <div className="font-black text-slate-900">ثبت درخواست، بررسی فنی، تماس کارشناس</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
                <MessageSquareText size={24} strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">فرم درخواست</h2>
                <p className="mt-1 text-sm text-slate-500">موارد ستاره‌دار برای ثبت درخواست الزامی هستند.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">نام و نام خانوادگی *</label>
                <div className="relative">
                  <UserRound size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="ui-input py-4 pl-4 pr-11" placeholder="نام کامل" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">شرکت / سازمان</label>
                <div className="relative">
                  <Building2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={company} onChange={(e) => setCompany(e.target.value)} className="ui-input py-4 pl-4 pr-11" placeholder="نام شرکت" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">شماره تماس *</label>
                <div className="relative">
                  <Phone size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="ui-input py-4 pl-4 pr-11" placeholder="شماره موبایل یا تلفن" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">ایمیل</label>
                <div className="relative">
                  <Mail size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="ui-input py-4 pl-4 pr-11" placeholder="email@example.com" />
                </div>
              </div>
            </div>

            <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">نوع درخواست</label>
            <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none transition focus:border-blue-600">
              {requestTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>

            <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">موضوع درخواست</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="ui-input p-4" placeholder="مثلاً: انتخاب دستگاه برای آنالیز سولفور در LPG" />

            <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">توضیحات درخواست *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="h-44 w-full resize-none rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-8 outline-none transition focus:border-blue-600"
              placeholder="نوع نمونه، کاربرد، مشکل، مدل دستگاه، محدوده اندازه‌گیری..."
            />

            <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              نوع درخواست: <span className="font-black text-blue-700">{getRequestTypeLabel(requestType)}</span>
            </div>

            <button onClick={submitRequest} disabled={loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-4 font-bold text-white hover:bg-blue-800 disabled:opacity-50">
              <Send size={18} />{loading ? "در حال ثبت درخواست..." : "ثبت درخواست و ارسال برای پیگیری"}
            </button>

            {resultMessage && (
              <div className={`mt-5 flex items-start gap-2 rounded-2xl p-4 leading-8 text-sm ${resultType === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {resultType === "success" && <CheckCircle2 className="mt-1 shrink-0" size={18} />}
                <span>{resultMessage}</span>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[30px] border border-blue-100 bg-blue-50 p-6 text-blue-900">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
                <BadgeCheck size={22} />
              </div>
              <div className="mb-3 text-lg font-black">چه زمانی درخواست ثبت کنم؟</div>
              <p className="text-sm leading-8">
                وقتی نیاز به پیشنهاد دقیق دستگاه، انتخاب ماده یا کاتالیست، بررسی گزارش تست، عیب‌یابی دستگاه، استعلام قیمت یا پیگیری کارشناسی دارید.
              </p>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck size={21} />
                </div>
                <div className="text-lg font-black text-slate-900">اطلاعات مفید برای کارشناس</div>
              </div>
              <div className="space-y-3 text-sm leading-7 text-slate-600">
                {usefulInfo.map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />{item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 text-lg font-black text-slate-900">راه ارتباط مستقیم</div>
              <div className="space-y-3 text-sm leading-7 text-slate-600">
                <div className="rounded-2xl bg-slate-50 p-3"><span className="font-black text-slate-900">تلفن:</span> 02191008898</div>
                <div className="rounded-2xl bg-slate-50 p-3"><span className="font-black text-slate-900">واتساپ:</span> 09906060910</div>
                <div className="rounded-2xl bg-slate-50 p-3"><span className="font-black text-slate-900">ایمیل:</span> info@artinazma.net</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
