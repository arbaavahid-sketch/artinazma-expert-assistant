import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import {
  checkAdminLoginRateLimit,
  getAdminLoginClientId,
  recordAdminLoginFailure,
  resetAdminLoginRateLimit,
} from "@/lib/admin-login-rate-limit";

/** Hash a string with SHA-256 so timingSafeEqual always compares same-length buffers */
function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const password = body.password || "";
  const clientId = getAdminLoginClientId(request.headers);
  const rateLimit = checkAdminLoginRateLimit(clientId);

  if (rateLimit.limited) {
    return NextResponse.json(
      {
        success: false,
        message: "تلاش‌های ناموفق زیاد بوده است. چند دقیقه بعد دوباره امتحان کنید.",
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

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
    const failure = recordAdminLoginFailure(clientId);
    const status = failure.blocked ? 429 : 401;

    return NextResponse.json(
      {
        success: false,
        message: failure.blocked
          ? "تلاش‌های ناموفق زیاد بوده است. چند دقیقه بعد دوباره امتحان کنید."
          : "رمز ادمین اشتباه است.",
        retry_after_seconds: failure.retryAfterSeconds,
      },
      {
        status,
        headers: failure.blocked
          ? { "Retry-After": String(failure.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  resetAdminLoginRateLimit(clientId);

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
