"use client";
/**
 * صفحه‌ی ۴۰۴ سفارشی — جایگزین صفحه‌ی پیش‌فرض Next با ظاهر برند و RTL.
 */

import Link from "next/link";
import { Home, MessageSquareText, Package } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";

  return (
    <section
      className="brand-shell-bg flex min-h-full flex-col items-center justify-center px-6 py-20 text-center"
      dir={dir}
    >
      <div className="text-7xl font-black text-blue-600 dark:text-blue-400">404</div>

      <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">
        {isEn ? "Page not found" : "صفحه پیدا نشد"}
      </h1>

      <p className="mt-3 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
        {isEn
          ? "The page you are looking for doesn't exist or has been moved."
          : "صفحه‌ای که دنبالش هستید وجود ندارد یا جابه‌جا شده است."}
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link href="/assistant" className="ui-btn ui-btn-primary flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black">
          <MessageSquareText size={16} aria-hidden="true" />
          {isEn ? "Ask Artin" : "پرسش از آرتین"}
        </Link>
        <Link href="/products" className="ui-btn ui-btn-ghost flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold">
          <Package size={16} aria-hidden="true" />
          {isEn ? "Products" : "محصولات"}
        </Link>
        <Link href="/" className="ui-btn ui-btn-ghost flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold">
          <Home size={16} aria-hidden="true" />
          {isEn ? "Home" : "خانه"}
        </Link>
      </div>
    </section>
  );
}
