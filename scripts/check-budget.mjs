#!/usr/bin/env node
// Fails the build if the homepage ships more than its budgets. Two JavaScript budgets:
// - initial: every island and module script, their static imports, and inline scripts (JSON-LD excluded);
// - lab: code the demos load on demand with import() (routes, translations, x-rays), so an expensive lab
//   can't hide behind a good initial number.
// Not covered: scripts a host injects at the edge (e.g. Cloudflare Web Analytics).
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
// Fonts are inlined into the stylesheet (src/styles/fonts.css) and budgeted separately from the CSS itself.
// js: 90 KB until it also counted inline scripts (~4.6 KB); 100 KB covers them plus the failure, cancellation
// and retry handling added to the demos. synthetic: the bundle demo's generated chunks, which are big on
// purpose (they are the problem it demonstrates); capped only to catch accidental growth.
// The full-screen phone navigation adds ~0.3 KB compressed CSS. Keep a bounded 0.5 KB allowance.
const BUDGET_KB = { js: 100, lab: 15, synthetic: 320, css: 10.5, fonts: 70 };
const FONT_URI = /url\(\s*["']?data:font\/woff2;base64,[^)"']+["']?\s*\)/g;

const html = await readFile(join(DIST, 'index.html'), 'utf8');
const entries = new Set(
  [...html.matchAll(/(?:component-url|renderer-url|src)="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]),
);

const resolve = (spec, from) => new URL(spec, `file:///x${from}`).pathname.replace(/^\/x/, '');
const dynamic = new Set();

/** Adds `url` and its static imports to `into`; collects dynamic import() targets on the way. */
async function walk(url, into) {
  if (into.has(url)) return;
  const code = await readFile(join(DIST, url), 'utf8');
  into.set(url, gzipSync(code).length);
  for (const [, spec] of code.matchAll(/(?:\bfrom|\bimport)\s*["'](\.\/[^"']+\.js)["']/g))
    await walk(resolve(spec, url), into);
  for (const [, spec] of code.matchAll(/\bimport\(\s*[`"'](\.\/[^`"']+\.js)[`"']\s*\)/g))
    dynamic.add(resolve(spec, url));
}

const seen = new Map();
for (const url of entries) await walk(url, seen);
const inlineJs = [
  ...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g),
]
  .map((m) => m[1])
  .filter((code) => code.trim());
seen.set(
  '(inline scripts)',
  inlineJs.reduce((n, code) => n + gzipSync(code).length, 0),
);

const lab = new Map();
for (
  let pending = [...dynamic];
  pending.length;
  pending = [...dynamic].filter((u) => !lab.has(u) && !seen.has(u))
)
  for (const url of pending) if (!seen.has(url)) await walk(url, lab);
for (const url of seen.keys()) lab.delete(url);

// The bundle demo's generated chunks (scripts/generate-demo-chunks.mjs): src/demos/core.ts and routes/*.ts.
const syntheticNames = [
  'core',
  ...(await readdir(new URL('../src/demos/routes/', import.meta.url))).map((f) => f.replace(/\.ts$/, '')),
];
const synthetic = new Map(
  [...lab].filter(([url]) => syntheticNames.some((name) => new RegExp(`/${name}\\.[\\w-]+\\.js$`).test(url))),
);
for (const url of synthetic.keys()) lab.delete(url);

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
const labKB = [...lab.values()].reduce((a, b) => a + b, 0) / 1024;
const syntheticKB = [...synthetic.values()].reduce((a, b) => a + b, 0) / 1024;
const cssKB = (cssBytes + inlineCss) / 1024;
const fontKB = fontBytes / 1024;

let commit = 'unknown commit';
try {
  commit = execFileSync(
    'git',
    [
      '-c',
      `safe.directory=${process.cwd().replaceAll('\\', '/')}`,
      '-c',
      'core.fsmonitor=false',
      'rev-parse',
      '--short',
      'HEAD',
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  ).trim();
} catch {
  // Not a git checkout (e.g. a zip): the report says so.
}
console.log(`Budget report for ${commit}, built ${new Date().toISOString()}`);
console.log('Homepage JS, initial (gzip):');
for (const [url, bytes] of [...seen].sort((a, b) => b[1] - a[1]))
  console.log(`  ${(bytes / 1024).toFixed(1).padStart(6)} KB  ${url}`);
console.log(`  total ${jsKB.toFixed(1)} KB / budget ${BUDGET_KB.js} KB`);
console.log(
  `Interactive lab, on demand (gzip): ${labKB.toFixed(1)} KB in ${lab.size} chunks / budget ${BUDGET_KB.lab} KB`,
);
console.log(
  `Bundle demo's synthetic payloads (gzip): ${syntheticKB.toFixed(1)} KB in ${synthetic.size} chunks / cap ${BUDGET_KB.synthetic} KB`,
);
console.log(`Homepage CSS (gzip): ${cssKB.toFixed(1)} KB / budget ${BUDGET_KB.css} KB`);
console.log(`Inlined web fonts (gzip): ${fontKB.toFixed(1)} KB / budget ${BUDGET_KB.fonts} KB`);

const failures = [];
if (jsKB > BUDGET_KB.js) failures.push(`JS ${jsKB.toFixed(1)} KB exceeds ${BUDGET_KB.js} KB`);
if (labKB > BUDGET_KB.lab) failures.push(`lab JS ${labKB.toFixed(1)} KB exceeds ${BUDGET_KB.lab} KB`);
if (syntheticKB > BUDGET_KB.synthetic)
  failures.push(`synthetic demo chunks ${syntheticKB.toFixed(1)} KB exceed ${BUDGET_KB.synthetic} KB`);
if (!lab.size) failures.push('found no on-demand lab chunks: the dynamic import pattern may have changed');
if (cssKB > BUDGET_KB.css) failures.push(`CSS ${cssKB.toFixed(1)} KB exceeds ${BUDGET_KB.css} KB`);
if (fontKB > BUDGET_KB.fonts) failures.push(`fonts ${fontKB.toFixed(1)} KB exceed ${BUDGET_KB.fonts} KB`);
if (fontBytes === 0) failures.push('web fonts are not inlined into the stylesheet (see astro.config.mjs)');
if (failures.length) {
  console.error(`Budget failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('Budget passed.');
