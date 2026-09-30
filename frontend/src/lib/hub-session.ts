/**
 * The Artin Azma holding hub signs one cookie for every app in the group.
 * A manager who signed in there reaches the admin area here without a second
 * password. Customer accounts are untouched — they are not hub users.
 *
 * WebCrypto only, so the proxy can verify it at the edge.
 */
export const HUB_COOKIE = "hub_session";

interface HubPayload {
  sub: string;
  role: "manager" | "member";
  exp: number;
}

const enc = new TextEncoder();

const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );

const b64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

function hubSecret(): string | undefined {
  const secret = process.env.SESSION_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : undefined;
}

/** True when a hub manager session is present and valid. */
export async function hubManagerSession(
  token: string | undefined,
): Promise<boolean> {
  const secret = hubSecret();
  if (!secret || !token) return false;

  const [body, sig] = token.split(".");
  if (!body || !sig) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expected = b64url(
      await crypto.subtle.sign("HMAC", key, enc.encode(body)),
    );
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++)
      diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(fromB64url(body)),
    ) as HubPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000))
      return false;
    // Only a manager: a member of another app is not an admin here.
    return payload.role === "manager";
  } catch {
    return false;
  }
}
