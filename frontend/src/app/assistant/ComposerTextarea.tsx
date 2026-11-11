"use client";

import { ComposerPrimitive } from "@assistant-ui/react";
import type { ClipboardEvent, RefObject } from "react";

type ComposerTextareaProps = {
  chatInputRef: RefObject<HTMLTextAreaElement | null>;
  className: string;
  isEn: boolean;
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
};

export default function ComposerTextarea({
  chatInputRef,
  className,
  isEn,
  onPaste,
  placeholder,
}: ComposerTextareaProps) {
  return (
    <ComposerPrimitive.Input
      ref={chatInputRef}
      submitMode="enter"
      cancelOnEscape={false}
      addAttachmentOnPaste={false}
      dir={isEn ? "ltr" : "rtl"}
      lang={isEn ? "en" : "fa"}
      spellCheck
      autoCorrect="on"
      autoCapitalize="sentences"
      autoComplete="on"
      inputMode="text"
      enterKeyHint="send"
      className={className}
      placeholder={placeholder}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.shiftKey && (event.ctrlKey || event.metaKey) &&
            !event.nativeEvent.isComposing && event.keyCode !== 229) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
      }}
      onPaste={onPaste}
    />
  );
}
