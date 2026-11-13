"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ButtonLink } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import {
  ArrowLeft,
  BarChart3,
  Calculator,
  Database,
  FileQuestion,
  Inbox,
  LogOut,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const adminCards = [
  {
    href: "/admin/calculations",
    title: { fa: "استفاده از محاسبات", en: "Calculation Usage" },
    description: { fa: "مشاهدهٔ کاربر، ابزار، زمان و وضعیت محاسبات آزمایشگاهی.", en: "See who used each laboratory calculator, when, and its outcome." },
    Icon: Calculator,
  },
  {
    href: "/admin/dashboard",
    title: { fa: "داشبورد مدیریتی", en: "Management Dashboard" },
    description: {
      fa: "نمای کلی سوالات، درخواست‌ها، بانک دانش و وضعیت سیستم.",
      en: "Overview of questions, requests, the knowledge base, and system status.",
    },
    Icon: BarChart3,
  },
  {
    href: "/admin/knowledge",
    title: { fa: "بانک دانش", en: "Knowledge Base" },
    description: {
      fa: "افزودن کاتالوگ، استاندارد، اپلیکیشن‌نوت و FAQ تاییدشده.",
      en: "Add approved catalogs, standards, application notes, and FAQs.",
    },
    Icon: Database,
  },
  {
    href: "/admin/questions",
    title: { fa: "سوالات کاربران", en: "User Questions" },
    description: {
      fa: "بررسی، اصلاح، تایید و تبدیل پاسخ‌های خوب به دانش داخلی.",
      en: "Review, improve, approve, and convert strong answers into internal knowledge.",
    },
    Icon: FileQuestion,
  },
  {
    href: "/admin/requests",
    title: { fa: "درخواست‌های مشتریان", en: "Customer Requests" },
    description: {
      fa: "پیگیری درخواست‌های مشاوره، تجهیزات، کاتالیست و استعلام قیمت.",
      en: "Track consultation, equipment, catalyst, and quotation requests.",
    },
    Icon: Inbox,
  },
  {
    href: "/admin/settings",
    title: { fa: "تنظیمات سیستم", en: "System Settings" },
    description: {
      fa: "بررسی Backend، اتصال OpenAI، fallback محلی و آمار بانک دانش.",
      en: "Check the backend, OpenAI connection, local fallback, and knowledge statistics.",
    },
    Icon: Settings2,
  },
];

const qualitySteps = [
  {
    title: { fa: "1. بررسی سوالات", en: "1. Review Questions" },
    body: {
      fa: "سوال‌های جدید کاربران را از بخش سوالات کاربران بررسی کنید.",
      en: "Review new user questions from the user questions section.",
    },
  },
  {
    title: { fa: "2. اصلاح پاسخ", en: "2. Improve Answers" },
    body: {
      fa: "پاسخ آرتین را در صورت نیاز کامل‌تر و تخصصی‌تر کنید.",
      en: "Make Artin's answer more complete and technically precise when needed.",
    },
  },
  {
    title: { fa: "3. افزودن به دانش", en: "3. Add to Knowledge" },
    body: {
      fa: "پاسخ تاییدشده را به بانک دانش اضافه کنید.",
      en: "Add the approved answer to the knowledge base.",
    },
  },
  {
    title: { fa: "4. پایش درخواست‌ها", en: "4. Track Requests" },
    body: {
      fa: "درخواست‌های مشتریان را پیگیری و وضعیت آن‌ها را بروزرسانی کنید.",
      en: "Follow up on customer requests and keep their statuses updated.",
    },
  },
];

export default function AdminPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const arrowClass = isEn ? "rotate-180" : "";

  return (
    <section className="min-h-full bg-[var(--background)] px-4 py-6 sm:px-6 sm:py-8" dir={dir}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-[var(--border-soft)] pb-5">
          <div>
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher variant="purple" />
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 dark:bg-purple-950/40 px-4 py-2 text-sm font-bold text-purple-700 dark:text-purple-300">
                  <ShieldCheck size={17} />
                  {isEn ? "ArtinAzma Internal Panel" : "پنل داخلی آرتین آزما"}
                </div>

                <h1 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
                  {isEn ? "Artin Assistant Management" : "مدیریت دستیار آرتین"}
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-muted)] dark:text-[var(--text-subtle)]">
                  {isEn
                    ? "Use this area to manage the knowledge base, review user questions, approve answers, follow up on customer requests, and monitor system health."
                    : "این بخش برای مدیریت بانک دانش، بررسی سوالات کاربران، تایید پاسخ‌ها، پیگیری درخواست‌های مشتریان و پایش وضعیت سیستم استفاده می‌شود."}
                </p>
              </div>

              <ButtonLink
                variant="danger"
                href="/admin-logout"
                className="gap-2 rounded-2xl border border-[var(--color-danger-border)] px-5 py-3 text-sm"
              >
                <LogOut size={18} />
                {isEn ? "Log out" : "خروج از ادمین"}
              </ButtonLink>
            </div>
          </div>
        </header>

        <nav aria-label={isEn ? "Management sections" : "بخش‌های مدیریت"} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {adminCards.map((card) => {
            const Icon = card.Icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="group flex items-start gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 transition-colors hover:border-teal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{card.title[locale]}</h2>
                  <p className="mt-1 text-sm leading-7 text-[var(--text-muted)] dark:text-[var(--text-subtle)]">{card.description[locale]}</p>
                </div>
                <ArrowLeft size={17} className={`mt-2 shrink-0 text-[var(--color-success-text)] ${arrowClass}`} aria-hidden="true" />
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                <Sparkles size={24} />
              </div>

              <div>
                <h2 className="text-xl font-black text-[var(--foreground)]">
                  {isEn ? "Suggested Artin Quality Workflow" : "روند پیشنهادی مدیریت کیفیت آرتین"}
                </h2>
                <p className="mt-1 text-sm text-[var(--text-subtle)]">
                  {isEn
                    ? "Follow this path regularly to improve answer quality."
                    : "برای بهتر شدن پاسخ‌ها، این مسیر را منظم انجام دهید."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {qualitySteps.map((step) => (
                <div key={step.title.en} className="rounded-3xl bg-[var(--surface-soft)] p-4">
                  <div className="mb-2 text-sm font-black text-[var(--foreground)]">
                    {step.title[locale]}
                  </div>
                  <p className="text-sm leading-7 text-[var(--text-muted)]">
                    {step.body[locale]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-purple-100 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 p-6 text-purple-950 dark:text-purple-300">
            <h2 className="text-xl font-black">
              {isEn ? "Management Note" : "نکته مدیریتی"}
            </h2>

            <p className="mt-4 text-sm leading-8">
              {isEn
                ? "Every approved answer added to the knowledge base improves Artin's future responses. It is best to regularly add frequent answers, important customer questions, and technical notes about equipment or materials."
                : "هر پاسخ تاییدشده‌ای که به بانک دانش اضافه می‌شود، کیفیت پاسخ‌های بعدی آرتین را بهتر می‌کند. بهتر است پاسخ‌های پرتکرار، سوالات مهم مشتریان و نکات تخصصی تجهیزات یا مواد، به‌صورت منظم وارد بانک دانش شوند."}
            </p>

            <Link
              href="/admin/knowledge"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-800"
            >
              {isEn ? "Manage knowledge base" : "مدیریت بانک دانش"}
              <ArrowLeft size={16} className={arrowClass} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
