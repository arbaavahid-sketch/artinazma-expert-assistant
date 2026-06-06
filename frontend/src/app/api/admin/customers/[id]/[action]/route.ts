import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";
const ADMIN_API_KEY: string = process.env.ADMIN_API_KEY ?? "";
const SESSION_TOKEN = process.env.ADMIN_SESSION_TOKEN;

if (!ADMIN_API_KEY) {
  throw new Error("ADMIN_API_KEY environment variable is not set");
}
if (!SESSION_TOKEN) {
  throw new Error("ADMIN_SESSION_TOKEN environment variable is not set");
}

function isAdminAuthed(request: NextRequest): boolean {
  const cookie = request.cookies.get("artin_admin");
  return cookie?.value === SESSION_TOKEN;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  if (!isAdminAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, action } = await params;

  if (action !== "block" && action !== "unblock") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/admin/customers/${id}/${action}`,
      {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_API_KEY },
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
