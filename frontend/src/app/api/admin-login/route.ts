import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const password = body.password || "";

  const adminPassword = process.env.ADMIN_PASSWORD || "artin-admin";
  const sessionToken =
    process.env.ADMIN_SESSION_TOKEN || "artin-local-admin-session";

  if (password !== adminPassword) {
    return NextResponse.json(
      {
        success: false,
        message: "رمز ادمین اشتباه است.",
      },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    success: true,
    message: "ورود موفق بود.",
  });

  response.cookies.set("artin_admin", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return response;
}