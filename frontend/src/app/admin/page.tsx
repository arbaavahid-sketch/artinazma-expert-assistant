import Link from "next/link";

export default function AdminPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-[32px] bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="mb-3 text-sm font-bold text-blue-700">
            پنل داخلی آرتین آزما
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            مدیریت دستیار آرتین
          </h1>

          <p className="mt-4 max-w-3xl leading-8 text-slate-600">
            این بخش برای مدیریت بانک دانش، بررسی سوالات کاربران، تایید پاسخ‌ها و
            مشاهده داشبورد داخلی آرتین آزما استفاده می‌شود.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/knowledge"
            className="rounded-3xl bg-purple-700 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold">بانک دانش</div>
            <div className="mt-2 text-sm leading-7 opacity-90">
              افزودن کاتالوگ، اپلیکیشن‌نوت، فایل آموزشی و FAQ داخلی.
            </div>
          </Link>

          <Link
            href="/questions"
            className="rounded-3xl bg-blue-700 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold">سوالات کاربران</div>
            <div className="mt-2 text-sm leading-7 opacity-90">
              مشاهده، بررسی، اصلاح و تایید پاسخ‌های آرتین.
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="rounded-3xl bg-slate-800 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold">داشبورد</div>
            <div className="mt-2 text-sm leading-7 opacity-90">
              بررسی آمار سوالات، فایل‌ها و حوزه‌های پرتکرار.
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}