import { expect, test } from './fixtures';
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
    await page.locator('#fixes').scrollIntoViewIfNeeded();
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

  test('toasts always enclose their text with room to spare', async ({ page, isMobile }) => {
    await page.goto('/');
    await waitForDemos(page);
    await tap(isMobile)(page.getByRole('button', { name: 'Break this site' }));
    const toast = page.locator('.toast--visible');
    await expect(toast).toContainText('Breaking the site.');
    const gap = await toast.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return el.getBoundingClientRect().bottom - range.getBoundingClientRect().bottom;
    });
    expect(gap, 'space between the last line and the toast edge').toBeGreaterThanOrEqual(8);
  });

  test('break → fix: every card breaks, every fix measurably improves things', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    const press = tap(isMobile);
    await page.goto('/');
    await waitForDemos(page);

    await press(page.getByRole('button', { name: 'Break this site' }));
    await expect(page.getByRole('button', { name: 'Let Subham fix it' })).toBeEnabled({ timeout: 60_000 });
    await expect(page.locator('html')).toHaveAttribute('data-site', 'broken');
    for (const word of ['fast', 'accessible', 'global']) {
      await expect(page.locator('html')).toHaveAttribute(`data-${word}`, 'broken');
    }
    await expect(
      page.getByTestId('controls-next').getByRole('link', { name: 'See what broke ↓' }),
    ).toBeVisible();
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
    await expect(page.locator('html')).toHaveAttribute('data-fast', 'healed');
    await expect(
      page.getByTestId('controls-next').getByRole('link', { name: 'See your results ↓' }),
    ).toBeVisible();

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
    // Dropped-frame counts are noisy on a shared CI machine; the broken run's 70 ms blocks are not. Frame
    // timestamps snap to vsync, so a block reads as 50-67 ms.
    const longest = async (phase: 'before' | 'after') => {
      const detail =
        (await page.getByTestId('fix-jank').locator(`.metric--${phase} span`).textContent()) ?? '';
      if (values.jank![phase] === 'n/a') {
        // A busy or throttled browser can supply fewer than five frame gaps. The demo must
        // report that limitation honestly; it cannot be compared as a numeric measurement.
        expect(detail).toBe('not enough frames sampled');
        const result = page.getByRole('row').filter({ hasText: 'Sidebar animation' });
        await expect(result.locator(`td.${phase}`)).toHaveText('n/a');
        return null;
      }
      expect(detail).toMatch(/longest frame \d+ ms/);
      return Number(/longest frame (\d+) ms/.exec(detail)![1]);
    };
    const brokenLongest = await longest('before');
    const fixedLongest = await longest('after');
    if (brokenLongest !== null) expect(brokenLongest).toBeGreaterThan(40);
    if (brokenLongest !== null && fixedLongest !== null) expect(fixedLongest).toBeLessThan(brokenLongest);
    expect(values.a11y!.before).toBe('0/18 reachable');
    expect(values.a11y!.after).toBe('18/18 reachable');
    expect(values.i18n!.before).toBe('5 of 5');
    expect(values.i18n!.after).toBe('0 of 5');
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('under reduced motion the x-ray is a still frame that explains the fix', async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    // Rendered only after hydration, so the card's buttons are live from here on.
    await expect(page.getByText('Breaking is turned off because you prefer reduced motion.')).toBeVisible({
      timeout: 30_000,
    });
    const card = page.getByTestId('fix-a11y');
    await tap(isMobile)(card.getByRole('button', { name: 'Fix', exact: true }));
    const xray = card.getByTestId('xray');
    await expect(xray).toHaveClass(/xray--still/);
    await expect(card.getByTestId('xray-caption')).toHaveText(
      'Every control reachable and announced by name.',
    );
    await expect(card.getByTestId('status')).toHaveText('Fixed ✓', { timeout: 15_000 });
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

  test('accessible table: W/S rows, A/D headers, arrows cells, Enter sorts', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation is a desktop concern');
    const region = page.getByTestId('a11y-region');
    const live = page.getByTestId('a11y-live');
    const key = (k: string) => page.keyboard.press(k);

    await region.getByRole('cell', { name: '0x9f…a21' }).click();
    await key('d');
    await expect(region.getByRole('columnheader', { name: /Address/ })).toBeFocused();
    await key('d');
    const typeHeader = region.getByRole('columnheader', { name: /Type/ });
    await expect(typeHeader).toBeFocused();
    await key('Enter');
    await expect(typeHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(region.getByRole('status')).toHaveText('Sorted by Type, ascending.');

    await key('s');
    await expect(region.locator('tbody tr').first()).toBeFocused();
    await expect(live).toHaveText('Row 1 of 4: 0xa4…19c, Bridge, High risk');
    await key('S');
    await expect(region.locator('tbody tr').nth(1)).toBeFocused();

    await key('ArrowRight');
    await expect(region.getByRole('cell', { name: 'Exchange' })).toBeFocused();
    await key('ArrowRight');
    await expect(region.getByRole('cell', { name: 'Low' })).toBeFocused();
    await expect(live).toHaveText('Row 2, Risk: Low');

    await key('w');
    await key('w');
    await key('w');
    await expect(region.getByRole('columnheader', { name: /Risk/ })).toBeFocused();
  });

  test('accessible menus: Filter and More actions work from the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation is a desktop concern');
    const region = page.getByTestId('a11y-region');
    const filter = region.getByRole('button', { name: 'Filter' });
    await filter.focus();
    await page.keyboard.press('Enter');
    await expect(region.getByRole('menuitemradio', { name: 'All risks' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(filter).toBeFocused();
    await expect(filter).toHaveAttribute('aria-expanded', 'false');
    await expect(region.locator('tbody tr')).toHaveCount(2);
    await expect(region.getByRole('status')).toHaveText('Showing 2 high-risk.');

    await filter.press('Enter');
    await page.keyboard.press('Escape');
    await expect(region.getByRole('menu')).toHaveCount(0);
    await expect(filter).toBeFocused();

    const more = region.getByRole('button', { name: 'More actions' });
    await more.focus();
    await page.keyboard.press('ArrowUp');
    await expect(region.getByRole('menuitem', { name: 'Reset table' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(region.locator('tbody tr')).toHaveCount(4);
  });

  test('export downloads the visible rows as CSV', async ({ page, isMobile }) => {
    const region = page.getByTestId('a11y-region');
    const downloading = page.waitForEvent('download');
    await tap(isMobile)(region.getByRole('button', { name: 'Export' }));
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('linked-addresses.csv');
    const stream = await download.createReadStream();
    let csv = '';
    for await (const chunk of stream) csv += chunk;
    expect(csv.split('\n')[0]).toBe('Address,Type,Risk');
    expect(csv.trim().split('\n')).toHaveLength(5);
  });

  test('broken panel: controls work with a mouse but cannot be reached by keyboard', async ({
    page,
    isMobile,
  }) => {
    const card = page.getByTestId('fix-a11y');
    await tap(isMobile)(card.getByRole('button', { name: 'Break', exact: true }));
    await expect(card.getByTestId('status')).toHaveText('Broken');
    const region = page.getByTestId('a11y-region');
    await tap(isMobile)(region.getByText('Filter', { exact: true }));
    await tap(isMobile)(region.locator('.menu__item', { hasText: 'High' }));
    await expect(region.locator('tbody tr')).toHaveCount(2);
    const focusable = await region.evaluate(
      (el) =>
        [...el.querySelectorAll<HTMLElement>('[data-interactive]')].filter((n) => n.tabIndex >= 0).length,
    );
    expect(focusable).toBe(0);
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

  test('a slow translation never overwrites a newer choice', async ({ page }) => {
    const panel = page.getByTestId('i18n-panel');
    const select = page.getByLabel('Language');
    await select.selectOption('ja');
    await expect(panel).toContainText('調査の概要');
    // Vite ships each translation as its own chunk; hold Spanish back so Japanese is picked before it lands.
    let released = false;
    await page.route(/\/_astro\/es\.[^/]+\.js$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      released = true;
      await route.continue();
    });
    await select.selectOption('es');
    await select.selectOption('ja');
    await expect.poll(() => released, { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(300);
    await expect(select).toHaveValue('ja');
    await expect(panel).toContainText('調査の概要');
    await expect(page.getByTestId('i18n-note')).toHaveText('ja.json · from cache, 0 requests');
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

  test('each hero word breaks and heals with the fix it stands for', async ({ page, isMobile }) => {
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-accessible', /.+/);
    const card = page.getByTestId('fix-a11y');
    await tap(isMobile)(card.getByRole('button', { name: 'Break', exact: true }));
    await expect(html).toHaveAttribute('data-accessible', 'broken');
    await expect(html).not.toHaveAttribute('data-fast', /.+/);
    await expect(html).toHaveAttribute('data-site', 'broken');
    await tap(isMobile)(card.getByRole('button', { name: 'Fix', exact: true }));
    await expect(html).toHaveAttribute('data-accessible', 'healed');
    await expect(html).toHaveAttribute('data-site', 'healthy');
  });

  test('an x-ray explains the bug first, then the measured run follows, with no layout shift', async ({
    page,
    isMobile,
  }) => {
    const card = page.getByTestId('fix-bundle');
    await card.scrollIntoViewIfNeeded();
    const shift = await recordLayoutShift(page);
    await tap(isMobile)(card.getByRole('button', { name: 'Break', exact: true }));
    const xray = card.getByTestId('xray');
    await expect(xray).toBeVisible();
    await expect(xray).toHaveAttribute('aria-label', /X-ray: /);
    await expect(card.getByTestId('xray-caption')).toHaveAttribute('aria-live', 'polite');
    await expect(card.getByTestId('xray-caption')).toContainText('loads and runs before anything works');
    // The measurement has not run while the x-ray plays.
    await expect(card.getByTestId('status')).toHaveText('Breaking…');
    await expect(card.getByTestId('metric-before')).toHaveText('—');
    await expect(xray).toBeHidden({ timeout: 15_000 });
    await expect(card.getByTestId('status')).toHaveText('Broken');
    await expect(card.getByTestId('metric-before')).toContainText('KB');
    const total = await shift();
    if (total !== null) expect(total, 'the x-ray overlay must not shift the page').toBeLessThan(0.01);
  });

  test('breaking and fixing a card in view never shifts the page around it', async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(browserName !== 'chromium', 'layout-shift entries are Chromium-only');
    test.setTimeout(150_000);
    for (const id of ['plot', 'jank', 'bundle', 'network', 'a11y', 'i18n']) {
      const card = page.getByTestId(`fix-${id}`);
      await card.locator('.fix-card__demo').evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const shift = await recordLayoutShift(page, { outsideDemos: true });
      for (const [button, status] of [
        ['Break', 'Broken'],
        ['Fix', 'Fixed ✓'],
      ] as const) {
        await tap(isMobile)(card.getByRole('button', { name: button, exact: true }));
        await expect(card.getByTestId('status')).toHaveText(status, { timeout: 30_000 });
      }
      await page.waitForTimeout(300);
      expect(await shift(), `${id}: layout shift while breaking and fixing`).toBeLessThan(0.01);
    }
  });

  test('the x-ray can be skipped', async ({ page, isMobile }) => {
    const card = page.getByTestId('fix-a11y');
    await card.scrollIntoViewIfNeeded();
    await tap(isMobile)(card.getByRole('button', { name: 'Fix', exact: true }));
    await expect(card.getByTestId('xray')).toBeVisible();
    await tap(isMobile)(card.getByRole('button', { name: 'Skip' }));
    await expect(card.getByTestId('xray')).toBeHidden();
    await expect(card.getByTestId('status')).toHaveText('Fixed ✓', { timeout: 5_000 });
  });

  test('the x-ray loads only when first needed', async ({ page }) => {
    const chunks: string[] = [];
    page.on('request', (r) => /XRay\.[\w-]+\.js/.test(r.url()) && chunks.push(r.url()));
    await page.goto('/');
    await waitForDemos(page);
    await page.waitForTimeout(500);
    expect(chunks).toHaveLength(0);
    await page.getByTestId('fix-i18n').getByRole('button', { name: 'Break', exact: true }).click();
    await expect.poll(() => chunks.length).toBe(1);
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
