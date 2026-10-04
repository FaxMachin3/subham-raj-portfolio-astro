import { expect, type Locator, type Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions for the lifetime of the page. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Waits until every demo island has hydrated and registered with the store. */
export async function waitForDemos(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Break this site' })).toBeEnabled({ timeout: 30_000 });
}

/**
 * Checks for sideways overflow. On mobile, an over-wide element makes the browser widen its layout
 * viewport (zooming out), so scrollWidth and innerWidth grow together; comparing against the device
 * width catches that case too.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const deviceWidth = page.viewportSize()!.width;
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(innerWidth, 'layout viewport should match the device width').toBe(deviceWidth);
  expect(scrollWidth, 'page should not scroll sideways').toBeLessThanOrEqual(deviceWidth);
}

/** Starts recording unexpected layout shifts (Chromium only; other engines return null). */
export async function recordLayoutShift(page: Page): Promise<() => Promise<number | null>> {
  const supported = await page.evaluate(() => {
    if (!PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) return false;
    const w = window as unknown as { __shift: number };
    w.__shift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!e.hadRecentInput) w.__shift += e.value;
      }
    }).observe({ type: 'layout-shift' });
    return true;
  });
  return async () =>
    supported ? page.evaluate(() => (window as unknown as { __shift: number }).__shift) : null;
}

/** Converts "1.12 s", "3.6 ms", "565 KB", "171 requests", "12 frames", "7/12 reachable" to numbers. */
export function parseMetric(text: string): number {
  const value = Number.parseFloat(text.replace(/,/g, ''));
  return /\d\s*s$/.test(text.trim()) && !text.includes('ms') ? value * 1000 : value;
}

/** Taps on touch devices and clicks elsewhere, so tests exercise the real input method. */
export function tap(isMobile: boolean) {
  return (locator: Locator) => (isMobile ? locator.tap() : locator.click());
}
