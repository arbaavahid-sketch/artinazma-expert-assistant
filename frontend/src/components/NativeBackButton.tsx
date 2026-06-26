"use client";

import { useEffect } from "react";

export default function NativeBackButton() {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function registerBackButton() {
      try {
        const [{ App }, { Capacitor }] = await Promise.all([
          import("@capacitor/app"),
          import("@capacitor/core"),
        ]);

        if (!Capacitor.isNativePlatform()) return;

        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          const menuOpen =
            document
              .querySelector("[data-mobile-sidebar-open]")
              ?.getAttribute("data-mobile-sidebar-open") === "true";

          if (menuOpen) {
            window.dispatchEvent(new Event("artin:close-mobile-sidebar"));
            return;
          }

          if (canGoBack && window.history.length > 1) {
            window.history.back();
            return;
          }

          void App.exitApp();
        });

        cleanup = () => {
          void handle.remove();
        };

        if (cancelled) {
          cleanup();
        }
      } catch {
        cleanup = undefined;
      }
    }

    void registerBackButton();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
