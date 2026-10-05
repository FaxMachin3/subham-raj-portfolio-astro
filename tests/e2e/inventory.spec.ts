import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { tap, waitForDemos } from './helpers';

/**
 * Every link, button, form control and visible string on every page: links resolve, controls have names
 * and are usable, and no text is broken (placeholders, NaN, undefined, misspelled name) in any state.
 */
const PAGES = [
  '/',
  '/resume',
  '/work/graph-performance',
  '/work/design-system',
  '/work/orion-chat',
  '/work/engineering-leverage',
  '/404',
];

const BROKEN_TEXT = [
  /\bundefined\b/,
  /\bNaN\b/,
  /\[object \w+\]/,
  /\bnull\b/,
  /\bTODO\b/i,
  /lorem ipsum/i,
  /shubham/i,
  /\{\{(?!\w+(\.\w+)?\}\})/,
];

async function checkText(page: Page, where: string) {
  const text = await page.evaluate(() => document.body.innerText);
  for (const pattern of BROKEN_TEXT) expect(text, `${where}: ${pattern}`).not.toMatch(pattern);
  expect(text, `${where}: doubled words`).not.toMatch(/\b(the|a|and|to|of|in) \1\b/i);
}

test.describe('inventory', () => {
  for (const path of PAGES) {
    test(`links, controls and text on ${path}`, async ({ page, request, isMobile }) => {
      await page.goto(path);
      if (path === '/') await waitForDemos(page);
      await checkText(page, path);

      const links = await page.locator('a[href]').evaluateAll((els) =>
        els.map((a) => ({
          href: a.getAttribute('href')!,
          name: (a.getAttribute('aria-label') ?? a.textContent ?? '').trim(),
          visible: !!(a as HTMLElement).offsetParent || a.classList.contains('skip-link'),
        })),
      );
      expect(links.length).toBeGreaterThan(3);
      for (const link of links) {
        expect(link.name, `link without a name: ${link.href}`).not.toBe('');
        if (link.href.startsWith('mailto:')) expect(link.href).toMatch(/^mailto:[^@\s]+@[^@\s]+\.\w+$/);
        else if (/^https?:/.test(link.href))
          expect(link.href).toMatch(/^https:\/\/(www\.)?(linkedin\.com|github\.com)\//);
        else {
          const target = new URL(link.href, page.url());
          const response = await request.get(target.pathname);
          expect(response.status(), `${path} → ${link.href}`).toBe(200);
          if (target.hash.length > 1) {
            const html = await response.text();
            expect(html, `anchor ${link.href} from ${path}`).toContain(`id="${target.hash.slice(1)}"`);
          }
        }
      }

      const controls = page.locator('button:visible, select:visible, input:visible');
      const count = await controls.count();
      for (let i = 0; i < count; i++) {
        const control = controls.nth(i);
        const name = await control.evaluate(
          (el) =>
            el.getAttribute('aria-label') ??
            (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null) ??
            el.closest('label')?.textContent ??
            el.textContent,
        );
        expect((name ?? '').trim(), `control without a name on ${path}`).not.toBe('');
        const box = await control.boundingBox();
        if (box && !(await control.evaluate((el) => el.closest('.theme-switch')))) {
          expect(
            Math.min(box.width, box.height),
            `target too small on ${path}: ${name}`,
          ).toBeGreaterThanOrEqual(24);
        }
      }
      if (path === '/' && !isMobile) expect(count).toBeGreaterThan(15);
    });
  }

  test('text stays intact after breaking and after fixing the whole site', async ({ page, isMobile }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await waitForDemos(page);
    await tap(isMobile)(page.getByRole('button', { name: 'Break this site' }));
    await expect(page.getByRole('button', { name: 'Let Subham fix it' })).toBeEnabled({ timeout: 60_000 });
    await checkText(page, 'broken');
    await tap(isMobile)(page.getByRole('button', { name: 'Let Subham fix it' }));
    await expect(page.getByTestId('pr-badge')).toHaveText('Merged', { timeout: 120_000 });
    await checkText(page, 'fixed');
    const metrics = await page.getByTestId('metric-after').allTextContents();
    for (const value of metrics) expect(value).toMatch(/^(\d[\d,.]*\s?\S*.*|n\/a)$/);
  });
});
