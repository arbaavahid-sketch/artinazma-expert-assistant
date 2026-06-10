"use client";
/**
 * هوک اسکرول خودکار چت — وقتی کاربر ته لیست است، با پیام جدید خودکار به پایین
 * اسکرول می‌کند؛ در غیر این صورت دکمه‌ی «رفتن به پایین» را نشان می‌دهد.
 *
 * استخراج‌شده از assistant/page.tsx. رفتار دقیقاً مطابق نسخه‌ی قبلی است:
 * اسکرول فوری حین streaming، تشخیص «ته بودن» با آستانه‌ی ۸۰px و debounce 50ms.
 */

import { useEffect, useRef, useState } from "react";
import { debounce } from "@/lib/debounce";
import type { ChatMessage } from "@/lib/chat-types";

export function useScrollToBottom(messages: ChatMessage[]) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const debouncedScrollRef = useRef<(() => void) | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Auto-scroll: only when user is already at the bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      const el = scrollContainerRef.current;
      if (el) {
        // Use instant scroll during streaming to avoid jittery smooth animations
        el.scrollTop = el.scrollHeight;
      }
    }
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
    debouncedScrollRef.current?.();
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    isAtBottomRef.current = true;
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
