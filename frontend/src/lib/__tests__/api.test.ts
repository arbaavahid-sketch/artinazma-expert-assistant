import { describe, it, expect, beforeEach } from "vitest";
import {
  API_BASE_URL,
  apiUrl,
  adminUrl,
  getCsrfToken,
  backendRequestUrl,
} from "../api";

function clearCookies() {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (name) {
      document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`;
    }
  }
}

describe("apiUrl", () => {
  it("joins a leading-slash path onto the base URL", () => {
    expect(apiUrl("/chat")).toBe(`${API_BASE_URL}/chat`);
  });

  it("inserts a slash for a path without a leading slash", () => {
    expect(apiUrl("chat")).toBe(`${API_BASE_URL}/chat`);
  });
});

describe("adminUrl", () => {
  it("routes through the admin proxy with a leading slash", () => {
    expect(adminUrl("/admin/knowledge-gaps")).toBe("/api/admin-proxy/admin/knowledge-gaps");
  });

  it("adds the leading slash when missing", () => {
    expect(adminUrl("admin/questions")).toBe("/api/admin-proxy/admin/questions");
  });
});

describe("getCsrfToken", () => {
  beforeEach(() => clearCookies());

  it("returns an empty string when the cookie is absent", () => {
    expect(getCsrfToken()).toBe("");
  });

  it("reads the artin_csrf cookie value", () => {
    document.cookie = "artin_csrf=abc123;path=/";
    expect(getCsrfToken()).toBe("abc123");
  });

  it("URL-decodes the cookie value", () => {
    document.cookie = `artin_csrf=${encodeURIComponent("a b/c")};path=/`;
    expect(getCsrfToken()).toBe("a b/c");
  });

  it("picks artin_csrf even when other cookies are present", () => {
    document.cookie = "other=xyz;path=/";
    document.cookie = "artin_csrf=tok42;path=/";
    expect(getCsrfToken()).toBe("tok42");
  });
});

describe("backendRequestUrl", () => {
  it("passes an already-relative URL through unchanged", () => {
    expect(backendRequestUrl("/customers/me")).toBe("/customers/me");
  });

  it("rewrites a dev cross-origin backend URL through the proxy", () => {
    // Only meaningful when the test env points at a local dev backend.
    if (API_BASE_URL.startsWith("http://127") || API_BASE_URL.startsWith("http://localhost")) {
      expect(backendRequestUrl(`${API_BASE_URL}/chat`)).toBe("/api/backend/chat");
    } else {
      expect(backendRequestUrl(`${API_BASE_URL}/chat`)).toBe(`${API_BASE_URL}/chat`);
    }
  });
});
