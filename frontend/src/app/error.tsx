"use client";
/**
 * مرز خطای سراسری برای route segmentها — جایگزین صفحه‌ی خطای پیش‌فرض Next.
 * دکمه‌ی «تلاش دوباره» با reset() همان بخش را بدون reload کامل بازسازی می‌کند.
 */

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Home } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";

  useEffect(() => {
    // در محیط واقعی Sentry این خطا را از قبل می‌گیرد؛ این فقط برای دیباگ لوکال است.
    console.error(error);
  }, [error]);

  return (
    <section
      className="brand-shell-bg flex min-h-full flex-col items-center justify-center px-6 py-20 text-center"
      dir={dir}
    >
      <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
        {isEn ? "Something went wrong" : "خطایی رخ داد"}
      </h1>

      <p className="mt-3 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
        {isEn
          ? "An unexpected error occurred. You can try again, or go back to the home page."
          : "یک خطای غیرمنتظره رخ داد. می‌توانید دوباره تلاش کنید یا به صفحه‌ی اصلی برگردید."}
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="ui-btn ui-btn-primary flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black"
        >
          <RotateCcw size={16} aria-hidden="true" />
          {isEn ? "Try again" : "تلاش دوباره"}
        </button>
        <Link href="/" className="ui-btn ui-btn-ghost flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold">
          <Home size={16} aria-hidden="true" />
          {isEn ? "Home" : "خانه"}
        </Link>
      </div>
    </section>
  );
}
