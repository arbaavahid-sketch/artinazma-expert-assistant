"use client";
/**
 * هوک مدیریت سشن چت مشتری — ساخت سشن، اطمینان از وجود سشن، ذخیره‌ی پیام‌ها،
 * و بارگذاری یک سشن ذخیره‌شده.
 *
 * استخراج‌شده از assistant/page.tsx. مالکیت state (customer، activeSessionId و ...)
 * در خود کامپوننت می‌ماند و از طریق پارامترها به هوک داده می‌شود؛ بنابراین رفتار
 * دقیقاً مطابق نسخه‌ی قبلی است و فقط بدنه‌ی توابع جابه‌جا شده است.
 */

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { apiUrl, customerFetch } from "@/lib/api";
import { getSavedCustomer, makeSessionTitle } from "@/lib/customer";
import type { Customer, ChatMessage, SavedChatMessage } from "@/lib/chat-types";

interface UseCustomerChatSessionOptions {
  customer: Customer | null;
  setCustomer: Dispatch<SetStateAction<Customer | null>>;
  activeSessionId: number | null;
  setActiveSessionId: Dispatch<SetStateAction<number | null>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setLoadingSavedSession: Dispatch<SetStateAction<boolean>>;
}

export function useCustomerChatSession({
  customer,
  setCustomer,
  activeSessionId,
  setActiveSessionId,
  setMessages,
  setLoadingSavedSession,
}: UseCustomerChatSessionOptions) {
  async function createCustomerChatSession(title: string) {
    const activeCustomer = customer || getSavedCustomer();

    if (!activeCustomer) return null;

    try {
      const res = await customerFetch(apiUrl("/customers/chat-sessions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: activeCustomer.id,
          title: makeSessionTitle(title),
        }),
      });

      const data = await res.json();

      if (!data.success || !data.session_id) return null;

      const newSessionId = Number(data.session_id);

      setCustomer(activeCustomer);
      setActiveSessionId(newSessionId);

      window.history.replaceState(
        null,
        "",
        `/assistant?session_id=${newSessionId}`,
      );

      return newSessionId;
    } catch {
      return null;
    }
  }

  async function ensureCustomerSession(titleSource: string) {
    const activeCustomer = customer || getSavedCustomer();

    if (!activeCustomer) return null;

    if (!customer) {
      setCustomer(activeCustomer);
    }

    if (activeSessionId) return activeSessionId;

    return createCustomerChatSession(titleSource);
  }

  async function saveCustomerChatMessage(
    sessionId: number | null,
    role: "user" | "assistant",
    content: string,
    metadata: Record<string, unknown> = {},
  ) {
    const activeCustomer = customer || getSavedCustomer();

    if (!activeCustomer || !sessionId || !content.trim()) return;

    try {
      await customerFetch(apiUrl("/customers/chat-messages"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: activeCustomer.id,
          session_id: sessionId,
          role,
          content,
          metadata,
        }),
      });
    } catch {
      // ذخیره گفتگو نباید باعث خراب شدن چت اصلی شود
    }
  }

  const loadSavedChatSession = useCallback(async (customerId: number, sessionId: number) => {
    setLoadingSavedSession(true);

    try {
      const res = await customerFetch(
        apiUrl(`/customers/${customerId}/chat-sessions/${sessionId}/messages`),
      );

      const data = await res.json();

      const savedMessages: ChatMessage[] = (data.messages || []).map(
        (item: SavedChatMessage) => ({
          role: item.role === "user" ? "user" : "assistant",
          content: item.content,
          sources: item.metadata?.sources || [],
          detected_domain: item.metadata?.detected_domain,
          question_id: item.metadata?.question_id,
          relatedDevices: item.metadata?.relatedDevices || [],
          resource_links: item.metadata?.resource_links || [],
          resource_images: item.metadata?.resource_images || [],
          attachment: item.metadata?.attachment
            ? {
                ...item.metadata.attachment,
                previewUrl:
                  item.metadata.attachment.previewUrl ||
                  (item.metadata.file_url
                    ? apiUrl(item.metadata.file_url as string)
                    : undefined),
              }
            : undefined,
        }),
      );

      setMessages(savedMessages);
      setActiveSessionId(sessionId);
    } catch {
      setMessages([]);
    } finally {
      setLoadingSavedSession(false);
    }
  }, [setActiveSessionId, setLoadingSavedSession, setMessages]);

  return {
    createCustomerChatSession,
    ensureCustomerSession,
    saveCustomerChatMessage,
    loadSavedChatSession,
  };
}
