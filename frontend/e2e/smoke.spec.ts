import { expect, test } from "@playwright/test";
import { mockCommonBackend } from "./test-helpers";

test.beforeEach(async ({ page }) => {
  await mockCommonBackend(page);
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

test("the first service worker install does not reload the login page", async ({ page }) => {
  await page.goto("/customer-login");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  expect(await page.evaluate(() => sessionStorage.getItem("artin_sw_reloaded"))).toBeNull();
});

test("assistant opens on the new start screen and inserts a topic draft", async ({ page }) => {
  await page.route(/\/chat\/access(?:\?|$)/, (route) => route.fulfill({
    json: { customer_id: 1, used: 0, identified: true },
  }));
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

  const composer = page.getByPlaceholder(/Ask Artin|از آرتین بپرسید/i).first();
  await expect(page.getByRole("heading", { name: /Ask Artin|از آرتین بپرسید/i })).toBeVisible();
  await expect(composer).toBeEmpty();
  await page.getByRole("button", { name: /Choose laboratory equipment|انتخاب تجهیزات آزمایشگاهی/i }).click();
  await expect(composer).toHaveValue(/mercury in crude oil|جیوه در نفت خام/i);
  await expect(composer).toBeFocused();
});

test("admin login page renders protected entry form", async ({ page }) => {
  await page.goto("/admin-login");

  await expect(page.getByRole("heading", { name: /ورود ادمین/i })).toBeVisible();
  await expect(page.locator("input[type='password']")).toBeVisible();
  await expect(page.getByRole("button", { name: /ورود به پنل ادمین/i })).toBeVisible();
});
