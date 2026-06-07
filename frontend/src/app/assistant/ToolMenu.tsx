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
import { useI18n } from "@/lib/i18n";

export const tools: {
  action: ToolAction;
  icon: string;
}[] = [
  {
    action: "upload",
    icon: "📎",
  },
  {
    action: "troubleshooting",
    icon: "🛠️",
  },
  {
    action: "device-suggestion",
    icon: "⚙️",
  },
  {
    action: "catalyst-suggestion",
    icon: "🧪",
  },
  {
    action: "customer-request",
    icon: "👤",
  },
];

const toolLabels: Record<ToolAction, { fa: string; en: string }> = {
  upload: { fa: "آپلود فایل یا عکس", en: "Upload file or image" },
  troubleshooting: { fa: "عیب‌یابی تجهیزات", en: "Equipment troubleshooting" },
  "device-suggestion": { fa: "پیشنهاد دستگاه", en: "Device suggestion" },
  "catalyst-suggestion": { fa: "پیشنهاد کاتالیست", en: "Catalyst suggestion" },
  "customer-request": { fa: "ثبت درخواست مشاوره", en: "Request consultation" },
};

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
  const { locale, dir } = useI18n();
  return (
    <div className="ui-card w-[245px] overflow-hidden rounded-[18px] py-1.5 shadow-xl shadow-slate-300/40" dir={dir}>
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

            <span className="flex-1">{toolLabels[tool.action][locale]}</span>
          </button>
        );
      })}
    </div>
  );
}
