"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Plus, SlidersHorizontal } from "lucide-react";
import { useExportChat } from "@/hooks/useExportChat";
import type { ChatMessage } from "@/lib/chat-types";

const DOMAINS = [
  ["auto", "Auto detect", "تشخیص خودکار"],
  ["catalyst", "Catalyst", "کاتالیست"],
  ["equipment", "Equipment", "تجهیزات"],
  ["chromatography", "Chromatography", "کروماتوگرافی"],
  ["mercury-analysis", "Mercury analysis", "آنالیز جیوه"],
  ["sulfur-analysis", "Sulfur analysis", "آنالیز سولفور"],
  ["troubleshooting", "Troubleshooting", "عیب‌یابی"],
  ["analysis", "Analysis & testing", "آنالیز و تست"],
] as const;

const RESPONSE_MODES = [
  ["auto", "Smart answer", "پاسخ هوشمند"],
  ["brief", "Brief", "خلاصه"],
  ["technical", "Full technical", "فنی کامل"],
  ["checklist", "Checklist", "چک‌لیست"],
] as const;

const exportItemClass =
  "flex w-full items-center gap-2.5 px-4 py-3 text-right text-sm font-semibold text-[var(--text-muted)] transition hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-text)]";
const headerButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-soft)] sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5";

/** Chat title bar: sign-in links, question domain, response style, export and new chat. */
export default function ChatHeader({
  isEn,
  dir,
  signedIn,
  messages,
  domain,
  onDomainChange,
  responseMode,
  onResponseModeChange,
  onNewChat,
}: {
  isEn: boolean;
  dir: "rtl" | "ltr";
  signedIn: boolean;
  messages: ChatMessage[];
  domain: string;
  onDomainChange: (value: string) => void;
  responseMode: string;
  onResponseModeChange: (value: string) => void;
  onNewChat: () => void;
}) {
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const { showExportMenu, setShowExportMenu, exportChat, exportChatWord, exportChatText } = useExportChat(messages);
  const domainOptions = DOMAINS.map(([value, en, fa]) => <option key={value} value={value}>{isEn ? en : fa}</option>);
  const modeOptions = RESPONSE_MODES.map(([value, en, fa]) => <option key={value} value={value}>{isEn ? en : fa}</option>);

  return (
    <>
      <header className="artin-workspace-header shrink-0 border-b">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/images/artin-avatar.webp"
              alt={isEn ? "Artin" : "آرتین"}
              className="h-7 w-7 shrink-0 rounded-full border border-[var(--border-soft)] object-cover shadow-sm sm:h-8 sm:w-8"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="text-[14px] font-bold text-[var(--foreground)] sm:text-[15px]">{isEn ? "Artin AI" : "آرتین AI"}</span>
            <span className="rounded-full bg-[var(--color-success-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-success-text)] sm:text-[11px]">
              {isEn ? "Online" : "آنلاین"}
            </span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            {!signedIn && (
              <>
                <Link href="/customer-login?next=/assistant" className="shrink-0 rounded-lg bg-[var(--brand-fill)] px-3 py-2 text-xs font-bold text-white">{isEn ? "Sign in" : "ورود به حساب"}</Link>
                <Link href="/customer-register" className="shrink-0 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-xs font-bold">{isEn ? "Register" : "ثبت‌نام"}</Link>
              </>
            )}
            {/* Domain + mode — visible on desktop, hidden on mobile */}
            <select
              aria-label={isEn ? "Question domain" : "حوزهٔ پرسش"}
              disabled={!signedIn}
              value={domain}
              onChange={(e) => onDomainChange(e.target.value)}
              className="hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] focus:outline-none md:block"
            >
              {domainOptions}
            </select>
            <select
              aria-label={isEn ? "Response style" : "سبک پاسخ"}
              disabled={!signedIn}
              value={responseMode}
              onChange={(e) => onResponseModeChange(e.target.value)}
              className="hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] focus:outline-none md:block"
            >
              {modeOptions}
            </select>
            {/* Mobile settings toggle — only on mobile */}
            <button
              type="button"
              disabled={!signedIn}
              onClick={() => setShowMobileSettings((v) => !v)}
              aria-label={isEn ? "Chat settings" : "تنظیمات گفتگو"}
              aria-expanded={showMobileSettings}
              aria-controls={showMobileSettings ? "artin-mobile-chat-settings" : undefined}
              title={isEn ? "Chat settings" : "تنظیمات گفتگو"}
              className={`flex h-8 w-8 items-center justify-center rounded-xl border transition md:hidden ${
                showMobileSettings
                  ? "border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]"
                  : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-subtle)] hover:bg-[var(--surface-soft)]"
              }`}
            >
              <SlidersHorizontal size={15} />
            </button>
            {signedIn && messages.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu((v) => !v)}
                  title={isEn ? "Export chat" : "خروجی گفتگو"}
                  className={headerButtonClass}
                  aria-label={isEn ? "Download" : "دانلود"}
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">{isEn ? "Download" : "دانلود"}</span>
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute left-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-xl md:left-0 max-[400px]:left-auto max-[400px]:right-0">
                      <button onClick={exportChat} className={exportItemClass}>
                        <span className="text-base">📄</span>
                        PDF (چاپ)
                      </button>
                      <button onClick={exportChatWord} className={`${exportItemClass} border-t border-[var(--border-soft)]`}>
                        <span className="text-base">📝</span>
                        Word (.doc)
                      </button>
                      <button onClick={exportChatText} className={`${exportItemClass} border-t border-[var(--border-soft)]`}>
                        <span className="text-base">📋</span>
                        متن ساده (.txt)
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <button onClick={onNewChat} className={headerButtonClass} aria-label={isEn ? "New chat" : "گفتگوی جدید"}>
              <Plus size={13} />
              <span className="hidden sm:inline">{isEn ? "New" : "جدید"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile settings panel — slides in below header on small screens */}
      {showMobileSettings && (
        <div id="artin-mobile-chat-settings" className="artin-motion-panel shrink-0 border-b border-[var(--border-soft)] bg-[var(--surface)] px-3 py-3 md:hidden" dir={dir}>
          <div className="grid grid-cols-2 items-start gap-x-2 gap-y-1.5">
            <label htmlFor="artin-mobile-domain" className="text-xs font-semibold">{isEn ? "Question domain" : "حوزهٔ پرسش"}</label>
            <label htmlFor="artin-mobile-response-mode" className="text-xs font-semibold">{isEn ? "Response style" : "سبک پاسخ"}</label>
            <select
              id="artin-mobile-domain"
              disabled={!signedIn}
              value={domain}
              onChange={(e) => onDomainChange(e.target.value)}
              className="min-h-10 min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-2 text-xs"
            >
              {domainOptions}
            </select>
            <select
              id="artin-mobile-response-mode"
              disabled={!signedIn}
              value={responseMode}
              onChange={(e) => onResponseModeChange(e.target.value)}
              className="min-h-10 min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-2 text-xs"
            >
              {modeOptions}
            </select>
          </div>
        </div>
      )}
    </>
  );
}
