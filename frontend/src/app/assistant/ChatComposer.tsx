"use client";

import {
  ArrowUp,
  ImagePlus,
  Loader,
  Mic,
  MicOff,
  Paperclip,
  StopCircle,
} from "lucide-react";
import type { RefObject, KeyboardEvent, ClipboardEvent } from "react";
import type { ToolAction } from "@/lib/chat-types";
import { getTextFont } from "@/lib/chat-helpers";
import ToolMenu from "@/app/assistant/ToolMenu";
import StagedImagePreview from "@/app/assistant/StagedImagePreview";

/**
 * Bottom chat composer shown once a conversation has started: tools menu,
 * staged-image preview, quick-image button, the text input, and the
 * voice/send/stop controls. All state and behaviour are owned by the parent
 * assistant page and passed in as props, keeping this purely about layout.
 */
type ChatComposerProps = {
  isEn: boolean;
  showTools: boolean;
  onToggleTools: () => void;
  onToolSelect: (action: ToolAction) => void;
  isDragOver: boolean;
  stagedImage: File | null;
  stagedImageUrl: string;
  onClearStagedImage: () => void;
  onStageImage: (file: File) => void;
  chatInputRef: RefObject<HTMLTextAreaElement | null>;
  message: string;
  onMessageChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: ClipboardEvent) => void;
  isVoiceSupported: boolean;
  onToggleVoice: () => void;
  voiceState: string;
  loading: boolean;
  onStop: () => void;
  onSend: () => void;
};

export default function ChatComposer({
  isEn,
  showTools,
  onToggleTools,
  onToolSelect,
  isDragOver,
  stagedImage,
  stagedImageUrl,
  onClearStagedImage,
  onStageImage,
  chatInputRef,
  message,
  onMessageChange,
  onKeyDown,
  onPaste,
  isVoiceSupported,
  onToggleVoice,
  voiceState,
  loading,
  onStop,
  onSend,
}: ChatComposerProps) {
  return (
    <footer className="shrink-0 border-t border-slate-100 bg-white/95 pb-2 pt-3 backdrop-blur">
      <div className="mx-auto w-full max-w-3xl px-3 sm:px-4">
        <div className="relative">
          {showTools && (
            <div className={`absolute bottom-full z-50 mb-2 ${isEn ? "left-0 right-auto" : "left-auto right-0"}`}>
              <ToolMenu onSelect={onToolSelect} />
            </div>
          )}

          <div className={`chat-composer-box ${isDragOver ? "chat-composer-box-active" : ""}`}>
            {/* Staged image preview strip */}
            <StagedImagePreview
              image={stagedImage}
              imageUrl={stagedImageUrl}
              onClear={onClearStagedImage}
              isEn={isEn}
            />
            <div className="flex items-end gap-1.5 p-2 sm:gap-2 sm:p-2.5">
              <button
                onClick={onToggleTools}
                aria-label={isEn ? "Tools and attachments" : "ابزارها و پیوست‌ها"}
                aria-haspopup="menu"
                aria-expanded={showTools}
                className="chat-composer-icon-button chat-composer-icon-button-muted"
              >
                <Paperclip size={18} aria-hidden="true" />
              </button>

              {/* Quick image button */}
              <button
                onClick={() => {
                  const inp = document.createElement("input");
                  inp.type = "file";
                  inp.accept = "image/*";
                  inp.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) onStageImage(file);
                  };
                  inp.click();
                }}
                title={isEn ? "Send image (or Ctrl+V to paste)" : "ارسال عکس (یا Ctrl+V برای Paste)"}
                aria-label={isEn ? "Attach an image" : "پیوست عکس"}
                className="chat-composer-icon-button text-blue-500 hover:bg-blue-50 hover:text-blue-700"
              >
                <ImagePlus size={18} aria-hidden="true" />
              </button>

              <textarea
                ref={chatInputRef}
                dir="auto"
                style={{ fontFamily: getTextFont(message || (isEn ? "English" : "فارسی")) }}
                className="chat-composer-textarea max-h-40 min-h-[44px]"
                placeholder={
                  stagedImage
                    ? (isEn ? "Write an optional note for the image..." : "توضیحی برای عکس بنویسید (اختیاری)...")
                    : (isEn ? "Ask Artin..." : "از آرتین بپرسید...")
                }
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
              />

              {isVoiceSupported && (
                <button
                  onClick={onToggleVoice}
                  title={voiceState === "listening" ? (isEn ? "Stop recording" : "توقف ضبط") : (isEn ? "Voice input" : "ورودی صوتی")}
                  aria-label={voiceState === "listening" ? (isEn ? "Stop recording" : "توقف ضبط") : (isEn ? "Voice input" : "ورودی صوتی")}
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
                disabled={!loading && !message.trim() && !stagedImage}
                className={`chat-composer-icon-button text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                  loading
                    ? "bg-red-600 hover:bg-red-700"
                    : "chat-composer-send-button"
                }`}
                title={loading ? (isEn ? "Stop response" : "توقف پاسخ") : (isEn ? "Send" : "ارسال")}
                aria-label={loading ? (isEn ? "Stop response" : "توقف پاسخ") : (isEn ? "Send message" : "ارسال پیام")}
              >
                {loading ? (
                  <StopCircle size={18} aria-hidden="true" />
                ) : (
                  <ArrowUp size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <p className="mt-2 text-center text-[11px] text-slate-400">
            {isEn
              ? "Artin can make mistakes. For important decisions, submit an expert consultation request."
              : "آرتین ممکن است اشتباه کند. برای تصمیم‌های مهم مشاوره کارشناسی ثبت کنید."}
          </p>
        </div>
      </div>
    </footer>
  );
}
