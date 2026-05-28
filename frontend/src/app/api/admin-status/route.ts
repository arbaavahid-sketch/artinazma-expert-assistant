import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const adminCookie = request.cookies.get("artin_admin")?.value;
  const sessionToken = process.env.ADMIN_SESSION_TOKEN;

  // Fail closed: if env is not configured, never grant admin
  const isAdmin = !!sessionToken && adminCookie === sessionToken;

  return NextResponse.json({
    is_admin: isAdmin,
  });
}
