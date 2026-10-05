/**
 * One merged coverage report for all TypeScript in src/: Vitest (unit + component) and Playwright (Chromium)
 * each save raw V8 coverage, then `npm run coverage` merges them and requires 100% on every metric.
 * Generated and data-only files have no logic to cover. Astro templates are checked through their rendered
 * output by the e2e suite; their build-time frontmatter is not instrumented.
 */
const NOT_CODE = [/^src\/demos\//, /^src\/i18n\/keys\.gen\.ts$/, /\.d\.ts$/, /^src\/data\//];

/** Maps any source path (absolute, `../../src/…`, query strings) to a project-relative `src/…` path. */
const toSrcPath = (filePath) => filePath.replace(/[?#].*$/, '').replace(/^.*?(?:^|\/)(src\/)/, 'src/');

const inScope = (filePath) => {
  const path = toSrcPath(filePath);
  return path.startsWith('src/') && /\.(ts|tsx)$/.test(path) && !NOT_CODE.some((re) => re.test(path));
};

/** Vitest modules from src/ (not dependencies). */
export const isUnitEntry = (entry) => entry.url.includes('/src/') && !entry.url.includes('node_modules');

const shared = {
  sourcePath: toSrcPath,
  sourceFilter: inScope,
  cleanCache: false,
};

/** @type {import('monocart-coverage-reports').CoverageReportOptions} */
export const unitOptions = {
  ...shared,
  name: 'Unit coverage',
  outputDir: 'coverage/unit',
  reports: ['raw'],
  entryFilter: isUnitEntry,
};

/** @type {import('monocart-coverage-reports').CoverageReportOptions} */
export const e2eOptions = {
  ...shared,
  name: 'E2E coverage (Chromium)',
  outputDir: 'coverage/e2e',
  reports: ['raw'],
  entryFilter: (entry) => entry.url.includes('/_astro/'),
};

/** @type {import('monocart-coverage-reports').CoverageReportOptions} */
export const mergedOptions = {
  ...shared,
  name: 'Merged coverage: unit + e2e',
  inputDir: ['coverage/unit/raw', 'coverage/e2e/raw'],
  outputDir: 'coverage/merged',
  reports: [['console-summary'], ['console-details', { skipPercent: 100 }], ['v8'], ['lcovonly']],
  // Files no test loads still count, as 0%.
  all: { dir: ['./src'], filter: (filePath) => inScope(filePath) },
  onEnd: ({ summary }) => {
    const below = ['statements', 'branches', 'functions', 'lines'].filter((k) => summary[k].pct < 100);
    if (below.length) throw new Error(`Coverage below 100% for: ${below.join(', ')}`);
  },
};
