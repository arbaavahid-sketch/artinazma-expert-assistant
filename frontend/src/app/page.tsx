"use client";

import Link from "next/link";
import LiveStats from "@/components/LiveStats";
import Image from "next/image";
import type { ReactNode } from "react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
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
  ChevronDown,
  Zap,
  BookOpen,
  Users,
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

  const howItWorks = [
    {
      step: isEn ? "1" : "۱",
      title: isEn ? "Ask a question" : "سوال بپرسید",
      desc: isEn ? "Ask a technical question, comparison request, troubleshooting case, or file analysis." : "سوال فنی، درخواست مقایسه، عیب‌یابی یا تحلیل فایل خود را مطرح کنید.",
      icon: MessageSquareText,
    },
    {
      step: isEn ? "2" : "۲",
      title: isEn ? "Artin analyzes" : "آرتین تحلیل می‌کند",
      desc: isEn ? "Artin reviews the specialized knowledge base, standards, and technical sources." : "آرتین بانک دانش تخصصی، استانداردها و منابع فنی را بررسی می‌کند.",
      icon: BookOpen,
    },
    {
      step: isEn ? "3" : "۳",
      title: isEn ? "Get a technical answer" : "پاسخ تخصصی دریافت کنید",
      desc: isEn ? "Receive a complete, step-by-step answer with reliable technical context." : "پاسخ کامل، مرحله‌به‌مرحله، با منابع معتبر و قابل استناد.",
      icon: Zap,
    },
  ];

  const userPaths = [
    {
      title: isEn ? "For industrial customers" : "برای مشتریان صنعتی",
      description: isEn ? "Submit requests, price inquiries, equipment selection needs, and contact experts." : "ثبت درخواست، استعلام قیمت، انتخاب دستگاه و ارتباط با کارشناس.",
      icon: ClipboardList,
      href: "/customer-register",
      cta: isEn ? "Register as customer" : "ثبت‌نام مشتری",
      color: "text-blue-700 bg-blue-50",
    },
    {
      title: isEn ? "For technical experts" : "برای کارشناسان فنی",
      description: isEn ? "Analyze tests, troubleshoot, review methods, and prepare technical responses." : "تحلیل تست، عیب‌یابی، بررسی روش آزمون و آماده‌سازی پاسخ فنی.",
      icon: FileText,
      href: "/assistant",
      cta: isEn ? "Start chat" : "شروع گفتگو",
      color: "text-emerald-700 bg-emerald-50",
    },
    {
      title: isEn ? "For internal management" : "برای مدیریت داخلی",
      description: isEn ? "Monitor questions, manage the knowledge base, and control answer quality." : "پایش سوالات، مدیریت بانک دانش و کنترل کیفیت پاسخ‌های آرتین.",
      icon: BarChart3,
      href: "/admin",
      cta: isEn ? "Admin panel" : "پنل ادمین",
      color: "text-purple-700 bg-purple-50",
    },
  ];

  return (
    <section className="brand-shell-bg min-h-full px-5 py-6 md:px-8 md:py-8" dir={dir}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="brand-panel hero-grid-bg overflow-hidden rounded-[34px]">
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_420px] lg:p-10 xl:p-12">
            <div className="flex flex-col justify-center">
              <div className="brand-kicker mb-6">
                <Sparkles size={17} />
                ArtinAzma Expert Assistant
              </div>

              <h1 className="max-w-4xl text-[var(--font-size-display)] font-black leading-[1.45] text-slate-950">
                {isEn ? "ArtinAzma Expert Assistant" : "دستیار تخصصی آرتین آزما"}
                <span className="block text-blue-700">
                  {isEn ? "For oil, gas, and petrochemical industries" : "برای صنایع نفت، گاز و پتروشیمی"}
                </span>
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-9 text-slate-600">
                {isEn
                  ? "Artin is designed for specialized answers, lab report analysis, instrument suggestions, equipment troubleshooting, and catalyst review in oil, gas, and petrochemical industries."
                  : "آرتین برای پاسخ‌گویی تخصصی، تحلیل گزارش‌های آزمایشگاهی، پیشنهاد دستگاه، عیب‌یابی تجهیزات و بررسی کاتالیست‌ها در صنایع نفت، گاز و پتروشیمی طراحی شده است."}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {domains.map((item) => (
                  <span key={item} className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-extrabold text-slate-700 shadow-sm">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <HeroLink href="/assistant" primary label={isEn ? "Start chatting with Artin" : "شروع گفتگو با آرتین"} icon={<ArrowLeft size={18} />} />
                <HeroLink href="/analyze" label={isEn ? "Analyze test file" : "تحلیل فایل تست"} icon={<Beaker size={18} />} />
                <HeroLink href="/customer-request" label={isEn ? "Submit request" : "ثبت درخواست"} icon={<PhoneCall size={18} />} />
              </div>
            </div>

            <div className="relative flex items-center justify-center rounded-[30px] border border-blue-100 bg-gradient-to-b from-blue-50/80 via-white/95 to-slate-50 p-6 shadow-inner">
              <div className="absolute right-5 top-5 rounded-2xl border border-emerald-100 bg-white/95 px-3 py-1.5 text-xs font-black text-emerald-700 shadow-sm">
                {isEn ? "Ready for technical answers" : "آماده پاسخ‌گویی تخصصی"}
              </div>

              <div className="w-full text-center">
                <div className="mx-auto mb-4 flex h-40 w-40 items-center justify-center rounded-[34px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/70">
                  <Image src="/images/artin-avatar.png" alt={isEn ? "Artin" : "آرتین"} width={160} height={160} priority className="h-full w-full object-contain" />
                </div>

                <h2 className="text-2xl font-black text-slate-950">{isEn ? "I'm Artin" : "من آرتین هستم"}</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-slate-600">
                  {isEn ? "Your expert assistant for technical questions, test analysis, and equipment selection." : "دستیار تخصصی شما برای سوالات فنی، تحلیل تست و انتخاب تجهیزات."}
                </p>

                <LiveStats />

                <div className="mt-4 grid gap-2 text-start">
                  <Badge text={isEn ? "Answers based on a specialized knowledge base" : "پاسخ بر اساس بانک دانش تخصصی"} icon={<CheckCircle2 size={16} className="shrink-0 text-emerald-600" />} />
                  <Badge text={isEn ? "Suitable for customers and technical experts" : "مناسب مشتری و کارشناس فنی"} icon={<ShieldCheck size={16} className="shrink-0 text-blue-600" />} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="brand-card rounded-[26px] px-6 py-5">
          <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
            {isEn ? "Specialized ArtinAzma Mehr brands" : "برندهای تخصصی آرتین آزما مهر"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {brands.map((brand) => (
              <a
                key={brand.name}
                href={brand.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                {brand.name}
              </a>
            ))}
          </div>
        </div>

        <SectionPanel kicker={isEn ? "How to use" : "نحوه استفاده"} icon={<Zap size={15} />}>
          <div className="grid gap-4 md:grid-cols-3">
            {howItWorks.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="relative flex gap-4 rounded-[22px] border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow">{step.step}</div>
                  <div>
                    <div className="flex items-center gap-2 font-black text-slate-900"><Icon size={16} />{step.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{step.desc}</p>
                  </div>
                  {i < howItWorks.length - 1 && <ChevronLeft size={20} className="absolute -left-3 top-1/2 hidden -translate-y-1/2 text-slate-300 md:block" />}
                </div>
              );
            })}
          </div>
        </SectionPanel>

        <SectionPanel kicker={isEn ? "Capabilities" : "قابلیت‌ها"} icon={<MessageSquareText size={15} />}>
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
        </SectionPanel>

        <SectionPanel kicker={isEn ? "Use paths" : "مسیرهای استفاده"} icon={<Users size={15} />}>
          <div className="grid gap-4 lg:grid-cols-3">
            {userPaths.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="brand-card flex flex-col rounded-[26px] p-5">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}><Icon size={24} strokeWidth={1.8} /></div>
                  <div className="text-lg font-black text-slate-950">{item.title}</div>
                  <p className="mt-2 flex-1 text-sm leading-7 text-slate-600">{item.description}</p>
                  <Link href={item.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-blue-700 transition hover:gap-2.5">
                    {item.cta}<ArrowLeft size={15} />
                  </Link>
                </div>
              );
            })}
          </div>
        </SectionPanel>

        <div className="grid gap-4 lg:grid-cols-3">
          <QuickCard href="/assistant" icon={<Bot size={24} strokeWidth={1.8} />} color="bg-purple-50 text-purple-700" title={isEn ? "Chat with Artin" : "گفتگو با آرتین"} desc={isEn ? "Ask a technical question and get a technical answer." : "سوال تخصصی بپرسید و پاسخ فنی دریافت کنید."} cta={isEn ? "Open chat" : "ورود به گفتگو"} />
          <QuickCard href="/analyze" icon={<Beaker size={24} strokeWidth={1.8} />} color="bg-emerald-50 text-emerald-700" title={isEn ? "Specialized test analysis" : "تحلیل تخصصی تست"} desc={isEn ? "Analyze Excel, CSV, or PDF files with a selected test type." : "فایل Excel، CSV یا PDF را با انتخاب نوع تست تحلیل کنید."} cta={isEn ? "Start analysis" : "شروع تحلیل"} />
          <QuickCard href="/customer-request" icon={<Settings2 size={24} strokeWidth={1.8} />} color="bg-amber-50 text-amber-700" title={isEn ? "Consultation request" : "درخواست مشاوره"} desc={isEn ? "Submit a technical review, price inquiry, or expert contact request." : "درخواست بررسی فنی، استعلام قیمت یا تماس کارشناس ثبت کنید."} cta={isEn ? "Submit request" : "ثبت درخواست"} />
        </div>

        <div className="overflow-hidden rounded-[30px] bg-gradient-to-l from-blue-700 to-indigo-800 p-8 text-center shadow-lg">
          <h2 className="text-2xl font-black text-white md:text-3xl">{isEn ? "Start now" : "همین الان شروع کنید"}</h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-8 text-blue-100">
            {isEn ? "No installation and no waiting. Artin is ready to answer your technical questions." : "بدون نیاز به نصب، بدون انتظار — آرتین آماده پاسخ‌گویی به سوالات فنی شماست."}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/assistant" className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-base font-black text-blue-700 shadow-md transition hover:bg-blue-50">
              {isEn ? "Start chatting with Artin" : "شروع گفتگو با آرتین"}<ArrowLeft size={18} />
            </Link>
            <Link href="/customer-register" className="inline-flex items-center gap-2 rounded-2xl border border-blue-400 px-7 py-3.5 text-base font-black text-white transition hover:bg-blue-600">
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
    <Link href={href} className={`ui-btn ${primary ? "ui-btn-primary" : "ui-btn-ghost"} gap-2 rounded-2xl px-6 py-4 text-base`}>
      {label}{icon}
    </Link>
  );
}

function Badge({ text, icon }: { text: string; icon: ReactNode }) {
  return <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-2.5 text-sm font-extrabold text-slate-700 shadow-sm">{icon}{text}</div>;
}

function SectionPanel({ kicker, icon, children }: { kicker: string; icon: ReactNode; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="brand-panel overflow-hidden rounded-[30px]">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 p-5 text-start transition hover:bg-white/55 md:p-6"
        aria-expanded={isOpen}
      >
        <span className="brand-kicker w-fit">{icon}{kicker}</span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm">
          <ChevronDown size={20} className={`transition ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-slate-100 p-5 pt-5 md:p-6">
          {children}
        </div>
      )}
    </div>
  );
}

function QuickCard({ href, icon, color, title, desc, cta }: { href: string; icon: ReactNode; color: string; title: string; desc: string; cta: string }) {
  return (
    <Link href={href} className="brand-card group rounded-[26px] p-6">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>{icon}</div>
      <div className="text-lg font-black text-slate-950">{title}</div>
      <div className="mt-2 text-sm leading-7 text-slate-600">{desc}</div>
      <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-700 transition group-hover:gap-3">
        {cta}<ArrowLeft size={16} />
      </div>
    </Link>
  );
}
