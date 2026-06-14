"use client";

import { useEffect, useState } from "react";
import { Download, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    if (sessionStorage.getItem("pwa_install_dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after a slight delay so it doesn't feel intrusive
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    sessionStorage.setItem("pwa_install_dismissed", "1");
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-slideUp" dir={dir}>
      <div className="flex items-center gap-3 rounded-[24px] border border-blue-100 bg-white/95 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-blue-700 text-white shadow-lg shadow-blue-700/20">
          <img src="/icons/pwa-96.png" alt="" className="h-full w-full object-cover" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-slate-100">
            <Sparkles size={14} className="shrink-0 text-blue-600 dark:text-blue-300" />
            {isEn ? "Install Artin app" : "نصب اپلیکیشن آرتین"}
          </p>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
            {isEn ? "Open faster from your home screen." : "دسترسی سریع‌تر از صفحه اصلی موبایل."}
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
        >
          <Download size={15} />
          {isEn ? "Install" : "نصب"}
        </button>
        <button
          onClick={handleDismiss}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          aria-label={isEn ? "Close" : "بستن"}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
