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
