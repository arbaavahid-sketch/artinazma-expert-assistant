import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className={vazirmatn.variable}>
        <ArtinShell>{children}</ArtinShell>
      </body>
    </html>
  );
}
