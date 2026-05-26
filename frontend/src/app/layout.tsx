import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import "./assistant-polish.css";
import ArtinShell from "@/components/ArtinShell";
import { ConfirmDialogProvider } from "@/components/ConfirmDialog";
import InstallPrompt from "@/components/InstallPrompt";
import NetworkStatus from "@/components/NetworkStatus";
import ThemeProvider from "@/components/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-persian",
  display: "swap",
});

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
  other: {
    "theme-color": "#1d4ed8",
  },
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="آرتین" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/images/artinazma-logo.png" />
        <meta name="theme-color" content="#1d4ed8" />
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}` }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={vazirmatn.variable}>
        <ThemeProvider>
          <I18nProvider>
          <ConfirmDialogProvider>
            <NetworkStatus />
            <ArtinShell>{children}</ArtinShell>
            <InstallPrompt />
          </ConfirmDialogProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
