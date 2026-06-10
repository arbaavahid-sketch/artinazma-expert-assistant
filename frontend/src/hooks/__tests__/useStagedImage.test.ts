import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStagedImage } from "../useStagedImage";

// jsdom پیاده‌سازی createObjectURL/revokeObjectURL ندارد، پس mock می‌کنیم.
beforeEach(() => {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  URL.revokeObjectURL = vi.fn();
});

function imageFile(name = "photo.png") {
  return new File(["x"], name, { type: "image/png" });
}

describe("useStagedImage", () => {
  it("starts with empty state", () => {
    const { result } = renderHook(() => useStagedImage());
    expect(result.current.stagedImage).toBeNull();
    expect(result.current.stagedImageUrl).toBe("");
    expect(result.current.isDragOver).toBe(false);
  });

  it("stages an image file and creates a preview url", () => {
    const { result } = renderHook(() => useStagedImage());
    const file = imageFile();
    act(() => result.current.stageImageFile(file));
    expect(result.current.stagedImage).toBe(file);
    expect(result.current.stagedImageUrl).toMatch(/^blob:mock\//);
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
  });

  it("ignores a non-image file", () => {
    const { result } = renderHook(() => useStagedImage());
    const txt = new File(["x"], "notes.txt", { type: "text/plain" });
    act(() => result.current.stageImageFile(txt));
    expect(result.current.stagedImage).toBeNull();
    expect(result.current.stagedImageUrl).toBe("");
  });

  it("clears the staged image and revokes the url", () => {
    const { result } = renderHook(() => useStagedImage());
    act(() => result.current.stageImageFile(imageFile()));
    const url = result.current.stagedImageUrl;
    act(() => result.current.clearStagedImage());
    expect(result.current.stagedImage).toBeNull();
    expect(result.current.stagedImageUrl).toBe("");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  });

  it("stages an image dropped onto the surface", () => {
    const { result } = renderHook(() => useStagedImage());
    const file = imageFile("dropped.png");
    const preventDefault = vi.fn();
    act(() =>
      result.current.handleDrop({
        preventDefault,
        dataTransfer: { files: [file] },
      } as unknown as React.DragEvent),
    );
    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.stagedImage).toBe(file);
    expect(result.current.isDragOver).toBe(false);
  });

  it("toggles isDragOver on drag over (with files) and drag leave", () => {
    const { result } = renderHook(() => useStagedImage());
    const preventDefault = vi.fn();
    act(() =>
      result.current.handleDragOver({
        preventDefault,
        dataTransfer: { types: ["Files"] },
      } as unknown as React.DragEvent),
    );
    expect(result.current.isDragOver).toBe(true);
    expect(preventDefault).toHaveBeenCalled();

    act(() => result.current.handleDragLeave());
    expect(result.current.isDragOver).toBe(false);
  });

  it("does not flag drag over when no files are dragged", () => {
    const { result } = renderHook(() => useStagedImage());
    act(() =>
      result.current.handleDragOver({
        preventDefault: vi.fn(),
        dataTransfer: { types: ["text/plain"] },
      } as unknown as React.DragEvent),
    );
    expect(result.current.isDragOver).toBe(false);
  });
});
