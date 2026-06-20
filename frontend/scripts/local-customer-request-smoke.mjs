import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://127.0.0.1:8000";
const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:3000";

function getLocalAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;

  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");
  const line = content.split(/\r?\n/).find((item) => item.startsWith("ADMIN_PASSWORD="));
  const value = line?.replace(/^ADMIN_PASSWORD=/, "").trim().replace(/^["']|["']$/g, "");

  if (!value) {
    throw new Error("ADMIN_PASSWORD is not set in frontend/.env.local.");
  }

  return value;
}

function getCookieHeader(response) {
  const setCookie = response.headers.get("set-cookie") || "";
  const cookies = setCookie
    .split(/,(?=\s*[^;,\s]+=)/)
    .map((cookie) => cookie.split(";")[0].trim())
    .filter(Boolean);

  return cookies.join("; ");
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function registerCustomer() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const email = `request-smoke-${stamp}-${Math.random().toString(16).slice(2, 8)}@example.com`;
  const password = `LocalSmoke${stamp}!`;
  const phone = `0912${stamp.slice(-7)}`;

  const body = await fetchJson(`${backendBaseUrl}/customers/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "Customer Request Smoke",
      email,
      password,
      company: "ArtinAzma Local Smoke",
      phone,
    }),
  });

  if (!body.success || !body.customer?.id) {
    throw new Error(`Customer registration failed: ${JSON.stringify(body)}`);
  }

  return { customer: body.customer, email, password, phone };
}

async function loginCustomer(credentials) {
  const healthResponse = await fetch(`${backendBaseUrl}/health`);
  const csrfCookie = getCookieHeader(healthResponse);
  const csrfToken = csrfCookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("artin_csrf="))
    ?.replace("artin_csrf=", "");

  const response = await fetch(`${backendBaseUrl}/customers/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw new Error(`Customer login failed: ${JSON.stringify(body)}`);
  }
  const cookieHeader = getCookieHeader(response);
  if (!cookieHeader.includes("artin_jwt=")) {
    throw new Error("Customer login did not return JWT cookie.");
  }
  return {
    cookieHeader: [cookieHeader, csrfCookie].filter(Boolean).join("; "),
    csrfToken,
  };
}

async function loginAdmin() {
  const response = await fetch(`${frontendBaseUrl}/api/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: getLocalAdminPassword() }),
  });
  if (!response.ok) {
    throw new Error(`Admin login failed with ${response.status}.`);
  }
  const cookieHeader = getCookieHeader(response);
  if (!cookieHeader.includes("artin_admin=")) {
    throw new Error("Admin login did not return admin session cookie.");
  }
  return cookieHeader;
}

async function main() {
  const credentials = await registerCustomer();
  const customerAuth = await loginCustomer(credentials);
  const adminCookie = await loginAdmin();
  const marker = `REQUEST_SMOKE_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const subject = `Local customer request smoke ${marker}`;

  const created = await fetchJson(`${backendBaseUrl}/customer-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: credentials.customer.full_name,
      company: credentials.customer.company,
      phone: credentials.phone,
      email: credentials.email,
      request_type: "equipment",
      subject,
      message: `Smoke request body. Marker: ${marker}`,
    }),
  });
  if (!created.success || !created.request_id) {
    throw new Error(`Request creation failed: ${JSON.stringify(created)}`);
  }
  const requestId = created.request_id;

  const adminList = await fetchJson(`${frontendBaseUrl}/api/admin-proxy/customer-requests?limit=20`, {
    headers: { Cookie: adminCookie },
  });
  const adminHit = (adminList.requests || []).find((item) => item.id === requestId);
  if (!adminHit || adminHit.subject !== subject) {
    throw new Error(`Created request was not visible to admin: ${JSON.stringify(adminList)}`);
  }

  const crm = await fetchJson(`${frontendBaseUrl}/api/admin-proxy/customer-requests/${requestId}/crm`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      priority: "high",
      internal_note: `Internal smoke note ${marker}`,
      assigned_to: "Local Smoke Owner",
      follow_up_at: "2026-06-21T09:00:00",
    }),
  });
  if (!crm.success) {
    throw new Error(`CRM update failed: ${JSON.stringify(crm)}`);
  }

  const status = await fetchJson(`${frontendBaseUrl}/api/admin-proxy/customer-requests/${requestId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ status: "reviewing" }),
  });
  if (!status.success) {
    throw new Error(`Status update failed: ${JSON.stringify(status)}`);
  }

  const customerHistory = await fetchJson(
    `${backendBaseUrl}/customers/${credentials.customer.id}/requests`,
    { headers: { Cookie: customerAuth.cookieHeader } },
  );
  const customerHit = (customerHistory.requests || []).find((item) => item.id === requestId);
  if (!customerHit || customerHit.status !== "reviewing") {
    throw new Error(`Request was not visible in customer history: ${JSON.stringify(customerHistory)}`);
  }

  const detail = await fetchJson(
    `${backendBaseUrl}/customers/${credentials.customer.id}/requests/${requestId}`,
    { headers: { Cookie: customerAuth.cookieHeader } },
  );
  if (!detail.success || detail.request?.id !== requestId || !Array.isArray(detail.timeline)) {
    throw new Error(`Customer request detail failed: ${JSON.stringify(detail)}`);
  }

  const formData = new FormData();
  formData.append("message", `Customer follow-up smoke note ${marker}`);
  const update = await fetchJson(
    `${backendBaseUrl}/customers/${credentials.customer.id}/requests/${requestId}/updates`,
    {
      method: "POST",
      headers: {
        Cookie: customerAuth.cookieHeader,
        ...(customerAuth.csrfToken ? { "X-CSRF-Token": customerAuth.csrfToken } : {}),
      },
      body: formData,
    },
  );
  if (!update.success || !update.update_id) {
    throw new Error(`Customer request update failed: ${JSON.stringify(update)}`);
  }

  const notifications = await fetchJson(
    `${backendBaseUrl}/customers/${credentials.customer.id}/notifications`,
    { headers: { Cookie: customerAuth.cookieHeader } },
  );
  if (!notifications.unread_count || notifications.unread_count < 1) {
    throw new Error(`Expected a customer notification after status/update actions: ${JSON.stringify(notifications)}`);
  }

  console.log(JSON.stringify({
    success: true,
    customer_id: credentials.customer.id,
    request_id: requestId,
    admin_visible: true,
    customer_history_visible: true,
    status: customerHit.status,
    update_id: update.update_id,
    unread_notifications: notifications.unread_count,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
