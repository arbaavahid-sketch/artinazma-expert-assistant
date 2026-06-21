import { NextRequest, NextResponse } from "next/server";

function getRuntimeConfig() {
  const adminApiKey = process.env.ADMIN_API_KEY;
  const sessionToken = process.env.ADMIN_SESSION_TOKEN;

  if (!adminApiKey || !sessionToken) {
    return null;
  }

  return {
    backendUrl:
      process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000",
    adminApiKey,
    sessionToken,
  };
}

function isAdminAuthed(
  request: NextRequest,
  sessionToken: string,
): boolean {
  const cookie = request.cookies.get("artin_admin");
  return cookie?.value === sessionToken;
}

export async function GET(request: NextRequest) {
  const config = getRuntimeConfig();

  if (!config) {
    return NextResponse.json(
      { error: "تنظیمات سرویس ادمین کامل نیست." },
      { status: 503 },
    );
  }

  if (!isAdminAuthed(request, config.sessionToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "200";
  const offset = searchParams.get("offset") || "0";

  try {
    const res = await fetch(
      `${config.backendUrl}/admin/customers?limit=${limit}&offset=${offset}`,
      {
        headers: {
          "X-Admin-Key": config.adminApiKey,
        },
      },
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "خطا در ارتباط با سرور" },
      { status: 500 },
    );
  }
}
