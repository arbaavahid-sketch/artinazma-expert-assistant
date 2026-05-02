import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/admin", "/knowledge", "/questions", "/dashboard"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const adminCookie = request.cookies.get("artin_admin")?.value;

  if (adminCookie === "ok") {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin-login", request.url);
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/knowledge/:path*",
    "/questions/:path*",
    "/dashboard/:path*",
  ],
};