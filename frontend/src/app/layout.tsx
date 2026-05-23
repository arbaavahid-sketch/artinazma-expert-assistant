import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import "./assistant-polish.css";
import ArtinShell from "@/components/ArtinShell";

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
      </head>
      <body className={vazirmatn.variable}>
        <ArtinShell>{children}</ArtinShell>
      </body>
    </html>
  );
}
