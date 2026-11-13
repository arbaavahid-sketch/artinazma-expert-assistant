import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { withStandardBadges } from "../standard-codes";

function badges(text: string) {
  const { container } = render(<p>{withStandardBadges(text)}</p>);
  return {
    codes: [...container.querySelectorAll("bdi.ai-md-std")].map((el) => el.textContent),
    text: container.textContent,
    dirs: [...container.querySelectorAll("bdi")].map((el) => el.getAttribute("dir")),
  };
}

describe("withStandardBadges", () => {
  it("wraps standard designations in left-to-right badges and keeps the text", () => {
    const input = "روش ASTM D4294 یا ISO 20846 و همچنین ASTM D 1151 و UOP 163-10.";
    const result = badges(input);
    expect(result.codes).toEqual(["ASTM D4294", "ISO 20846", "ASTM D 1151", "UOP 163-10"]);
    expect(result.dirs.every((d) => d === "ltr")).toBe(true);
    expect(result.text).toBe(input);
  });

  it("matches codes that already carry Unicode isolate marks and drops the marks", () => {
    const result = badges("روش ⁦ASTM⁩ D4294 و ⁦ISO⁩ 20846 رایج است");
    expect(result.codes).toEqual(["ASTM D4294", "ISO 20846"]);
  });

  it("leaves numbers without an organisation prefix alone", () => {
    expect(badges("گستره 17 تا 8000 mg/kg و دمای 25 درجه").codes).toEqual([]);
  });

  it("passes through non-string children", () => {
    const { container } = render(<p>{withStandardBadges(["ASTM D5453 ", <a key="x" href="#">پیوند</a>])}</p>);
    expect(container.querySelector("a")?.textContent).toBe("پیوند");
    expect(container.querySelector("bdi")?.textContent).toBe("ASTM D5453");
  });
});
