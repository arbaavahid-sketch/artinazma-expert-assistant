"use client";
/**
 * منوی ابزارها — استخراج‌شده از assistant/page.tsx برای کاهش حجم صفحه.
 * شامل لیست ابزارها، نگاشت آیکون و کامپوننت منو.
 */

import {
  Paperclip,
  Wrench,
  Settings,
  FlaskConical,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ToolAction } from "@/lib/chat-types";

export const tools: {
  label: string;
  description: string;
  action: ToolAction;
  icon: string;
}[] = [
  {
    label: "آپلود فایل یا عکس",
    description: "تحلیل PDF، Excel، CSV، عکس خطا یا کروماتوگرام",
    action: "upload",
    icon: "📎",
  },
  {
    label: "عیب‌یابی تجهیزات",
    description: "ساخت قالب سوال برای خطا یا مشکل دستگاه",
    action: "troubleshooting",
    icon: "🛠️",
  },
  {
    label: "پیشنهاد دستگاه",
    description: "انتخاب تجهیز مناسب برای کاربرد یا نمونه",
    action: "device-suggestion",
    icon: "⚙️",
  },
  {
    label: "پیشنهاد کاتالیست",
    description: "بررسی کاتالیست یا تست‌های تکمیلی",
    action: "catalyst-suggestion",
    icon: "🧪",
  },
  {
    label: "ثبت درخواست مشاوره",
    description: "ارسال اطلاعات تماس برای پیگیری کارشناس",
    action: "customer-request",
    icon: "👤",
  },
];

export function getToolIcon(action: ToolAction): LucideIcon {
  if (action === "upload") return Paperclip;
  if (action === "troubleshooting") return Wrench;
  if (action === "device-suggestion") return Settings;
  if (action === "catalyst-suggestion") return FlaskConical;
  return UserRound;
}

export default function ToolMenu({
  onSelect,
}: {
  onSelect: (action: ToolAction) => void;
}) {
  return (
    <div className="ui-card w-[245px] overflow-hidden rounded-[18px] py-1.5 shadow-xl shadow-slate-300/40">
      {tools.map((tool, index) => {
        const Icon = getToolIcon(tool.action);

        return (
          <button
            key={tool.action}
            onClick={() => onSelect(tool.action)}
            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-right text-[13px] font-medium text-slate-800 transition hover:bg-slate-50 ${
              index === 0 || index === 3 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-700">
              <Icon size={17} strokeWidth={1.9} />
            </span>

            <span className="flex-1">{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
}
