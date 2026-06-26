import { describe, it, expect } from "vitest";
import {
  escapeRegExp,
  hasPersianText,
  getTextDirection,
  getTextFont,
  cleanAssistantOutput,
  normalizeSuggestedQuestions,
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

describe("assistant output cleanup", () => {
  const leakedPrompt =
    "\u00ab\u0644\u0637\u0641\u0627\u064b \u0645\u0633\u0626\u0644\u0647 \u0631\u0627 \u0645\u0631\u062d\u0644\u0647\u200c\u0628\u0647\u200c\u0645\u0631\u062d\u0644\u0647 \u0628\u0631\u0631\u0633\u06cc \u06a9\u0646 \u0648 \u067e\u0627\u0633\u062e \u0631\u0627 \u0628\u0627 \u0627\u0633\u062a\u062f\u0644\u0627\u0644 \u0648 \u062a\u0648\u0636\u06cc\u062d \u0631\u0648\u0634\u0646 \u0627\u0631\u0627\u0626\u0647 \u0628\u062f\u0647.\u00bb";

  it("removes leaked instruction text from assistant answers", () => {
    const answer = `\u067e\u0627\u0633\u062e \u0627\u0635\u0644\u06cc\n\n${leakedPrompt}`;

    expect(cleanAssistantOutput(answer)).toBe("\u067e\u0627\u0633\u062e \u0627\u0635\u0644\u06cc");
  });

  it("filters leaked instruction text from suggested questions", () => {
    expect(
      normalizeSuggestedQuestions([
        leakedPrompt,
        "\u062a\u0641\u0627\u0648\u062a GC-FID \u0648 GC-TCD \u062f\u0631 \u0622\u0646\u0627\u0644\u06cc\u0632 \u06af\u0627\u0632 \u0686\u06cc\u0633\u062a\u061f",
        "\u062a\u0641\u0627\u0648\u062a GC-FID \u0648 GC-TCD \u062f\u0631 \u0622\u0646\u0627\u0644\u06cc\u0632 \u06af\u0627\u0632 \u0686\u06cc\u0633\u062a\u061f",
      ]),
    ).toEqual([
      "\u062a\u0641\u0627\u0648\u062a GC-FID \u0648 GC-TCD \u062f\u0631 \u0622\u0646\u0627\u0644\u06cc\u0632 \u06af\u0627\u0632 \u0686\u06cc\u0633\u062a\u061f",
    ]);
  });

  it("keeps long technical suggested questions instead of dropping them", () => {
    const longQuestion =
      "\u0628\u0631\u0627\u06cc \u0622\u0646\u0627\u0644\u06cc\u0632 \u06a9\u0627\u0645\u0644 \u06af\u0627\u0632 \u0637\u0628\u06cc\u0639\u06cc \u0628\u0627 \u0631\u0648\u0634 GC-FID \u0648 GC-TCD\u060c \u0686\u0647 \u0646\u0648\u0639 \u0633\u062a\u0648\u0646\u060c \u06af\u0627\u0632 \u062d\u0627\u0645\u0644\u060c \u0634\u0631\u0627\u06cc\u0637 \u062f\u0645\u0627\u06cc\u06cc \u0648 \u0628\u0631\u0646\u0627\u0645\u0647 \u06a9\u0627\u0644\u06cc\u0628\u0631\u0627\u0633\u06cc\u0648\u0646\u06cc \u0628\u0631\u0627\u06cc \u062f\u0642\u062a \u0628\u0647\u062a\u0631 \u067e\u06cc\u0634\u0646\u0647\u0627\u062f \u0645\u06cc\u200c\u0634\u0648\u062f\u061f";

    const [question] = normalizeSuggestedQuestions([longQuestion]);

    expect(question).toBeTruthy();
    expect(question.length).toBeLessThanOrEqual(180);
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
