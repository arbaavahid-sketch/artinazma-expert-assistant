export const DIGIT_OPTIONS = [3, 4, 5, 6, 8] as const;
export const DEFAULT_DIGITS = 6;

/** One number format for every quick-calculator value, in the reader's locale. */
export function formatQuantity(number: number, en: boolean, digits = 8): string {
  return new Intl.NumberFormat(en ? "en" : "fa", {
    maximumSignificantDigits: digits,
    notation: number !== 0 && (Math.abs(number) < 0.0001 || Math.abs(number) >= 1e9) ? "scientific" : "standard",
  }).format(number);
}

/** True when showing `number` with `digits` significant figures drops real digits (not float noise). */
export function isRounded(number: number, digits: number): boolean {
  if (!Number.isFinite(number) || number === 0) return false;
  return Math.abs(Number(number.toPrecision(digits)) - number) > 1e-12 * Math.abs(number);
}
