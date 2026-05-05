import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Beaker,
  Bot,
  CheckCircle2,
  FlaskConical,
  MessageSquareText,
  Microscope,
  PhoneCall,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

const capabilities = [
  {
    title: "پاسخ‌گویی فنی تخصصی",
    description:
      "پاسخ به سوالات مرتبط با تجهیزات آزمایشگاهی، آنالیز دستگاهی، مواد شیمیایی، کاتالیست‌ها و روش‌های آزمون.",
    icon: MessageSquareText,
  },
  {
    title: "تحلیل تست و گزارش",
    description:
      "بررسی فایل‌های PDF، Excel، CSV، گزارش آزمایشگاهی، نمودار، کروماتوگرام و داده‌های QC.",
    icon: FlaskConical,
  },
  {
    title: "پیشنهاد دستگاه و روش آزمون",
    description:
      "راهنمایی برای انتخاب تجهیز، روش آنالیز، محدوده اندازه‌گیری، آماده‌سازی نمونه و کنترل کیفیت.",
    icon: Microscope,
  },
  {
    title: "عیب‌یابی تجهیزات",
    description:
      "تحلیل خطاها، نوسان baseline، مشکلات کالیبراسیون، آماده‌سازی نمونه، مصرفی‌ها و شرایط دستگاه.",
    icon: Wrench,
  },
];

const domains = [
  "GC / GC-MS / HPLC",
  "آنالیز جیوه و سولفور",
  "کاتالیست و جاذب‌ها",
  "مواد شیمیایی و افزودنی‌ها",
  "ASTM و روش‌های آزمون",
  "سوخت، LPG و گاز طبیعی",
];

export default function Home() {
  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[40px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-8 p-8 lg:grid-cols-[1fr_430px] lg:p-12">
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                <Sparkles size={17} />
                ArtinAzma Expert Assistant
              </div>

              <h1 className="max-w-4xl text-4xl font-black leading-[1.45] text-slate-900 md:text-5xl">
                آرتین؛ دستیار تخصصی و مشاور فنی آرتین آزما مهر
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-9 text-slate-600">
                آرتین برای پاسخ‌گویی به سوالات فنی، تحلیل تست‌ها، راهنمایی
                درباره تجهیزات آزمایشگاهی، مواد شیمیایی، کاتالیست‌ها، افزودنی‌ها
                و موضوعات مرتبط با صنایع نفت، گاز، پتروشیمی و آزمایشگاه‌های
                صنعتی طراحی شده است.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                {domains.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/assistant"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-6 py-4 text-center font-bold text-white shadow-sm transition hover:bg-blue-800"
                >
                  شروع گفتگو با آرتین
                  <ArrowLeft size={18} />
                </Link>

                <Link
                  href="/customer-request"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-center font-bold text-slate-800 transition hover:bg-slate-50"
                >
                  ثبت درخواست مشاوره
                  <PhoneCall size={18} />
                </Link>
              </div>
            </div>

            <div className="relative flex items-center justify-center rounded-[36px] bg-gradient-to-b from-blue-50 via-white to-slate-50 p-8">
              <div className="absolute right-8 top-8 rounded-2xl bg-white px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm">
                آماده پاسخ‌گویی تخصصی
              </div>

              <div className="text-center">
                <div className="mx-auto mb-5 flex h-48 w-48 items-center justify-center rounded-[44px] bg-white p-6 shadow-sm">
                  <Image
                    src="/images/artin-avatar.png"
                    alt="آرتین"
                    width={192}
                    height={192}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>

                <h2 className="text-2xl font-black text-slate-900">
                  من آرتین هستم
                </h2>

                <p className="mt-3 leading-8 text-slate-600">
                  دستیار تخصصی شما برای سوالات فنی، تحلیل تست، انتخاب تجهیزات و
                  ارتباط با کارشناسان آرتین آزما.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-white/90 px-3 py-2 shadow-sm">
                    <div className="text-xl font-black text-slate-900">24/7</div>
                    <div className="text-[11px] font-semibold text-slate-500">پاسخ‌گویی آنلاین</div>
                  </div>
                  <div className="rounded-xl bg-white/90 px-3 py-2 shadow-sm">
                    <div className="text-xl font-black text-slate-900">+200</div>
                    <div className="text-[11px] font-semibold text-slate-500">سناریوی فنی آماده</div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-right">
                  <div className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm font-bold text-slate-700 shadow-sm">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    پاسخ‌گویی بر اساس بانک دانش
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm font-bold text-slate-700 shadow-sm">
                    <ShieldCheck size={18} className="text-blue-600" />
                    مناسب مشتری و کارشناس فنی
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50 p-6 lg:p-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {capabilities.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                      <Icon size={24} strokeWidth={1.8} />
                    </div>

                    <div className="text-lg font-black text-slate-900">
                      {item.title}
                    </div>

                    <div className="mt-3 text-sm leading-7 text-slate-600">
                      {item.description}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <Link
                href="/assistant"
                className="group rounded-[28px] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                  <Bot size={24} strokeWidth={1.8} />
                </div>
                <div className="text-lg font-black text-slate-900">
                  گفتگو با آرتین
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-600">
                  سوال تخصصی بپرسید و پاسخ فنی دریافت کنید.
                </div>
              </Link>

              <Link
                href="/analyze"
                className="group rounded-[28px] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Beaker size={24} strokeWidth={1.8} />
                </div>
                <div className="text-lg font-black text-slate-900">
                  تحلیل تخصصی تست
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-600">
                  فایل Excel، CSV یا PDF را با انتخاب نوع تست تحلیل کنید.
                </div>
              </Link>

              <Link
                href="/customer-request"
                className="group rounded-[28px] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <Settings2 size={24} strokeWidth={1.8} />
                </div>
                <div className="text-lg font-black text-slate-900">
                  درخواست مشاوره
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-600">
                  درخواست بررسی فنی، استعلام قیمت یا تماس کارشناس ثبت کنید.
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}