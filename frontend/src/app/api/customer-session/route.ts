/**
 * Customer session management via secure httpOnly cookie.
 *
 * POST /api/customer-session  — set session after login/register
 * GET  /api/customer-session  — verify session & return customer_id
 * DELETE /api/customer-session — logout
 *
 * Why: storing customer_id only in localStorage + a plain "logged_in" cookie
 * allowed any user to tamper with customer_id in requests.
 * Now customer_id is stored in a signed httpOnly cookie that JS cannot read.
 */

import { NextRequest, NextResponse } from "next/server";

const SESSION_SECRET =
  process.env.CUSTOMER_SESSION_SECRET || "artin-customer-default-secret-change-me";

/** Simple HMAC-like signing using Web Crypto (available in Next.js edge/node) */
async function sign(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Buffer.from(sig).toString("base64url");
}

async function verify(payload: string, signature: string): Promise<boolean> {
  const expected = await sign(payload);
  return expected === signature;
}

function buildCookieValue(customerId: number): Promise<string> {
  const payload = String(customerId);
  return sign(payload).then((sig) => `${payload}.${sig}`);
}

async function parseCookie(
  value: string,
): Promise<{ customerId: number } | null> {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const ok = await verify(payload, sig);
  if (!ok) return null;
  const id = parseInt(payload, 10);
  if (isNaN(id)) return null;
  return { customerId: id };
}

// POST — called after successful login/register
export async function POST(request: NextRequest) {
  const body = await request.json();
  const customerId = Number(body.customer_id);
  if (!customerId || isNaN(customerId)) {
    return NextResponse.json({ error: "invalid customer_id" }, { status: 400 });
  }

  const cookieValue = await buildCookieValue(customerId);

  const response = NextResponse.json({ success: true, customer_id: customerId });
  response.cookies.set("artin_customer_session", cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });
  // Also set the plain "logged_in" marker so middleware can read it without crypto
  response.cookies.set("artin_customer_auth", "logged_in", {
    httpOnly: false, // readable by middleware
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}

// GET — verify session, return customer_id
export async function GET(request: NextRequest) {
  const raw = request.cookies.get("artin_customer_session")?.value;
  if (!raw) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const session = await parseCookie(raw);
  if (!session) {
    return NextResponse.json({ authenticated: false, error: "invalid session" }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, customer_id: session.customerId });
}

// DELETE — logout
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("artin_customer_session", "", { maxAge: 0, path: "/" });
  response.cookies.set("artin_customer_auth", "", { maxAge: 0, path: "/" });
  return response;
}
