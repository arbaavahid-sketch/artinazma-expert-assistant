import { describe, it, expect } from "vitest";
import { findRelatedDevices, deviceAssets } from "../device-assets";

describe("findRelatedDevices", () => {
  it("matches a device by a Persian keyword", () => {
    const results = findRelatedDevices("قیمت آنالایزر جیوه چنده؟");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("ra-915m");
  });

  it("matches a device by an English keyword, case-insensitively", () => {
    const results = findRelatedDevices("I need an ATOMIC ABSORPTION spectrometer");
    expect(results[0].id).toBe("mga-1000");
  });

  it("returns an empty array when nothing matches", () => {
    expect(findRelatedDevices("یک موضوع کاملا نامرتبط درباره آشپزی")).toEqual([]);
  });

  it("ranks devices with more keyword hits higher", () => {
    // Text hits multiple sulfur-analyzer keywords (گوگرد, h2s, مرکاپتان, lpg)
    // and only one gc keyword (gc) — sulfur should outrank gc.
    const results = findRelatedDevices("اندازه‌گیری گوگرد و h2s و مرکاپتان در lpg با gc");
    expect(results[0].id).toBe("sulfur-analyzer");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("respects the maxResults limit", () => {
    // A query that hits several devices at once.
    const broad = "gc کروماتوگرافی، گوگرد sulfur، جیوه mercury، کاتالیست catalyst، جذب اتمی aas";
    expect(findRelatedDevices(broad, 2)).toHaveLength(2);
    expect(findRelatedDevices(broad, 4)).toHaveLength(4);
  });

  it("only returns devices with a positive score", () => {
    const results = findRelatedDevices("gc baseline پیک");
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
    }
  });

  it("does not mutate the source deviceAssets list", () => {
    const before = JSON.parse(JSON.stringify(deviceAssets));
    findRelatedDevices("جیوه mercury gc گوگرد");
    expect(deviceAssets).toEqual(before);
  });
});
