import type { Metadata } from "next";
import "./globals.css";
import ArtinShell from "@/components/ArtinShell";

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
      <body>
        <ArtinShell>{children}</ArtinShell>
      </body>
    </html>
  );
}