import { describe, it, expect } from "vitest";
import {
  escapeRegExp,
  hasPersianText,
  getTextDirection,
  getTextFont,
  shouldShowRelatedDeviceCards,
  getTestTypeLabel,
  getImageTypeLabel,
} from "../chat-helpers";

describe("escapeRegExp", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegExp("a.b*c")).toBe("a\\.b\\*c");
    expect(escapeRegExp("(x)[y]")).toBe("\\(x\\)\\[y\\]");
  });

  it("leaves plain text untouched", () => {
    expect(escapeRegExp("hello world")).toBe("hello world");
  });

  it("produces a pattern that matches the literal input", () => {
    const literal = "GC/HPLC (v1.2)";
    const re = new RegExp(escapeRegExp(literal));
    expect(re.test(literal)).toBe(true);
  });
});

describe("hasPersianText", () => {
  it("detects Persian characters", () => {
    expect(hasPersianText("سلام")).toBe(true);
    expect(hasPersianText("دستگاه ABC")).toBe(true);
  });

  it("returns false for pure Latin text", () => {
    expect(hasPersianText("hello 123")).toBe(false);
    expect(hasPersianText("")).toBe(false);
  });
});

describe("getTextDirection", () => {
  it("returns rtl for Persian and ltr for Latin", () => {
    expect(getTextDirection("متن فارسی")).toBe("rtl");
    expect(getTextDirection("english text")).toBe("ltr");
  });
});

describe("getTextFont", () => {
  it("picks the Persian font for Persian text", () => {
    expect(getTextFont("آرتین")).toBe("var(--font-persian)");
    expect(getTextFont("Artin")).toBe("var(--font-english)");
  });
});

describe("shouldShowRelatedDeviceCards", () => {
  it("always shows cards when domain is equipment", () => {
    expect(shouldShowRelatedDeviceCards("هر متنی", "equipment")).toBe(true);
  });

  it("shows cards when an intent keyword is present", () => {
    expect(shouldShowRelatedDeviceCards("یک دستگاه مناسب می‌خواهم", "general")).toBe(true);
    expect(shouldShowRelatedDeviceCards("show me the analyzer model", "general")).toBe(true);
  });

  it("hides cards for unrelated questions", () => {
    expect(shouldShowRelatedDeviceCards("تفاوت دو روش چیست؟", "general")).toBe(false);
  });
});

describe("label lookups", () => {
  it("maps known values to labels and falls back otherwise", () => {
    expect(getTestTypeLabel("sulfur")).toBe("آنالیز سولفور");
    expect(getTestTypeLabel("unknown-value")).toBe("گزارش عمومی آزمایشگاهی");
    expect(getImageTypeLabel("chromatogram")).toBe("کروماتوگرام");
    expect(getImageTypeLabel("unknown-value")).toBe("تصویر عمومی");
  });
});
