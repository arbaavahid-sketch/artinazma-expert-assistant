import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WaitingIndicator from "./WaitingIndicator";

describe("WaitingIndicator", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("describes the work first, then shows elapsed seconds once the wait is noticeable", () => {
    render(<WaitingIndicator />);
    expect(screen.getByRole("status")).toHaveTextContent("آرتین در حال بررسی منابع و نوشتن پاسخ است");
    expect(screen.getByText("بانک دانش، استانداردها و کاتالوگ محصولات")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("۵ ثانیه");
  });
});
