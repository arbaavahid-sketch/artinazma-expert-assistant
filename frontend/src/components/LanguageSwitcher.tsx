"use client";

import { useI18n } from "@/lib/i18n";

type LanguageSwitcherProps = {
  variant?: "blue" | "purple";
  size?: "default" | "compact";
  className?: string;
};

const activeColorClass = {
  blue: "text-blue-700",
  purple: "text-purple-700",
};

function IranFlag() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 20"
      className="block h-5 w-8 overflow-hidden rounded-[5px] border border-slate-200 shadow-sm"
    >
      {/* استایل flat: سبز روشن، سفید، قرمز ملایم + نوارهای کنگره‌ایِ سفید */}
      <rect width="32" height="20" fill="#f5f5f5" />
      <rect width="32" height="6.67" fill="#73af00" />
      <rect y="13.33" width="32" height="6.67" fill="#ff4b55" />
      {/* نوار کنگره‌ای لبهٔ سبز و لبهٔ قرمز (تکبیر) */}
      <g fill="#f5f5f5">
        <path d="M0 5.55 H32 V6.0 H0 Z" />
        <path d="M0 14.0 H32 V14.45 H0 Z" />
      </g>
      <g fill="none" strokeLinecap="butt">
        <path d="M0 6.35 H32" stroke="#f5f5f5" strokeWidth="0.7" strokeDasharray="0.9 0.6" />
        <path d="M0 13.65 H32" stroke="#f5f5f5" strokeWidth="0.7" strokeDasharray="0.9 0.6" />
      </g>
      {/* نشان الله: شمشیر مرکزی + دو جفت هلال توپُر + تشدید */}
      <g transform="translate(16 10.05) scale(0.62)" fill="#ff4b55">
        {/* شمشیر مرکزی */}
        <path d="M0 -3.4 L0.5 -2.45 L0.5 2.0 L0 3.55 L-0.5 2.0 L-0.5 -2.45 Z" />
        {/* هلال داخلی و بیرونی سمت راست */}
        <path d="M0.85 -2.7 C2.95 -1.75 2.95 1.75 0.85 2.7 C2.25 1.5 2.25 -1.5 0.85 -2.7 Z" />
        <path d="M1.65 -3.05 C4.65 -1.55 4.45 2.55 1.3 3.7 C3.75 2.3 3.95 -1.15 1.65 -3.05 Z" />
        {/* قرینهٔ سمت چپ */}
        <g transform="scale(-1 1)">
          <path d="M0.85 -2.7 C2.95 -1.75 2.95 1.75 0.85 2.7 C2.25 1.5 2.25 -1.5 0.85 -2.7 Z" />
          <path d="M1.65 -3.05 C4.65 -1.55 4.45 2.55 1.3 3.7 C3.75 2.3 3.95 -1.15 1.65 -3.05 Z" />
        </g>
        {/* تشدید بالای نشان */}
        <path d="M-1.05 -4.02 Q-0.52 -4.75 0 -4.02 Q0.52 -4.75 1.05 -4.02 L1.05 -3.7 Q0.52 -4.32 0 -3.66 Q-0.52 -4.32 -1.05 -3.7 Z" />
      </g>
    </svg>
  );
}

function UkFlag() {
  return (
    <span
      aria-hidden="true"
      className="block h-5 w-8 overflow-hidden rounded-[5px] border border-slate-200 shadow-sm"
      style={{
        background:
          "linear-gradient(27deg, transparent 0 44%, #ffffff 44% 48%, #c8102e 48% 52%, #ffffff 52% 56%, transparent 56% 100%), linear-gradient(153deg, transparent 0 44%, #ffffff 44% 48%, #c8102e 48% 52%, #ffffff 52% 56%, transparent 56% 100%), linear-gradient(to right, transparent 0 38%, #ffffff 38% 44%, #c8102e 44% 56%, #ffffff 56% 62%, transparent 62% 100%), linear-gradient(to bottom, transparent 0 34%, #ffffff 34% 42%, #c8102e 42% 58%, #ffffff 58% 66%, transparent 66% 100%), #012169",
      }}
    />
  );
}

export function LanguageSwitcher({ variant = "blue", size = "default", className = "" }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();
  const isEn = locale === "en";
  const activeClass = activeColorClass[variant];
  const isCompact = size === "compact";
  const containerClass = isCompact
    ? "rounded-xl p-0.5 text-[11px]"
    : "rounded-2xl p-1 text-sm";
  const buttonClass = isCompact
    ? "min-w-9 rounded-lg px-1.5 py-1"
    : "min-w-14 rounded-xl px-3 py-2";

  return (
    <div className={`inline-flex bg-slate-100 font-bold text-slate-600 ${containerClass} ${className}`}>
      <button
        type="button"
        onClick={() => setLocale("fa")}
        aria-pressed={locale === "fa"}
        aria-label={isEn ? "Switch to Persian" : "تغییر به فارسی"}
        title={isEn ? "Persian" : "فارسی"}
        className={`${buttonClass} text-lg leading-none transition-colors ${
          locale === "fa" ? `bg-white ${activeClass} shadow-sm` : "hover:bg-white/70 hover:text-slate-900"
        }`}
      >
        <IranFlag />
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        aria-label={isEn ? "Switch to English" : "تغییر به انگلیسی"}
        title={isEn ? "English" : "انگلیسی"}
        className={`${buttonClass} text-lg leading-none transition-colors ${
          locale === "en" ? `bg-white ${activeClass} shadow-sm` : "hover:bg-white/70 hover:text-slate-900"
        }`}
      >
        <UkFlag />
      </button>
    </div>
  );
}
