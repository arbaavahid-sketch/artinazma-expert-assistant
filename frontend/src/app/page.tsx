import Link from "next/link";

export default function Home() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-[32px] bg-white p-8 shadow-sm">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 text-sm font-bold text-blue-700">
            ArtinAzma Expert Assistant
          </div>

          <h1 className="text-4xl font-bold leading-[1.5] text-slate-900">
            آرتین؛ دستیار هوشمند تخصصی آرتین آزما
          </h1>

          <p className="mt-5 leading-8 text-slate-600">
            آرتین برای پاسخ‌گویی تخصصی به مشتریان، تحلیل تست‌های آزمایشگاهی،
            پیشنهاد تجهیزات و کاتالیست، عیب‌یابی دستگاه‌ها و مدیریت دانش فنی
            آرتین آزما طراحی شده است.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          <Link
            href="/assistant"
            className="rounded-3xl bg-blue-700 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold">گفتگو با آرتین</div>
            <div className="mt-2 text-sm leading-7 opacity-90">
              سوال تخصصی بپرسید و پاسخ فنی دریافت کنید.
            </div>
          </Link>

          <Link
            href="/analyze"
            className="rounded-3xl bg-emerald-700 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold">تحلیل تست</div>
            <div className="mt-2 text-sm leading-7 opacity-90">
              فایل Excel، CSV یا PDF را تحلیل کنید.
            </div>
          </Link>

          <Link
            href="/knowledge"
            className="rounded-3xl bg-purple-700 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold">بانک دانش</div>
            <div className="mt-2 text-sm leading-7 opacity-90">
              کاتالوگ‌ها و فایل‌های تخصصی را وارد کنید.
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="rounded-3xl bg-slate-800 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold">داشبورد</div>
            <div className="mt-2 text-sm leading-7 opacity-90">
              وضعیت سوالات و دانش سیستم را ببینید.
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}