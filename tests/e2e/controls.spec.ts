import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { tap, waitForDemos } from './helpers';

/** Every control path in the demos that the flow tests don't already take. */

const status = (page: Page, id: string) => page.getByTestId(`fix-${id}`).getByTestId('status');

async function run(page: Page, isMobile: boolean, id: string, button: 'Break' | 'Fix') {
  const card = page.getByTestId(`fix-${id}`);
  await tap(isMobile)(card.getByRole('button', { name: button, exact: true }));
  await tap(isMobile)(card.getByRole('button', { name: 'Skip' })).catch(() => {});
  await expect(status(page, id)).toHaveText(button === 'Break' ? 'Broken' : 'Fixed ✓', { timeout: 30_000 });
}

test.describe('Fix 05 controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForDemos(page);
  });

  test('headers sort by mouse and keyboard, both directions, and announce their state', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'keyboard navigation is a desktop concern');
    const region = page.getByTestId('a11y-region');
    const risk = region.getByRole('columnheader', { name: /Risk/ });
    await risk.click();
    await expect(risk).toHaveAttribute('aria-sort', 'ascending');
    await expect(risk).toContainText('▲');
    await risk.click();
    await expect(risk).toHaveAttribute('aria-sort', 'descending');
    await expect(risk).toContainText('▼');
    const type = region.getByRole('columnheader', { name: /Type/ });
    await page.keyboard.press('a');
    await expect(type).toBeFocused();
    await expect(page.getByTestId('a11y-live')).toHaveText(
      'Type column header, not sorted. Press Enter to sort.',
    );
    await page.keyboard.press(' ');
    await expect(type).toHaveAttribute('aria-sort', 'ascending');
    await page.keyboard.press('d');
    await page.keyboard.press('a');
    await expect(page.getByTestId('a11y-live')).toHaveText(
      'Type column header, sorted ascending. Press Enter to sort.',
    );
    // Shortcuts with modifiers belong to the browser, not the table.
    await page.keyboard.press('Control+d');
    await expect(type).toBeFocused();
  });

  test('focus stays on a real row when a filter removes the focused one', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation is a desktop concern');
    const region = page.getByTestId('a11y-region');
    await region.getByRole('cell', { name: '0x9f…a21' }).click();
    for (const key of ['s', 's', 's', 's']) await page.keyboard.press(key);
    await expect(region.locator('tbody tr').nth(3)).toBeFocused();
    await region.getByRole('button', { name: 'Filter' }).click();
    await region.getByRole('menuitemradio', { name: 'Medium risk' }).click();
    await expect(region.locator('tbody tr')).toHaveCount(1);
    await expect(region.locator('tbody tr').first()).toHaveAttribute('tabindex', '0');
    await region.getByRole('button', { name: 'Filter' }).click();
    await region.getByRole('menuitemradio', { name: 'All risks' }).click();
    await expect(region.getByRole('status')).toHaveText('Showing all 4 addresses.');
  });

  test('copy addresses reports success, and says so when the browser blocks the clipboard', async ({
    page,
    context,
    browserName,
    isMobile,
  }) => {
    const region = page.getByTestId('a11y-region');
    const more = region.getByRole('button', { name: 'More actions' });
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await tap(isMobile)(more);
      await tap(isMobile)(region.getByRole('menuitem', { name: 'Copy addresses' }));
      await expect(region.getByRole('status')).toHaveText('Copied 4 addresses.');
      expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(
        '0x9f…a21\n0x3c…7e0\n0x71…b4d\n0xa4…19c',
      );
    }
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
      });
    });
    await tap(isMobile)(more);
    await tap(isMobile)(region.getByRole('menuitem', { name: 'Copy addresses' }));
    await expect(region.getByRole('status')).toHaveText('Your browser blocked clipboard access.');
  });

  test('the broken panel still sorts and exports with a mouse', async ({ page, isMobile }) => {
    await run(page, isMobile, 'a11y', 'Break');
    const region = page.getByTestId('a11y-region');
    await tap(isMobile)(region.locator('th', { hasText: 'Risk' }));
    await expect(region.getByText('Sorted by Risk, ascending.')).toBeVisible();
    const downloading = page.waitForEvent('download');
    await tap(isMobile)(region.getByText('Export', { exact: true }));
    expect((await downloading).suggestedFilename()).toBe('linked-addresses.csv');
    await tap(isMobile)(region.getByText('⋯', { exact: true }));
    await tap(isMobile)(region.locator('.menu__item', { hasText: 'Reset table' }));
    await expect(region.getByText('Table reset.')).toBeVisible();
  });
});

test.describe('other demo controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForDemos(page);
  });

  test('every language loads, English comes back from the bundle, and repeats come from cache', async ({
    page,
  }) => {
    const select = page.getByLabel('Language');
    const note = page.getByTestId('i18n-note');
    const panel = page.getByTestId('i18n-panel');
    const titles: Record<string, string> = { es: 'Resumen', pt: 'Visão', hi: 'जाँच', ja: '調査', zh: '调查' };
    for (const [code, title] of Object.entries(titles)) {
      await select.selectOption(code);
      await expect(panel.locator('h4')).toContainText(title);
      await expect(note).toContainText(`${code}.json · loaded in`);
    }
    await select.selectOption('en');
    await expect(panel.locator('h4')).toHaveText('Investigation overview');
    await expect(note).toHaveText('en · bundled with the page');
    await select.selectOption('ja');
    await expect(note).toHaveText('ja.json · from cache, 0 requests');
  });

  test('the sidebar toggles open and closed', async ({ page, isMobile }) => {
    const card = page.getByTestId('fix-jank');
    const app = card.locator('.jank-app');
    await tap(isMobile)(card.getByRole('button', { name: 'Toggle sidebar' }));
    await expect(app).toHaveClass(/jank-app--open/);
    await tap(isMobile)(card.getByRole('button', { name: 'Toggle sidebar' }));
    await expect(app).not.toHaveClass(/jank-app--open/);
  });

  test('status polling pauses while the tab is hidden', async ({ page, isMobile }) => {
    await run(page, isMobile, 'network', 'Break');
    await page.evaluate(() =>
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }),
    );
    const rate = page.getByTestId('fix-network').locator('.network-stats strong').first();
    await expect(rate).toHaveText('0', { timeout: 5_000 });
  });

  test("a card's buttons are disabled while it is busy, so runs never overlap", async ({
    page,
    isMobile,
  }) => {
    const card = page.getByTestId('fix-bundle');
    await tap(isMobile)(card.getByRole('button', { name: 'Break', exact: true }));
    await expect(card.getByTestId('xray')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Fix', exact: true })).toBeDisabled();
    await tap(isMobile)(card.getByRole('button', { name: 'Skip' }));
    await expect(status(page, 'bundle')).toHaveText('Broken', { timeout: 15_000 });
  });
});

test.describe('browsers that cannot measure everything', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', { get: () => [] });
      const original = performance.getEntriesByType.bind(performance);
      performance.getEntriesByType = (type: string) => (type === 'resource' ? [] : original(type));
    });
    await page.goto('/');
    await waitForDemos(page);
  });

  test('say n/a instead of a made-up number', async ({ page, isMobile }) => {
    const hud = page.getByTestId('hud');
    await expect(hud).toContainText('n/a');
    await run(page, isMobile, 'bundle', 'Fix');
    const bundle = page.getByTestId('fix-bundle');
    await expect(bundle.getByTestId('metric-after')).toHaveText('n/a');
    await expect(bundle.locator('.waterfall__size').first()).toHaveText('n/a');
    await tap(isMobile)(bundle.getByRole('button', { name: 'Open graph' }));
    await expect(bundle.getByRole('button', { name: 'graph · loaded' })).toBeDisabled();
    await run(page, isMobile, 'network', 'Break');
    await expect(page.getByTestId('fix-network').locator('.metric--before span')).toContainText(
      'layout shift n/a',
    );
  });
});
