import { describe, it, expect, beforeEach } from "vitest";
import { makeSessionTitle, getSavedCustomer } from "../customer";

describe("makeSessionTitle", () => {
  it("falls back to a default title for empty/whitespace input", () => {
    expect(makeSessionTitle("")).toBe("گفتگوی جدید");
    expect(makeSessionTitle("   ")).toBe("گفتگوی جدید");
  });

  it("keeps a short title unchanged", () => {
    expect(makeSessionTitle("سوال درباره کاتالیست")).toBe("سوال درباره کاتالیست");
  });

  it("collapses internal whitespace", () => {
    expect(makeSessionTitle("  چند   فاصله\tاضافه ")).toBe("چند فاصله اضافه");
  });

  it("truncates titles longer than 42 chars with an ellipsis", () => {
    const long = "a".repeat(60);
    const result = makeSessionTitle(long);
    expect(result).toBe(`${"a".repeat(42)}...`);
    expect(result.length).toBe(45);
  });
});

describe("getSavedCustomer", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing is stored", () => {
    expect(getSavedCustomer()).toBeNull();
  });

  it("parses and returns the stored customer", () => {
    const customer = { id: 7, name: "Vahid", email: "v@example.com" };
    localStorage.setItem("artin_customer", JSON.stringify(customer));
    expect(getSavedCustomer()).toEqual(customer);
  });

  it("returns null when the stored value is invalid JSON", () => {
    localStorage.setItem("artin_customer", "{not-json");
    expect(getSavedCustomer()).toBeNull();
  });
});
