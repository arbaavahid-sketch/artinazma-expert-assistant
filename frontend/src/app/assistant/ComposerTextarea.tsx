"use client";

import type {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  RefObject,
} from "react";
import { useEffect, useRef } from "react";

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
  const isComposingRef = useRef(false);

  useEffect(() => {
    const textarea = chatInputRef.current;
    if (!textarea || textarea.value === message) return;
    if (isComposingRef.current) return;
    if (document.activeElement === textarea && message && textarea.value.trim()) return;

    textarea.value = message;
  }, [chatInputRef, message]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onMessageChange(event.currentTarget.value);
  }

  return (
    <textarea
      ref={chatInputRef}
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
      defaultValue={message}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onCompositionStart={() => {
        isComposingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        isComposingRef.current = false;
        onMessageChange(event.currentTarget.value);
      }}
    />
  );
}
