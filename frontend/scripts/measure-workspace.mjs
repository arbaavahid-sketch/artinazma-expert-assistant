// Production browser baseline; device/network acceptance requires a real device.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.PERF_BASE_URL || 'http://127.0.0.1:3100';
const target = new URL('/calculators/workspace', base).href;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__workspaceMetrics = { lcpMs: null, cls: 0, longTaskMs: 0 };
        const metrics = window.__workspaceMetrics;
        for (const type of ['largest-contentful-paint', 'layout-shift', 'longtask']) {
          try {
            new PerformanceObserver(list => {
              for (const entry of list.getEntries()) {
                if (type === 'largest-contentful-paint') metrics.lcpMs = entry.startTime;
                if (type === 'layout-shift' && !entry.hadRecentInput) metrics.cls += entry.value;
                if (type === 'longtask') metrics.longTaskMs += entry.duration;
              }
            }).observe({ type, buffered: true });
          } catch { /* Unsupported metric stays unavailable or zero. */ }
        }
      });
      for (const cache of ['cold-context', 'warm-context']) {
        const errors = [];
        const onError = error => errors.push(error.message);
        page.on('pageerror', onError);
        const response = await page.goto(target, { waitUntil: 'load' });
        if (!response?.ok()) throw Error(`Workspace HTTP ${response?.status()}`);
        const navigation = page.getByRole('navigation', { name: /Laboratory sections|بخش‌های آزمایشگاه/ });
        await navigation.waitFor();
        // A fixed observation window, not a networkidle or usability claim.
        await page.waitForTimeout(2000);
        const metrics = await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0];
          const resources = performance.getEntriesByType('resource');
          return { ...window.__workspaceMetrics, ttfbMs: nav.responseStart - nav.requestStart,
            domContentLoadedMs: nav.domContentLoadedEventEnd, loadMs: nav.loadEventEnd,
            resourceCount: resources.length, transferredBytes: resources.reduce((sum, r) => sum + r.transferSize, 0),
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
        });
        const started = performance.now();
        await navigation.getByRole('button', { name: /Chemicals & elements|مواد و عناصر/ }).click();
        await page.getByRole('heading', { name: /بانک ترکیبات شیمیایی|Chemical compound library/i }).first().waitFor({ timeout: 30000 });
        const sectionVisibleMs = performance.now() - started;
        results.push({ viewport, cache, ...metrics, sectionVisibleMs, errors });
        page.off('pageerror', onError);
      }
    } finally { await context.close(); }
  }
  const report = { measuredAt: new Date().toISOString(), target,
    conditions: 'Desktop Chrome headless; desktop/mobile viewport; reduced motion; no CPU/network throttling. Not real-phone acceptance. LCP/CLS observed for two seconds after load; section timing includes automation overhead.', results };
  await mkdir('../output', { recursive: true });
  await writeFile('../output/workspace-performance.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
