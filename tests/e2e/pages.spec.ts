import { expect, test } from '@playwright/test';
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

test.describe('SEO', () => {
  test('homepage has canonical, social and structured data', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://subhamraj.dev/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://subhamraj.dev/og.png',
    );
    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
    );
    expect(jsonLd).toMatchObject({ '@type': 'Person', name: 'Subham Raj' });
  });

  test('sitemap, robots and social image are served', async ({ request }) => {
    for (const path of ['/sitemap-index.xml', '/robots.txt', '/og.png']) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });
});
