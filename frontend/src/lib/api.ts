export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export function apiUrl(path: string) {
  if (!path.startsWith("/")) {
    return `${API_BASE_URL}/${path}`;
  }

  return `${API_BASE_URL}${path}`;
}


/**
 * Returns a URL routed through the Next.js admin proxy.
 * Use this instead of apiUrl() for admin-protected backend endpoints.
 * The proxy checks the admin session cookie and adds X-Admin-Key automatically.
 */
export function adminUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `/api/admin-proxy${p}`;
}

/**
 * In dev, direct backend calls are cross-origin so the browser won't send
 * httpOnly cookies. Rewrite them through the Next.js reverse-proxy
 * (/api/backend/*) so every customer request is same-origin.
 * In production NEXT_PUBLIC_API_BASE_URL already points to a same-origin path.
 */
function toProxyUrl(url: string): string {
  if (typeof window === "undefined") return url; // SSR — no rewrite needed
  const isDev =
    !process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL.startsWith("http://127") ||
    process.env.NEXT_PUBLIC_API_BASE_URL.startsWith("http://localhost");
  if (isDev && url.startsWith(API_BASE_URL)) {
    return `/api/backend${url.slice(API_BASE_URL.length)}`;
  }
  return url;
}

/**
 * fetch wrapper برای اندپوینت‌های مشتری.
 * کوکی artin_jwt (httpOnly) خودکار توسط مرورگر ارسال می‌شود — credentials: 'include'.
 * در dev از پروکسی Next.js استفاده می‌کند تا کوکی‌ها same-origin باشند.
 * اگر 401 برگرداند، به صفحه لاگین ریدایرکت می‌کند.
 */
export async function customerFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(toProxyUrl(url), { ...options, credentials: "include" });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("artin_customer");
      try {
        // Clear Next.js session cookie and backend JWT cookie
        await fetch("/api/customer-session", { method: "DELETE" });
        await fetch(toProxyUrl(`${API_BASE_URL}/customers/logout`), { method: "POST", credentials: "include" });
      } catch {
        // ignore — still redirect
      }
      window.location.href = "/customer-login";
    }
  }

  return res;
}

// ─── CSRF Token Management ────────────────────────────────────────────────

/** Read the CSRF cookie set by the backend. */
export function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)artin_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * fetch wrapper that automatically attaches the CSRF token header
 * for state-changing requests (POST/PUT/PATCH/DELETE).
 */
export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set("X-CSRF-Token", csrf);
    }
  }

  return fetch(url, { ...options, headers });
}
