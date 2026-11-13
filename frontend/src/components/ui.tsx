/**
 * کامپوننت‌های پایهٔ مشترک رابط کاربری.
 *
 * این‌ها پوسته‌های نازکی روی کلاس‌های سراسری ui-* در globals.css هستند تا
 * صفحه‌ها به‌جای تکرار رشته‌های طولانی کلاس، از یک نقطهٔ مشترک استفاده کنند
 * و ظاهر دکمه‌ها، کارت‌ها و پیام‌ها همه‌جا یکدست بماند. همهٔ کامپوننت‌ها
 * className اضافه می‌پذیرند و با هر دو تم روشن و تاریک سازگارند.
 */
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger";
const buttonVariant: Record<Variant, string> = {
  primary: "ui-btn ui-btn-primary",
  ghost: "ui-btn ui-btn-ghost",
  danger: "ui-btn ui-btn-danger",
};

export function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...props} className={`${buttonVariant[variant]} ${className}`} />;
}

/** لینکی که شبیه دکمه است — برای مسیرهای داخلی اپ. */
export function ButtonLink({
  variant = "ghost",
  className = "",
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; href: string }) {
  return <Link href={href} {...props} className={`${buttonVariant[variant]} ${className}`} />;
}

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`ui-card ${className}`} />;
}

type Tone = "info" | "success" | "warning" | "danger";

export function Alert({
  tone = "info",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div role={tone === "danger" ? "alert" : "status"} {...props} className={`ui-alert ui-alert-${tone === "danger" ? "error" : tone} ${className}`} />;
}

// نام کلاس‌ها باید به‌صورت رشتهٔ کامل در کد باشند تا Tailwind آن‌ها را بسازد.
const badgeTone: Record<Tone, string> = {
  info: "border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
  success: "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]",
  warning: "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
  danger: "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
};

export function Badge({
  tone = "info",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; children: ReactNode }) {
  return (
    <span
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${badgeTone[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`ui-empty ${className}`} />;
}
