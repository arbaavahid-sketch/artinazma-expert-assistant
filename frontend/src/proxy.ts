import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  const isCustomerProtectedRoute =
    pathname === "/assistant" ||
    pathname.startsWith("/assistant/") ||
    pathname === "/customer-dashboard" ||
    pathname.startsWith("/customer-dashboard/") ||
    pathname === "/customer-request" ||
    pathname.startsWith("/customer-request/") ||
    pathname === "/analyze" ||
    pathname.startsWith("/analyze/");

  if (isAdminRoute) {
    const adminCookie = request.cookies.get("artin_admin")?.value;
    const sessionToken = process.env.ADMIN_SESSION_TOKEN;

    if (!sessionToken) {
      // Fail closed: if env is missing, block all admin access rather than falling back to a known value
      return NextResponse.redirect(new URL("/admin-login", request.url));
    }

    if (adminCookie === sessionToken) {
      return NextResponse.next();
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin-login";
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (isCustomerProtectedRoute) {
    // artin_customer_session is an httpOnly signed cookie set only by /api/customer-session.
    // We verify it exists and has the expected "payload.signature" shape;
    // full HMAC verification happens in API routes that need the customer_id.
    const sessionCookie = request.cookies.get("artin_customer_session")?.value;

    if (sessionCookie && sessionCookie.includes(".")) {
      return NextResponse.next();
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/customer-login";
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/assistant/:path*",
    "/customer-dashboard/:path*",
    "/customer-request/:path*",
    "/analyze/:path*",
  ],
};
