import Link from "next/link";
import AppNav from "@/components/AppNav";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AppNav />

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="mb-4 text-4xl font-bold">
            دستیار هوشمند تخصصی آرتین آزما
          </h1>

          <p className="max-w-3xl leading-8 text-slate-600">
            این اپلیکیشن برای پاسخ‌گویی تخصصی به مشتریان، تحلیل تست‌های
            آزمایشگاهی، پیشنهاد دستگاه و کاتالیست، عیب‌یابی تجهیزات و مدیریت
            دانش فنی آرتین آزما طراحی شده است.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <Link
              href="/assistant"
              className="rounded-3xl bg-blue-700 p-6 text-white shadow-sm"
            >
              <div className="text-lg font-bold">دستیار فنی</div>
              <div className="mt-2 text-sm opacity-90">
                سوال تخصصی بپرسید و پاسخ فنی بگیرید.
              </div>
            </Link>

            <Link
              href="/analyze"
              className="rounded-3xl bg-emerald-700 p-6 text-white shadow-sm"
            >
              <div className="text-lg font-bold">تحلیل تست</div>
              <div className="mt-2 text-sm opacity-90">
                فایل Excel، CSV یا PDF را تحلیل کنید.
              </div>
            </Link>

            <Link
              href="/knowledge"
              className="rounded-3xl bg-purple-700 p-6 text-white shadow-sm"
            >
              <div className="text-lg font-bold">بانک دانش</div>
              <div className="mt-2 text-sm opacity-90">
                کاتالوگ‌ها و اپلیکیشن‌نوت‌ها را اضافه کنید.
              </div>
            </Link>

            <Link
              href="/dashboard"
              className="rounded-3xl bg-slate-800 p-6 text-white shadow-sm"
            >
              <div className="text-lg font-bold">داشبورد</div>
              <div className="mt-2 text-sm opacity-90">
                وضعیت سیستم و بانک دانش را ببینید.
              </div>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}