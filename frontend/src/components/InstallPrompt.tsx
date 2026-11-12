"use client";

import { useEffect, useState } from "react";
import { Download, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import Link from 'next/link';
import {Capacitor} from '@capacitor/core';

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
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if(Capacitor.isNativePlatform()||window.matchMedia?.('(display-mode: standalone)')?.matches||(navigator as Navigator&{standalone?:boolean}).standalone)return;
    try{if(sessionStorage.getItem('pwa_install_dismissed'))return;}catch{/* Storage may be unavailable in private browsing. */}
    let timer:ReturnType<typeof setTimeout>|undefined;
    const isIos=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    if(isIos){setIos(true);timer=setTimeout(()=>setShowBanner(true),3000);}

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after a slight delay so it doesn't feel intrusive
      clearTimeout(timer);timer=setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    const installed=()=>{clearTimeout(timer);setShowBanner(false);setDeferredPrompt(null);};
    window.addEventListener('appinstalled',installed);
    return () => {clearTimeout(timer);window.removeEventListener("beforeinstallprompt", handler);window.removeEventListener('appinstalled',installed);};
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try{await deferredPrompt.prompt();await deferredPrompt.userChoice;}
    catch{/* The manual guide remains available from the navigation. */}
    finally{setShowBanner(false);setDeferredPrompt(null);}
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    try{sessionStorage.setItem("pwa_install_dismissed", "1");}catch{/* Dismiss still works without storage. */}
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-slideUp" dir={dir}>
      <div className="flex items-center gap-3 rounded-[24px] border border-[var(--color-info-border)] bg-white/95 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[var(--brand-fill)] text-white shadow-lg shadow-teal-800/20">
          <img src="/icons/pwa-96.png" alt="" className="h-full w-full object-cover" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-slate-100">
            <Sparkles size={14} className="shrink-0 text-[var(--color-info-text)] dark:text-teal-300" />
            {isEn ? "Artin on your Home Screen" : "آرتین روی صفحهٔ اصلی"}
          </p>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
            {isEn ? "Open faster from your home screen." : "دسترسی سریع‌تر از صفحه اصلی موبایل."}
          </p>
        </div>
        {ios?<Link href="/install" className="inline-flex shrink-0 items-center rounded-2xl bg-[var(--brand-fill)] px-3 py-2.5 text-xs font-bold text-white">{isEn?'Install guide':'راهنمای نصب'}</Link>:<button
          onClick={handleInstall}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-[var(--brand-fill)] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[var(--brand-fill-hover)]"
        >
          <Download size={15} />
          {isEn ? "Install" : "نصب"}
        </button>}
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
