"use client";

import { Mic, MicOff, Loader, StopCircle } from "lucide-react";
import type { RefObject, KeyboardEvent } from "react";
import type { ToolAction } from "@/lib/chat-types";
import { getTextFont } from "@/lib/chat-helpers";
import { useI18n } from "@/lib/i18n";
import ToolMenu from "@/app/assistant/ToolMenu";

/**
 * Centered composer shown on the empty assistant page (before any messages).
 * Simpler than the bottom ChatComposer: no image attachments. State and
 * behaviour are owned by the parent and passed in as props.
 */
type HeroComposerProps = {
  showTools: boolean;
  onToggleTools: () => void;
  onToolSelect: (action: ToolAction) => void;
  chatInputRef: RefObject<HTMLTextAreaElement | null>;
  message: string;
  onMessageChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  isVoiceSupported: boolean;
  onToggleVoice: () => void;
  voiceState: string;
  loading: boolean;
  onStop: () => void;
  onSend: () => void;
  /** Whether the user is currently rate-limited (disables send). */
  rateLimitActive: boolean;
};

export default function HeroComposer({
  showTools,
  onToggleTools,
  onToolSelect,
  chatInputRef,
  message,
  onMessageChange,
  onKeyDown,
  isVoiceSupported,
  onToggleVoice,
  voiceState,
  loading,
  onStop,
  onSend,
  rateLimitActive,
}: HeroComposerProps) {
  const { t, locale } = useI18n();
  const isEn = locale === "en";

  return (
    <div className="relative mt-5 w-full max-w-3xl px-1 md:mt-8 md:px-0">
      {showTools && (
        <div className={`absolute top-full z-50 mt-2 ${isEn ? "left-0" : "right-0"}`}>
          <ToolMenu onSelect={onToolSelect} />
        </div>
      )}

      <div className="ui-card rounded-[32px] shadow-xl shadow-slate-200/70">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onToggleTools}
            aria-label={isEn ? "Tools and attachments" : "ابزارها و پیوست‌ها"}
            aria-haspopup="menu"
            className="ui-btn ui-btn-ghost flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 text-2xl"
          >
            <span aria-hidden="true">+</span>
          </button>

          <textarea
            ref={chatInputRef}
            dir="auto"
            style={{ fontFamily: getTextFont(message || (isEn ? "English" : "فارسی")) }}
            className="max-h-32 min-h-[46px] flex-1 resize-none border-none bg-transparent px-2 py-3 text-[17px] leading-7 outline-none"
            placeholder={isEn ? "Ask Artin..." : "از آرتین بپرسید..."}
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            onKeyDown={onKeyDown}
          />

          {isVoiceSupported && (
            <button
              onClick={onToggleVoice}
              title={voiceState === "listening" ? (isEn ? "Stop recording" : "توقف ضبط") : t("assistant.voiceInput")}
              aria-label={voiceState === "listening" ? (isEn ? "Stop recording" : "توقف ضبط") : t("assistant.voiceInput")}
              aria-pressed={voiceState === "listening"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
                voiceState === "listening"
                  ? "animate-pulse bg-red-100 text-red-500"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              }`}
            >
              {voiceState === "listening" ? <MicOff size={18} aria-hidden="true" /> : voiceState === "processing" ? <Loader size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
            </button>
          )}
          <button
            onClick={loading ? onStop : onSend}
            disabled={(!loading && !message.trim()) || rateLimitActive}
            className={`ui-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 text-xl shadow-sm disabled:bg-slate-300 ${
              loading ? "bg-red-600 text-white hover:bg-red-700" : "ui-btn-primary"
            }`}
            title={loading ? (isEn ? "Stop response" : "توقف پاسخ") : t("common.send")}
            aria-label={loading ? (isEn ? "Stop response" : "توقف پاسخ") : (isEn ? "Send message" : "ارسال پیام")}
          >
            {loading ? <StopCircle size={19} aria-hidden="true" /> : <span aria-hidden="true">↑</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
