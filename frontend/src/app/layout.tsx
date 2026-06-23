import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "./assistant-polish.css";
import ArtinShell from "@/components/ArtinShell";
import { ConfirmDialogProvider } from "@/components/ConfirmDialog";
import ErrorBoundary from "@/components/ErrorBoundary";
import InstallPrompt from "@/components/InstallPrompt";
import NetworkStatus from "@/components/NetworkStatus";
import ThemeProvider from "@/components/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "آرتین آزما | دستیار هوشمند تخصصی",
  description:
    "دستیار هوشمند آرتین برای پاسخ‌گویی تخصصی، تحلیل تست‌ها، بانک دانش، تجهیزات و کاتالیست‌های آرتین آزما",
  keywords: [
    "آرتین آزما",
    "تجهیزات آزمایشگاهی",
    "مواد شیمیایی",
    "کاتالیست",
    "XRF",
    "ICP",
    "GC",
    "HPLC",
    "نفت و گاز",
    "پتروشیمی",
    "آنالیز",
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "آرتین آزما مهر",
  url: "https://artinazma.net",
  description: "تأمین‌کننده تجهیزات آزمایشگاهی، مواد شیمیایی، کاتالیست‌ها و مواد فرایندی",
  sameAs: ["https://artinazma.net"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* theme-color is declared first so the pre-paint script below can update
            it before the browser chrome renders. */}
        <meta name="theme-color" content="#1d4ed8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="آرتین" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/pwa-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        {/* Apply theme before first paint to avoid a flash of the wrong theme (FOUC).
            Falls back to the OS preference when the user hasn't chosen one. */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('artin_theme');var lg=localStorage.getItem('artin_dark_mode');var sys=!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var d;if(t==='dark')d=true;else if(t==='light')d=false;else if(t==='system')d=sys;else if(lg!==null)d=lg==='true';else d=sys;if(d){document.documentElement.classList.add('dark');var m=document.querySelector('meta[name=\"theme-color\"]');if(m){m.setAttribute('content','#0d1117');}}}catch(e){}})();",
          }}
        />
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}",
          }}
        />
        <Script
          id="ld-json"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <ThemeProvider>
          <I18nProvider>
          <ConfirmDialogProvider>
            <NetworkStatus />
            <ErrorBoundary>
              <ArtinShell>{children}</ArtinShell>
            </ErrorBoundary>
            <InstallPrompt />
          </ConfirmDialogProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
