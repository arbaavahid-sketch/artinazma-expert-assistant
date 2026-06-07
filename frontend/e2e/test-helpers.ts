import type { Page } from "@playwright/test";

export async function mockCommonBackend(page: Page) {
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
