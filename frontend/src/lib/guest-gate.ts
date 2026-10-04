/**
 * How much a visitor without an account may ask before we ask who they are.
 *
 * The count lives in the browser, so clearing site data or opening a private
 * window resets it. That is accepted: this is a nudge toward leaving a phone
 * number, not an abuse control. Counting server-side would have to key on IP,
 * which punishes a whole lab sharing one connection.
 */
const COUNT_KEY = "artin_guest_questions";
const CAPTURED_KEY = "artin_guest_captured";

/** Questions a guest may ask before the contact card blocks the composer. */
export const GUEST_FREE_QUESTIONS = 5;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode, or storage blocked
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do — the visitor simply gets the free questions again later.
  }
}

export function guestQuestionCount(): number {
  const raw = read(COUNT_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function bumpGuestQuestionCount(): number {
  const next = guestQuestionCount() + 1;
  write(COUNT_KEY, String(next));
  return next;
}

/** True once the visitor has left a name and phone — they are a known lead. */
export function isGuestCaptured(): boolean {
  return read(CAPTURED_KEY) === "1";
}

export function markGuestCaptured(): void {
  write(CAPTURED_KEY, "1");
}
