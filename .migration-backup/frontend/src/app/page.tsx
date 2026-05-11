import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  BarChart3,
  Beaker,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileText,
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

const userPaths = [
  {
    title: "برای مشتریان صنعتی",
    description: "ثبت درخواست، استعلام قیمت، انتخاب دستگاه و ارتباط با کارشناس.",
    icon: ClipboardList,
  },
  {
    title: "برای کارشناسان فنی",
    description: "تحلیل تست، عیب‌یابی، بررسی روش آزمون و آماده‌سازی پاسخ فنی.",
    icon: FileText,
  },
  {
    title: "برای مدیریت داخلی",
    description: "پایش سوالات، مدیریت بانک دانش و کنترل کیفیت پاسخ‌های آرتین.",
    icon: BarChart3,
  },
];

const heroHighlights = [
  {
    title: "پاسخ ساختاریافته",
    subtitle: "راهنمای مرحله‌به‌مرحله فنی",
  },
  {
    title: "تحلیل پرونده تست",
    subtitle: "مناسب فایل‌های آزمایشگاهی",
  },
];

export default function Home() {
  return (
    <section className="brand-shell-bg min-h-full px-5 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="brand-panel hero-grid-bg overflow-hidden rounded-[34px]">
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_430px] lg:p-10 xl:p-12">
            <div className="flex flex-col justify-center">
              <div className="brand-kicker mb-6">
                <Sparkles size={17} />
                ArtinAzma Expert Assistant
              </div>

              <h1 className="max-w-4xl text-[var(--font-size-display)] font-black leading-[1.45] tracking-[-0.03em] text-slate-950">
                دستیار تخصصی آرتین آزما برای تجهیزات آزمایشگاهی، مواد شیمیایی و تحلیل فنی
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-9 text-slate-600">
                آرتین برای پاسخ‌گویی تخصصی، تحلیل گزارش‌های آزمایشگاهی، پیشنهاد
                دستگاه، عیب‌یابی تجهیزات، بررسی کاتالیست‌ها و ثبت درخواست کارشناسی
                در صنایع نفت، گاز، پتروشیمی و آزمایشگاه‌های صنعتی طراحی شده است.
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <ul className="contents" aria-label="حوزه‌های تخصصی">
                  {domains.map((item) => (
                    <li
                      key={item}
                      className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-extrabold text-slate-700 shadow-sm"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/assistant"
                  className="ui-btn ui-btn-primary gap-2 rounded-2xl px-6 py-4 text-base"
                >
                  شروع گفتگو با آرتین
                  <ArrowLeft size={18} />
                </Link>

                <Link
                  href="/analyze"
                  className="ui-btn ui-btn-ghost gap-2 rounded-2xl px-6 py-4 text-base"
                >
                  تحلیل فایل تست
                  <Beaker size={18} />
                </Link>

                <Link
                  href="/customer-request"
                  className="ui-btn ui-btn-ghost gap-2 rounded-2xl px-6 py-4 text-base"
                >
                  ثبت درخواست مشاوره
                  <PhoneCall size={18} />
                </Link>
              </div>
            </div>

            <div className="relative flex items-center justify-center rounded-[30px] border border-blue-100 bg-gradient-to-b from-blue-50/80 via-white/95 to-slate-50 p-6 shadow-inner">
              <div className="absolute right-6 top-6 rounded-2xl border border-emerald-100 bg-white/95 px-4 py-2 text-xs font-black text-emerald-700 shadow-sm">
                آماده پاسخ‌گویی تخصصی
              </div>

              <div className="w-full text-center">
                <div className="mx-auto mb-5 flex h-48 w-48 items-center justify-center rounded-[38px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/70">
                  <Image
                    src="/images/artin-avatar.png"
                    alt="آرتین"
                    width={192}
                    height={192}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>

                <h2 className="text-2xl font-black text-slate-950">
                  من آرتین هستم
                </h2>

                <p className="mx-auto mt-3 max-w-sm leading-8 text-slate-600">
                  دستیار تخصصی شما برای سوالات فنی، تحلیل تست، انتخاب تجهیزات و
                  ارتباط با کارشناسان آرتین آزما.
                </p>

                <div className="mt-5 grid grid-cols-1 gap-2 text-center sm:grid-cols-2">
                  {heroHighlights.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 shadow-sm"
                    >
                      <div className="text-sm font-black text-slate-950 sm:text-base">
                        {item.title}
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-slate-500 sm:text-xs">
                        {item.subtitle}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-2xl border border-slate-100 bg-white/95 px-3 py-3 shadow-sm">
                    <div className="text-2xl font-black text-slate-950">24/7</div>
                    <div className="text-[11px] font-bold text-slate-500">
                      پاسخ‌گویی آنلاین
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white/95 px-3 py-3 shadow-sm">
                    <div className="text-2xl font-black text-slate-950">+200</div>
                    <div className="text-[11px] font-bold text-slate-500">
                      سناریوی فنی آماده
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-right">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-sm font-extrabold text-slate-700 shadow-sm">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    پاسخ‌گویی بر اساس بانک دانش
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-sm font-extrabold text-slate-700 shadow-sm">
                    <ShieldCheck size={18} className="text-blue-600" />
                    مناسب مشتری و کارشناس فنی
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-white/72 p-6 md:p-8">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">مسیرهای اصلی استفاده</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  کاربر از همان صفحه اول متوجه می‌شود آرتین برای چه کاری مناسب است.
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {userPaths.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="brand-card rounded-[26px] p-5"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                      <Icon size={24} strokeWidth={1.8} />
                    </div>
                    <div className="text-lg font-black text-slate-950">{item.title}</div>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {capabilities.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="brand-card rounded-[26px] p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-blue-700">
                  <Icon size={24} strokeWidth={1.8} />
                </div>
                <div className="text-lg font-black text-slate-950">{item.title}</div>
                <div className="mt-3 text-sm leading-7 text-slate-600">{item.description}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Link href="/assistant" className="brand-card group rounded-[26px] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
              <Bot size={24} strokeWidth={1.8} />
            </div>
            <div className="text-lg font-black text-slate-950">گفتگو با آرتین</div>
            <div className="mt-2 text-sm leading-7 text-slate-600">
              سوال تخصصی بپرسید و پاسخ فنی دریافت کنید.
            </div>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-700 transition group-hover:gap-3">
              ورود به گفتگو
              <ArrowLeft size={16} />
            </div>
          </Link>

          <Link href="/analyze" className="brand-card group rounded-[26px] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Beaker size={24} strokeWidth={1.8} />
            </div>
            <div className="text-lg font-black text-slate-950">تحلیل تخصصی تست</div>
            <div className="mt-2 text-sm leading-7 text-slate-600">
              فایل Excel، CSV یا PDF را با انتخاب نوع تست تحلیل کنید.
            </div>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-700 transition group-hover:gap-3">
              شروع تحلیل
              <ArrowLeft size={16} />
            </div>
          </Link>

          <Link href="/customer-request" className="brand-card group rounded-[26px] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Settings2 size={24} strokeWidth={1.8} />
            </div>
            <div className="text-lg font-black text-slate-950">درخواست مشاوره</div>
            <div className="mt-2 text-sm leading-7 text-slate-600">
              درخواست بررسی فنی، استعلام قیمت یا تماس کارشناس ثبت کنید.
            </div>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-amber-700 transition group-hover:gap-3">
              ثبت درخواست
              <ArrowLeft size={16} />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
