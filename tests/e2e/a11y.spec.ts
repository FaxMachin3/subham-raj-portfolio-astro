import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
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
