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
