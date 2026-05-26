"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import faStrings from "./fa.json";
import enStrings from "./en.json";

export type Locale = "fa" | "en";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
}

const translations: Record<Locale, Record<string, unknown>> = {
  fa: faStrings,
  en: enStrings,
};

const I18nContext = createContext<I18nContextValue>({
  locale: "fa",
  setLocale: () => {},
  t: (key: string) => key,
  dir: "rtl",
});

/**
 * Resolve a dot-separated key like "auth.loginTitle" from nested JSON.
 */
function resolve(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path; // fallback: return key itself
    }
  }
  return typeof current === "string" ? current : path;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fa");

  useEffect(() => {
    const stored = localStorage.getItem("artin_locale") as Locale | null;
    if (stored && (stored === "fa" || stored === "en")) {
      setLocaleState(stored);
      applyLocale(stored);
    }
  }, []);

  function applyLocale(loc: Locale) {
    const html = document.documentElement;
    html.setAttribute("lang", loc === "fa" ? "fa" : "en");
    html.setAttribute("dir", loc === "fa" ? "rtl" : "ltr");
  }

  function setLocale(loc: Locale) {
    setLocaleState(loc);
    localStorage.setItem("artin_locale", loc);
    applyLocale(loc);
  }

  const t = useCallback(
    (key: string): string => resolve(translations[locale] as Record<string, unknown>, key),
    [locale]
  );

  const dir = locale === "fa" ? "rtl" : "ltr";

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useTranslation() {
  const { t, locale, dir } = useContext(I18nContext);
  return { t, locale, dir };
}
