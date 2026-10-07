#!/usr/bin/env node
// Fails the build if the homepage ships more JavaScript than its budget. Follows static imports from
// every island and module script; dynamic import() chunks (demo routes, translations) are on-demand
// by design and excluded.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
// Fonts are inlined into the stylesheet (src/styles/fonts.css) and budgeted separately from the CSS itself.
const BUDGET_KB = { js: 90, css: 10, fonts: 70 };
const FONT_URI = /url\(\s*["']?data:font\/woff2;base64,[^)"']+["']?\s*\)/g;

const html = await readFile(join(DIST, 'index.html'), 'utf8');
const entries = new Set(
  [...html.matchAll(/(?:component-url|renderer-url|src)="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]),
);

const seen = new Map();
async function walk(url) {
  if (seen.has(url)) return;
  const code = await readFile(join(DIST, url), 'utf8');
  seen.set(url, gzipSync(code).length);
  // Static imports only: `import"./x.js"`, `from"./x.js"`. Dynamic `import("./x.js")` is skipped.
  for (const [, spec] of code.matchAll(/(?:\bfrom|\bimport)\s*["'](\.\/[^"']+\.js)["']/g)) {
    await walk(new URL(spec, `file:///x${url}`).pathname.replace(/^\/x/, ''));
  }
}
for (const url of entries) await walk(url);

const cssUrls = [...html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)].map((m) => m[1]);
let cssBytes = 0;
let fontBytes = 0;
for (const url of cssUrls) {
  const css = await readFile(join(DIST, url), 'utf8');
  const fonts = css.match(FONT_URI) ?? [];
  cssBytes += gzipSync(css.replace(FONT_URI, 'url()')).length;
  fontBytes += fonts.reduce((n, font) => n + gzipSync(font).length, 0);
}
const inlineCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].reduce(
  (n, m) => n + gzipSync(m[1]).length,
  0,
);

const jsKB = [...seen.values()].reduce((a, b) => a + b, 0) / 1024;
const cssKB = (cssBytes + inlineCss) / 1024;
const fontKB = fontBytes / 1024;

console.log('Homepage JS (gzip):');
for (const [url, bytes] of [...seen].sort((a, b) => b[1] - a[1]))
  console.log(`  ${(bytes / 1024).toFixed(1).padStart(6)} KB  ${url}`);
console.log(`  total ${jsKB.toFixed(1)} KB / budget ${BUDGET_KB.js} KB`);
console.log(`Homepage CSS (gzip): ${cssKB.toFixed(1)} KB / budget ${BUDGET_KB.css} KB`);
console.log(`Inlined web fonts (gzip): ${fontKB.toFixed(1)} KB / budget ${BUDGET_KB.fonts} KB`);

const failures = [];
if (jsKB > BUDGET_KB.js) failures.push(`JS ${jsKB.toFixed(1)} KB exceeds ${BUDGET_KB.js} KB`);
if (cssKB > BUDGET_KB.css) failures.push(`CSS ${cssKB.toFixed(1)} KB exceeds ${BUDGET_KB.css} KB`);
if (fontKB > BUDGET_KB.fonts) failures.push(`fonts ${fontKB.toFixed(1)} KB exceed ${BUDGET_KB.fonts} KB`);
if (fontBytes === 0) failures.push('web fonts are not inlined into the stylesheet (see astro.config.mjs)');
if (failures.length) {
  console.error(`Budget failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('Budget passed.');
