import Link from "next/link";

export default function Home() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="overflow-hidden rounded-[36px] bg-white shadow-sm">
        <div className="grid gap-8 p-8 lg:grid-cols-[1fr_420px] lg:p-12">
          <div className="flex flex-col justify-center">
            <div className="mb-6 w-full max-w-sm rounded-3xl bg-slate-50 p-5">
              <img
                src="/images/artinazma-logo.png"
                alt="آرتین آزما"
                className="h-auto w-full object-contain"
              />
            </div>

            <div className="mb-4 text-sm font-bold text-blue-700">
              ArtinAzma Expert Assistant
            </div>

            <h1 className="text-4xl font-bold leading-[1.5] text-slate-900 md:text-5xl">
              آرتین؛ دستیار هوشمند تخصصی آرتین آزما
            </h1>

            <p className="mt-5 max-w-3xl leading-8 text-slate-600">
              آرتین برای پاسخ‌گویی تخصصی، تحلیل فایل و عکس تست‌های آزمایشگاهی،
              پیشنهاد تجهیزات و کاتالیست، عیب‌یابی دستگاه‌ها و ثبت درخواست
              مشاوره طراحی شده است.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/assistant"
                className="rounded-2xl bg-blue-700 px-6 py-4 text-center font-bold text-white shadow-sm hover:bg-blue-800"
              >
                شروع گفتگو با آرتین
              </Link>

              <Link
                href="/customer-request"
                className="rounded-2xl border border-slate-300 bg-white px-6 py-4 text-center font-bold text-slate-800 hover:bg-slate-50"
              >
                ثبت درخواست مشاوره
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-[32px] bg-gradient-to-b from-blue-50 to-slate-50 p-8">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-48 w-48 items-center justify-center rounded-[40px] bg-white p-6 shadow-sm">
                <img
                  src="/images/artin-avatar.png"
                  alt="آرتین"
                  className="h-full w-full object-contain"
                />
              </div>

              <h2 className="text-2xl font-bold text-slate-900">
                من آرتین هستم
              </h2>

              <p className="mt-3 leading-8 text-slate-600">
                دستیار تخصصی شما برای سوالات فنی، تحلیل تست و ارتباط با
                کارشناسان آرتین آزما.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-100 bg-slate-50 p-6 md:grid-cols-3 lg:p-8">
          <Link
            href="/assistant"
            className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold text-slate-900">
              گفتگو با آرتین
            </div>
            <div className="mt-2 text-sm leading-7 text-slate-600">
              سوال تخصصی بپرسید و پاسخ فنی دریافت کنید.
            </div>
          </Link>

          <Link
            href="/analyze"
            className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold text-slate-900">
              تحلیل تخصصی تست
            </div>
            <div className="mt-2 text-sm leading-7 text-slate-600">
              فایل Excel، CSV یا PDF را با انتخاب نوع تست تحلیل کنید.
            </div>
          </Link>

          <Link
            href="/customer-request"
            className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-lg font-bold text-slate-900">
              درخواست مشاوره
            </div>
            <div className="mt-2 text-sm leading-7 text-slate-600">
              درخواست بررسی فنی، استعلام قیمت یا تماس کارشناس ثبت کنید.
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}