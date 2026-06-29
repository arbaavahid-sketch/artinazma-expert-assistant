import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import ComposerTextarea from "../ComposerTextarea";

function renderComposer(overrides: Partial<Parameters<typeof ComposerTextarea>[0]> = {}) {
  const props = {
    chatInputRef: createRef<HTMLTextAreaElement>(),
    className: "composer-test",
    isEn: false,
    message: "",
    onKeyDown: vi.fn(),
    onMessageChange: vi.fn(),
    placeholder: "از آرتین بپرسید...",
    ...overrides,
  };

  const view = render(<ComposerTextarea {...props} />);
  return { props, ...view };
}

describe("ComposerTextarea", () => {
  it("enables browser and keyboard text correction features", () => {
    renderComposer();

    const textarea = screen.getByPlaceholderText("از آرتین بپرسید...");
    expect(textarea).toHaveAttribute("spellcheck", "true");
    expect(textarea).toHaveAttribute("autocorrect", "on");
    expect(textarea).toHaveAttribute("autocomplete", "on");
    expect(textarea).toHaveAttribute("inputmode", "text");
  });

  it("lets the browser own caret placement while typing", () => {
    const { props } = renderComposer({ message: "سلام دنیا" });
    const textarea = screen.getByPlaceholderText("از آرتین بپرسید...") as HTMLTextAreaElement;

    textarea.focus();
    textarea.setSelectionRange(5, 5);
    fireEvent.change(textarea, { target: { value: "سلام خوب دنیا" } });

    expect(props.onMessageChange).toHaveBeenCalledWith("سلام خوب دنیا");
    expect(textarea).not.toHaveAttribute("value");
  });

  it("syncs external message changes without making typing controlled", () => {
    const ref = createRef<HTMLTextAreaElement>();
    const onMessageChange = vi.fn();
    const { rerender } = render(
      <ComposerTextarea
        chatInputRef={ref}
        className="composer-test"
        isEn={false}
        message="سلام"
        onKeyDown={vi.fn()}
        onMessageChange={onMessageChange}
        placeholder="از آرتین بپرسید..."
      />,
    );
    const textarea = screen.getByPlaceholderText("از آرتین بپرسید...") as HTMLTextAreaElement;

    expect(textarea.value).toBe("سلام");

    rerender(
      <ComposerTextarea
        chatInputRef={ref}
        className="composer-test"
        isEn={false}
        message=""
        onKeyDown={vi.fn()}
        onMessageChange={onMessageChange}
        placeholder="از آرتین بپرسید..."
      />,
    );

    expect(textarea.value).toBe("");
  });
});
