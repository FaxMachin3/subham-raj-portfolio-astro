import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoHorizontalOverflow, trackErrors } from './helpers';

const STUDIES = ['graph-performance', 'design-system', 'orion-chat', 'engineering-leverage'];

test.describe('content pages', () => {
  for (const slug of STUDIES) {
    test(`case study: ${slug}`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/work/${slug}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Next case study' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }

  test('case studies are linked from the homepage', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Making an investigation graph interactive/ }).click();
    await expect(page).toHaveURL(/\/work\/graph-performance/);
  });

  const landings = [
    { from: '/work/graph-performance', link: '← All case studies' },
    { from: '/resume', link: 'Work' },
  ];
  for (const { from, link } of landings) {
    test(`"${link}" from ${from} lands on the Work section instead of scrolling down to it`, async ({
      page,
    }) => {
      await page.addInitScript(() => {
        const w = window as unknown as { __scrolls: number[] };
        w.__scrolls = [];
        addEventListener('scroll', () => w.__scrolls.push(scrollY), { passive: true });
      });
      await page.goto(from);
      const target = page.getByRole('link', { name: link, exact: true }).first();
      test.skip(!(await target.isVisible()), 'the header hides this link on the smallest phones');
      await target.click();
      await expect(page).toHaveURL(/\/#work$/);
      await page.waitForLoadState('load');
      await page.waitForTimeout(800);
      const { scrolls, top } = await page.evaluate(() => ({
        scrolls: (window as unknown as { __scrolls: number[] }).__scrolls,
        top: document.getElementById('work')!.getBoundingClientRect().top,
      }));
      const final = scrolls.at(-1) ?? 0;
      expect(final, 'the page ends up scrolled to the section').toBeGreaterThan(0);
      // The old behaviour animated from the top: positions from near 0 up to the section. WebKit may land a
      // little off while the layout above settles and then re-anchor; that is a nudge, not a scroll.
      expect(
        scrolls.filter((y) => y < final * 0.9),
        'no positions between the top of the page and the section',
      ).toEqual([]);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top).toBeLessThan(200);
    });
  }

  test('in-page links scroll smoothly once loaded, and never under reduced motion', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    const behavior = () => page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    await expect.poll(behavior).toBe('smooth');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await behavior()).toBe('auto');
  });

  test('résumé page offers the PDF', async ({ page, request }) => {
    await page.goto('/resume');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Subham Raj');
    const href = await page.getByRole('link', { name: 'Download PDF' }).getAttribute('href');
    const pdf = await request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('pdf');
    await expectNoHorizontalOverflow(page);
  });

  test('unknown routes show the 404 page', async ({ page }) => {
    const response = await page.goto('/this-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This one isn’t broken on purpose.');
  });
});

test.describe('case-study return history', () => {
  test('page transitions remain enabled outside the case-study flow', async ({ page }) => {
    await page.addInitScript(() => {
      const state = window as unknown as { __animatedNavigation: boolean };
      state.__animatedNavigation = false;
      addEventListener('pagereveal', (event) => {
        const transition = (event as Event & { viewTransition?: { ready: Promise<void> } }).viewTransition;
        transition?.ready.then(
          () => {
            state.__animatedNavigation = true;
          },
          () => {},
        );
      });
    });
    await page.goto('/');
    test.skip(
      !(await page.evaluate(() => 'onpagereveal' in window)),
      'cross-document transitions are unsupported',
    );
    if (page.viewportSize()!.width <= 720) await page.locator('[data-mobile-nav] summary').click();
    await page.locator('.site-header').getByRole('link', { name: 'Résumé', exact: true }).click();
    await expect(page).toHaveURL(/\/resume$/);
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __animatedNavigation: boolean }).__animatedNavigation),
      )
      .toBe(true);
  });

  for (const action of ['browser Back', 'return link', 'browser Back without NavigationActivation']) {
    test(`${action} preserves the page morph when entering or returning from a case study`, async ({
      page,
    }) => {
      await page.addInitScript((legacy) => {
        if (legacy) {
          Object.defineProperty(window, 'navigation', { value: undefined });
          addEventListener('pageswap', (event) => {
            Object.defineProperty(event, 'activation', { value: undefined });
          });
        }
        addEventListener('pagereveal', (event) => {
          const transition = (event as Event & { viewTransition?: { ready: Promise<void> } }).viewTransition;
          const path = location.pathname;
          const record = (status: string) =>
            sessionStorage.setItem('test:last-transition', JSON.stringify({ path, status }));
          if (!transition) {
            record('none');
            return;
          }
          transition.ready.then(
            () => record('animated'),
            () => record('skipped'),
          );
        });
      }, action.includes('without NavigationActivation'));
      await page.goto('/#work');
      test.skip(
        !(await page.evaluate(() => 'onpagereveal' in window)),
        'cross-document transitions are unsupported',
      );
      await page.getByRole('link', { name: /Making an investigation graph interactive/ }).click();
      await expect(page).toHaveURL(/\/work\/graph-performance$/);
      await page.waitForLoadState('domcontentloaded');
      const result = () =>
        page.evaluate(() => JSON.parse(sessionStorage.getItem('test:last-transition') || 'null'));
      await expect.poll(result).toEqual({ path: '/work/graph-performance', status: 'animated' });
      if (action.startsWith('browser Back')) await page.goBack();
      else await page.getByRole('link', { name: '← All case studies', exact: true }).click();
      await expect(page).toHaveURL(/\/#work$/);
      await expect
        .poll(async () => {
          const transition = await result();
          return transition?.path === '/' && transition.status === 'animated';
        })
        .toBe(true);
    });
  }

  const openFromHome = async (page: Page) => {
    await page.goto('/#work');
    await page.evaluate(() => document.fonts.ready);
    const study = page.getByRole('link', { name: /Making an investigation graph interactive/ });
    await study.scrollIntoViewIfNeeded();
    await study.evaluate((element) =>
      scrollTo({ top: element.getBoundingClientRect().top + scrollY - 120, behavior: 'instant' }),
    );
    await page.evaluate(() => {
      addEventListener(
        'click',
        () => {
          sessionStorage.setItem(
            'test:departure',
            JSON.stringify({ x: scrollX, y: scrollY, url: location.href }),
          );
        },
        { once: true, capture: true },
      );
    });
    await study.click();
    await expect(page).toHaveURL(/\/work\/graph-performance$/);
    await expect.poll(() => page.evaluate(() => history.state?.openedFromHome)).toBe(true);
    return page.evaluate(
      () => JSON.parse(sessionStorage.getItem('test:departure')!) as { x: number; y: number; url: string },
    );
  };

  test('returns to the original homepage position, including after a reload', async ({ page }) => {
    const position = await openFromHome(page);
    await page.reload();
    await page.getByRole('link', { name: '← All case studies', exact: true }).click();
    await expect(page).toHaveURL(position.url);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(position.y, 0);
    expect(await page.evaluate(() => scrollX)).toBe(position.x);
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior))
      .toBe('smooth');
  });

  test('browser Back and Forward preserve the contextual return', async ({ page }) => {
    const position = await openFromHome(page);
    await page.goBack();
    await expect(page).toHaveURL(position.url);
    await page.goForward();
    await page.getByRole('link', { name: '← All case studies', exact: true }).click();
    await expect(page).toHaveURL(position.url);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(position.y, 0);
  });

  test('next-study navigation uses the fallback instead of going back to another study', async ({ page }) => {
    await openFromHome(page);
    await page.getByRole('navigation', { name: 'Next case study' }).getByRole('link').click();
    expect(await page.evaluate(() => history.state?.openedFromHome)).toBeFalsy();
    await page.getByRole('link', { name: '← All case studies', exact: true }).click();
    await expect(page).toHaveURL(/\/#work$/);
  });

  test('direct visits with unrelated history use the fallback', async ({ page }) => {
    await page.goto('/resume');
    await page.goto('/work/graph-performance');
    await page.getByRole('link', { name: '← All case studies', exact: true }).click();
    await expect(page).toHaveURL(/\/#work$/);
  });

  test('opening a study in a new tab uses the fallback', async ({ page, context }) => {
    await page.goto('/#work');
    const link = page.getByRole('link', { name: /Making an investigation graph interactive/ });
    await link.evaluate((element) => element.setAttribute('target', '_blank'));
    const newPagePromise = context.waitForEvent('page');
    await link.click();
    const newPage = await newPagePromise;
    await newPage.waitForLoadState();
    expect(await newPage.evaluate(() => history.state?.openedFromHome)).toBeFalsy();
    await newPage.getByRole('link', { name: '← All case studies', exact: true }).click();
    await expect(newPage).toHaveURL(/\/#work$/);
    await newPage.close();
  });

  test('blocked session storage leaves a working fallback', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', {
        get() {
          throw new DOMException('Storage blocked', 'SecurityError');
        },
      });
    });
    await page.goto('/#work');
    await page.getByRole('link', { name: /Making an investigation graph interactive/ }).click();
    await page.getByRole('link', { name: '← All case studies', exact: true }).click();
    await expect(page).toHaveURL(/\/#work$/);
  });

  test('the return link works without JavaScript', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      const page = await context.newPage();
      await page.goto('/work/graph-performance');
      await page.getByRole('link', { name: '← All case studies', exact: true }).click();
      await expect(page).toHaveURL(/\/#work$/);
    } finally {
      await context.close();
    }
  });
});

type GraphNode = { '@type': string; [key: string]: unknown };
const graphOf = async (page: Page): Promise<GraphNode[]> =>
  JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}')['@graph'];

test.describe('SEO', () => {
  test('homepage: title, canonical, social card and a ProfilePage for one Person', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Subham Raj · Senior Frontend Engineer, React & Performance');
    expect((await page.title()).length).toBeLessThanOrEqual(60);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://subhamraj.dev/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://subhamraj.dev/og/home.png',
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description!.length).toBeGreaterThan(110);
    expect(description!.length).toBeLessThanOrEqual(200);

    const graph = await graphOf(page);
    const profile = graph.find((n) => n['@type'] === 'ProfilePage');
    const person = graph.find((n) => n['@type'] === 'Person');
    expect(profile).toMatchObject({ mainEntity: { '@id': 'https://subhamraj.dev/#person' } });
    expect(person).toMatchObject({ name: 'Subham Raj', givenName: 'Subham', familyName: 'Raj' });
    expect(person!.sameAs).toEqual(expect.arrayContaining([expect.stringContaining('linkedin.com')]));
    expect(JSON.stringify(graph)).not.toMatch(/shubham/i);
  });

  test('case studies: clean canonical, own social image, TechArticle and breadcrumbs', async ({ page }) => {
    await page.goto('/work/graph-performance');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://subhamraj.dev/work/graph-performance',
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://subhamraj.dev/og/work-graph-performance.png',
    );
    const graph = await graphOf(page);
    expect(graph.find((n) => n['@type'] === 'TechArticle')).toMatchObject({
      headline: 'Making an investigation graph interactive at scale',
      author: { '@id': 'https://subhamraj.dev/#person' },
    });
    const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList');
    expect(crumbs?.itemListElement).toHaveLength(3);
  });

  test('the 404 page is not indexed', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  test('crawler files, icons and social images are served', async ({ request }) => {
    for (const path of [
      '/sitemap-index.xml',
      '/robots.txt',
      '/llms.txt',
      '/site.webmanifest',
      '/favicon.ico',
      '/favicon.svg',
      '/apple-touch-icon.png',
      '/og/home.png',
      '/og/resume.png',
      '/og/work-graph-performance.png',
    ]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
    const og = await request.get('/og/home.png');
    expect(og.headers()['content-type']).toContain('image/png');
  });

  test('the sitemap lists clean URLs only', async ({ request }) => {
    const xml = await (await request.get('/sitemap-0.xml')).text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls).toContain('https://subhamraj.dev/resume');
    for (const url of urls) {
      expect(url).not.toMatch(/\.html$|\/og\/|404/);
      if (url !== 'https://subhamraj.dev/') expect(url).not.toMatch(/\/$/);
    }
  });
});
