"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const THEME_COLORS: Record<Theme, string> = {
  light: "#1d4ed8",
  dark: "#0d1117",
};

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[t]);
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // The pre-paint head script already set the class; sync React state to it.
    // Resolution order: explicit choice (artin_theme) → legacy key
    // (artin_dark_mode, from the old ArtinShell toggle) → OS preference.
    const stored = localStorage.getItem("artin_theme") as Theme | null;
    const legacy = localStorage.getItem("artin_dark_mode");
    const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial: Theme =
      stored ??
      (legacy !== null ? (legacy === "true" ? "dark" : "light") : systemDark ? "dark" : "light");
    setThemeState(initial);
    applyTheme(initial);

    // While the user hasn't made an explicit choice, follow OS changes live.
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => {
      // An explicit choice (new or legacy key) always wins over OS changes.
      if (localStorage.getItem("artin_theme") || localStorage.getItem("artin_dark_mode")) return;
      const next: Theme = e.matches ? "dark" : "light";
      setThemeState(next);
      applyTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    localStorage.setItem("artin_theme", t);
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
