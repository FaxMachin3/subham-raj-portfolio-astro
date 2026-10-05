import { defineConfig, devices } from '@playwright/test';

const PORT = 4322;
const coverage = process.env.COVERAGE === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry: headless WebKit occasionally crashes a page under heavy parallel load (never reproduced
  // serially). Retried tests are still reported as "flaky", so a real regression stays visible.
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  // With COVERAGE=1 (npm run coverage), browser coverage is collected per test and reported at the end.
  ...(coverage && {
    globalSetup: './coverage-config/e2e-setup.mjs',
    globalTeardown: './coverage-config/e2e-teardown.mjs',
  }),
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  // The suite runs against the production build, never the dev server.
  webServer: {
    command: `npm run preview -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-laptop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    { name: 'android-pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'android-small-360', use: { ...devices['Galaxy S8'] } },
    { name: 'webkit-iphone-se', use: { ...devices['iPhone SE'] } },
    { name: 'webkit-iphone-14', use: { ...devices['iPhone 14'] } },
    { name: 'webkit-iphone-landscape', use: { ...devices['iPhone 14 landscape'] } },
    { name: 'webkit-ipad', use: { ...devices['iPad (gen 7)'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } },
    },
  ],
});
