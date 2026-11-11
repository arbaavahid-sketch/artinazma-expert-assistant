"use client";

import { useSyncExternalStore } from "react";

const changed = "artin-conversation-labels-changed";
const labels = [
  { id: "saved", fa: "ذخیره‌شده", en: "Saved" },
  { id: "lab", fa: "آزمایشگاه", en: "Laboratory" },
  { id: "equipment", fa: "تجهیزات", en: "Equipment" },
  { id: "industrial", fa: "صنعتی", en: "Industrial" },
] as const;

function subscribe(listener: () => void) {
  window.addEventListener(changed, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(changed, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useConversationLabels(customerId?: number) {
  const key = customerId === undefined ? null : `artin-chat-labels:${customerId}`;
  const snapshot = useSyncExternalStore(subscribe, () => {
    try { return key ? localStorage.getItem(key) ?? "{}" : "{}"; }
    catch { return "{}"; }
  }, () => "{}");
  let assignments: Record<number, string[]> = {};
  try { assignments = JSON.parse(snapshot) ?? {}; } catch { /* Use an empty index. */ }

  function toggle(sessionId: number, label: string) {
    if (!key) return;
    const current = assignments[sessionId] ?? [];
    const next = current.includes(label) ? current.filter((id) => id !== label) : [...current, label];
    try {
      localStorage.setItem(key, JSON.stringify({ ...assignments, [sessionId]: next }));
      window.dispatchEvent(new Event(changed));
    } catch { /* History stays available when storage is blocked. */ }
  }

  return { assignments, toggle };
}

export { labels as conversationLabels };
