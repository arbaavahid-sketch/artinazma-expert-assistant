import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScrollToBottom } from "../useScrollToBottom";
import type { ChatMessage } from "@/lib/chat-types";

const msgs = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => ({ role: "user", content: `m${i}` })) as ChatMessage[];

const assistantMsg = (content: string): ChatMessage[] => [
  { role: "user", content: "question" },
  { role: "assistant", content },
];

describe("useScrollToBottom", () => {
  it("exposes refs, a button flag and the scroll helpers", () => {
    const { result } = renderHook(() => useScrollToBottom(msgs(0)));
    expect(result.current.showScrollBtn).toBe(false);
    expect(result.current.messagesEndRef).toBeDefined();
    expect(result.current.scrollContainerRef).toBeDefined();
    expect(typeof result.current.handleChatScroll).toBe("function");
    expect(typeof result.current.scrollToBottom).toBe("function");
  });

  it("scrollToBottom scrolls the end anchor into view and hides the button", () => {
    const { result } = renderHook(() => useScrollToBottom(msgs(3)));
    const scrollIntoView = vi.fn();
    // Simulate React attaching the anchor node to the ref.
    result.current.messagesEndRef.current = { scrollIntoView } as unknown as HTMLDivElement;
    act(() => result.current.scrollToBottom());
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
    expect(result.current.showScrollBtn).toBe(false);
  });

  it("auto-scrolls the container to the bottom when messages change", () => {
    const { result, rerender } = renderHook(({ m }) => useScrollToBottom(m), {
      initialProps: { m: msgs(1) },
    });
    const el = { scrollTop: 0, scrollHeight: 500, clientHeight: 100 } as HTMLDivElement;
    result.current.scrollContainerRef.current = el;
    rerender({ m: msgs(2) });
    expect(el.scrollTop).toBe(500);
  });

  it("does not auto-scroll while an assistant answer is streaming", () => {
    const { result, rerender } = renderHook(({ m }) => useScrollToBottom(m), {
      initialProps: { m: assistantMsg("") },
    });
    const el = { scrollTop: 400, scrollHeight: 500, clientHeight: 100 } as HTMLDivElement;
    result.current.scrollContainerRef.current = el;

    rerender({ m: assistantMsg("first streamed chunk") });

    expect(el.scrollTop).toBe(400);
  });

  it("keeps the bottom button hidden for an empty assistant placeholder", () => {
    const { result, rerender } = renderHook(({ m }) => useScrollToBottom(m), {
      initialProps: { m: assistantMsg("previous") },
    });
    const el = { scrollTop: 0, scrollHeight: 700, clientHeight: 100 } as HTMLDivElement;
    result.current.scrollContainerRef.current = el;

    rerender({ m: assistantMsg("") });

    expect(result.current.showScrollBtn).toBe(false);
  });

  it("handleChatScroll is safe to call before the container is attached", () => {
    const { result } = renderHook(() => useScrollToBottom(msgs(0)));
    expect(() => act(() => result.current.handleChatScroll())).not.toThrow();
  });
});
