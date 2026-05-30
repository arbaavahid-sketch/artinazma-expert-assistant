/**
 * GET /api/customer-ws-token
 *
 * Reads the httpOnly artin_jwt cookie (not accessible from client JS) and
 * returns the raw JWT value so the frontend can attach it to the WebSocket
 * URL (?token=...) for cross-origin dev connections.
 *
 * In production (same-origin via nginx), the browser sends cookies on the WS
 * upgrade request automatically, so this route is only needed in development.
 *
 * Security: This route is only callable by same-site JavaScript (SameSite=Lax
 * + the HTTPS origin check handled by the browser). The token is kept in
 * React state (memory) — not persisted to localStorage.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get("artin_jwt");

  if (!jwt?.value) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ token: jwt.value });
}
