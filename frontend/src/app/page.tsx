import Link from "next/link";
import LiveStats from "@/components/LiveStats";
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
  ChevronLeft,
  Zap,
  BookOpen,
  Users,
} from "lucide-react";

const capabilities = [
  {
    title: "پاسخ‌گویی فنی تخصصی",
    description:
      "پاسخ به سوالات مرتبط با تجهیزات آزمایشگاهی، آنالیز دستگاهی، مواد شیمیایی، کاتالیست‌ها و روش‌های آزمون.",
    icon: MessageSquareText,
    color: "bg-blue-50 text-blue-700",
  },
  {
    title: "تحلیل تست و گزارش",
    description:
      "بررسی فایل‌های PDF، Excel، CSV، گزارش آزمایشگاهی، نمودار، کروماتوگرام و داده‌های QC.",
    icon: FlaskConical,
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "پیشنهاد دستگاه و روش آزمون",
    description:
      "راهنمایی برای انتخاب تجهیز، روش آنالیز، محدوده اندازه‌گیری، آماده‌سازی نمونه و کنترل کیفیت.",
    icon: Microscope,
    color: "bg-purple-50 text-purple-700",
  },
  {
    title: "عیب‌یابی تجهیزات",
    description:
      "تحلیل خطاها، نوسان baseline، مشکلات کالیبراسیون، آماده‌سازی نمونه، مصرفی‌ها و شرایط دستگاه.",
    icon: Wrench,
    color: "bg-amber-50 text-amber-700",
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

const brands = [
  "CHROMATEC",
  "SPECTRON",
  "LUMEX",
  "TERMEX",
  "NXA",
  "HACH",
  "METTLER TOLEDO",
];

const howItWorks = [
  {
    step: "۱",
    title: "سوال بپرسید",
    desc: "سوال فنی، درخواست مقایسه، عیب‌یابی یا تحلیل فایل خود را مطرح کنید.",
    icon: MessageSquareText,
  },
  {
    step: "۲",
    title: "آرتین تحلیل می‌کند",
    desc: "آرتین بانک دانش تخصصی، استانداردها و منابع فنی را بررسی می‌کند.",
    icon: BookOpen,
  },
  {
    step: "۳",
    title: "پاسخ تخصصی دریافت کنید",
    desc: "پاسخ کامل، مرحله‌به‌مرحله، با منابع معتبر و قابل استناد.",
    icon: Zap,
  },
];

const userPaths = [
  {
    title: "برای مشتریان صنعتی",
    description: "ثبت درخواست، استعلام قیمت، انتخاب دستگاه و ارتباط با کارشناس.",
    icon: ClipboardList,
    href: "/customer-register",
    cta: "ثبت‌نام مشتری",
    color: "text-blue-700 bg-blue-50",
  },
  {
    title: "برای کارشناسان فنی",
    description: "تحلیل تست، عیب‌یابی، بررسی روش آزمون و آماده‌سازی پاسخ فنی.",
    icon: FileText,
    href: "/assistant",
    cta: "شروع گفتگو",
    color: "text-emerald-700 bg-emerald-50",
  },
  {
    title: "برای مدیریت داخلی",
    description: "پایش سوالات، مدیریت بانک دانش و کنترل کیفیت پاسخ‌های آرتین.",
    icon: BarChart3,
    href: "/admin",
    cta: "پنل ادمین",
    color: "text-purple-700 bg-purple-50",
  },
];

export default function Home() {
  return (
    <section className="brand-shell-bg min-h-full px-5 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ── Hero ── */}
        <div className="brand-panel hero-grid-bg overflow-hidden rounded-[34px]">
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_420px] lg:p-10 xl:p-12">
            <div className="flex flex-col justify-center">
              <div className="brand-kicker mb-6">
                <Sparkles size={17} />
                ArtinAzma Expert Assistant
              </div>

              <h1 className="max-w-4xl text-[var(--font-size-display)] font-black leading-[1.45] tracking-[-0.03em] text-slate-950">
                دستیار تخصصی آرتین آزما
                <span className="block text-blue-700">برای صنایع نفت، گاز و پتروشیمی</span>
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-9 text-slate-600">
                آرتین برای پاسخ‌گویی تخصصی، تحلیل گزارش‌های آزمایشگاهی، پیشنهاد
                دستگاه، عیب‌یابی تجهیزات و بررسی کاتالیست‌ها در صنایع نفت، گاز و
                پتروشیمی طراحی شده است.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {domains.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-extrabold text-slate-700 shadow-sm"
                  >
                    {item}
                  </span>
                ))}
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
                  ثبت درخواست
                  <PhoneCall size={18} />
                </Link>
              </div>
            </div>

            {/* Avatar card */}
            <div className="relative flex items-center justify-center rounded-[30px] border border-blue-100 bg-gradient-to-b from-blue-50/80 via-white/95 to-slate-50 p-6 shadow-inner">
              <div className="absolute right-5 top-5 rounded-2xl border border-emerald-100 bg-white/95 px-3 py-1.5 text-xs font-black text-emerald-700 shadow-sm">
                آماده پاسخ‌گویی تخصصی
              </div>

              <div className="w-full text-center">
                <div className="mx-auto mb-4 flex h-40 w-40 items-center justify-center rounded-[34px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/70">
                  <Image
                    src="/images/artin-avatar.png"
                    alt="آرتین"
                    width={160}
                    height={160}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>

                <h2 className="text-2xl font-black text-slate-950">من آرتین هستم</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-slate-600">
                  دستیار تخصصی شما برای سوالات فنی، تحلیل تست و انتخاب تجهیزات.
                </p>

                {/* Stats — live data from API */}
                <LiveStats />

                <div className="mt-4 grid gap-2 text-right">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-2.5 text-sm font-extrabold text-slate-700 shadow-sm">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    پاسخ بر اساس بانک دانش تخصصی
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-2.5 text-sm font-extrabold text-slate-700 shadow-sm">
                    <ShieldCheck size={16} className="shrink-0 text-blue-600" />
                    مناسب مشتری و کارشناس فنی
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Brands ── */}
        <div className="brand-card rounded-[26px] px-6 py-5">
          <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
            برندهای تخصصی آرتین آزما مهر
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {brands.map((b) => (
              <span
                key={b}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-600 shadow-sm"
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="brand-panel overflow-hidden rounded-[30px] p-6 md:p-8">
          <div className="mb-6 text-center">
            <div className="brand-kicker mx-auto mb-3 w-fit">
              <Zap size={15} />
              نحوه استفاده
            </div>
            <h2 className="text-2xl font-black text-slate-950">در ۳ مرحله ساده</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {howItWorks.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="relative flex gap-4 rounded-[22px] border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow">
                    {step.step}
                  </div>
                  <div>
                    <div className="font-black text-slate-900">{step.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{step.desc}</p>
                  </div>
                  {i < howItWorks.length - 1 && (
                    <ChevronLeft
                      size={20}
                      className="absolute -left-3 top-1/2 hidden -translate-y-1/2 text-slate-300 md:block"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Capabilities ── */}
        <div>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-black text-slate-950">قابلیت‌های آرتین</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="brand-card rounded-[26px] p-6">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
                    <Icon size={24} strokeWidth={1.8} />
                  </div>
                  <div className="text-lg font-black text-slate-950">{item.title}</div>
                  <div className="mt-3 text-sm leading-7 text-slate-600">{item.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── User paths ── */}
        <div className="brand-panel overflow-hidden rounded-[30px] p-6 md:p-8">
          <div className="mb-6">
            <div className="brand-kicker mb-3 w-fit">
              <Users size={15} />
              مسیرهای استفاده
            </div>
            <h2 className="text-2xl font-black text-slate-950">برای چه کسانی مناسب است؟</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {userPaths.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="brand-card flex flex-col rounded-[26px] p-5">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
                    <Icon size={24} strokeWidth={1.8} />
                  </div>
                  <div className="text-lg font-black text-slate-950">{item.title}</div>
                  <p className="mt-2 flex-1 text-sm leading-7 text-slate-600">{item.description}</p>
                  <Link
                    href={item.href}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-blue-700 transition hover:gap-2.5"
                  >
                    {item.cta}
                    <ArrowLeft size={15} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Quick action cards ── */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Link href="/assistant" className="brand-card group rounded-[26px] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
              <Bot size={24} strokeWidth={1.8} />
            </div>
            <div className="text-lg font-black text-slate-950">گفتگو با آرتین</div>
            <div className="mt-2 text-sm leading-7 text-slate-600">
              سوال تخصصی بپرسید و پاسخ فنی دریافت کنید.
            </div>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-700 transition group-hover:gap-3">
              ورود به گفتگو <ArrowLeft size={16} />
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
              شروع تحلیل <ArrowLeft size={16} />
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
              ثبت درخواست <ArrowLeft size={16} />
            </div>
          </Link>
        </div>

        {/* ── CTA Banner ── */}
        <div className="overflow-hidden rounded-[30px] bg-gradient-to-l from-blue-700 to-indigo-800 p-8 text-center shadow-lg">
          <h2 className="text-2xl font-black text-white md:text-3xl">
            همین الان شروع کنید
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-8 text-blue-100">
            بدون نیاز به نصب، بدون انتظار — آرتین آماده پاسخ‌گویی به سوالات فنی شماست.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/assistant"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-base font-black text-blue-700 shadow-md transition hover:bg-blue-50"
            >
              شروع گفتگو با آرتین
              <ArrowLeft size={18} />
            </Link>
            <Link
              href="/customer-register"
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-400 px-7 py-3.5 text-base font-black text-white transition hover:bg-blue-600"
            >
              ثبت‌نام مشتری
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
