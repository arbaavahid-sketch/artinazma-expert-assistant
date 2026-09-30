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
  /** Set on a handoff ticket: the one app it may be used on. */
  aud?: string;
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

/** The signed payload of a hub token, or null when it does not check out. */
async function readHubToken(
  token: string | undefined,
): Promise<HubPayload | null> {
  const secret = hubSecret();
  if (!secret || !token) return null;

  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

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
    if (expected.length !== sig.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++)
      diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromB64url(body)),
    ) as HubPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** True when a hub manager session is present and valid. Only a manager: a
 *  member of another app is not an admin here. */
export async function hubManagerSession(
  token: string | undefined,
): Promise<boolean> {
  const payload = await readHubToken(token);
  // A handoff ticket is for the sign-in route, not for passing as a session.
  return Boolean(payload && !payload.aud && payload.role === "manager");
}

/**
 * A one-minute ticket the hub mints when a manager clicks this app's card.
 * It is bound to this app, so a ticket for another one is refused.
 */
export async function verifyHubTicket(
  token: string | undefined,
  appId: string,
): Promise<boolean> {
  const payload = await readHubToken(token);
  return Boolean(
    payload && payload.aud === appId && payload.role === "manager",
  );
}
