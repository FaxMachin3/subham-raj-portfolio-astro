import { test, expect } from './fixtures';
import { expectNoHorizontalOverflow, waitForDemos } from './helpers';

for (const theme of ['light', 'dark'] as const) {
  test(`full-screen navigation in ${theme}: reveal, focus, scroll and return`, async ({
    page,
    browserName,
  }) => {
    test.skip(page.viewportSize()!.width > 720, 'mobile navigation');
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
    await page.goto('/');
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await waitForDemos(page);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo({ top: 1200, behavior: 'instant' }));
    const before = await page.evaluate(() => scrollY);
    const menu = page.locator('[data-mobile-nav]');
    const summary = menu.locator('summary');
    const toggle = async () => {
      const box = (await summary.boundingBox())!;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    };
    const opening = await page.evaluate(() => {
      document.querySelector<HTMLElement>('[data-mobile-nav] summary')!.click();
      const animation = document.querySelector<HTMLElement>('.mobile-nav__panel')!.getAnimations()[0]!;
      animation.pause();
      return [0, 190, 379].map((time) => {
        animation.currentTime = time;
        const layer = getComputedStyle(document.querySelector('.site-header')!, '::before');
        return { opacity: layer.opacity, blur: layer.backdropFilter, background: layer.backgroundColor };
      });
    });
    for (const frame of opening) {
      expect(frame.opacity).toBe('1');
      expect(frame.blur).toBe('blur(8px)');
      expect(frame.background).not.toBe('rgba(0, 0, 0, 0)');
    }
    await menu.locator('.mobile-nav__panel').evaluate((element) => element.getAnimations()[0]!.play());
    await expect(summary).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('link', { name: 'Work', exact: true })).toBeFocused();
    await expectNoHorizontalOverflow(page);
    const panel = menu.locator('.mobile-nav__panel');
    expect(await panel.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      theme === 'dark' ? 'rgb(18, 18, 17)' : 'rgb(245, 244, 239)',
    );
    expect(await panel.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
    if (browserName !== 'webkit') await page.mouse.wheel(0, 400);
    await panel.evaluate((element) => {
      element.scrollTop = 100;
    });
    expect(await page.evaluate(() => scrollY)).toBe(before);
    // Inspect the closing animation before it settles: the header must already be blurred,
    // while the fixed panel keeps its viewport bounds and the background remains locked.
    const closing = await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const header = document.querySelector<HTMLElement>('.site-header')!;
      const panel = document.querySelector<HTMLElement>('.mobile-nav__panel')!;
      const animation = panel.getAnimations()[0]!;
      animation.pause();
      animation.currentTime = 130;
      const layer = getComputedStyle(header, '::before');
      const bounds = panel.getBoundingClientRect();
      return {
        opacity: layer.opacity,
        blur: layer.backdropFilter,
        background: layer.backgroundColor,
        headerBlur: getComputedStyle(header).backdropFilter,
        top: Math.round(bounds.top),
        height: Math.round(bounds.height),
        viewportHeight: innerHeight,
        overflow: getComputedStyle(document.documentElement).overflow,
      };
    });
    expect(closing.opacity).toBe('1');
    expect(closing.blur).toBe('blur(8px)');
    expect(closing.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(closing.headerBlur).toBe('none');
    expect(closing.top).toBe(0);
    expect(closing.height).toBe(closing.viewportHeight);
    expect(closing.overflow).toBe('hidden');
    await panel.evaluate((element) => element.getAnimations()[0]!.play());
    await expect(menu).not.toHaveAttribute('open');
    await expect(summary).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(before);
    await toggle();
    await expect(menu.getByRole('link', { name: 'Résumé', exact: true })).toBeVisible();
    await menu.getByRole('link', { name: 'Résumé', exact: true }).click();
    await expect(page).toHaveURL(/\/resume$/);
    await page.goBack();
    await expect(menu).not.toHaveAttribute('open');
    await expect(page.locator('main')).not.toHaveAttribute('inert');
  });
}

test('rapid toggles, reduced motion, theme control and desktop resizing', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 720, 'mobile navigation');
  await page.goto('/');
  const menu = page.locator('[data-mobile-nav]');
  const summary = menu.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(menu.getByRole('link', { name: 'Work', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open');
  await summary.click();
  await summary.click();
  await summary.click();
  await expect(menu.getByRole('link', { name: 'Work', exact: true })).toBeFocused();
  await page.locator('.theme-cycle').click();
  await expect(menu).toHaveAttribute('open');
  await summary.click();
  await expect(menu).not.toHaveAttribute('open');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await summary.click();
  expect(await menu.locator('.mobile-nav__panel').evaluate((element) => element.getAnimations().length)).toBe(
    0,
  );
  await summary.click();
  await expect(menu).not.toHaveAttribute('open');
  await summary.click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(menu).not.toHaveAttribute('open');
  await expect(page.locator('.site-nav')).toBeVisible();
  await expect(page.locator('main')).not.toHaveAttribute('inert');
});
import { AxeBuilder } from '@axe-core/playwright';

test('short screens keep every contact reachable and keyboard focus inside the navigation', async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width > 720, 'mobile navigation');
  await page.setViewportSize({ width: 360, height: 400 });
  await page.goto('/');
  const menu = page.locator('[data-mobile-nav]');
  await menu.locator('summary').click();
  await expect(menu.getByRole('link', { name: 'Work', exact: true })).toBeFocused();
  const brand = page.locator('.brand');
  await brand.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.theme-cycle')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(brand).toBeFocused();
  await menu.getByRole('link', { name: 'GitHub', exact: true }).scrollIntoViewIfNeeded();
  await expect(menu.getByRole('link', { name: 'GitHub', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open');
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
