"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

type Theme = "light" | "dark";
type ThemePref = "light" | "dark" | "system";

interface ThemeContextType {
  /** The resolved theme actually applied to the page. */
  theme: Theme;
  /** The user's preference: an explicit theme, or "system" to follow the OS. */
  pref: ThemePref;
  /** Set the preference (persists the choice). */
  setPref: (p: ThemePref) => void;
  /** Cycle light → dark → system → light. */
  cycleTheme: () => void;
  /** Back-compat: toggle between an explicit light/dark choice. */
  toggleTheme: () => void;
  /** Back-compat: set an explicit theme. */
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  pref: "system",
  setPref: () => {},
  cycleTheme: () => {},
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

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolvePref(p: ThemePref): Theme {
  return p === "system" ? (systemPrefersDark() ? "dark" : "light") : p;
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[t]);
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [theme, setThemeState] = useState<Theme>("light");
  const prefRef = useRef<ThemePref>("system");

  // Apply a preference: resolve it, sync state + DOM, and optionally persist.
  const applyPref = (p: ThemePref, persist: boolean) => {
    const resolved = resolvePref(p);
    prefRef.current = p;
    setPrefState(p);
    setThemeState(resolved);
    applyTheme(resolved);
    if (persist) localStorage.setItem("artin_theme", p);
  };

  useEffect(() => {
    // Resolution order: explicit choice (artin_theme) → legacy key
    // (artin_dark_mode, from the old ArtinShell toggle) → "system".
    const stored = localStorage.getItem("artin_theme");
    const legacy = localStorage.getItem("artin_dark_mode");
    let initial: ThemePref;
    if (stored === "light" || stored === "dark" || stored === "system") {
      initial = stored;
    } else if (legacy !== null) {
      initial = legacy === "true" ? "dark" : "light";
    } else {
      initial = "system";
    }
    applyPref(initial, false);

    // When following the OS, react to OS theme changes live.
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = () => {
      if (prefRef.current !== "system") return;
      const resolved: Theme = systemPrefersDark() ? "dark" : "light";
      setThemeState(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPref = (p: ThemePref) => applyPref(p, true);
  const cycleTheme = () =>
    setPref(pref === "light" ? "dark" : pref === "dark" ? "system" : "light");
  const toggleTheme = () => setPref(theme === "dark" ? "light" : "dark");
  const setTheme = (t: Theme) => setPref(t);

  return (
    <ThemeContext.Provider value={{ theme, pref, setPref, cycleTheme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
