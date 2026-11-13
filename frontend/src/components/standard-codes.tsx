import { Children, Fragment, type ReactNode } from "react";

// Answer text may already carry Unicode isolate marks (U+2066–U+2069) around
// Latin words, e.g. "⁦ASTM⁩ D4294", so the pattern skips over them.
const MARKS = "[\\u2066-\\u2069]*";
const ISOLATE_MARKS = /[⁦-⁩]/g;

/**
 * Matches test-method and standard designations such as "ASTM D4294",
 * "ASTM D 1151", "ISO 20846", "EN 590", "UOP 163-10" or "GB/T 11140".
 * The organisation prefix is required, so ordinary numbers are left alone.
 */
export const STANDARD_CODE = new RegExp(
  `${MARKS}\\b(?:ASTM|ISO|EN|IP|UOP|GPA|DIN|BS|API|IEC|ANSI|JIS|GB\\/T|GOST|ISIRI)${MARKS}\\s?${MARKS}` +
    `(?:[A-Z]{1,2}${MARKS}\\s?${MARKS})?\\d{1,6}(?:[-/.:]\\d+)*[A-Z]?\\b${MARKS}`,
  "g",
);

/**
 * Wraps standard codes found in plain-text children in a left-to-right badge,
 * so a code like "ASTM D4294" keeps its word order inside Persian text and is
 * easy to spot. Non-string children (links, nested formatting) pass through.
 */
export function withStandardBadges(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    const parts: ReactNode[] = [];
    let last = 0;
    for (const match of child.matchAll(STANDARD_CODE)) {
      const start = match.index ?? 0;
      if (start > last) parts.push(child.slice(last, start));
      parts.push(
        <bdi key={start} dir="ltr" className="ai-md-std">
          {match[0].replace(ISOLATE_MARKS, "")}
        </bdi>,
      );
      last = start + match[0].length;
    }
    if (parts.length === 0) return child;
    if (last < child.length) parts.push(child.slice(last));
    return <Fragment>{parts}</Fragment>;
  });
}
