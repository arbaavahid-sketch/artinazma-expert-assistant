import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  // This app's own admin session, or a manager session from the holding hub.
  return NextResponse.json({ is_admin: await isAdminRequest(request) });
}
