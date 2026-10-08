#!/usr/bin/env node
// Production smoke check: `npm run smoke -- https://subhamraj.dev`. Every page in the sitemap, the résumé
// PDF, social images, crawler files, a real 404 and long-lived caching on built assets. Exits non-zero
// with a list of failures.
const base = (process.argv[2] ?? 'https://subhamraj.dev').replace(/\/$/, '');
const failures = [];

async function check(path, { status = 200, type, includes, header } = {}) {
  const url = path.startsWith('http') ? path : `${base}${path}`;
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    const problems = [];
    if (response.status !== status) problems.push(`status ${response.status}, expected ${status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (type && !contentType.includes(type)) problems.push(`content-type "${contentType}", expected ${type}`);
    if (header) {
      const [name, value] = header;
      const actual = response.headers.get(name) ?? '';
      if (!actual.includes(value)) problems.push(`${name} "${actual}", expected "${value}"`);
    }
    const body = includes || path === '/sitemap-0.xml' || path === '/' ? await response.text() : '';
    if (includes && !body.includes(includes)) problems.push(`body is missing "${includes}"`);
    console.log(
      `${problems.length ? '✗' : '✓'} ${response.status} ${path}${problems.length ? `  ${problems.join('; ')}` : ''}`,
    );
    if (problems.length) failures.push(`${path}: ${problems.join('; ')}`);
    return body;
  } catch (error) {
    console.log(`✗ ${path}  ${error.message}`);
    failures.push(`${path}: ${error.message}`);
    return '';
  }
}

const home = await check('/', { type: 'text/html', includes: 'Subham Raj' });
const sitemap = await check('/sitemap-0.xml', { type: 'xml' });
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
if (pages.length < 3) failures.push(`sitemap lists only ${pages.length} pages`);
for (const page of pages.filter((p) => p !== '/'))
  await check(page, { type: 'text/html', includes: 'Subham Raj' });

await check('/resume/Subham_Raj_Resume.pdf', { type: 'application/pdf' });
await check('/og/home.png', { type: 'image/png' });
await check('/favicon.svg', { type: 'image/svg+xml' });
await check('/robots.txt', { type: 'text/plain', includes: 'Sitemap:' });
await check('/sitemap-index.xml', { type: 'xml' });
await check('/llms.txt', { type: 'text/plain', includes: 'Subham Raj' });
await check('/site.webmanifest');
await check('/this-page-does-not-exist', { status: 404, type: 'text/html' });

const stylesheet = home.match(/href="(\/_astro\/[^"]+\.css)"/)?.[1];
if (stylesheet) await check(stylesheet, { type: 'text/css', header: ['cache-control', 'immutable'] });
else failures.push('/: no /_astro/ stylesheet found');

if (failures.length) {
  console.error(`\nSmoke check failed for ${base}:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nSmoke check passed for ${base}: ${pages.length} pages and the key assets.`);
