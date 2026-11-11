import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssistantRuntimeProvider, ThreadPrimitive, useExternalStoreRuntime } from "@assistant-ui/react";
import MessageBubble from "../MessageBubble";
import type { ChatMessage } from "@/lib/chat-types";

/** پراپ‌های مشترک با callbackهای ساختگی */
function makeProps(item: ChatMessage) {
  return {
    item,
    index: 0,
    loading: false,
    onCopy: vi.fn(),
    onRequest: vi.fn(),
    onQuickAction: vi.fn(),
    onFeedback: vi.fn(),
    onSpeak: vi.fn(),
  };
}

function renderMessage(item: ChatMessage) {
  function TestThread() {
    const runtime = useExternalStoreRuntime({
      messages: [item],
      convertMessage: (message) => ({ role: message.role, content: message.content }),
      onNew: async () => {},
    });
    return (
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Messages>{() => <MessageBubble {...makeProps(item)} />}</ThreadPrimitive.Messages>
      </AssistantRuntimeProvider>
    );
  }
  return render(<TestThread />);
}

describe("MessageBubble", () => {
  it("renders the user's message text", () => {
    const item: ChatMessage = { role: "user", content: "سلام آرتین" };
    renderMessage(item);
    expect(screen.getByText("سلام آرتین")).toBeInTheDocument();
  });

  it("shows the Artin avatar for assistant messages", () => {
    const item: ChatMessage = { role: "assistant", content: "پاسخ تخصصی" };
    renderMessage(item);
    expect(screen.getByAltText("آرتین")).toBeInTheDocument();
  });

  it("does not show the avatar for user messages", () => {
    const item: ChatMessage = { role: "user", content: "یک سوال" };
    renderMessage(item);
    expect(screen.queryByAltText("آرتین")).not.toBeInTheDocument();
  });

  it("renders assistant markdown content as text", () => {
    const item: ChatMessage = { role: "assistant", content: "نتیجه نهایی تست" };
    renderMessage(item);
    expect(screen.getByText(/نتیجه نهایی تست/)).toBeInTheDocument();
  });
  it("renders ArtinAzma resource links as product cards", () => {
    const item: ChatMessage = {
      role: "assistant",
      content: "Related product:",
      resource_links: [
        {
          title: "RA-915M mercury analyzer",
          url: "https://artinazma.net/product/ra-915m-mercury-measuring-device/",
          source: "artinazma.net",
          score: 42,
        },
      ],
      resource_images: [
        {
          title: "RA-915M mercury analyzer",
          url: "https://artinazma.net/wp-content/uploads/ra-915m.jpg",
          page_url: "https://artinazma.net/product/ra-915m-mercury-measuring-device/",
          source: "artinazma.net",
        },
      ],
    };

    renderMessage(item);

    expect(screen.getByText("RA-915M mercury analyzer")).toBeInTheDocument();
    expect(screen.getByText(/artinazma\.net/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /RA-915M mercury analyzer/i })).toHaveAttribute(
      "href",
      item.resource_links?.[0].url,
    );
  });
});
