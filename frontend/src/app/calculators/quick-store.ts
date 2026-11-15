import { useSyncExternalStore } from "react";
import { DEFAULT_DIGITS, DIGIT_OPTIONS } from "./quick-format";

/** Form state needed to reopen a quick calculation exactly as it was entered. */
export type QuickSnapshot = {
  values: string[];
  alternate: Record<number, boolean>;
  from: string;
  to: string;
  ppmFromMass: boolean;
  sampleUnit: string;
  unknowns: string;
  quantity?: string;
};
export type QuickEntry = { tool: string; at: string; output: string; inputs: string; state: QuickSnapshot };

// Kept on this device only. Input values are never sent with usage records.
const HISTORY_KEY = "artin.quick-history.v1";
const DIGITS_KEY = "artin.quick-digits.v1";
export const HISTORY_LIMIT = 20;
const EMPTY: QuickEntry[] = [];

let history: QuickEntry[] | null = null;
let digits: number | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const notify = () => listeners.forEach(listener => listener());

function validEntry(entry: unknown): entry is QuickEntry {
  const item = entry as QuickEntry;
  return Boolean(item) && typeof item.tool === "string" && typeof item.at === "string" && typeof item.output === "string" &&
    typeof item.inputs === "string" && Boolean(item.state) && Array.isArray(item.state.values) &&
    item.state.values.every(value => typeof value === "string");
}

export function readQuickHistory(): QuickEntry[] {
  if (history) return history;
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    history = Array.isArray(stored) ? stored.filter(validEntry).slice(0, HISTORY_LIMIT) : EMPTY;
  } catch {
    history = EMPTY;
  }
  return history;
}

function writeHistory(next: QuickEntry[]) {
  history = next;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* History is a convenience; the calculation stands without it. */ }
  notify();
}

/** Newest first. Repeating the same calculation refreshes its entry instead of adding another. */
export function addQuickEntry(entry: QuickEntry) {
  const same = JSON.stringify(entry.state);
  writeHistory([entry, ...readQuickHistory().filter(item => item.tool !== entry.tool || JSON.stringify(item.state) !== same)].slice(0, HISTORY_LIMIT));
}

export const clearQuickHistory = () => writeHistory(EMPTY);

export function readQuickDigits(): number {
  if (digits !== null) return digits;
  try {
    const stored = Number(localStorage.getItem(DIGITS_KEY));
    digits = (DIGIT_OPTIONS as readonly number[]).includes(stored) ? stored : DEFAULT_DIGITS;
  } catch {
    digits = DEFAULT_DIGITS;
  }
  return digits;
}

export function setQuickDigits(value: number) {
  if (!(DIGIT_OPTIONS as readonly number[]).includes(value)) return;
  digits = value;
  try { localStorage.setItem(DIGITS_KEY, String(value)); } catch { /* Falls back to the default next time. */ }
  notify();
}

export const useQuickHistory = () => useSyncExternalStore(subscribe, readQuickHistory, () => EMPTY);
export const useQuickDigits = () => useSyncExternalStore(subscribe, readQuickDigits, () => DEFAULT_DIGITS);

/** Test hook: forget cached values so the next read comes from storage. */
export function resetQuickStore() { history = null; digits = null; }
