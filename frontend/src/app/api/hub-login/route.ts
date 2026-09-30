import { NextResponse, type NextRequest } from "next/server";

import { withBasePath } from "@/lib/base-path";
import { verifyHubTicket } from "@/lib/hub-session";

/**
 * Signs a manager into the admin panel when they arrive from the holding hub.
 * The hub cannot set a cookie on this host — a different domain — so it sends
 * a short-lived signed ticket and this turns it into the admin session the
 * rest of the app already understands.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const raw = params.get("next") ?? "/admin";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";

  const sessionToken = process.env.ADMIN_SESSION_TOKEN;
  const ok = await verifyHubTicket(params.get("ticket") ?? undefined, "assistant");
  if (!ok || !sessionToken) {
    const login = new URL(withBasePath("/admin-login"), request.url);
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  // A relative Location keeps the visitor on the address they came in on —
  // the hub's, when the assistant is served as one of its zones.
  const res = new NextResponse(null, {
    status: 302,
    headers: { Location: withBasePath(next) },
  });
  res.cookies.set("artin_admin", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
