/**
 * کمکی‌های خالص مربوط به مشتری — بدون وابستگی به state کامپوننت.
 * استخراج‌شده از assistant/page.tsx برای قابل‌تست و قابل‌استفاده‌مجدد شدن.
 */

import type { Customer } from "@/lib/chat-types";

export const CUSTOMER_STORAGE_KEY = "artin_customer";
export const CUSTOMER_AUTH_CHANGED_EVENT = "artin_customer_auth_changed";

/** عنوان کوتاه و تمیز برای یک گفتگوی ذخیره‌شده می‌سازد. */
export function makeSessionTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();

  if (!clean) return "گفتگوی جدید";

  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

/** مشتری ذخیره‌شده در localStorage را می‌خواند (در صورت نبود/خطا، null). */
export function getSavedCustomer(): Customer | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);

    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCustomer(customer: Customer): void {
  localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customer));
  window.dispatchEvent(new CustomEvent(CUSTOMER_AUTH_CHANGED_EVENT));
}

export function clearSavedCustomer(): void {
  localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(CUSTOMER_AUTH_CHANGED_EVENT));
}

export async function createCustomerSession(customerId: number): Promise<void> {
  const res = await fetch("/api/customer-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: customerId }),
  });

  if (!res.ok) {
    throw new Error("Customer session could not be created.");
  }
}
