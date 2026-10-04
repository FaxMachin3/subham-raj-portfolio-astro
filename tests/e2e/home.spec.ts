import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  parseMetric,
  recordLayoutShift,
  tap,
  trackErrors,
  waitForDemos,
} from './helpers';

const FIXES = ['plot', 'jank', 'bundle', 'network', 'a11y', 'i18n'] as const;

test.describe('homepage', () => {
  test('renders the essentials with no errors and no sideways scrolling', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/Subham Raj/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('I make broken interfaces');
    await waitForDemos(page);
    await expectNoHorizontalOverflow(page);
    for (const id of FIXES) await expect(page.getByTestId(`fix-${id}`)).toBeVisible();
    await expect(page.getByTestId('hud')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('skip link moves focus to the main content', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation is a desktop concern');
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('break → fix: every card breaks, every fix measurably improves things', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    const press = tap(isMobile);
    await page.goto('/');
    await waitForDemos(page);

    await press(page.getByRole('button', { name: 'Break this site' }));
    await expect(page.getByRole('button', { name: 'Let Subham fix it' })).toBeEnabled({ timeout: 60_000 });
    await expect(page.locator('html')).toHaveAttribute('data-site', 'broken');
    for (const id of FIXES) {
      await expect(page.getByTestId(`fix-${id}`).getByTestId('status')).toHaveText('Broken');
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    const fixPhaseShift = await recordLayoutShift(page);
    await press(page.getByRole('button', { name: 'Let Subham fix it' }));
    await expect(page.getByTestId('pr-badge')).toHaveText('Merged', { timeout: 90_000 });
    const shift = await fixPhaseShift();
    if (shift !== null) expect(shift, 'fixing the site must not shift the layout').toBeLessThan(0.01);
    await expect(page.locator('html')).toHaveAttribute('data-site', 'healthy');

    const values: Record<string, { before: string; after: string }> = {};
    for (const id of FIXES) {
      const card = page.getByTestId(`fix-${id}`);
      await expect(card.getByTestId('status')).toHaveText('Fixed ✓');
      values[id] = {
        before: (await card.getByTestId('metric-before').textContent()) ?? '',
        after: (await card.getByTestId('metric-after').textContent()) ?? '',
      };
    }
    const better = (id: string) =>
      expect(parseMetric(values[id]!.after), `${id}: ${JSON.stringify(values[id])}`).toBeLessThan(
        parseMetric(values[id]!.before),
      );

    better('plot');
    better('bundle');
    better('network');
    expect(parseMetric(values.jank!.after)).toBeLessThanOrEqual(
      Math.max(1, parseMetric(values.jank!.before)),
    );
    expect(values.a11y!.before).toBe('0/12 reachable');
    expect(values.a11y!.after).toBe('12/12 reachable');
    expect(values.i18n!.before).toBe('5 of 5');
    expect(values.i18n!.after).toBe('0 of 5');
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('reduced motion disables breaking the whole site but keeps everything readable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByText('Breaking is turned off because you prefer reduced motion.')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Break this site' })).toBeDisabled();
    await expect(page.getByTestId('fix-plot').getByRole('button', { name: 'Break' })).toBeDisabled();
    await expect(page.getByTestId('fix-bundle').getByRole('button', { name: 'Break' })).toBeEnabled();
  });
});

test.describe('individual demos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForDemos(page);
  });

  test('accessible table: arrow keys and WASD move focus and announce it', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation is a desktop concern');
    const region = page.getByTestId('a11y-region');
    await region.getByRole('cell', { name: '0x9f…a21' }).click();
    await page.keyboard.press('d');
    await page.keyboard.press('ArrowDown');
    await expect(region.getByRole('cell', { name: 'Mixer' })).toBeFocused();
    await expect(page.getByTestId('a11y-live')).toHaveText('Row 2, Type: Mixer');
  });

  test('translations load on demand, then come from cache', async ({ page }) => {
    const panel = page.getByTestId('i18n-panel');
    await page.getByLabel('Language').selectOption('ja');
    await expect(panel).toContainText('調査の概要');
    await expect(page.getByTestId('i18n-note')).toContainText('loaded in');
    await page.getByLabel('Language').selectOption('es');
    await page.getByLabel('Language').selectOption('ja');
    await expect(page.getByTestId('i18n-note')).toContainText('from cache, 0 requests');
  });

  test('entity panels load as the list scrolls', async ({ page }) => {
    const card = page.getByTestId('fix-network');
    await card.scrollIntoViewIfNeeded();
    const fetched = card.locator('.network-stats strong').nth(1);
    await expect.poll(async () => Number(await fetched.textContent())).toBeGreaterThan(0);
    const initial = Number(await fetched.textContent());
    expect(initial).toBeLessThan(24);
    await card
      .getByRole('list', { name: 'Entity panels, scrollable' })
      .evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect.poll(async () => Number(await fetched.textContent())).toBeGreaterThan(initial);
  });

  test('the healthy page fetches no entity panels until the card is near the screen', async ({ page }) => {
    const entityRequests: string[] = [];
    page.on('request', (r) => r.url().includes('/data/entities/') && entityRequests.push(r.url()));
    await page.goto('/');
    await waitForDemos(page);
    await page.waitForTimeout(1000);
    expect(entityRequests).toHaveLength(0);
    await page.getByTestId('fix-network').scrollIntoViewIfNeeded();
    await expect.poll(() => entityRequests.length).toBeGreaterThan(0);
  });

  test('fixed bundle loads a route only when it is opened', async ({ page, isMobile }) => {
    const press = tap(isMobile);
    const card = page.getByTestId('fix-bundle');
    await press(card.getByRole('button', { name: 'Fix', exact: true }));
    await expect(card.getByTestId('status')).toHaveText('Fixed ✓');
    const open = card.getByRole('button', { name: 'Open graph' });
    await press(open);
    await expect(card.getByRole('button', { name: /^graph · / })).toBeVisible();
  });
});
