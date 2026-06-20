import { expect, test } from "@playwright/test";
import { mockCommonBackend } from "./test-helpers";

const customer = {
  id: 42,
  full_name: "Smoke Customer",
  email: "smoke@example.com",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
};

test.beforeEach(async ({ page }) => {
  await mockCommonBackend(page);

  await page.route("**/customers/login", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        access_token: "smoke-token",
        token_type: "bearer",
        customer,
      }),
    });
  });

  await page.route("**/api/customer-session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      headers: {
        "Set-Cookie": "artin_customer_session=smoke.signature; Path=/; SameSite=Lax",
      },
      body: JSON.stringify({ success: true, authenticated: true, customer_id: customer.id }),
    });
  });

  await page.route("**/customers/chat-sessions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, session_id: 777, title: "Smoke chat" }),
    });
  });

  await page.route("**/customers/chat-messages", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, message_id: 1001 }),
    });
  });

  await page.route("**/customers/*/chat-sessions/*/messages", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        messages: [
          { role: "user", content: "What causes GC baseline noise?", metadata: {} },
          { role: "assistant", content: "Smoke chat answer from Artin.", metadata: { question_id: 501 } },
        ],
      }),
    });
  });

  await page.route("**/chat/stream", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const body = [
      `data: ${JSON.stringify({ type: "meta", detected_domain: "chromatography", sources: [] })}`,
      `data: ${JSON.stringify({ type: "chunk", text: "Smoke chat answer from Artin." })}`,
      `data: ${JSON.stringify({ type: "done", question_id: 501 })}`,
      "",
    ].join("\n");

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: corsHeaders,
      body,
    });
  });

  await page.route("**/chat/suggest-questions", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify({ questions: [] }),
    });
  });
});

test("customer can log in and receive a chat answer", async ({ page }) => {
  await page.goto("/customer-login?next=/assistant");

  await page.getByPlaceholder("email@example.com").fill(customer.email);
  await page.locator("input[type='password']").fill("correct-password");
  await page.getByRole("button", { name: /Log in|ورود به حساب کاربری/i }).click();

  await expect(page).toHaveURL(/\/assistant$/);

  const composer = page.getByPlaceholder(/Ask Artin|از آرتین بپرسید/i).first();
  await composer.fill("What causes GC baseline noise?");
  await expect(composer).toHaveValue("What causes GC baseline noise?");
  const sendButton = page.getByRole("button", { name: /Send message|ارسال پیام/i }).first();
  await expect(sendButton).toBeEnabled();
  const chatResponse = page.waitForResponse((response) => (
    response.url().includes("/chat/stream") && response.request().method() === "POST"
  ));
  await sendButton.click();
  const response = await chatResponse;
  expect(response.status()).toBe(200);

  await expect(page.getByText("What causes GC baseline noise?")).toBeVisible();
  await expect(page.getByText("Smoke chat answer from Artin.")).toBeVisible();
});
