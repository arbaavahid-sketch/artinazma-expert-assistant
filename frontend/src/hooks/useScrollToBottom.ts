"use client";
/**
 * هوک اسکرول خودکار چت — وقتی کاربر ته لیست است، با پیام جدید خودکار به پایین
 * اسکرول می‌کند؛ در غیر این صورت دکمه‌ی «رفتن به پایین» را نشان می‌دهد.
 *
 * استخراج‌شده از assistant/page.tsx. رفتار دقیقاً مطابق نسخه‌ی قبلی است:
 * اسکرول فوری حین streaming، تشخیص «ته بودن» با آستانه‌ی ۸۰px و debounce 50ms.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { debounce } from "@/lib/debounce";
import type { ChatMessage } from "@/lib/chat-types";

export function useScrollToBottom(messages: ChatMessage[]) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const previousScrollHeightRef = useRef(0);
  const debouncedScrollRef = useRef<(() => void) | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Show newly added messages, but do not chase a streaming assistant answer.
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      previousMessageCountRef.current = messages.length;
      return;
    }

    const previousMessageCount = previousMessageCountRef.current;
    const previousScrollHeight = previousScrollHeightRef.current;
    const messageCountChanged = messages.length !== previousMessageCount;
    const lastMessage = messages[messages.length - 1];
    const isStreamingAssistantUpdate =
      !messageCountChanged && lastMessage?.role === "assistant";

    const distanceFromBottomBeforeUpdate =
      previousScrollHeight - el.scrollTop - el.clientHeight;
    const wasNearBottom =
      previousScrollHeight === 0 || distanceFromBottomBeforeUpdate < 36;

    if (messageCountChanged && wasNearBottom) {
      el.scrollTop = el.scrollHeight;
      isAtBottomRef.current = true;
      setShowScrollBtn(false);
    } else if (isStreamingAssistantUpdate) {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const shouldShowButton =
        lastMessage.content.trim().length > 0 && distanceFromBottom > 80;

      isAtBottomRef.current = !shouldShowButton;
      setShowScrollBtn(shouldShowButton);
    } else {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distanceFromBottom < 36;
      isAtBottomRef.current = atBottom;
      setShowScrollBtn(!atBottom && el.scrollHeight > el.clientHeight + 36);
    }

    previousMessageCountRef.current = messages.length;
    previousScrollHeightRef.current = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    debouncedScrollRef.current = debounce(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distanceFromBottom < 80;
      isAtBottomRef.current = atBottom;
      setShowScrollBtn(!atBottom);
    }, 50);
  }, []);

  function handleChatScroll() {
    const el = scrollContainerRef.current;
    if (el) {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distanceFromBottom < 36;
      isAtBottomRef.current = atBottom;
      setShowScrollBtn(!atBottom);
    }

    debouncedScrollRef.current?.();
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    isAtBottomRef.current = true;
    const el = scrollContainerRef.current;
    if (el) previousScrollHeightRef.current = el.scrollHeight;
    setShowScrollBtn(false);
  }

  return {
    messagesEndRef,
    scrollContainerRef,
    showScrollBtn,
    handleChatScroll,
    scrollToBottom,
  };
}
