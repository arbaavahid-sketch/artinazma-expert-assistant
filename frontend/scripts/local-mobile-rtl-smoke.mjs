import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://127.0.0.1:8000";
const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:3000";

const viewports = [
  { name: "mobile", width: 390, height: 844, isMobile: true },
  { name: "tablet", width: 768, height: 1024, isMobile: true },
  { name: "desktop", width: 1440, height: 900, isMobile: false },
];

const publicRoutes = [
  "/",
  "/assistant",
  "/analyze",
  "/products",
  "/customer-login",
  "/customer-register",
  "/customer-request",
  "/admin-login",
  "/privacy",
  "/terms",
];

const customerRoutes = [
  "/assistant",
  "/analyze",
  "/customer-dashboard",
  "/customer-request",
];

const adminRoutes = [
  "/admin",
  "/admin/dashboard",
  "/admin/questions",
  "/admin/knowledge",
  "/admin/requests",
  "/admin/customers",
  "/admin/settings",
];

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (!String(error?.message || "").includes("Executable doesn't exist")) {
      throw error;
    }
    return chromium.launch({ channel: "msedge", headless: true });
  }
}

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

async function registerSmokeCustomer() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const email = `rtl-smoke-${stamp}-${Math.random().toString(16).slice(2, 8)}@example.com`;
  const password = `LocalSmoke${stamp}!`;

  const result = await apiJson("/customers/register", {
    method: "POST",
    body: JSON.stringify({
      full_name: "RTL Smoke Customer",
      email,
      password,
      company: "ArtinAzma Local Smoke",
      phone: "09120000000",
    }),
  });

  if (!result.success || !result.customer?.id) {
    throw new Error("Could not create RTL smoke customer.");
  }

  return { customer: result.customer, email, password };
}

async function loginCustomer(context, credentials) {
  const page = await context.newPage();
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(async ({ customer, email, password }) => {
      const loginResponse = await fetch("/api/backend/customers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const loginData = await loginResponse.json();
      if (!loginResponse.ok || !loginData.success) {
        throw new Error(loginData.message || "Customer login failed.");
      }

      const sessionResponse = await fetch("/api/customer-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ customer_id: customer.id }),
      });
      if (!sessionResponse.ok) {
        throw new Error("Customer frontend session failed.");
      }

      localStorage.setItem("artin_customer", JSON.stringify(customer));
    }, credentials);

    await page.goto("/customer-dashboard", { waitUntil: "domcontentloaded" });
    if (page.url().includes("/customer-login")) {
      const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500);
      throw new Error(`Customer session did not unlock dashboard. URL=${page.url()} BODY=${text}`);
    }
  } finally {
    await page.close();
  }
}

async function loginAdmin(context) {
  const page = await context.newPage();
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(async (password) => {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        throw new Error(`Admin login failed with ${response.status}.`);
      }
    }, getLocalAdminPassword());

    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
    if (page.url().includes("/admin-login")) {
      const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500);
      throw new Error(`Admin session did not unlock dashboard. URL=${page.url()} BODY=${text}`);
    }
  } finally {
    await page.close();
  }
}

async function inspectPage(page, route, viewportName) {
  const events = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      events.push({ type: message.type(), text: message.text().slice(0, 240) });
    }
  });
  page.on("pageerror", (error) => {
    events.push({ type: "pageerror", text: error.message.slice(0, 240) });
  });

  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const overflowing = [];

    for (const element of Array.from(document.querySelectorAll("body *"))) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.right > window.innerWidth + 2) {
        const text = element.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) || "";
        overflowing.push({
          tag: element.tagName.toLowerCase(),
          className: String(element.getAttribute("class") || "").slice(0, 100),
          right: Math.round(rect.right),
          text,
        });
        if (overflowing.length >= 5) break;
      }
    }

    return {
      dir: root.getAttribute("dir") || body.getAttribute("dir") || "",
      title: document.title,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      bodyTextLength: body.innerText.trim().length,
      overflowing,
    };
  });

  return {
    route,
    viewport: viewportName,
    status: response?.status() || 0,
    finalUrl: page.url(),
    dir: metrics.dir,
    hasHorizontalOverflow: metrics.scrollWidth > metrics.clientWidth + 2,
    scrollWidth: metrics.scrollWidth,
    clientWidth: metrics.clientWidth,
    bodyTextLength: metrics.bodyTextLength,
    overflowing: metrics.overflowing,
    events,
  };
}

async function main() {
  const browser = await launchBrowser();
  const results = [];
  const customerCredentials = await registerSmokeCustomer();

  try {
    for (const viewport of viewports) {
      const baseOptions = {
        baseURL: frontendBaseUrl,
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile,
        hasTouch: viewport.isMobile,
        locale: "fa-IR",
      };

      const context = await browser.newContext(baseOptions);

      for (const route of publicRoutes) {
        const page = await context.newPage();
        try {
          results.push(await inspectPage(page, route, viewport.name));
        } finally {
          await page.close();
        }
      }

      await context.close();

      const customerContext = await browser.newContext(baseOptions);
      await loginCustomer(customerContext, customerCredentials);

      for (const route of customerRoutes) {
        const page = await customerContext.newPage();
        try {
          results.push(await inspectPage(page, route, `${viewport.name}-customer`));
        } finally {
          await page.close();
        }
      }

      await customerContext.close();

      const adminContext = await browser.newContext(baseOptions);
      await loginAdmin(adminContext);

      for (const route of adminRoutes) {
        const page = await adminContext.newPage();
        try {
          results.push(await inspectPage(page, route, `${viewport.name}-admin`));
        } finally {
          await page.close();
        }
      }

      await adminContext.close();
    }
  } finally {
    await browser.close();
  }

  const failures = results.filter((result) => {
    const badStatus = result.status >= 400 || result.status === 0;
    const badDir = result.dir && result.dir !== "rtl";
    const badBody = result.bodyTextLength < 20;
    return badStatus || badDir || result.hasHorizontalOverflow || badBody || result.events.length > 0;
  });

  console.log(JSON.stringify({ success: failures.length === 0, checked: results.length, failures, results }, null, 2));

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
