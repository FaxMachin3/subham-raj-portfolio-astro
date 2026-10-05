import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { waitForDemos } from './helpers';

const PAGES = [
  '/',
  '/work/graph-performance',
  '/work/design-system',
  '/work/orion-chat',
  '/work/engineering-leverage',
  '/resume',
  '/404',
];
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const summarize = (violations: { id: string; nodes: { target: unknown }[] }[]) =>
  violations.map((v) => `${v.id}: ${v.nodes.map((n) => JSON.stringify(n.target)).join(', ')}`);

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  for (const path of PAGES) {
    test(`no violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      if (path === '/') await waitForDemos(page);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(summarize(violations)).toEqual([]);
    });
  }

  test('broken state: violations are confined to the deliberately broken demo regions', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');
    await waitForDemos(page);
    const breakButton = page.getByRole('button', { name: 'Break this site' });
    await (isMobile ? breakButton.tap() : breakButton.click());
    await expect(page.getByRole('button', { name: 'Let Subham fix it' })).toBeEnabled({ timeout: 60_000 });
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG)
      .exclude('[data-demo-region]')
      .analyze();
    expect(summarize(violations)).toEqual([]);
  });
});

test.describe('accessibility beyond axe', () => {
  test('the x-ray overlay passes axe', async ({ page, isMobile }) => {
    await page.goto('/');
    await waitForDemos(page);
    const card = page.getByTestId('fix-i18n');
    await card.scrollIntoViewIfNeeded();
    const fix = card.getByRole('button', { name: 'Fix', exact: true });
    await (isMobile ? fix.tap() : fix.click());
    await expect(card.getByTestId('xray-caption')).toContainText('compile error', { timeout: 10_000 });
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG)
      .include('[data-testid="xray"]')
      .analyze();
    expect(summarize(violations)).toEqual([]);
  });

  test('keyboard focus is never hidden behind the sticky header or the health bar', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'keyboard navigation is a desktop concern');
    // Instant scrolling so each check sees where focus lands, not a frame of a smooth-scroll animation.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Let Subham fix it' })).toBeAttached();
    await page.waitForTimeout(1500);
    const obscured: string[] = [];
    for (let i = 0; i < 70; i++) {
      await page.keyboard.press('Tab');
      const result = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        if (el.closest('.site-header, .hud, .skip-link')) return null;
        const r = el.getBoundingClientRect();
        const header = document.querySelector('.site-header')!.getBoundingClientRect();
        const hud = document.querySelector('.hud')?.getBoundingClientRect();
        // 2.4.11 fails only when the focused element is entirely covered.
        const underHud = hud
          ? r.top >= hud.top && r.bottom <= hud.bottom && r.left >= hud.left && r.right <= hud.right
          : false;
        const hidden = r.bottom <= header.bottom || underHud;
        return hidden ? `${el.tagName}.${el.className} "${el.textContent?.trim().slice(0, 30)}"` : null;
      });
      if (result) obscured.push(result);
    }
    expect(obscured).toEqual([]);
  });

  test('content survives WCAG text-spacing overrides (1.4.12)', async ({ page }) => {
    await page.goto('/');
    await waitForDemos(page);
    await page.addStyleTag({
      content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
        p { margin-bottom: 2em !important; }`,
    });
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button, .btn, .status-pill, .toast, .hud__cell, .metric')]
        .filter((el) => el.offsetParent !== null)
        .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
        .filter((el) => getComputedStyle(el).overflow !== 'visible' || el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${el.className}: "${el.textContent?.trim().slice(0, 30)}"`),
    );
    expect(clipped).toEqual([]);
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
});
