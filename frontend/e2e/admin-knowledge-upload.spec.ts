import { expect, test } from "@playwright/test";
import { mockCommonBackend } from "./test-helpers";

const emptyKnowledgeStats = {
  total_chunks: 0,
  total_files: 0,
  files: [],
  categories: [],
  file_details: [],
  category_breakdown: [],
  backend: "json",
  vector_store_exists: false,
};

test.beforeEach(async ({ page }) => {
  await mockCommonBackend(page);

  await page.route("**/knowledge/stats", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(emptyKnowledgeStats),
    });
  });

  await page.route("**/api/admin-proxy/knowledge/audit-log**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ total: 0, entries: [] }),
    });
  });

  await page.route("**/api/admin-proxy/knowledge/upload", async (route) => {
    expect(route.request().method()).toBe("POST");
    const form = await route.request().postDataBuffer();
    expect(form?.toString()).toContain("smoke-knowledge.txt");

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        file_name: "smoke-knowledge.txt",
        chunks_added: 1,
      }),
    });
  });
});

test("admin can log in and upload a knowledge file", async ({ page }) => {
  await page.goto("/admin-login?next=/admin/knowledge");

  await page.locator("input[type='password']").fill("smoke-admin-password");
  await page.getByRole("button", { name: /ورود به پنل ادمین/i }).click();

  await expect(page).toHaveURL(/\/admin\/knowledge$/);
  await expect(page.getByRole("heading", { name: /بانک دانش|Knowledge/i }).first()).toBeVisible();

  await page.locator("input[type='file']").setInputFiles({
    name: "smoke-knowledge.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Smoke knowledge content for E2E upload."),
  });

  await page.locator("input[type='text']").first().fill("Smoke knowledge title");
  await page.getByRole("button", { name: /افزودن به بانک دانش/i }).click();

  await expect(page.getByText("smoke-knowledge.txt")).toBeVisible();
  await expect(page.getByText(/فایل با موفقیت اضافه شد|success/i)).toBeVisible();
});
