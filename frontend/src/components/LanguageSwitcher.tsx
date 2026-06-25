"use client";

import { useI18n } from "@/lib/i18n";

type LanguageSwitcherProps = {
  variant?: "blue" | "purple";
  className?: string;
};

const activeColorClass = {
  blue: "text-blue-700",
  purple: "text-purple-700",
};

function IranFlag() {
  return (
    <span
      aria-hidden="true"
      className="block h-5 w-8 overflow-hidden rounded-[5px] border border-slate-200 shadow-sm"
      style={{
        background:
          "linear-gradient(to bottom, #239f40 0 33.33%, #ffffff 33.33% 66.66%, #da0000 66.66% 100%)",
      }}
    />
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

export function LanguageSwitcher({ variant = "blue", className = "" }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();
  const isEn = locale === "en";
  const activeClass = activeColorClass[variant];

  return (
    <div className={`inline-flex rounded-2xl bg-slate-100 p-1 text-sm font-bold text-slate-600 ${className}`}>
      <button
        type="button"
        onClick={() => setLocale("fa")}
        aria-pressed={locale === "fa"}
        aria-label={isEn ? "Switch to Persian" : "تغییر به فارسی"}
        title={isEn ? "Persian" : "فارسی"}
        className={`min-w-14 rounded-xl px-3 py-2 text-lg leading-none transition-colors ${
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
        className={`min-w-14 rounded-xl px-3 py-2 text-lg leading-none transition-colors ${
          locale === "en" ? `bg-white ${activeClass} shadow-sm` : "hover:bg-white/70 hover:text-slate-900"
        }`}
      >
        <UkFlag />
      </button>
    </div>
  );
}
