import { Link } from "wouter";
import {
  ArrowLeft,
  BarChart3,
  Database,
  FileQuestion,
  Inbox,
  LogOut,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const adminCards = [
  { href: "/admin/dashboard", title: "داشبورد مدیریتی", description: "نمای کلی سوالات، درخواست‌ها، بانک دانش و وضعیت سیستم.", Icon: BarChart3, className: "bg-purple-700 text-white" },
  { href: "/admin/knowledge", title: "بانک دانش", description: "افزودن کاتالوگ، استاندارد، اپلیکیشن‌نوت و FAQ تاییدشده.", Icon: Database, className: "bg-blue-700 text-white" },
  { href: "/admin/questions", title: "سوالات کاربران", description: "بررسی، اصلاح، تایید و تبدیل پاسخ‌های خوب به دانش داخلی.", Icon: FileQuestion, className: "bg-slate-800 text-white" },
  { href: "/admin/requests", title: "درخواست‌های مشتریان", description: "پیگیری درخواست‌های مشاوره، تجهیزات، کاتالیست و استعلام قیمت.", Icon: Inbox, className: "bg-emerald-700 text-white" },
  { href: "/admin/settings", title: "تنظیمات سیستم", description: "بررسی Backend، اتصال OpenAI، fallback محلی و آمار بانک دانش.", Icon: Settings2, className: "bg-zinc-700 text-white" },
];

export default function AdminPage() {
  return (
    <section className="min-h-screen bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                  <ShieldCheck size={17} />
                  پنل داخلی آرتین آزما
                </div>
                <h1 className="text-3xl font-black text-slate-900">مدیریت دستیار آرتین</h1>
                <p className="mt-4 max-w-4xl leading-8 text-slate-600">
                  این بخش برای مدیریت بانک دانش، بررسی سوالات کاربران، تایید پاسخ‌ها، پیگیری درخواست‌های مشتریان و پایش وضعیت سیستم استفاده می‌شود.
                </p>
              </div>
              <Link href="/admin-logout" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100">
                <LogOut size={18} />خروج از ادمین
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {adminCards.map((card) => {
            const Icon = card.Icon;
            return (
              <Link key={card.href} href={card.href} className={`group rounded-[30px] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${card.className}`}>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <Icon size={25} strokeWidth={1.8} />
                </div>
                <div className="text-xl font-black">{card.title}</div>
                <div className="mt-3 min-h-[84px] text-sm leading-7 opacity-90">{card.description}</div>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold opacity-90 transition group-hover:gap-3">
                  ورود به بخش <ArrowLeft size={16} />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                <Sparkles size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">روند پیشنهادی مدیریت کیفیت آرتین</h2>
                <p className="mt-1 text-sm text-slate-500">برای بهتر شدن پاسخ‌ها، این مسیر را منظم انجام دهید.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                { title: "1. بررسی سوالات", desc: "سوال‌های جدید کاربران را از بخش سوالات کاربران بررسی کنید." },
                { title: "2. اصلاح پاسخ", desc: "پاسخ آرتین را در صورت نیاز کامل‌تر و تخصصی‌تر کنید." },
                { title: "3. افزودن به دانش", desc: "پاسخ تاییدشده را به بانک دانش اضافه کنید." },
                { title: "4. پایش درخواست‌ها", desc: "درخواست‌های مشتریان را پیگیری و وضعیت آن‌ها را بروزرسانی کنید." },
              ].map((step) => (
                <div key={step.title} className="rounded-3xl bg-slate-50 p-4">
                  <div className="mb-2 text-sm font-black text-slate-900">{step.title}</div>
                  <p className="text-sm leading-7 text-slate-600">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-purple-100 bg-purple-50 p-6 text-purple-950">
            <h2 className="text-xl font-black">نکته مدیریتی</h2>
            <p className="mt-4 text-sm leading-8">
              هر پاسخ تاییدشده‌ای که به بانک دانش اضافه می‌شود، کیفیت پاسخ‌های بعدی آرتین را بهتر می‌کند.
            </p>
            <Link href="/admin/knowledge" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-800">
              مدیریت بانک دانش <ArrowLeft size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
