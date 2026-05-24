import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const password = body.password || "";

  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionToken = process.env.ADMIN_SESSION_TOKEN || "artin-local-admin-session";

  if (!adminPassword) {
    console.error("[admin-login] ADMIN_PASSWORD is not set in environment variables.");
    return NextResponse.json(
      { success: false, message: "پیکربندی سرور ناقص است. با مدیر سیستم تماس بگیرید." },
      { status: 503 }
    );
  }

  if (password !== adminPassword) {
    return NextResponse.json(
      {
        success: false,
        message: "رمز ادمین اشتباه است.",
      },
      { status: 401 },
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
