import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  if (cookies.length === 0) {
    throw new Error("Admin login did not return a session cookie.");
  }

  return cookies.join("; ");
}

async function fetchJson(path, init = {}) {
  const response = await fetch(`${frontendBaseUrl}${path}`, init);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function main() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const token = `SMOKE_KNOWLEDGE_TOKEN_${stamp}_${Math.random().toString(16).slice(2, 8)}`;
  const requestedFileName = `local-knowledge-smoke-${stamp}.txt`;
  let uploadedFileName = "";

  const loginResponse = await fetch(`${frontendBaseUrl}/api/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: getLocalAdminPassword() }),
  });
  if (!loginResponse.ok) {
    throw new Error(`Admin login failed with ${loginResponse.status}.`);
  }
  const cookieHeader = getCookieHeader(loginResponse);

  try {
    const formData = new FormData();
    const content = [
      "ArtinAzma local smoke knowledge document.",
      `Unique verification token: ${token}`,
      "This file verifies admin knowledge upload, chunk indexing, search visibility, audit logging, and cleanup.",
    ].join("\n");

    formData.append("file", new Blob([content], { type: "text/plain" }), requestedFileName);
    formData.append("title", `Local Knowledge Smoke ${stamp}`);
    formData.append("category", "general");
    formData.append("replace_existing", "false");

    const uploadResponse = await fetch(`${frontendBaseUrl}/api/admin-proxy/knowledge/upload`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
      body: formData,
    });
    const upload = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok || !upload.success) {
      throw new Error(`Knowledge upload failed with ${uploadResponse.status}: ${JSON.stringify(upload)}`);
    }
    uploadedFileName = upload.file_name;

    const chunks = await fetchJson(
      `/api/admin-proxy/knowledge/files/${encodeURIComponent(uploadedFileName)}/chunks`,
      { headers: { Cookie: cookieHeader } },
    );
    if (!chunks.total || chunks.total < 1) {
      throw new Error(`Uploaded file has no indexed chunks: ${JSON.stringify(chunks)}`);
    }

    const search = await fetchJson("/api/admin-proxy/knowledge/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ message: token, top_k: 5 }),
    });
    const searchHit = (search.results || []).some((item) => item.file_name === uploadedFileName);
    if (!searchHit) {
      throw new Error(`Uploaded smoke file was not found by knowledge search: ${JSON.stringify(search)}`);
    }

    const audit = await fetchJson("/api/admin-proxy/knowledge/audit-log?limit=10", {
      headers: { Cookie: cookieHeader },
    });
    const auditHit = (audit.entries || []).some(
      (entry) => entry.action === "upload" && entry.file_name === uploadedFileName,
    );
    if (!auditHit) {
      throw new Error(`Upload audit entry was not found: ${JSON.stringify(audit)}`);
    }

    console.log(JSON.stringify({
      success: true,
      uploaded_file_name: uploadedFileName,
      chunks: chunks.total,
      search_hits: search.total,
      audit_entries_checked: audit.total,
    }, null, 2));
  } finally {
    if (uploadedFileName) {
      await fetch(`${frontendBaseUrl}/api/admin-proxy/knowledge/files/${encodeURIComponent(uploadedFileName)}`, {
        method: "DELETE",
        headers: { Cookie: cookieHeader },
      }).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
