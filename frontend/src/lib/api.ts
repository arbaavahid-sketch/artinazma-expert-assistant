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

// ─── Customer JWT Token Management ─────────────────────────────────────────

const TOKEN_KEY = "artin_customer_token";

/** ذخیره توکن JWT در localStorage */
export function saveCustomerToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/** خواندن توکن JWT از localStorage */
export function getCustomerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** حذف توکن هنگام خروج */
export function removeCustomerToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * ساخت هدرهای Authorization برای درخواست‌های مشتری.
 * به headers موجود اضافه می‌شود.
 */
export function customerAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = getCustomerToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * fetch wrapper برای اندپوینت‌های مشتری — توکن JWT را خودکار اضافه می‌کند.
 * اگر 401 برگرداند، توکن را پاک و به صفحه لاگین ریدایرکت می‌کند.
 */
export async function customerFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getCustomerToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    removeCustomerToken();
    if (typeof window !== "undefined") {
      // Remove stored customer data
      localStorage.removeItem("artin_customer");
      window.location.href = "/customer-login";
    }
  }

  return res;
}
