import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORWARDED_HEADERS = [
  "authorization",
  "cookie",
  "x-csrf-token",
  "accept",
];

function copyForwardHeaders(request: NextRequest, contentType: string): Headers {
  const headers = new Headers();

  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (contentType && !contentType.includes("multipart/form-data")) {
    headers.set("content-type", contentType);
  }

  return headers;
}

async function getProxyBody(request: NextRequest): Promise<BodyInit | null> {
  if (request.method === "GET" || request.method === "HEAD") return null;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    return request.formData();
  }

  if (contentType.includes("application/json") || contentType.startsWith("text/")) {
    return request.text();
  }

  return request.blob();
}

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const backendPath = path.join("/");
  const { search } = new URL(request.url);
  const backendUrl = `${BACKEND_URL}/${backendPath}${search}`;
  const contentType = request.headers.get("content-type") || "";

  try {
    const res = await fetch(backendUrl, {
      method: request.method,
      headers: copyForwardHeaders(request, contentType),
      body: await getProxyBody(request),
    });

    const responseHeaders = new Headers();
    const responseContentType = res.headers.get("content-type");

    if (responseContentType) {
      responseHeaders.set("content-type", responseContentType);
    }

    // The backend can set MULTIPLE cookies on a single response
    // (e.g. artin_jwt + artin_csrf on login). res.headers.get("set-cookie")
    // collapses them into one comma-joined string, which corrupts the cookies
    // (Expires dates also contain commas) and the browser drops artin_jwt —
    // causing every authenticated request to 401 and bounce back to /customer-login.
    // getSetCookie() returns each Set-Cookie header separately; append them all.
    const setCookies = res.headers.getSetCookie();
    for (const cookie of setCookies) {
      responseHeaders.append("set-cookie", cookie);
    }

    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown proxy error";
    return NextResponse.json(
      {
        detail:
          "Backend connection failed. Make sure the FastAPI server is running on port 8000.",
        error: message,
      },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
