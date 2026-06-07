import { expect, test } from "@playwright/test";

async function mockBackend(page: import("@playwright/test").Page) {
  await page.route("**/system/status**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        backend_status: "running",
        openai_configured: false,
        openai_status: "not_checked",
        openai_error: "",
        local_fallback_enabled: true,
        knowledge_stats: { total_chunks: 0, total_files: 0, files: [], categories: [] },
      }),
    });
  });

  await page.route("**/customers/*/chat-sessions**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ sessions: [] }),
    });
  });

  await page.route("**/admin-status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    });
  });

  await page.route("**/admin/dashboard-stats**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        questions: { total: 0, today: 0, by_intent: [], per_day: [], top_keywords: [] },
        customers: { total: 0, total_sessions: 0, total_messages: 0 },
        requests: { total: 0, pending: 0, by_type: [] },
        knowledge: { total_chunks: 0, total_files: 0 },
      }),
    });
  });

  await page.route("**/questions/stats-public**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ total_questions: 0, approved_questions: 0 }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});

test("home page renders primary entry points", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /ArtinAzma Expert Assistant|دستیار تخصصی آرتین آزما/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start chatting with Artin|شروع گفتگو با آرتین/i }).first()).toBeVisible();
});

test("customer login page renders the login form", async ({ page }) => {
  await page.goto("/customer-login");

  await expect(page.getByRole("heading", { name: /Log in to your ArtinAzma account|ورود به حساب کاربری/i })).toBeVisible();
  await expect(page.getByPlaceholder("email@example.com")).toBeVisible();
  await expect(page.getByRole("button", { name: /Login|ورود/i })).toBeVisible();
});

test("assistant page renders prompt composer", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "artin_customer_session",
      value: "smoke.signature",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "artin_customer",
      JSON.stringify({ id: 1, full_name: "Smoke User", email: "smoke@example.com" }),
    );
  });

  await page.goto("/assistant");

  await expect(page.getByRole("heading", { name: /What can Artin help you with today|امروز چه کمکی از آرتین می‌خواهید/i })).toBeVisible();
  await expect(page.getByPlaceholder(/Ask Artin|از آرتین بپرسید/i).first()).toBeVisible();
});

test("admin login page renders protected entry form", async ({ page }) => {
  await page.goto("/admin-login");

  await expect(page.getByRole("heading", { name: /ورود ادمین/i })).toBeVisible();
  await expect(page.locator("input[type='password']")).toBeVisible();
  await expect(page.getByRole("button", { name: /ورود به پنل ادمین/i })).toBeVisible();
});
