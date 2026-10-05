import { test as base, expect } from '@playwright/test';
import MCR from 'monocart-coverage-reports';
import { e2eOptions } from '../../coverage-config/options.mjs';

const collecting = process.env.COVERAGE === '1';

/** Playwright's `test`, plus browser coverage collection in Chromium when run with COVERAGE=1. */
export const test = base.extend<{ coverage: void }>({
  coverage: [
    async ({ page, browserName }, use) => {
      const on = collecting && browserName === 'chromium';
      if (on) await page.coverage.startJSCoverage({ resetOnNavigation: false });
      await use();
      if (on) await MCR(e2eOptions).add(await page.coverage.stopJSCoverage());
    },
    { auto: true },
  ],
});

export { expect };
