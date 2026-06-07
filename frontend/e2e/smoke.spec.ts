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
