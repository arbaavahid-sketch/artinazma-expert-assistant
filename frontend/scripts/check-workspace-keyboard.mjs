import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const locale of ['fa', 'en']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    try {
      await context.addInitScript(value => localStorage.setItem('artin_locale', value), locale);
      const page = await context.newPage();
      await page.goto(new URL('/calculators/workspace', process.env.PERF_BASE_URL || 'http://127.0.0.1:3100').href);
      const nav = page.getByRole('navigation', { name: locale === 'fa' ? 'بخش‌های آزمایشگاه' : 'Laboratory sections' });
      await nav.getByRole('button', { name: locale === 'fa' ? 'مواد و عناصر' : 'Chemicals & elements' }).click();
      await page.getByRole('button', { name: locale === 'fa' ? 'عناصر و ایزوتوپ‌ها' : 'Elements & isotopes', exact: true }).click();
      const opener = page.getByRole('button', { name: /Hydrogen H 1$/ });
      await opener.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const region = dialog.getByRole('region', { name: /Isotope table|جدول ایزوتوپ‌ها/ });
      await expect(region).toBeVisible();
      // Reach the table through Tab, rather than setting its focus directly.
      let reached = false;
      for (let i = 0; i < 100; i++) {
        await page.keyboard.press('Tab');
        reached = await region.evaluate(el => el === document.activeElement);
        if (reached) break;
        expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
      }
      expect(reached).toBe(true);
      const before = await region.evaluate(el => ({ left: el.scrollLeft, width: el.clientWidth, total: el.scrollWidth }));
      expect(before.total).toBeGreaterThan(before.width);
      // Native RTL scrolling is negative in Chrome; try both directions.
      await page.keyboard.press(locale === 'fa' ? 'ArrowLeft' : 'ArrowRight');
      await expect.poll(() => region.evaluate((el, left) => Math.abs(el.scrollLeft - left), before.left)).toBeGreaterThan(0);
      const after = await region.evaluate(el => el.scrollLeft);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      results.push({ locale, width: 390, tabReachedTable: reached, before, after, escapeRestoredFocus: true, focusStayedInDialog: true });
    } finally { await context.close(); }
  }
  await mkdir('../output', { recursive: true });
  await writeFile('../output/workspace-keyboard.json', JSON.stringify({ checkedAt: new Date().toISOString(), conditions: 'Desktop Chrome, 390px viewport, production build; not an assistive-technology or phone test.', results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
