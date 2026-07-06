"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import LiveStats from "@/components/LiveStats";
import { useI18n } from "@/lib/i18n";
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

const brands = [
  { name: "CHROMATEC", href: "https://artinazma.net/chromatec-agency-in-iran/" },
  { name: "SPECTRON", href: "https://artinazma.net/spectron-agency-in-iran/" },
  { name: "LUMEX", href: "https://artinazma.net/lumex-agency-in-iran/" },
  { name: "TERMEX", href: "https://artinazma.net/termex-agency-in-iran/" },
  { name: "NXA", href: "https://artinazma.net/nxa-agency-in-iran/" },
  { name: "HACH", href: "https://artinazma.net/hach-agency-in-iran/" },
  { name: "METTLER TOLEDO", href: "https://artinazma.net/mettler-toledo-agency-in-iran/" },
];

export default function Home() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";

  const capabilities = [
    {
      title: isEn ? "Specialized technical answers" : "پاسخ‌گویی فنی تخصصی",
      description: isEn
        ? "Answers for lab equipment, instrumental analysis, chemicals, catalysts, and test methods."
        : "پاسخ به سوالات مرتبط با تجهیزات آزمایشگاهی، آنالیز دستگاهی، مواد شیمیایی، کاتالیست‌ها و روش‌های آزمون.",
      icon: MessageSquareText,
      color: "bg-blue-50 text-blue-700",
    },
    {
      title: isEn ? "Test and report analysis" : "تحلیل تست و گزارش",
      description: isEn
        ? "Review PDF, Excel, CSV, lab reports, charts, chromatograms, and QC data."
        : "بررسی فایل‌های PDF، Excel، CSV، گزارش آزمایشگاهی، نمودار، کروماتوگرام و داده‌های QC.",
      icon: FlaskConical,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      title: isEn ? "Instrument and method suggestions" : "پیشنهاد دستگاه و روش آزمون",
      description: isEn
        ? "Guidance for selecting equipment, analysis methods, measurement range, sample preparation, and quality control."
        : "راهنمایی برای انتخاب تجهیز، روش آنالیز، محدوده اندازه‌گیری، آماده‌سازی نمونه و کنترل کیفیت.",
      icon: Microscope,
      color: "bg-purple-50 text-purple-700",
    },
    {
      title: isEn ? "Equipment troubleshooting" : "عیب‌یابی تجهیزات",
      description: isEn
        ? "Analyze errors, baseline fluctuation, calibration issues, sample preparation, consumables, and instrument conditions."
        : "تحلیل خطاها، نوسان baseline، مشکلات کالیبراسیون، آماده‌سازی نمونه، مصرفی‌ها و شرایط دستگاه.",
      icon: Wrench,
      color: "bg-amber-50 text-amber-700",
    },
  ];

  const domains = isEn
    ? ["GC / GC-MS / HPLC", "Mercury and sulfur analysis", "Catalysts and adsorbents", "Chemicals and additives", "ASTM and test methods", "Fuel, LPG, and natural gas"]
    : ["GC / GC-MS / HPLC", "آنالیز جیوه و سولفور", "کاتالیست و جاذب‌ها", "مواد شیمیایی و افزودنی‌ها", "ASTM و روش‌های آزمون", "سوخت، LPG و گاز طبیعی"];

  const heroHighlights = [
    isEn ? "Technical answers grounded in specialized knowledge" : "پاسخ فنی بر پایه بانک دانش تخصصی",
    isEn ? "Report and file analysis for lab workflows" : "تحلیل گزارش و فایل برای کار آزمایشگاهی",
    isEn ? "Equipment, catalyst, and method guidance" : "راهنمایی تجهیز، کاتالیست و روش آزمون",
  ];

  return (
    <section className="brand-shell-bg min-h-full px-3 py-3 sm:px-5 sm:py-6 md:px-8 md:py-8" dir={dir}>
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-7">
        <div className="brand-panel hero-grid-bg relative overflow-hidden rounded-[26px] sm:rounded-[34px]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-blue-600 via-cyan-500 to-emerald-500" />
          <div className="grid gap-8 p-5 sm:p-7 md:p-9 lg:grid-cols-[minmax(0,1fr)_470px] lg:p-10 xl:p-12">
            <div className="flex flex-col justify-center">
              <div className="brand-kicker mb-5 hidden sm:flex">
                <Sparkles size={17} />
                ArtinAzma Expert Assistant
              </div>

              <h1 className="max-w-4xl text-center text-3xl font-black leading-[1.45] text-slate-950 sm:text-start sm:text-[var(--font-size-display)] sm:leading-[1.35]">
                {isEn ? "ArtinAzma Expert Assistant" : "دستیار تخصصی آرتین آزما"}
                <span className="block text-blue-700">
                  {isEn ? "For oil, gas, and petrochemical industries" : "برای صنایع نفت، گاز و پتروشیمی"}
                </span>
              </h1>

              <p className="mt-4 max-w-3xl text-center text-base leading-8 text-slate-600 sm:mt-5 sm:text-start sm:text-lg sm:leading-9">
                {isEn
                  ? "Artin is designed for specialized answers, lab report analysis, instrument suggestions, equipment troubleshooting, and catalyst review in oil, gas, and petrochemical industries."
                  : "آرتین برای پاسخ‌گویی تخصصی، تحلیل گزارش‌های آزمایشگاهی، پیشنهاد دستگاه، عیب‌یابی تجهیزات و بررسی کاتالیست‌ها در صنایع نفت، گاز و پتروشیمی طراحی شده است."}
              </p>

              <div className="mt-6 flex flex-col gap-2.5 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-3">
                <HeroLink href="/assistant" primary label={isEn ? "Start chatting with Artin" : "شروع گفتگو با آرتین"} icon={<ArrowLeft size={18} />} />
                <HeroLink href="/analyze" label={isEn ? "Analyze test file" : "تحلیل فایل تست"} icon={<Beaker size={18} />} />
                <HeroLink href="/customer-request" label={isEn ? "Submit request" : "ثبت درخواست"} icon={<PhoneCall size={18} />} />
              </div>

              <div className="mt-5 grid gap-2.5 sm:mt-6 sm:max-w-2xl sm:grid-cols-3">
                {heroHighlights.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200/80 bg-white/70 px-3.5 py-3 text-center text-xs font-black leading-6 text-slate-700 shadow-sm sm:text-start">
                    {item}
                  </div>
                ))}
              </div>

              <ul className="mt-5 flex max-w-3xl cursor-default select-none flex-wrap justify-center gap-x-5 gap-y-3 text-center text-sm font-extrabold leading-6 text-slate-600 sm:mt-7 sm:justify-start sm:text-base">
                {domains.map((item) => (
                  <li key={item} className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500/70" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative hidden items-center justify-center rounded-[30px] border border-blue-100 bg-gradient-to-b from-blue-50/80 via-white/95 to-slate-50 p-6 shadow-inner lg:flex">
              <div className="absolute right-5 top-5 rounded-2xl border border-emerald-100 bg-white/95 px-3 py-1.5 text-xs font-black text-emerald-700 shadow-sm">
                {isEn ? "Ready for technical answers" : "آماده پاسخ‌گویی تخصصی"}
              </div>

              <div className="w-full text-center">
                <div className="mx-auto mb-5 flex h-44 w-44 items-center justify-center overflow-hidden rounded-[34px] bg-blue-50 shadow-lg shadow-slate-200/70">
                  <Image src="/images/artin-avatar-hero.png" alt={isEn ? "Artin" : "آرتین"} width={220} height={220} priority className="h-full w-full object-cover" />
                </div>

                <h2 className="text-2xl font-black text-slate-950">{isEn ? "I'm Artin" : "من آرتین هستم"}</h2>

                <LiveStats />

                <div className="mt-4 grid gap-2 text-start">
                  <Badge text={isEn ? "Answers based on a specialized knowledge base" : "پاسخ بر اساس بانک دانش تخصصی"} icon={<CheckCircle2 size={16} className="shrink-0 text-emerald-600" />} />
                  <Badge text={isEn ? "Suitable for customers and technical experts" : "مناسب مشتری و کارشناس فنی"} icon={<ShieldCheck size={16} className="shrink-0 text-blue-600" />} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <SectionBlock kicker={isEn ? "Fast start" : "شروع سریع"} icon={<Bot size={15} />}>
          <div className="grid gap-4 lg:grid-cols-3">
            <QuickCard href="/assistant" icon={<Bot size={24} strokeWidth={1.8} />} color="bg-blue-50 text-blue-700" title={isEn ? "Chat with Artin" : "گفتگو با آرتین"} desc={isEn ? "Ask a technical question and get a focused answer." : "سوال تخصصی بپرسید و پاسخ فنی و متمرکز دریافت کنید."} cta={isEn ? "Open chat" : "ورود به گفتگو"} />
            <QuickCard href="/analyze" icon={<Beaker size={24} strokeWidth={1.8} />} color="bg-emerald-50 text-emerald-700" title={isEn ? "Analyze a test file" : "تحلیل فایل تست"} desc={isEn ? "Review Excel, CSV, PDF, and lab reports." : "فایل Excel، CSV، PDF و گزارش آزمایشگاهی را بررسی کنید."} cta={isEn ? "Start analysis" : "شروع تحلیل"} />
            <QuickCard href="/customer-request" icon={<Settings2 size={24} strokeWidth={1.8} />} color="bg-amber-50 text-amber-700" title={isEn ? "Request consultation" : "درخواست مشاوره"} desc={isEn ? "Send a technical review or price inquiry." : "درخواست بررسی فنی یا استعلام قیمت ثبت کنید."} cta={isEn ? "Submit request" : "ثبت درخواست"} />
          </div>
        </SectionBlock>

        <SectionBlock kicker={isEn ? "Capabilities" : "قابلیت‌ها"} icon={<MessageSquareText size={15} />}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-[22px] border border-slate-100 bg-white/80 p-5">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
                    <Icon size={24} strokeWidth={1.8} />
                  </div>
                  <div className="text-lg font-black text-slate-950">{item.title}</div>
                  <div className="mt-3 text-sm leading-7 text-slate-600">{item.description}</div>
                </div>
              );
            })}
          </div>
        </SectionBlock>

        <div className="rounded-[24px] border border-slate-200/80 bg-white/70 px-5 py-5 shadow-sm backdrop-blur sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-center text-sm font-black text-slate-500 lg:text-start">
              {isEn ? "Specialized ArtinAzma Mehr brands" : "برندهای تخصصی آرتین آزما مهر"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-end">
              {brands.map((brand) => (
                <a
                  key={brand.name}
                  href={brand.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-black text-slate-600 transition hover:text-blue-700 sm:text-[15px]"
                >
                  {brand.name}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-blue-100 bg-white p-7 text-center shadow-sm">
          <h2 className="text-2xl font-black text-slate-950 md:text-3xl">{isEn ? "Start now" : "همین الان شروع کنید"}</h2>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/assistant" className="ui-btn ui-btn-primary inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-base">
              {isEn ? "Start chatting with Artin" : "شروع گفتگو با آرتین"}<ArrowLeft size={18} />
            </Link>
            <Link href="/customer-register" className="ui-btn ui-btn-ghost inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-base">
              {isEn ? "Register as customer" : "ثبت‌نام مشتری"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroLink({ href, label, icon, primary = false }: { href: string; label: string; icon: ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={`ui-btn ${primary ? "ui-btn-primary" : "ui-btn-ghost"} w-full shrink-0 justify-center gap-2 whitespace-nowrap rounded-2xl px-5 py-3.5 text-sm sm:w-auto sm:px-6 sm:py-4 sm:text-base`}>
      {label}{icon}
    </Link>
  );
}

function Badge({ text, icon }: { text: string; icon: ReactNode }) {
  return <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-2.5 text-sm font-extrabold text-slate-700">{icon}{text}</div>;
}

function SectionBlock({ kicker, icon, children }: { kicker: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[26px] border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur md:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <span className="brand-kicker w-fit">{icon}{kicker}</span>
      </div>
      {children}
    </section>
  );
}

function QuickCard({ href, icon, color, title, desc, cta }: { href: string; icon: ReactNode; color: string; title: string; desc: string; cta: string }) {
  return (
    <Link href={href} className="group rounded-[22px] border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>{icon}</div>
      <div className="text-lg font-black text-slate-950">{title}</div>
      <div className="mt-2 text-sm leading-7 text-slate-600">{desc}</div>
      <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-700 transition group-hover:gap-3">
        {cta}<ArrowLeft size={16} />
      </div>
    </Link>
  );
}
