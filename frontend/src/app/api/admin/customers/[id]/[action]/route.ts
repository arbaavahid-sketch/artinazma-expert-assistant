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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
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

  const { id, action } = await params;

  if (action !== "block" && action !== "unblock") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${config.backendUrl}/admin/customers/${id}/${action}`,
      {
        method: "POST",
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
