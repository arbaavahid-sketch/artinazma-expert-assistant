import { describe, it, expect, beforeEach } from "vitest";
import { getOrCreateUserId } from "../user";

describe("getOrCreateUserId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates and persists a new id when none exists", () => {
    expect(localStorage.getItem("artin_user_id")).toBeNull();
    const id = getOrCreateUserId();
    expect(id).toMatch(/^user_/);
    expect(localStorage.getItem("artin_user_id")).toBe(id);
  });

  it("returns the same id on subsequent calls (stable)", () => {
    const first = getOrCreateUserId();
    const second = getOrCreateUserId();
    expect(second).toBe(first);
  });

  it("reuses an existing stored id", () => {
    localStorage.setItem("artin_user_id", "user_existing_123");
    expect(getOrCreateUserId()).toBe("user_existing_123");
  });

  it("generates distinct ids for distinct sessions", () => {
    const a = getOrCreateUserId();
    localStorage.clear();
    const b = getOrCreateUserId();
    expect(a).not.toBe(b);
  });
});
