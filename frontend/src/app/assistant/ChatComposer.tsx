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
import { ComposerPrimitive, useAuiState } from "@assistant-ui/react";
import type { RefObject, ClipboardEvent } from "react";
import { useEffect, useId, useRef } from "react";
import type { ToolAction } from "@/lib/chat-types";
import ToolMenu from "@/app/assistant/ToolMenu";
import StagedImagePreview from "@/app/assistant/StagedImagePreview";
import ComposerTextarea from "@/app/assistant/ComposerTextarea";

/**
 * Composer for the welcome screen and active conversations: tools menu,
 * staged-image preview, quick-image button, the text input, and the
 * voice/send/stop controls. Assistant UI owns the draft and its attachments.
 */
type ChatComposerProps = {
  toolsEnabled?: boolean;
  welcome?: boolean;
  rateLimitActive?: boolean;
  isEn: boolean;
  showTools: boolean;
  onToggleTools: () => void;
  onToolSelect: (action: ToolAction) => void;
  isDragOver: boolean;
  onStageImage: (file: File) => void;
  chatInputRef: RefObject<HTMLTextAreaElement | null>;
  onPaste: (e: ClipboardEvent) => void;
  isVoiceSupported: boolean;
  onToggleVoice: () => void;
  voiceState: string;
  loading: boolean;
};

export default function ChatComposer({
  toolsEnabled = true,
  welcome = false,
  rateLimitActive = false,
  isEn,
  showTools,
  onToggleTools,
  onToolSelect,
  isDragOver,
  onStageImage,
  chatInputRef,
  onPaste,
  isVoiceSupported,
  onToggleVoice,
  voiceState,
  loading,
}: ChatComposerProps) {
  const hasImage = useAuiState((state) => state.composer.attachments.length > 0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const toolButtonRef = useRef<HTMLButtonElement>(null);
  const toolPanelRef = useRef<HTMLDivElement>(null);
  const toolPanelId = useId();

  useEffect(() => {
    if (!toolsEnabled || !showTools) return;

    function dismissOutside(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (toolButtonRef.current?.contains(event.target) || toolPanelRef.current?.contains(event.target)) return;
      onToggleTools();
    }

    function dismissOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onToggleTools();
      toolButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape, true);
    };
  }, [toolsEnabled, showTools, onToggleTools]);

  return (
    <div className={welcome ? "mt-5 w-full sm:mt-8" : "shrink-0 px-3 pb-1.5 pt-2 sm:pb-2 sm:pt-3 md:px-6"}>
      <div className="mx-auto w-full max-w-[780px]">
        <div className="relative flex flex-col">
          <ComposerPrimitive.Root
            className={`chat-composer-box ${isDragOver ? "chat-composer-box-active" : ""}`}
            onSubmit={(event) => { if (rateLimitActive) event.preventDefault(); }}
          >
            <ComposerPrimitive.Attachments>
              {({ attachment }) => attachment.file && (
                <StagedImagePreview image={attachment.file} isEn={isEn} />
              )}
            </ComposerPrimitive.Attachments>
            <ComposerTextarea
              chatInputRef={chatInputRef}
              isEn={isEn}
              className="chat-composer-textarea max-h-36 min-h-[40px] sm:max-h-40 sm:min-h-[44px]"
              placeholder={
                hasImage
                  ? (isEn ? "Write an optional note for the image..." : "توضیحی برای عکس بنویسید (اختیاری)...")
                  : (isEn ? "Ask Artin..." : "از آرتین بپرسید...")
              }
              onPaste={onPaste}
            />
            <div className="artin-composer-toolbar flex items-center gap-1.5 p-1.5 sm:gap-2 sm:p-2.5">
              <button
                ref={toolButtonRef}
                type="button"
                disabled={!toolsEnabled}
                onClick={onToggleTools}
                aria-label={isEn ? "Tools and attachments" : "ابزارها و پیوست‌ها"}
                aria-controls={showTools ? toolPanelId : undefined}
                aria-expanded={showTools}
                className="chat-composer-icon-button chat-composer-icon-button-muted"
              >
                <Paperclip size={18} aria-hidden="true" />
              </button>

              {/* Quick image button */}
              {toolsEnabled && (
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file) onStageImage(file);
                  }}
                />
              )}
              <button
                type="button"
                disabled={!toolsEnabled}
                onClick={() => imageInputRef.current?.click()}
                title={isEn ? "Send image (or Ctrl+V to paste)" : "ارسال عکس (یا Ctrl+V برای Paste)"}
                aria-label={isEn ? "Attach an image" : "پیوست عکس"}
                className="chat-composer-icon-button text-[var(--color-info-text)] hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-text)]"
              >
                <ImagePlus size={18} aria-hidden="true" />
              </button>


              {toolsEnabled && isVoiceSupported && (
                <button
                  type="button"
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

              {loading ? (
                <ComposerPrimitive.Cancel
                  className="ms-auto chat-composer-icon-button bg-red-600 text-white shadow-sm hover:bg-red-700"
                  title={isEn ? "Stop response" : "توقف پاسخ"}
                  aria-label={isEn ? "Stop response" : "توقف پاسخ"}
                >
                  <StopCircle size={18} aria-hidden="true" />
                </ComposerPrimitive.Cancel>
              ) : (
                <ComposerPrimitive.Send
                  disabled={rateLimitActive}
                  className="ms-auto chat-composer-icon-button chat-composer-send-button text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  title={isEn ? "Send" : "ارسال"}
                  aria-label={isEn ? "Send message" : "ارسال پیام"}
                >
                  <ArrowUp size={18} aria-hidden="true" />
                </ComposerPrimitive.Send>
              )}
            </div>
          </ComposerPrimitive.Root>

          {toolsEnabled && showTools && (
            <div id={toolPanelId} ref={toolPanelRef} className={`artin-motion-panel ${welcome ? "mt-2 max-w-full self-start" : "absolute start-0 bottom-full z-50 mb-2 max-w-full"}`}>
              <ToolMenu onSelect={onToolSelect} />
            </div>
          )}

          <p className="mt-1.5 text-center text-[10px] leading-5 text-slate-400 sm:mt-2 sm:text-[11px]">
            {isEn
              ? "Artin can make mistakes. For important decisions, submit an expert consultation request."
              : "آرتین ممکن است اشتباه کند. برای تصمیم‌های مهم مشاوره کارشناسی ثبت کنید."}
          </p>
        </div>
      </div>
    </div>
  );
}
