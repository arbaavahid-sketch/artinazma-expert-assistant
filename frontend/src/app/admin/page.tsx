import Link from "next/link";

export default function AdminPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-[32px] bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
  <div>
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

  <a
    href="/admin-logout"
    className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-100"
  >
    خروج از ادمین
  </a>
</div>

        <div className="grid gap-4 md:grid-cols-5">
          <Link
            href="/admin/knowledge"
            className="rounded-3xl bg-purple-700 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold">بانک دانش</div>
            <div className="mt-2 text-sm leading-7 opacity-90">
              افزودن کاتالوگ، اپلیکیشن‌نوت، فایل آموزشی و FAQ داخلی.
            </div>
          </Link>

          <Link
            href="/admin/questions"
            className="rounded-3xl bg-blue-700 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold">سوالات کاربران</div>
            <div className="mt-2 text-sm leading-7 opacity-90">
              مشاهده، بررسی، اصلاح و تایید پاسخ‌های آرتین.
            </div>
          </Link>
          <Link
  href="/admin/requests"
  className="rounded-3xl bg-emerald-700 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
>
  <div className="text-lg font-bold">درخواست‌های مشتریان</div>
  <div className="mt-2 text-sm leading-7 opacity-90">
    مشاهده و پیگیری درخواست‌های مشاوره، تجهیزات، کاتالیست و استعلام قیمت.
  </div>
</Link>
          <Link
            href="/admin/dashboard"
            className="rounded-3xl bg-slate-800 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold">داشبورد</div>
            <div className="mt-2 text-sm leading-7 opacity-90">
              بررسی آمار سوالات، فایل‌ها و حوزه‌های پرتکرار.
            </div>
          </Link>
          <Link
            href="/admin/settings"
            className="rounded-3xl bg-zinc-700 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
>
            <div className="text-lg font-bold">تنظیمات سیستم</div>
            <div className="mt-2 text-sm leading-7 opacity-90">
              بررسی وضعیت OpenAI، fallback محلی، بانک دانش و اتصال Backend.
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}