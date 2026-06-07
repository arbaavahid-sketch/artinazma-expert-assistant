"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Status = "online" | "offline" | "checking";

const POLL_INTERVAL = 30_000; // 30 seconds
const TIMEOUT_MS = 5_000;

export default function ServerStatus() {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [status, setStatus] = useState<Status>("checking");
  const [latency, setLatency] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function check() {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(apiUrl("/health"), {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      if (res.ok) {
        setStatus("online");
        setLatency(Date.now() - start);
      } else {
        setStatus("offline");
        setLatency(null);
      }
    } catch {
      setStatus("offline");
      setLatency(null);
    }
  }

  useEffect(() => {
    check();
    timerRef.current = setInterval(check, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const dot =
    status === "online"
      ? "bg-emerald-500"
      : status === "offline"
      ? "bg-red-500"
      : "bg-amber-400";

  const label =
    status === "online"
      ? latency !== null
        ? `${isEn ? "Server online" : "سرور آنلاین"} • ${latency}ms`
        : isEn ? "Server online" : "سرور آنلاین"
      : status === "offline"
      ? isEn ? "Server offline" : "سرور آفلاین"
      : isEn ? "Checking..." : "در حال بررسی...";

  return (
    <button
      onClick={check}
      title={label}
      className="group flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      <span
        className={`relative flex h-2 w-2 shrink-0`}
      >
        {status === "online" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span className="hidden text-[11px] font-bold text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300 sm:inline">
        {status === "online" ? (isEn ? "Online" : "آنلاین") : status === "offline" ? (isEn ? "Offline" : "آفلاین") : "..."}
      </span>
    </button>
  );
}
