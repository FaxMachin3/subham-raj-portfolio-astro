import { expect, test } from './fixtures';

for (const action of ['browser Back', 'return link']) {
  test(`slow stylesheet keeps inlined fonts stable on study entry and ${action}`, async ({ page }) => {
    let requests = 0;
    page.on('request', (request) => {
      if (request.resourceType() === 'font') requests++;
    });
    await page.route('**/*.css', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await page.addInitScript(() => {
      addEventListener('unload', () => {});
      const state = window as unknown as { __textFrames: string[]; __fontDiagnostics: unknown[] };
      state.__textFrames = [];
      state.__fontDiagnostics = [];
      const sample = () => {
        const heading = document.querySelector('h1');
        if (
          heading &&
          document.body &&
          getComputedStyle(document.body).visibility === 'visible' &&
          getComputedStyle(document.documentElement).getPropertyValue('--font-sans') !== ''
        ) {
          const range = document.createRange();
          range.selectNodeContents(heading);
          const rects = [...range.getClientRects()].map((rect) => [
            Math.round(rect.width * 10),
            Math.round(rect.height * 10),
          ]);
          const signature = JSON.stringify(rects);
          if (signature !== state.__textFrames.at(-1)) {
            state.__fontDiagnostics.push({
              signature,
              readyState: document.readyState,
              viewport: [innerWidth, document.documentElement.clientWidth],
              fonts: [...document.fonts].map((face) => ({
                family: face.family,
                weight: face.weight,
                status: face.status,
              })),
            });
          }
          state.__textFrames.push(signature);
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const stableText = async () => {
      await page.waitForLoadState('load');
      await page.evaluate(() => document.fonts.ready);
      await expect
        .poll(() =>
          page.evaluate(() => (window as unknown as { __textFrames: string[] }).__textFrames.length),
        )
        .toBeGreaterThan(0);
      await page.waitForTimeout(200);
      const frames = await page.evaluate(
        () => (window as unknown as { __textFrames: string[] }).__textFrames,
      );
      expect(frames.length).toBeGreaterThan(0);
      const diagnostics = await page.evaluate(
        () => (window as unknown as { __fontDiagnostics: unknown[] }).__fontDiagnostics,
      );
      expect(
        new Set(frames).size,
        `visible heading geometry stays stable on ${new URL(page.url()).pathname}: ${JSON.stringify(diagnostics)}`,
      ).toBe(1);
    };

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await stableText();
    const study = page.getByRole('link', { name: /Making an investigation graph interactive/ });
    await study.scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => scrollY);
    await study.click();
    await expect(page).toHaveURL(/\/work\/graph-performance$/);
    await page.waitForLoadState('domcontentloaded');
    await stableText();
    if (action === 'browser Back') await page.goBack();
    else await page.getByRole('link', { name: '← All case studies', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await stableText();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
    expect(requests).toBe(0);
  });
}
