"use client";

import { useEffect, useState } from "react";
import { formatNumber, useI18n } from "@/lib/i18n";

/**
 * Shown under the conversation while Artin is answering. It says what is
 * happening in general terms (the backend does not report stages) and, once
 * the wait is noticeable, how long it has taken so far.
 */
export default function WaitingIndicator() {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex justify-start" role="status" aria-live="polite">
      <div className="flex max-w-[88%] items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-3.5 py-2.5 sm:px-4 sm:py-3">
        <div className="relative shrink-0">
          <img
            src="/images/artin-avatar.webp"
            alt=""
            className="h-8 w-8 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] object-cover"
          />
          <span className="absolute -bottom-0.5 -start-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--brand-fill)] ring-2 ring-[var(--surface)]">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />
          </span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
            {isEn ? "Artin is checking sources and writing" : "آرتین در حال بررسی منابع و نوشتن پاسخ است"}
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-1 w-1 animate-[typing_1.2s_ease-in-out_infinite] rounded-full bg-[var(--brand-accent)]" />
              <span className="h-1 w-1 animate-[typing_1.2s_ease-in-out_infinite] rounded-full bg-[var(--brand-accent)] [animation-delay:200ms]" />
              <span className="h-1 w-1 animate-[typing_1.2s_ease-in-out_infinite] rounded-full bg-[var(--brand-accent)] [animation-delay:400ms]" />
            </span>
          </span>
          <span className="text-xs text-[var(--text-subtle)]">
            {seconds >= 4
              ? isEn
                ? `${formatNumber(seconds, locale)} s · technical answers can take a little longer`
                : `${formatNumber(seconds, locale)} ثانیه · پاسخ‌های فنی ممکن است کمی طول بکشد`
              : isEn
                ? "Knowledge base, standards and product catalog"
                : "بانک دانش، استانداردها و کاتالوگ محصولات"}
          </span>
        </div>
      </div>
    </div>
  );
}
