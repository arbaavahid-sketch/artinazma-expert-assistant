/**
 * کمکی‌های خالص مربوط به مشتری — بدون وابستگی به state کامپوننت.
 * استخراج‌شده از assistant/page.tsx برای قابل‌تست و قابل‌استفاده‌مجدد شدن.
 */

import type { Customer } from "@/lib/chat-types";

/** عنوان کوتاه و تمیز برای یک گفتگوی ذخیره‌شده می‌سازد. */
export function makeSessionTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();

  if (!clean) return "گفتگوی جدید";

  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

/** مشتری ذخیره‌شده در localStorage را می‌خواند (در صورت نبود/خطا، null). */
export function getSavedCustomer(): Customer | null {
  try {
    const raw = localStorage.getItem("artin_customer");

    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    return null;
  }
}
