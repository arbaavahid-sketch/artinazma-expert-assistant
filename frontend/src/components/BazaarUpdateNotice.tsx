"use client";

import { useEffect, useState } from "react";

const APP_ID = "net.artinazma.expertassistant";
const BAZAAR_URL = `https://cafebazaar.ir/app/${APP_ID}`;
const DISMISSED_VERSION_KEY = "artin_bazaar_update_dismissed";

function readDismissedVersion() {
  try {
    return window.localStorage.getItem(DISMISSED_VERSION_KEY);
  } catch {
    return null;
  }
}

export default function BazaarUpdateNotice({ en }: { en: boolean }) {
  const [availableVersion, setAvailableVersion] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function checkForUpdate() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

        const { App } = await import("@capacitor/app");
        const { id, build } = await App.getInfo();
        if (id !== APP_ID || !/^[1-9][0-9]*$/.test(build)) return;

        const response = await fetch("/api/app-update", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const { latestVersionCode } = await response.json();
        if (
          !controller.signal.aborted &&
          Number.isSafeInteger(latestVersionCode) &&
          latestVersionCode > Number(build) &&
          readDismissedVersion() !== String(latestVersionCode)
        ) {
          setAvailableVersion(latestVersionCode);
        }
      } catch {
        // Checking for an update is optional and must not block the app.
      }
    }

    void checkForUpdate();
    return () => controller.abort();
  }, []);

  if (availableVersion === null) return null;

  function dismiss() {
    setAvailableVersion(null);
    try {
      window.localStorage.setItem(DISMISSED_VERSION_KEY, String(availableVersion));
    } catch {
      // The current view can still be dismissed when storage is unavailable.
    }
  }

  return (
    <aside
      aria-label={en ? "App update" : "به‌روزرسانی اپ"}
      className="mx-3 mb-2 flex shrink-0 flex-wrap items-center gap-x-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1 text-sm"
    >
      <p role="status" className="min-w-0 flex-1 basis-40 py-2 font-medium">
        {en ? "A new version of Artin is available in Bazaar." : "نسخهٔ جدید آرتین در بازار موجود است."}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <a className="ui-btn ui-btn-primary min-h-11" href={BAZAAR_URL}>
          {en ? "Update in Bazaar" : "به‌روزرسانی در بازار"}
        </a>
        <button type="button" className="ui-btn ui-btn-ghost min-h-11" onClick={dismiss}>
          {en ? "Later" : "بعداً"}
        </button>
      </div>
    </aside>
  );
}
