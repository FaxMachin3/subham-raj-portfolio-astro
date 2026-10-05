import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoHorizontalOverflow, tap, waitForDemos } from './helpers';

const DARK_PAPER = 'rgb(18, 18, 17)';
const LIGHT_PAPER = 'rgb(245, 244, 239)';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const paper = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** Picks a theme with whichever control the viewport shows: the segmented switch or the compact button. */
async function chooseTheme(page: Page, isMobile: boolean, theme: 'Light' | 'Dark' | 'System') {
  const cycle = page.locator('.theme-cycle');
  if (await cycle.isVisible()) {
    for (let i = 0; i < 3; i++) {
      if ((await cycle.getAttribute('aria-label'))?.startsWith(`Colour theme: ${theme}.`)) return;
      await tap(isMobile)(cycle);
    }
    throw new Error(`Could not reach the ${theme} theme`);
  }
  await tap(isMobile)(page.getByRole('radio', { name: `${theme} theme` }));
}

test.describe('colour theme', () => {
  test('follows the system setting by default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    expect(await paper(page)).toBe(DARK_PAPER);
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await paper(page)).toBe(LIGHT_PAPER);
  });

  test('an explicit choice overrides the system and survives a reload without flashing', async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await chooseTheme(page, isMobile, 'Dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await paper(page)).toBe(DARK_PAPER);

    // Record the theme at the very first paint-relevant moment of the next load.
    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive') {
          (window as unknown as { __firstTheme: string }).__firstTheme =
            document.documentElement.dataset.theme ?? 'none';
        }
      });
    });
    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { __firstTheme: string }).__firstTheme)).toBe(
      'dark',
    );

    await chooseTheme(page, isMobile, 'System');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    expect(await paper(page)).toBe(LIGHT_PAPER);
  });

  test('the switch fits the header on every screen', async ({ page }) => {
    await page.goto('/');
    await expectNoHorizontalOverflow(page);
    const header = await page.locator('.site-header__inner').boundingBox();
    expect(header!.height).toBeLessThanOrEqual(64);
  });

  for (const state of ['healthy', 'broken'] as const) {
    test(`dark theme passes axe when the site is ${state}`, async ({ page, isMobile }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');
      await waitForDemos(page);
      if (state === 'broken') {
        await tap(isMobile)(page.getByRole('button', { name: 'Break this site' }));
        await expect(page.getByRole('button', { name: 'Let Subham fix it' })).toBeEnabled({
          timeout: 60_000,
        });
      }
      const { violations } = await new AxeBuilder({ page })
        .withTags(WCAG)
        .exclude(state === 'broken' ? '[data-demo-region]' : '[data-none]')
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
    });
  }

  test('dark theme: the x-ray overlay passes axe', async ({ page, isMobile }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await waitForDemos(page);
    const card = page.getByTestId('fix-jank');
    await card.scrollIntoViewIfNeeded();
    await tap(isMobile)(card.getByRole('button', { name: 'Fix', exact: true }));
    await expect(card.getByTestId('xray-caption')).toContainText('transitionend');
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG)
      .include('[data-testid="xray"]')
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  });

  test('dark theme passes axe on the inner pages', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const path of ['/work/graph-performance', '/resume', '/404']) {
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${path} ${v.id}`)).toEqual([]);
    }
  });
});
