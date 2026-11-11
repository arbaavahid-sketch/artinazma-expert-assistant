import { expect, test } from "@playwright/test";
import { mockCommonBackend } from "./test-helpers";

const customer = {
  id: 42,
  full_name: "Smoke Customer",
  email: "smoke@example.com",
};

test.use({ serviceWorkers: "block" });

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

  await page.route("**/customers/42/chat-sessions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ sessions: [{ id: 777, title: "Smoke chat" }, { id: 778, title: "کیفیت نمونه‌ها" }] }),
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

test("mobile composer previews images and submits image and document analyses", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.addInitScript((account) => {
    localStorage.setItem("artin_customer", JSON.stringify(account));
  }, customer);
  await page.route(/\/chat\/access(?:\?|$)/, (route) => route.fulfill({
    json: { customer_id: customer.id, used: 0, identified: true },
  }));
  await page.route("**/analyze-image", (route) => route.fulfill({
    json: { ai_analysis: "Sample image analysis.", question_id: 502 },
  }));
  await page.route("**/analyze-file", (route) => route.fulfill({
    json: { ai_analysis: "Sample report analysis.", question_id: 503 },
  }));
  await page.goto("/assistant");

  const settings = page.getByRole("button", { name: /Chat settings|تنظیمات گفتگو/ });
  await settings.click();
  await expect(settings).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("combobox", { name: /Question domain|حوزهٔ پرسش/ }).selectOption("chromatography");
  await expect(page.getByRole("combobox", { name: /Response style|سبک پاسخ/ })).toBeVisible();
  await settings.click();

  const tools = page.getByRole("button", { name: /Tools and attachments|ابزارها و پیوست‌ها/ });
  await tools.click();
  const lastTool = page.getByRole("button", { name: /Request consultation|ثبت درخواست مشاوره/, exact: true });
  await lastTool.scrollIntoViewIfNeeded();
  await expect(lastTool).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(tools).toBeFocused();
  await expect(tools).toHaveAttribute("aria-expanded", "false");

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Attach an image|پیوست عکس/ }).click();
  const sampleImage = {
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF2kAAAAASUVORK5CYII=", "base64"),
  };
  await (await chooser).setFiles(sampleImage);
  await expect(page.getByText("sample.png")).toBeVisible();
  await page.getByRole("button", { name: /Remove attached image|برداشتن عکس پیوست/ }).click();
  await expect(page.getByText("sample.png")).toHaveCount(0);
  const send = page.getByRole("button", { name: /Send message|ارسال پیام/ });
  await expect(send).toBeDisabled();
  await page.locator('input[accept="image/*"]').setInputFiles(sampleImage);
  await expect(page.getByText("sample.png")).toBeVisible();
  const upload = page.waitForRequest((request) =>
    request.url().endsWith("/analyze-image") && request.method() === "POST",
  );
  await send.click();
  expect((await upload).postData()).toContain('filename="sample.png"');
  await expect(page.getByText("Sample image analysis.")).toBeVisible();
  await expect(page.locator('a[href="/laboratory-imports?analysis=502"]')).toBeVisible();

  await tools.click();
  const reportChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Upload file or image|آپلود فایل یا عکس/ }).click();
  await (await reportChooser).setFiles({
    name: "report.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sample,value\nA,1\n"),
  });
  const analysis = page.getByRole("dialog", { name: /File analysis settings|تنظیمات تحلیل فایل/ });
  await analysis.getByRole("combobox").selectOption("chromatography");
  await analysis.getByRole("textbox").fill("Check sample A");
  const reportUpload = page.waitForRequest((request) =>
    request.url().endsWith("/analyze-file") && request.method() === "POST",
  );
  await analysis.getByRole("button", { name: /Start file analysis|شروع تحلیل فایل/ }).click();
  const reportBody = (await reportUpload).postData();
  expect(reportBody).toContain('filename="report.csv"');
  expect(reportBody).toContain("chromatography");
  expect(reportBody).toContain("Check sample A");
  await expect(page.getByText("Sample report analysis.")).toBeVisible();
  await expect(page.locator('a[href="/laboratory-imports?analysis=503"]')).toBeVisible();
  const workspace = page.locator(".artin-workspace");
  expect(await workspace.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("customer can log in and receive a chat answer", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route(/\/chat\/access(?:\?|$)/, (route) => route.fulfill({
    json: { customer_id: customer.id, used: 0, identified: true },
  }));
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
  await composer.press("Enter");
  const response = await chatResponse;
  expect(response.status()).toBe(200);

  await expect(page.getByText("What causes GC baseline noise?")).toBeVisible();
  await expect(page.getByText("Smoke chat answer from Artin.")).toBeVisible();

  await page.getByRole("button", { name: /^(Copy|کپی)$/ }).click();
  await expect(page.getByRole("button", { name: /^(Copied|کپی شد)$/ })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Smoke chat answer from Artin.");

  await page.getByRole("button", { name: /^(More|بیشتر)$/ }).click();
  const regenerated = page.waitForRequest((request) =>
    request.url().endsWith("/chat/stream") && request.method() === "POST",
  );
  await page.getByRole("menuitem", { name: /Regenerate|تولید دوباره/ }).click();
  expect((await regenerated).postDataJSON()).toMatchObject({ message: "What causes GC baseline noise?", history: [] });
  await expect(page.getByText("Smoke chat answer from Artin.")).toHaveCount(1);

  await page.getByTitle(/Edit message|ویرایش پیام/).click();
  const editor = page.getByRole("textbox", { name: /Edit message|ویرایش پیام/ });
  await editor.fill("What causes HPLC baseline noise?");
  const edited = page.waitForRequest((request) =>
    request.url().endsWith("/chat/stream") && request.method() === "POST",
  );
  await editor.press("Enter");
  expect((await edited).postDataJSON()).toMatchObject({ message: "What causes HPLC baseline noise?", history: [] });
  await expect(page.getByText("What causes HPLC baseline noise?")).toBeVisible();

  const history = page.locator("[data-assistant-sidebar]");
  const smokeChat = history.getByRole("link", { name: "Smoke chat", exact: true });
  await smokeChat.locator("..").getByRole("button", { name: /Conversation labels|برچسب‌های گفتگو/ }).click();
  const saved = history.getByRole("button", { name: /^(Saved|ذخیره‌شده)$/ });
  await saved.click();
  await expect(saved).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await history.getByRole("combobox", { name: /Conversation category|دستهٔ گفتگو/ }).selectOption("saved");
  await expect(smokeChat).toBeVisible();
  const persianChat = history.getByRole("link", { name: "کیفیت نمونه‌ها", exact: true });
  await expect(persianChat).toHaveCount(0);
  await history.getByRole("searchbox").fill("No matching title");
  await expect(smokeChat).toHaveCount(0);
  await history.getByRole("button", { name: /Clear search and filter|پاک‌کردن جست‌وجو و فیلتر/ }).click();
  await expect(smokeChat).toBeVisible();
  await expect(persianChat).toBeVisible();
  await history.getByRole("searchbox").fill("كيفيت نمونه ها");
  await expect(persianChat).toBeVisible();
  await expect(smokeChat).toHaveCount(0);

  await page.getByRole("button", { name: /^(New chat|گفتگوی جدید)$/ }).click();
  await expect(page).toHaveURL(/\/assistant$/);
  await page.getByRole("button", { name: /Choose laboratory equipment|انتخاب تجهیزات آزمایشگاهی/ }).click();
  await expect(composer).toHaveValue(/Which method and instrument|برای اندازه‌گیری جیوه در نفت خام/);
  await expect(composer).toBeFocused();
  await expect(page.getByRole("log", { name: /^(Conversation|گفتگو)$/ })).toHaveCount(0);
  await composer.fill("Which equipment measures mercury in crude oil?");
  const suggestionResponse = page.waitForResponse((response) =>
    response.url().includes("/chat/stream") && response.request().method() === "POST",
  );
  await sendButton.click();
  const sentSuggestion = await suggestionResponse;
  expect(sentSuggestion.status()).toBe(200);
  expect(sentSuggestion.request().postDataJSON()).toMatchObject({
    message: "Which equipment measures mercury in crude oil?",
  });
  await expect(page.getByText("Smoke chat answer from Artin.")).toBeVisible();

  let releaseResponse!: () => void;
  const holdResponse = new Promise<void>((resolve) => { releaseResponse = resolve; });
  await page.route("**/chat/stream", async (route) => {
    await holdResponse;
    await route.abort();
  });
  try {
    await composer.fill("Wait for this response");
    const pendingRequest = page.waitForRequest((request) =>
      request.url().endsWith("/chat/stream") && request.method() === "POST",
    );
    await sendButton.click();
    await pendingRequest;
    await page.getByRole("button", { name: /Stop response|توقف پاسخ/ }).click();
    await expect(page.getByText(/Response stopped|پاسخ متوقف شد/)).toBeVisible();
  } finally {
    releaseResponse();
  }
});
