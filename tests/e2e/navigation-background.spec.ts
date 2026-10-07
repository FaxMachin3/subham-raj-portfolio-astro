import { expect, test } from './fixtures';

for (const theme of ['light', 'dark'] as const) {
  test(`saved ${theme} canvas is stable before styles load and during navigation`, async ({ page }) => {
    // Saved preference must win even when the system prefers the opposite theme.
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await page.addInitScript((savedTheme) => {
      localStorage.setItem('theme', savedTheme);
      addEventListener('unload', () => {});
      const state = window as unknown as { __canvasFrames: string[] };
      state.__canvasFrames = [];
      const sample = () => {
        if (document.body) {
          const style = getComputedStyle(document.documentElement);
          state.__canvasFrames.push(`${style.visibility}:${style.backgroundColor}:${style.colorScheme}`);
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, theme);
    await page.route('**/*.css', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    const stableCanvas = async () => {
      await page.waitForLoadState('load');
      await page.waitForTimeout(100);
      const frames = await page.evaluate(
        () => (window as unknown as { __canvasFrames: string[] }).__canvasFrames,
      );
      expect(frames.length).toBeGreaterThan(0);
      const color = theme === 'light' ? 'rgb(245, 244, 239)' : 'rgb(18, 18, 17)';
      expect([...new Set(frames)], 'the themed canvas stays visible for every sampled frame').toEqual([
        `visible:${color}:${theme}`,
      ]);
    };
    await page.goto('/');
    await stableCanvas();
    await page.getByRole('link', { name: /Making an investigation graph interactive/ }).click();
    await expect(page).toHaveURL(/\/work\/graph-performance$/);
    await stableCanvas();
    await page.getByRole('link', { name: '← All case studies', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await stableCanvas();
  });
}
