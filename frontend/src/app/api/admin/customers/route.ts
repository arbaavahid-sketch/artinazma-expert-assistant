import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const ADMIN_API_KEY =
  process.env.ADMIN_API_KEY || "ArtinAzma1*2#amzanitra!@#";
const SESSION_TOKEN =
  process.env.ADMIN_SESSION_TOKEN || "artin-local-admin-session";

function isAdminAuthed(request: NextRequest): boolean {
  const cookie = request.cookies.get("artin_admin");
  return cookie?.value === SESSION_TOKEN;
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "200";
  const offset = searchParams.get("offset") || "0";

  try {
    const res = await fetch(
      `${BACKEND_URL}/admin/customers?limit=${limit}&offset=${offset}`,
      { headers: { "X-Admin-Key": ADMIN_API_KEY } },
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
