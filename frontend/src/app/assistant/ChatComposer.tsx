"use client";

import { Paperclip, ImagePlus, Mic, MicOff, Loader, StopCircle } from "lucide-react";
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
    <footer className="shrink-0 border-t border-slate-100 bg-white pb-2 pt-3">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="relative">
          {showTools && (
            <div className={`absolute bottom-full z-50 mb-2 ${isEn ? "left-0 right-auto" : "left-auto right-0"}`}>
              <ToolMenu onSelect={onToolSelect} />
            </div>
          )}

          <div className={`rounded-2xl border bg-white shadow-sm transition-colors ${isDragOver ? "border-blue-400 bg-blue-50/20" : "border-slate-200"}`}>
            {/* Staged image preview strip */}
            <StagedImagePreview
              image={stagedImage}
              imageUrl={stagedImageUrl}
              onClear={onClearStagedImage}
              isEn={isEn}
            />
            <div className="flex items-end gap-2 px-3 py-2.5">
              <button
                onClick={onToggleTools}
                aria-label={isEn ? "Tools and attachments" : "ابزارها و پیوست‌ها"}
                aria-haspopup="menu"
                aria-expanded={showTools}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-500 transition hover:bg-blue-50 hover:text-blue-700"
              >
                <ImagePlus size={18} aria-hidden="true" />
              </button>

              <textarea
                ref={chatInputRef}
                dir="auto"
                style={{ fontFamily: getTextFont(message || "فارسی") }}
                className="max-h-40 min-h-[44px] flex-1 resize-none border-none bg-transparent px-1 py-2 text-[15px] leading-7 text-slate-800 placeholder-slate-400 outline-none"
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
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition ${
                    voiceState === "listening"
                      ? "animate-pulse bg-red-100 text-red-500"
                      : voiceState === "processing"
                      ? "animate-spin text-emerald-500"
                      : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  }`}
                >
                  {voiceState === "listening" ? <MicOff size={18} aria-hidden="true" /> : voiceState === "processing" ? <Loader size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
                </button>
              )}

              <button
                onClick={loading ? onStop : onSend}
                disabled={!loading && !message.trim() && !stagedImage}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition disabled:bg-slate-200 disabled:text-slate-400 ${
                  loading
                    ? "bg-red-600 hover:bg-red-700"
                    : stagedImage
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-slate-800 hover:bg-slate-700"
                }`}
                title={loading ? (isEn ? "Stop response" : "توقف پاسخ") : (isEn ? "Send" : "ارسال")}
                aria-label={loading ? (isEn ? "Stop response" : "توقف پاسخ") : (isEn ? "Send message" : "ارسال پیام")}
              >
                {loading ? (
                  <StopCircle size={18} aria-hidden="true" />
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
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
