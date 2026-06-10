"use client";
/**
 * کارت‌های «دستگاه مرتبط پیشنهادی» که زیر پاسخ آرتین نمایش داده می‌شوند.
 *
 * این کامپوننت قبلاً به‌صورت inline در page.tsx بود و هنگام بازطراحی چت از
 * رندر حذف شده بود (regression). اینجا بازگردانده شده و دو CTA تبدیل به آن
 * اضافه شده است:
 *   - «استعلام قیمت این دستگاه» → فرم درخواست با نوع و کالای از پیش پرشده
 *   - «مشاهده محصول» → صفحه‌ی محصول روی سایت (در صورت وجود productUrl)
 */

import Link from "next/link";
import { ExternalLink, Send } from "lucide-react";
import type { DeviceAsset } from "@/lib/device-assets";
import { useI18n } from "@/lib/i18n";

export default function RelatedDeviceCards({ devices }: { devices?: DeviceAsset[] }) {
  const { locale } = useI18n();
  const isEn = locale === "en";

  if (!devices || devices.length === 0) return null;

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {devices.map((device) => {
        const quoteHref =
          `/customer-request?type=price-inquiry&item=${encodeURIComponent(device.title)}`;

        return (
          <div
            key={device.id}
            className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex gap-4 p-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
                <img
                  src={device.image}
                  alt={device.title}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {device.title}
                </div>

                <div className="mt-1.5 text-xs leading-6 text-slate-500 dark:text-slate-400">
                  {device.subtitle}
                </div>

                <span className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {isEn ? "Suggested related device" : "دستگاه مرتبط پیشنهادی"}
                </span>
              </div>
            </div>

            {/* CTAها — تبدیل علاقه به لید درست در لحظه‌ی پیشنهاد دستگاه */}
            <div className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
              <Link
                href={quoteHref}
                className="ui-btn ui-btn-primary flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-black"
              >
                <Send size={14} aria-hidden="true" />
                {isEn ? "Request a quote" : "استعلام قیمت این دستگاه"}
              </Link>

              {device.productUrl && (
                <a
                  href={device.productUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-btn ui-btn-ghost flex shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-bold"
                >
                  {isEn ? "View product" : "مشاهده محصول"}
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
