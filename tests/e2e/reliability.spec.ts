import { expect, test } from './fixtures';
import { expectNoHorizontalOverflow, tap, waitForDemos } from './helpers';

test.describe('failure and recovery', () => {
  test('a failed route import retries with a fresh URL and then reuses the recovered module', async ({
    page,
  }) => {
    let requests = 0;
    await page.route('**/graph.*.js*', async (route) => {
      requests++;
      if (requests <= 2) await route.abort();
      else await route.continue();
    });
    await page.goto('/');
    await waitForDemos(page);
    const card = page.getByTestId('fix-bundle');
    await card.getByRole('button', { name: 'Fix', exact: true }).click();
    await card.getByRole('button', { name: /Skip/ }).click();
    await card.getByRole('button', { name: 'Open graph', exact: true }).click();
    await card.getByRole('button', { name: 'Retry graph · failed', exact: true }).click();
    await card.getByRole('button', { name: 'Retry graph · failed', exact: true }).click();
    await expect(card.getByRole('button', { name: /^graph ·/ })).toBeDisabled();
    expect(requests).toBe(3);
    await card.getByRole('button', { name: 'Fix', exact: true }).click();
    await card.getByRole('button', { name: /Skip/ }).click();
    await card.getByRole('button', { name: 'Open graph', exact: true }).click();
    await expect(card.getByRole('button', { name: /^graph ·/ })).toBeDisabled();
    expect(requests).toBe(3);
  });
  test('a demo that fails ends the whole-site run with a clear message and usable controls', async ({
    page,
    isMobile,
  }) => {
    test.skip(
      await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
      'breaking is off under reduced motion',
    );
    await page.route(/\/_astro\/admin\.[^/]+\.js$/, (route) => route.abort());
    await page.goto('/');
    await waitForDemos(page);
    await tap(isMobile)(page.getByRole('button', { name: 'Break this site' }));
    await expect(page.locator('.toast--visible')).toContainText('Some demos didn’t break.', {
      timeout: 60_000,
    });
    await expect(page.locator('.toast--visible')).toContainText('Bundle size');
    await expect(page.getByTestId('fix-bundle').getByTestId('status')).toHaveText('Failed · try again');
    await expect(page.getByRole('button', { name: 'Break this site' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Let Subham fix it' })).toBeEnabled();
    // The fix still works for the demos that did break.
    await page.unroute(/\/_astro\/admin\.[^/]+\.js$/);
    await tap(isMobile)(page.getByRole('button', { name: 'Let Subham fix it' }));
    await expect(page.getByTestId('pr-badge')).toHaveText('Merged', { timeout: 120_000 });
  });

  test('a panel request that fails shows a retry instead of a fake success', async ({ page, isMobile }) => {
    await page.route('**/data/entities/5.json', (route) => route.fulfill({ status: 500, body: 'down' }));
    await page.goto('/');
    await waitForDemos(page);
    const card = page.getByTestId('fix-network');
    await card.scrollIntoViewIfNeeded();
    await tap(isMobile)(card.getByRole('button', { name: 'Break', exact: true }));
    await expect(card.getByText('Couldn’t load panel 5')).toBeVisible({ timeout: 30_000 });
    await expect(card.getByTestId('status')).toHaveText('Broken', { timeout: 30_000 });
    await expect(card.getByTestId('xray')).toHaveCount(0);
    await page.unroute('**/data/entities/5.json');
    const retry = card.getByRole('button', { name: 'Retry' });
    await retry.scrollIntoViewIfNeeded();
    await tap(isMobile)(retry);
    await expect(card.getByText('Couldn’t load panel 5')).toHaveCount(0);
  });

  test('a translation that fails to load puts the menu back on the language shown', async ({ page }) => {
    await page.goto('/');
    await waitForDemos(page);
    const select = page.getByLabel('Language');
    const panel = page.getByTestId('i18n-panel');
    await select.selectOption('ja');
    await expect(panel).toHaveAttribute('lang', 'ja');
    await page.route(/\/_astro\/es\.[^/]+\.js$/, (route) => route.abort());
    await select.selectOption('es');
    await expect(page.getByTestId('i18n-note')).toHaveText('couldn’t load es.json · try again');
    await expect(select).toHaveValue('ja');
    await expect(panel).toHaveAttribute('lang', 'ja');
    await expect(panel).toContainText('調査の概要');
  });

  test('a translation that fails after another was picked changes nothing', async ({ page }) => {
    await page.goto('/');
    await waitForDemos(page);
    const select = page.getByLabel('Language');
    await select.selectOption('ja');
    await expect(page.getByTestId('i18n-panel')).toHaveAttribute('lang', 'ja');
    let failed = false;
    await page.route(/\/_astro\/pt\.[^/]+\.js$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      failed = true;
      await route.abort();
    });
    await select.selectOption('pt');
    await select.selectOption('ja');
    await expect.poll(() => failed, { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(300);
    await expect(select).toHaveValue('ja');
    await expect(page.getByTestId('i18n-note')).toHaveText('ja.json · from cache, 0 requests');
  });
});

test.describe('whole-site runs', () => {
  test('lock every card while they run, and Cancel hands everything back', async ({ page, isMobile }) => {
    test.skip(
      await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
      'breaking is off under reduced motion',
    );
    await page.goto('/');
    await waitForDemos(page);
    const cardFix = page.getByTestId('fix-i18n').getByRole('button', { name: 'Fix', exact: true });
    await tap(isMobile)(page.getByRole('button', { name: 'Break this site' }));
    await expect(cardFix).toBeDisabled();
    await tap(isMobile)(page.getByRole('button', { name: 'Cancel run' }));
    await expect(page.locator('.toast--visible')).toContainText('Run cancelled.');
    await expect(cardFix).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Break this site' })).toBeEnabled();
    await expect(page.getByTestId('pr-badge')).not.toHaveText('Merged');
  });
});

test.describe('honest counting', () => {
  test('a translation already in memory is not counted as a download', async ({ page, isMobile }) => {
    await page.goto('/');
    await waitForDemos(page);
    const select = page.getByLabel('Language');
    await select.selectOption('ja');
    await expect(page.getByTestId('i18n-note')).toContainText('loaded in');
    // The measured fix clears the demo's cache, but the browser still has the module: no new request.
    const card = page.getByTestId('fix-i18n');
    await card.scrollIntoViewIfNeeded();
    await tap(isMobile)(card.getByRole('button', { name: 'Fix', exact: true }));
    await expect(page.getByTestId('i18n-note')).toHaveText('ja.json · already in memory, 0 requests', {
      timeout: 30_000,
    });
  });
});

test.describe('hiring structure', () => {
  test('selected work comes before the interactive lab, and the hero leads with it', async ({ page }) => {
    await page.goto('/');
    const order = await page.evaluate(() =>
      ['work', 'leverage', 'fixes', 'results', 'experience', 'contact'].map(
        (id) => document.getElementById(id)!.offsetTop,
      ),
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    await expect(page.getByRole('link', { name: 'View selected work' })).toHaveAttribute('href', '#work');
    await expect(page.locator('.hero').getByRole('link', { name: 'Résumé' })).toHaveAttribute(
      'href',
      '/resume',
    );
    await expect(page.getByText('From my production work at TRM Labs')).toBeVisible();
    await expect(
      page.locator('.hero').getByRole('link', { name: 'Explore the interactive lab ↓' }),
    ).toHaveAttribute('href', '#fixes');
    // The lab's controls sit directly above the cards they break and fix.
    const [controls, firstCard] = await Promise.all([
      page.getByRole('button', { name: 'Break this site' }).boundingBox(),
      page.getByTestId('fix-plot').boundingBox(),
    ]);
    expect(controls!.y).toBeLessThan(firstCard!.y);
    expect(firstCard!.y - controls!.y).toBeLessThan(800);
  });

  test('every demo explains how it measures, and says the TRM note is historical', async ({ page }) => {
    await page.goto('/');
    for (const id of ['plot', 'jank', 'bundle', 'network', 'a11y', 'i18n']) {
      const how = page.getByTestId(`fix-${id}`).locator('details.fix-card__how');
      await how.locator('summary').click();
      await expect(how).toContainText('Measured live');
      await expect(how).toContainText('past production result');
    }
  });

  test('the health bar starts collapsed, remembers being opened or closed, and never covers content', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForDemos(page);
    await expect(page.locator('html')).toHaveAttribute('data-hud', 'collapsed');
    await expect(page.locator('#hud-cells')).toBeHidden();
    await page.getByRole('button', { name: 'Show page health' }).click();
    await expect(page.locator('#hud-cells')).toBeVisible();
    await page.reload();
    await waitForDemos(page);
    await expect(page.locator('html')).not.toHaveAttribute('data-hud', 'collapsed');
    await expect(page.locator('#hud-cells')).toBeVisible();
    await page.getByRole('button', { name: 'Hide page health' }).click();
    await page.reload();
    await expect(page.locator('#hud-cells')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Show page health' })).toBeVisible();
  });
});

test.describe('resilience', () => {
  test('without JavaScript the work, résumé and contact are all still there', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('#work h3')).toHaveCount(4);
    await expect(page.getByRole('link', { name: 'View selected work' })).toBeVisible();
    await expect(page.locator('#contact').getByRole('link', { name: 'Email me' })).toHaveAttribute(
      'href',
      /^mailto:/,
    );
    await page.locator('#work h3').first().click();
    await expect(page).toHaveURL(/\/work\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await context.close();
  });

  test('text spacing overrides (WCAG 1.4.12) clip nothing and add no sideways scrolling', async ({
    page,
  }) => {
    for (const path of ['/', '/work/graph-performance', '/resume']) {
      await page.goto(path);
      await page.addStyleTag({
        content:
          '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
      });
      await expectNoHorizontalOverflow(page);
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('main *')]
          .filter((el) => {
            const style = getComputedStyle(el);
            if (!/(hidden|clip)/.test(style.overflow + style.overflowY) || !el.textContent?.trim())
              return false;
            if (el.closest('[aria-hidden="true"], .sr-only, .fix-card__demo, .hud')) return false;
            return el.scrollHeight > el.clientHeight + 2;
          })
          .map((el) => el.className || el.tagName),
      );
      expect(clipped, `clipped text on ${path}`).toEqual([]);
    }
  });
});
