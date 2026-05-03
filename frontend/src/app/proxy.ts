import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const adminCookie = request.cookies.get("artin_admin")?.value;
  const sessionToken =
    process.env.ADMIN_SESSION_TOKEN || "artin-local-admin-session";

  if (adminCookie === sessionToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin-login", request.url);
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};