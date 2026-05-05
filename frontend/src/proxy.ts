import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");

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
    const sessionToken =
      process.env.ADMIN_SESSION_TOKEN || "artin-local-admin-session";

    if (adminCookie === sessionToken) {
      return NextResponse.next();
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin-login";
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (isCustomerProtectedRoute) {
    const customerCookie = request.cookies.get("artin_customer_auth")?.value;

    if (customerCookie === "logged_in") {
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