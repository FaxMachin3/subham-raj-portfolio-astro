import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { expectNoHorizontalOverflow } from './helpers';

const posts = [
  { slug: 'keyboard-data-tables', related: 'design-system' },
  { slug: 'memoized-index-lookups', related: 'graph-performance' },
];

for (const { slug, related } of posts) {
  test(`published article: ${slug}`, async ({ page, request }) => {
    const path = `/writing/${slug}`;
    await page.goto('/');
    const link = page.locator(`#writing a[href="${path}"]`);
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('.post__draft')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://subhamraj.dev${path}`,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      `https://subhamraj.dev/og/writing-${slug}.png`,
    );
    const graph = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    const article = graph['@graph'].find((node: { '@type': string }) => node['@type'] === 'TechArticle');
    expect(article.headline).toBe(await page.locator('h1').textContent());
    expect(article.datePublished).toContain('2026-11-02');
    expect(article.dateModified).toContain('2026-11-02');
    const crumbs = graph['@graph'].find((node: { '@type': string }) => node['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement[1].item).toBe('https://subhamraj.dev/#writing');
    await expect(page.locator(`.post__related a[href="/work/${related}"]`)).toBeVisible();
    const links = await page
      .locator('article a[href^="/"]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('href')!));
    for (const href of new Set(links)) {
      const response = await request.get(href.split('#')[0] || '/');
      expect(response.status(), href).toBe(200);
      const fragment = href.split('#')[1];
      if (fragment) expect(await response.text()).toContain(`id="${fragment}"`);
    }
    const image = await request.get(`/og/writing-${slug}.png`);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    const png = await image.body();
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    const sitemap = await (await request.get('/sitemap-0.xml')).text();
    expect(sitemap).toContain(`<loc>https://subhamraj.dev${path}</loc>`);
    await page.getByRole('link', { name: '← All writing', exact: true }).click();
    await expect(page).toHaveURL(/\/#writing$/);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${slug}: ${colorScheme} accessibility`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(`/writing/${slug}`);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(violations).toEqual([]);
      await expectNoHorizontalOverflow(page);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: /skip to/i })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
    });
  }
}
