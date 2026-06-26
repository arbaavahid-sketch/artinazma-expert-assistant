"use client";

import { ArrowUp, Loader, Mic, MicOff, Plus, StopCircle } from "lucide-react";
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

      <div className="chat-composer-box">
        <div className="flex items-end gap-1.5 p-1.5 sm:gap-3 sm:p-3">
          <button
            onClick={onToggleTools}
            aria-label={isEn ? "Tools and attachments" : "ابزارها و پیوست‌ها"}
            aria-haspopup="menu"
            className="chat-composer-icon-button chat-composer-icon-button-muted"
          >
            <Plus size={19} aria-hidden="true" />
          </button>

          <textarea
            ref={chatInputRef}
            dir="auto"
            style={{ fontFamily: getTextFont(message || (isEn ? "English" : "فارسی")) }}
            className="chat-composer-textarea max-h-32 min-h-[40px] sm:min-h-[46px]"
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
              className={`chat-composer-icon-button ${
                voiceState === "listening"
                  ? "animate-pulse bg-red-50 text-red-500 ring-1 ring-red-100"
                  : voiceState === "processing"
                  ? "text-emerald-500"
                  : "chat-composer-icon-button-muted"
              }`}
            >
              {voiceState === "listening" ? <MicOff size={18} aria-hidden="true" /> : voiceState === "processing" ? <Loader size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
            </button>
          )}
          <button
            onClick={loading ? onStop : onSend}
            disabled={(!loading && !message.trim()) || rateLimitActive}
            className={`chat-composer-icon-button shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
              loading ? "bg-red-600 text-white hover:bg-red-700" : "chat-composer-send-button"
            }`}
            title={loading ? (isEn ? "Stop response" : "توقف پاسخ") : t("common.send")}
            aria-label={loading ? (isEn ? "Stop response" : "توقف پاسخ") : (isEn ? "Send message" : "ارسال پیام")}
          >
            {loading ? <StopCircle size={19} aria-hidden="true" /> : <ArrowUp size={19} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
