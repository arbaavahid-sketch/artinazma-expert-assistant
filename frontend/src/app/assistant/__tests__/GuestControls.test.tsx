import { fireEvent, render, screen } from "@testing-library/react";
import { AssistantRuntimeProvider, useExternalStoreRuntime, type ThreadMessageLike } from "@assistant-ui/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import ChatComposer from "../ChatComposer";
import GuestRegistrationCard from "@/components/GuestRegistrationCard";

function renderWithRuntime(children: ReactNode, onNew = vi.fn(async () => {})) {
  function TestRuntime() {
    const runtime = useExternalStoreRuntime<ThreadMessageLike>({ messages: [], onNew, convertMessage: (message) => message });
    return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
  }
  return render(<TestRuntime />);
}

describe("guest controls", () => {
  it("lets a signed-in customer choose an image on the welcome screen", () => {
    const stage = vi.fn();
    const { container } = renderWithRuntime(<ChatComposer welcome isEn showTools={false}
      onToggleTools={vi.fn()} onToolSelect={vi.fn()} isDragOver={false}
      onStageImage={stage} chatInputRef={{ current: null }} onPaste={vi.fn()}
      isVoiceSupported={false} onToggleVoice={vi.fn()} voiceState="idle" loading={false} />);
    const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
    const open = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "Attach an image" }));
    expect(open).toHaveBeenCalledOnce();
    const image = new File(["sample"], "sample.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [image] } });
    expect(stage).toHaveBeenCalledWith(image);
  });

  it("disables attachments and voice but allows sending text", () => {
    const send = vi.fn(async () => {});
    const tools = vi.fn();
    renderWithRuntime(<ChatComposer toolsEnabled={false} isEn showTools={false}
      onToggleTools={tools} onToolSelect={vi.fn()} isDragOver={false}
      onStageImage={vi.fn()} chatInputRef={{ current: null }} onPaste={vi.fn()}
      isVoiceSupported onToggleVoice={vi.fn()} voiceState="idle" loading={false} />, send);
    expect(screen.getByRole("button", { name: "Tools and attachments" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Attach an image" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Voice input" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tools and attachments" }));
    expect(tools).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "question" } });
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
