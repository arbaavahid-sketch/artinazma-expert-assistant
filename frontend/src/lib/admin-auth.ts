import type { NextRequest } from "next/server";

import { HUB_COOKIE, hubManagerSession } from "@/lib/hub-session";

/**
 * Admin route handlers accept either this app's own admin session or a
 * manager session from the Artin Azma holding hub — the same rule the proxy
 * applies to /admin pages, so a manager who got in does not hit 401s.
 */
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const sessionToken = process.env.ADMIN_SESSION_TOKEN || "";
  const own =
    Boolean(sessionToken) &&
    request.cookies.get("artin_admin")?.value === sessionToken;
  if (own) return true;
  return hubManagerSession(request.cookies.get(HUB_COOKIE)?.value);
}
