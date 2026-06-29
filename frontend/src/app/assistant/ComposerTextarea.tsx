"use client";

import type {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  RefObject,
} from "react";

type ComposerTextareaProps = {
  chatInputRef: RefObject<HTMLTextAreaElement | null>;
  className: string;
  isEn: boolean;
  message: string;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onMessageChange: (value: string) => void;
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
};

function restoreSelection(
  textarea: HTMLTextAreaElement,
  start: number | null,
  end: number | null,
  direction: "forward" | "backward" | "none" | null,
) {
  if (start === null || end === null) return;

  window.requestAnimationFrame(() => {
    if (document.activeElement !== textarea) return;

    const max = textarea.value.length;
    textarea.setSelectionRange(
      Math.min(start, max),
      Math.min(end, max),
      direction || "none",
    );
  });
}

export default function ComposerTextarea({
  chatInputRef,
  className,
  isEn,
  message,
  onKeyDown,
  onMessageChange,
  onPaste,
  placeholder,
}: ComposerTextareaProps) {
  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget;
    const { selectionStart, selectionEnd, selectionDirection, value } = textarea;

    onMessageChange(value);
    restoreSelection(textarea, selectionStart, selectionEnd, selectionDirection);
  }

  return (
    <textarea
      ref={chatInputRef}
      dir="auto"
      lang={isEn ? "en" : "fa"}
      spellCheck
      autoCorrect="on"
      autoCapitalize="sentences"
      autoComplete="on"
      inputMode="text"
      enterKeyHint="send"
      className={className}
      placeholder={placeholder}
      value={message}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  );
}
