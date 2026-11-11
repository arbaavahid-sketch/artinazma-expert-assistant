import { AssistantRuntimeProvider, ComposerPrimitive, useExternalStoreRuntime, type ThreadMessageLike } from "@assistant-ui/react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import ComposerTextarea from "../ComposerTextarea";

function renderComposer(isEn = false) {
  const ref = createRef<HTMLTextAreaElement>();
  const onNew = vi.fn(async () => {});
  let composer: ReturnType<typeof useExternalStoreRuntime>["thread"]["composer"];

  function TestComposer() {
    const runtime = useExternalStoreRuntime<ThreadMessageLike>({ messages: [], onNew, convertMessage: (message) => message });
    composer = runtime.thread.composer;

    return (
      <AssistantRuntimeProvider runtime={runtime}>
        <ComposerPrimitive.Root>
          <ComposerTextarea chatInputRef={ref} className="composer-test" isEn={isEn} placeholder="از آرتین بپرسید..." />
        </ComposerPrimitive.Root>
      </AssistantRuntimeProvider>
    );
  }

  render(<TestComposer />);
  return {
    textarea: ref.current!,
    onNew,
    setText: (text: string) => act(() => composer.setText(text)),
    getText: () => composer.getState().text,
  };
}

describe("ComposerTextarea", () => {
  it("enables browser and keyboard text correction features", () => {
    const { textarea } = renderComposer();
    expect(textarea).toHaveAttribute("dir", "rtl");
    expect(textarea).toHaveAttribute("spellcheck", "true");
    expect(textarea).toHaveAttribute("autocorrect", "on");
    expect(textarea).toHaveAttribute("autocomplete", "on");
    expect(textarea).toHaveAttribute("inputmode", "text");
  });

  it("uses ltr direction for the English composer", () => {
    renderComposer(true);
    expect(screen.getByPlaceholderText("از آرتین بپرسید...")).toHaveAttribute("dir", "ltr");
  });

  it("syncs programmatic drafts and middle-of-text edits with the runtime", () => {
    const { textarea, setText, getText } = renderComposer();
    setText("سلام دنیا");
    expect(textarea).toHaveValue("سلام دنیا");
    textarea.focus();
    textarea.setSelectionRange(5, 5);
    fireEvent.change(textarea, { target: { value: "سلام خوب دنیا" } });
    expect(getText()).toBe("سلام خوب دنیا");
    setText("");
    expect(textarea).toHaveValue("");
  });

  it("does not send during IME composition or on Shift+Enter", () => {
    const { textarea, onNew } = renderComposer();
    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: "سلام" } });
    fireEvent.keyDown(textarea, { key: "Enter", isComposing: true, keyCode: 229 });
    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onNew).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("سلام");

    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onNew).toHaveBeenCalledWith(expect.objectContaining({
      content: [{ type: "text", text: "سلام" }],
    }));
  });
});
