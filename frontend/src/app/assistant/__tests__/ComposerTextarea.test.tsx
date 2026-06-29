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

  render(<ComposerTextarea {...props} />);
  return props;
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

  it("restores the caret after a controlled value update", async () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const props = renderComposer({ message: "سلام دنیا" });
    const textarea = screen.getByPlaceholderText("از آرتین بپرسید...") as HTMLTextAreaElement;
    const setSelectionRangeSpy = vi
      .spyOn(HTMLTextAreaElement.prototype, "setSelectionRange")
      .mockImplementation(() => undefined);

    textarea.focus();
    Object.defineProperty(textarea, "selectionStart", { configurable: true, get: () => 5 });
    Object.defineProperty(textarea, "selectionEnd", { configurable: true, get: () => 5 });
    Object.defineProperty(textarea, "selectionDirection", { configurable: true, get: () => "none" });
    fireEvent.change(textarea, { target: { value: "سلام خوب دنیا" } });

    expect(props.onMessageChange).toHaveBeenCalledWith("سلام خوب دنیا");
    expect(setSelectionRangeSpy).toHaveBeenCalledWith(5, 5, "none");

    setSelectionRangeSpy.mockRestore();
    requestAnimationFrameSpy.mockRestore();
  });
});
