import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "../debounce";

describe("debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("invokes the function only once after the delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    debounced();
    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes the latest arguments through", () => {
    const fn = vi.fn();
    const debounced = debounce(fn as (...a: unknown[]) => void, 100);

    debounced("a");
    debounced("b");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("b");
  });

  it("resets the timer on each call", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(60);
    debounced();
    vi.advanceTimersByTime(60);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(40);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
