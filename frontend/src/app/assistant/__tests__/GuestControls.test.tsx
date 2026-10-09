import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChatComposer from "../ChatComposer";
import GuestRegistrationCard from "@/components/GuestRegistrationCard";

describe("guest controls", () => {
  it("disables attachments and voice but allows sending text", () => {
    const send = vi.fn();
    const tools = vi.fn();
    render(<ChatComposer toolsEnabled={false} isEn showTools={false}
      onToggleTools={tools} onToolSelect={vi.fn()} isDragOver={false}
      stagedImage={null} stagedImageUrl="" onClearStagedImage={vi.fn()} onStageImage={vi.fn()}
      chatInputRef={{ current: null }} message="question" onMessageChange={vi.fn()}
      onKeyDown={vi.fn()} onPaste={vi.fn()} isVoiceSupported onToggleVoice={vi.fn()}
      voiceState="idle" loading={false} onStop={vi.fn()} onSend={send} />);
    expect(screen.getByRole("button", { name: "Tools and attachments" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Attach an image" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Voice input" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tools and attachments" }));
    expect(tools).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(send).toHaveBeenCalledOnce();
  });

  it("requires account registration instead of a contact form", () => {
    render(<GuestRegistrationCard isEn />);
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/customer-register");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/customer-login?next=/assistant");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
