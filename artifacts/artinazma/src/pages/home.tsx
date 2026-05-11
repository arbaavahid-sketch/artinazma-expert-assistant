import { Link } from "wouter";
import {
  ArrowLeft,
  ChevronLeft,
  FlaskConical,
  MessageSquare,
  Search,
  Sparkles,
  Star,
  TestTube2,
} from "lucide-react";

const domains = [
  {
    id: "catalyst",
    label: "کاتالیست",
    description: "کاتالیست‌ها، جاذب‌ها و مواد فعال سطحی",
    color: "bg-amber-50 text-amber-700 border-amber-100",
  },
  {
    id: "equipment",
    label: "تجهیزات",
    description: "دستگاه‌های آنالیز و تجهیزات آزمایشگاهی",
    color: "bg-blue-50 text-blue-700 border-blue-100",
  },
  {
    id: "chromatography",
    label: "کروماتوگرافی",
    description: "GC، HPLC و روش‌های کروماتوگرافی",
    color: "bg-indigo-50 text-indigo-700 border-indigo-100",
  },
  {
    id: "mercury-analysis",
    label: "آنالیز جیوه",
    description: "روش‌های آنالیز جیوه در نمونه‌های مختلف",
    color: "bg-red-50 text-red-700 border-red-100",
  },
  {
    id: "sulfur-analysis",
    label: "آنالیز سولفور",
    description: "اندازه‌گیری سولفور در فرآورده‌های نفتی",
    color: "bg-orange-50 text-orange-700 border-orange-100",
  },
  {
    id: "troubleshooting",
    label: "عیب‌یابی",
    description: "رفع مشکلات دستگاه‌ها و بهینه‌سازی شرایط",
    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
];

const features = [
  {
    icon: <Search size={22} />,
    title: "جست‌وجوی تخصصی",
    description: "جست‌وجو در بانک دانش اختصاصی آرتین آزما شامل کاتالوگ‌ها و استانداردها",
  },
  {
    icon: <Sparkles size={22} />,
    title: "پاسخ هوشمند",
    description: "پاسخ‌های تحلیلی و دقیق در حوزه تجهیزات آزمایشگاهی با کمک هوش مصنوعی",
  },
  {
    icon: <MessageSquare size={22} />,
    title: "مکالمه تخصصی",
    description: "گفتگوی پیوسته با دستیار آرتین و دریافت مشاوره تخصصی",
  },
  {
    icon: <Star size={22} />,
    title: "دانش تاییدشده",
    description: "پاسخ‌های تاییدشده توسط کارشناسان آرتین آزما برای دقت بیشتر",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <section className="relative overflow-hidden bg-white px-6 py-20">
        <div className="absolute inset-0 bg-gradient-to-bl from-purple-50 via-white to-slate-50" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-purple-50 px-5 py-2.5 text-sm font-bold text-purple-700">
            <FlaskConical size={17} />
            دستیار هوشمند تخصصی آرتین آزما
          </div>

          <h1 className="text-4xl font-black leading-[1.5] text-slate-900 md:text-5xl">
            سوالات تخصصی‌تان را
            <br />
            <span className="text-purple-700">با آرتین در میان بگذارید</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-9 text-slate-600">
            آرتین، دستیار هوشمند آرتین آزما، در حوزه‌های کاتالیست، کروماتوگرافی،
            آنالیز جیوه، سولفور و تجهیزات آزمایشگاهی پاسخ تخصصی می‌دهد.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/assistant"
              className="inline-flex items-center gap-2 rounded-2xl bg-purple-700 px-7 py-4 text-base font-bold text-white shadow-sm transition hover:bg-purple-800 hover:shadow-md"
            >
              <MessageSquare size={20} />
              شروع گفتگو با آرتین
            </Link>

            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-4 text-base font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <TestTube2 size={20} />
              آنالیز نتیجه آزمون
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-black text-slate-900">حوزه‌های تخصصی آرتین</h2>
            <p className="mt-3 text-slate-500">در هر یک از این حوزه‌ها سوال بپرسید</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {domains.map((domain) => (
              <Link
                key={domain.id}
                href={`/assistant?domain=${domain.id}`}
                className={`group rounded-[28px] border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${domain.color}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black">{domain.label}</div>
                    <p className="mt-2 text-sm leading-7 opacity-80">{domain.description}</p>
                  </div>
                  <ChevronLeft size={20} className="mt-1 shrink-0 opacity-60 transition group-hover:translate-x-[-4px]" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-black text-slate-900">چرا آرتین؟</h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <div key={i} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                  {f.icon}
                </div>
                <div className="font-black text-slate-900">{f.title}</div>
                <p className="mt-2 text-sm leading-7 text-slate-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-3xl rounded-[36px] bg-purple-700 p-10 text-center text-white">
          <h2 className="text-2xl font-black">آماده برای مشاوره تخصصی؟</h2>
          <p className="mt-4 leading-8 opacity-90">
            سوال فنی خود را از آرتین بپرسید. از کاتالیست تا کروماتوگرافی، از عیب‌یابی تا استعلام قیمت.
          </p>
          <Link
            href="/assistant"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 font-bold text-purple-700 transition hover:bg-purple-50"
          >
            شروع گفتگو
            <ArrowLeft size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
