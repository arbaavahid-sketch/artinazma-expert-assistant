import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no media decoder; playback policy is tested with explicit sensor mocks.
Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });

// jsdom does not implement native dialog.close(); browser focus trapping is checked in-browser.
Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value: function(this: HTMLDialogElement) { this.removeAttribute('open'); },
});

// پاک‌سازی DOM بعد از هر تست تا تست‌ها روی هم اثر نگذارند
afterEach(() => {
  cleanup();
});
