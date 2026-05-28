import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

/** Hash a string with SHA-256 so timingSafeEqual always compares same-length buffers */
function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const password = body.password || "";

  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const sessionToken = process.env.ADMIN_SESSION_TOKEN || "";

  if (!adminPassword || !sessionToken) {
    return NextResponse.json(
      {
        success: false,
        message: "تنظیمات ادمین انجام نشده. ADMIN_PASSWORD و ADMIN_SESSION_TOKEN را در متغیرهای محیطی تنظیم کنید.",
      },
      { status: 503 },
    );
  }

  // Timing-safe comparison: hash both sides first so buffers are always equal length.
  // This prevents attackers from measuring response time to guess the password character by character.
  const passwordMatch = timingSafeEqual(sha256(password), sha256(adminPassword));

  if (!passwordMatch) {
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
