/**
 * Universal admin proxy — forwards any request to the backend with X-Admin-Key.
 * Checks the admin session cookie first; rejects unauthenticated requests.
 *
 * Usage from client:  fetch("/api/admin-proxy/customer-requests?limit=100")
 * Forwards to:        http://backend/customer-requests?limit=100  (with X-Admin-Key)
 */

import { NextRequest, NextResponse } from "next/server";

// Use BACKEND_INTERNAL_URL (server-side only, absolute) — never the public-facing
// NEXT_PUBLIC_API_BASE_URL which may be a relative path like /api/backend in dev.
const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";
const SESSION_TOKEN = process.env.ADMIN_SESSION_TOKEN || "";

function isAdminAuthed(request: NextRequest): boolean {
  if (!SESSION_TOKEN || !ADMIN_API_KEY) return false;
  return request.cookies.get("artin_admin")?.value === SESSION_TOKEN;
}

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!isAdminAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const backendPath = path.join("/");
  const { search } = new URL(request.url);
  const backendUrl = `${BACKEND_URL}/${backendPath}${search}`;

  // Forward body for non-GET requests
  let body: BodyInit | null = null;
  const contentType = request.headers.get("content-type") || "";
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (contentType.includes("application/json")) {
      body = await request.text();
    } else if (contentType.includes("multipart/form-data")) {
      body = await request.formData();
    } else {
      body = await request.blob();
    }
  }

  const headers: Record<string, string> = {
    "X-Admin-Key": ADMIN_API_KEY,
  };
  if (contentType && !contentType.includes("multipart/form-data")) {
    headers["Content-Type"] = contentType;
  }

  try {
    const res = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
    });

    const resContentType = res.headers.get("content-type") || "";

    // Stream binary/download responses (e.g. CSV exports)
    if (
      resContentType.includes("text/csv") ||
      resContentType.includes("octet-stream") ||
      resContentType.includes("application/")
    ) {
      const blob = await res.blob();
      return new NextResponse(blob, {
        status: res.status,
        headers: {
          "Content-Type": resContentType,
          "Content-Disposition":
            res.headers.get("content-disposition") || "",
        },
      });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[admin-proxy] backend error:", err);
    return NextResponse.json(
      { error: "خطا در ارتباط با سرور" },
      { status: 500 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
