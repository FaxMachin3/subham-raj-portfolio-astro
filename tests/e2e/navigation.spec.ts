import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Records, per document, whether a cross-document view transition ran, was skipped, or never started. */
async function watchTransitions(page: Page) {
  await page.addInitScript(() => {
    addEventListener('pageswap', (e: Event) => {
      const offered = !!(e as Event & { viewTransition: ViewTransition | null }).viewTransition;
      sessionStorage.setItem(`vt-out:${location.pathname}`, String(offered));
    });
    addEventListener('pagereveal', (e: Event) => {
      const transition = (e as Event & { viewTransition: ViewTransition | null }).viewTransition;
      const record = (result: string) => sessionStorage.setItem(`vt:${location.pathname}`, result);
      if (!transition) return record('none');
      record('pending');
      transition.ready.then(
        () => record('ran'),
        () => record('skipped'),
      );
    });
  });
}

const transitionOn = (page: Page, path: string) =>
  page.evaluate((p) => sessionStorage.getItem(`vt:${p}`), path);

/**
 * Chromium's mobile emulation intermittently drops cross-document transitions on the incoming page, even
 * between two plain case-study pages (5 of 16 runs, independent of this site's code); desktop Chromium and
 * WebKit are deterministic. There, check that the outgoing page started the transition.
 */
async function expectTransition(page: Page, from: string, to: string, flaky: boolean) {
  if (flaky) expect(await page.evaluate((p) => sessionStorage.getItem(`vt-out:${p}`), from)).toBe('true');
  else await expect.poll(() => transitionOn(page, to)).toBe('ran');
}

const supportsPageTransitions = (page: Page) => page.evaluate(() => 'onpagereveal' in window);

async function openFirstStudyFromWork(page: Page): Promise<number> {
  await page.goto('/');
  await page.waitForLoadState('load');
  const card = page.locator('#work h3').first();
  await card.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(1200);
  const scrollY = await page.evaluate(() => Math.round(window.scrollY));
  await card.click();
  await expect(page).toHaveURL(/\/work\/graph-performance$/);
  await page.waitForLoadState('load');
  return scrollY;
}

test.describe('page transitions', () => {
  test('opening a case study from its card morphs the title', async ({ page, isMobile, browserName }) => {
    await watchTransitions(page);
    await page.goto('/');
    test.skip(!(await supportsPageTransitions(page)), 'this engine has no cross-document view transitions');
    await openFirstStudyFromWork(page);
    await expectTransition(page, '/', '/work/graph-performance', isMobile && browserName === 'chromium');
  });

  for (const via of ['browser Back', '← All case studies'] as const) {
    test(`coming back with ${via} morphs back into the card, at the exact place you left`, async ({
      page,
      isMobile,
      browserName,
    }) => {
      await watchTransitions(page);
      await page.goto('/');
      const transitions = await supportsPageTransitions(page);
      const left = await openFirstStudyFromWork(page);
      await page.evaluate(() => sessionStorage.removeItem('vt:/'));
      if (via === 'browser Back') await page.goBack();
      else await page.getByRole('link', { name: via }).click();
      await expect(page).toHaveURL(/\/$/);
      await page.waitForLoadState('load');
      if (transitions)
        await expectTransition(page, '/work/graph-performance', '/', isMobile && browserName === 'chromium');
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - left)).toBeLessThanOrEqual(2);
    });
  }

  test('"← All case studies" stays a normal link to /#work when the page was not opened from home', async ({
    page,
  }) => {
    await page.goto('/work/graph-performance');
    await page.getByRole('link', { name: '← All case studies' }).click();
    await expect(page).toHaveURL(/\/#work$/);
  });

  test('"← All case studies" ignores modified clicks (new tab or window)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'modifier keys are a desktop concern');
    await openFirstStudyFromWork(page);
    const link = page.getByRole('link', { name: '← All case studies' });
    const prevented = await link.evaluate((el) => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
      el.addEventListener('click', (e) => e.preventDefault(), { once: true });
      el.dispatchEvent(event);
      return location.pathname;
    });
    expect(prevented).toBe('/work/graph-performance');
  });
});

test.describe('fonts', () => {
  test('arrive inside the stylesheet: no separate font downloads', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'font' || /\.woff2?($|\?)/.test(request.url()))
        fontRequests.push(request.url());
    });
    await page.goto('/');
    await page.waitForLoadState('load');
    expect(fontRequests).toEqual([]);
  });

  test('a first, cold visit does not shift as the inlined fonts decode', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'layout-shift entries are Chromium-only');
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(1000);
    const shift = await page.evaluate(
      () =>
        new Promise<{ total: number; sources: string[] }>((resolve) => {
          let total = 0;
          const sources: string[] = [];
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as (PerformanceEntry & {
              value: number;
              sources?: { node?: Node }[];
            })[]) {
              total += entry.value;
              for (const source of entry.sources ?? [])
                sources.push(
                  source.node instanceof Element
                    ? source.node.outerHTML.slice(0, 300)
                    : (source.node?.parentElement?.outerHTML.slice(0, 300) ?? String(source.node)),
                );
            }
          }).observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => resolve({ total, sources }), 100);
        }),
    );
    expect(shift.total, JSON.stringify(shift.sources)).toBe(0);
  });

  test('every navigation paints its first frame in the web fonts', async ({ page }) => {
    // WebKit paints a navigation's first frame before linked font files are ready, even from cache: text
    // either swapped fonts (`swap`) or was invisible for a few frames (`optional`). Inlined, the first frame
    // already has the final text geometry.
    await page.addInitScript(() => {
      const width = () => {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector('h1')!);
        return Math.round(range.getBoundingClientRect().width * 10) / 10;
      };
      // The first frame the stylesheet applies to, i.e. the first one painted: Firefox runs animation frames
      // while it still holds back painting for the stylesheet.
      const styled = () => getComputedStyle(document.documentElement).getPropertyValue('--font-sans') !== '';
      const first = () => {
        if (!styled() || !document.querySelector('h1')) return requestAnimationFrame(first);
        sessionStorage.setItem(`first:${location.pathname}`, String(width()));
        const faces = [...document.fonts].filter((face) =>
          ['Poppins', 'JetBrains Mono'].includes(face.family.replaceAll('"', '').replaceAll("'", '')),
        );
        sessionStorage.setItem(
          `fonts-first:${location.pathname}`,
          JSON.stringify(faces.map((face) => face.status)),
        );
      };
      requestAnimationFrame(first);
      addEventListener('load', () =>
        setTimeout(() => sessionStorage.setItem(`settled:${location.pathname}`, String(width())), 300),
      );
    });
    const forget = (path: string) =>
      page.evaluate((p) => {
        sessionStorage.removeItem(`first:${p}`);
        sessionStorage.removeItem(`settled:${p}`);
        sessionStorage.removeItem(`fonts-first:${p}`);
      }, path);
    const check = async (path: string) => {
      await page.waitForLoadState('load');
      await page.waitForTimeout(400);
      const [first, settled] = await page.evaluate(
        (p) => [sessionStorage.getItem(`first:${p}`), sessionStorage.getItem(`settled:${p}`)],
        path,
      );
      // No new first frame: the page came back from the back/forward cache, already painted.
      if (first === null) return;
      const fonts = await page.evaluate(
        (p) => JSON.parse(sessionStorage.getItem(`fonts-first:${p}`) || '[]') as string[],
        path,
      );
      expect(fonts, `all five font faces are loaded for the first styled frame of ${path}`).toEqual([
        'loaded',
        'loaded',
        'loaded',
        'loaded',
        'loaded',
      ]);
      // A font swap changes the heading by ~5% (e.g. 322 → 339 px); allow only subpixel differences.
      expect(Math.abs(Number(first) - Number(settled)), `first frame of ${path}`).toBeLessThan(2);
    };
    await page.goto('/');
    await page.waitForLoadState('load');
    const card = page.locator('#work h3').first();
    await card.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await forget('/work/graph-performance');
    await card.click();
    await check('/work/graph-performance');
    await forget('/');
    await page.goBack();
    await check('/');
    await forget('/work/graph-performance');
    await page.goForward();
    await check('/work/graph-performance');
    await forget('/');
    await page.getByRole('link', { name: '← All case studies' }).click();
    await check('/');
  });
});
