import { chromium } from "@playwright/test";

const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://127.0.0.1:8000";
const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:3000";

async function apiJson(path, init) {
  const response = await fetch(`${backendBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const email = `frontend-smoke-${stamp}@example.com`;
  const password = `LocalSmoke${stamp}!`;

  const register = await apiJson("/customers/register", {
    method: "POST",
    body: JSON.stringify({
      full_name: "Frontend Smoke Customer",
      email,
      password,
      company: "ArtinAzma Local Smoke",
      phone: "09120000000",
    }),
  });

  if (!register.success || !register.customer?.id) {
    throw new Error("Customer registration did not return a customer id.");
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (!String(error?.message || "").includes("Executable doesn't exist")) {
      throw error;
    }
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }
  const page = await browser.newPage({ baseURL: frontendBaseUrl });
  const seenResponses = [];
  const pageEvents = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      pageEvents.push({ type: message.type(), text: message.text().slice(0, 300) });
    }
  });
  page.on("pageerror", (error) => {
    pageEvents.push({ type: "pageerror", text: error.message.slice(0, 300) });
  });
  page.on("response", (response) => {
    const url = response.url();
    if (
      url.includes("/customers/login") ||
      url.includes("/api/customer-session") ||
      url.includes("/api/backend/")
    ) {
      seenResponses.push({ url, status: response.status() });
    }
  });

  try {
    await page.goto("/customer-login?next=/customer-dashboard");
    await page.getByPlaceholder("email@example.com").click();
    await page.keyboard.type(email, { delay: 2 });
    await page.locator('input[type="password"]').click();
    await page.keyboard.type(password, { delay: 2 });
    const button = page.locator("section button.ui-btn-primary").first();
    const formState = await page.evaluate(() => ({
      email: document.querySelector('input[type="email"]')?.value || "",
      passwordLength: document.querySelector('input[type="password"]')?.value.length || 0,
      buttons: Array.from(document.querySelectorAll("button")).map((button) => ({
        text: button.textContent?.replace(/\s+/g, " ").trim().slice(0, 80),
        className: button.className,
        disabled: button.disabled,
      })),
    }));
    await page.locator('input[type="password"]').press("Enter");
    await page.waitForTimeout(1000);
    if (seenResponses.every((response) => !response.url.includes("/customers/login"))) {
      await button.evaluate((element) => element.click());
    }

    await page.waitForFunction(
      () => window.location.pathname === "/customer-dashboard",
      undefined,
      { timeout: 15000 },
    ).catch(async () => {
      const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500);
      throw new Error(`Login did not reach customer dashboard. URL=${page.url()} FORM=${JSON.stringify(formState)} RESPONSES=${JSON.stringify(seenResponses)} EVENTS=${JSON.stringify(pageEvents)} BODY=${bodyText}`);
    });
    await page.waitForLoadState("networkidle");

    const title = await page.locator("h1, h2").first().textContent({ timeout: 15000 });
    const sessionBody = await page.evaluate(async () => {
      const response = await fetch("/api/customer-session", { credentials: "include" });
      return response.json();
    });

    if (!sessionBody.customer_id) {
      const cookieNames = (await page.context().cookies(frontendBaseUrl)).map((cookie) => cookie.name);
      throw new Error(
        `Frontend customer session cookie was not created: ${JSON.stringify({
          sessionBody,
          cookieNames,
          finalUrl: page.url(),
        })}`,
      );
    }

    console.log(JSON.stringify({
      success: true,
      customer_id: register.customer.id,
      frontend_session_customer_id: sessionBody.customer_id,
      final_url: page.url(),
      heading: (title || "").trim(),
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
