import { test, expect } from './fixtures';
import { trackErrors, waitForDemos } from './helpers';

test('cross-document opt-in is ready when Chrome reveals an incoming page', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Checks the Chromium cross-document reveal lifecycle.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    addEventListener('pagereveal', (event) => {
      sessionStorage.setItem(
        'incoming-transition',
        String(Boolean((event as PageRevealEvent).viewTransition)),
      );
    });
  });
  const errors = trackErrors(page);
  await page.goto('/');
  await page.getByRole('link', { name: /Making an investigation graph interactive/ }).click();
  await expect(page).toHaveURL(/\/work\/graph-performance$/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('incoming-transition'))).toBe('true');
  await page.getByRole('link', { name: '← All case studies', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('incoming-transition'))).toBe('true');
  expect(errors).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  for (const from of ['/resume', '/work/graph-performance']) {
    test(`${theme}: incoming section links from ${from} handle skipped transitions`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      const errors = trackErrors(page);
      for (const [name, hash] of [
        ['Work', 'work'],
        ['The fixes', 'fixes'],
        ['Experience', 'experience'],
      ]) {
        await page.goto(from);
        const header = page.locator('.site-header');
        if (page.viewportSize()!.width <= 720) await header.locator('[data-mobile-nav] summary').click();
        await header.getByRole('link', { name, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/#${hash}$`));
        await waitForDemos(page);
        await expect(page.locator(`#${hash} h2`).first()).toBeInViewport();
        await expect.poll(() => page.evaluate(() => document.documentElement.dataset.vtDir)).toBeUndefined();
      }
      expect(errors).toEqual([]);
    });
  }
}

test('incoming and outgoing invalid-state aborts are handled without leaking cleanup promises', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.evaluate(async () => {
    for (const type of ['pageswap', 'pagereveal']) {
      const event = new Event(type);
      const error = new DOMException(
        'Transition was aborted because of invalid state. ViewTransition opt-in disabled',
        'InvalidStateError',
      );
      Object.defineProperty(event, 'viewTransition', {
        value: { ready: Promise.reject(error), finished: Promise.reject(error) },
      });
      dispatchEvent(event);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.vtDir)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('repeated case-study and section returns keep navigation usable without uncaught transition errors', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/');
  for (let cycle = 0; cycle < 4; cycle++) {
    await page.locator('#work').evaluate((element) => element.scrollIntoView({ behavior: 'instant' }));
    await page.getByRole('link', { name: /Making an investigation graph interactive/ }).click();
    await expect(page).toHaveURL(/\/work\/graph-performance$/);
    if (cycle % 2) await page.goBack();
    else await page.getByRole('link', { name: '← All case studies', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    const header = page.locator('.site-header');
    if (page.viewportSize()!.width <= 720) await header.locator('[data-mobile-nav] summary').click();
    await header.getByRole('link', { name: 'Experience', exact: true }).click();
    await expect(page).toHaveURL(/\/#experience$/);
    if (page.viewportSize()!.width <= 720) await header.locator('[data-mobile-nav] summary').click();
    await header.getByRole('link', { name: 'Résumé', exact: true }).click();
    await expect(page).toHaveURL(/\/resume$/);
    if (page.viewportSize()!.width <= 720) await page.locator('[data-mobile-nav] summary').click();
    await page.locator('.site-header').getByRole('link', { name: 'Work', exact: true }).click();
    await expect(page).toHaveURL(/\/#work$/);
    // Remove only the fragment for the next native history round trip; keep the current scroll position.
    await page.evaluate(() => history.replaceState(history.state, '', '/'));
  }
  await waitForDemos(page);
  expect(errors).toEqual([]);
});
