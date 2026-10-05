import { defineConfig, devices } from '@playwright/test';

const PORT = 4323;

/**
 * Recorded walkthroughs (npm run walkthrough): one long, assertion-driven run through every page, flow and
 * control on desktop, tablet and phone, saved as a video per device in walkthrough-results/.
 */
export default defineConfig({
  testDir: 'tests/walkthrough',
  timeout: 20 * 60_000,
  expect: { timeout: 30_000 },
  retries: 0,
  // Three recording browsers at once starve WebKit (page crashes) and make the videos stutter.
  workers: 1,
  reporter: [['list']],
  outputDir: 'walkthrough-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    actionTimeout: 30_000,
    video: 'on',
    launchOptions: { slowMo: 120 },
  },
  webServer: {
    command: `npm run preview -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        video: { mode: 'on', size: { width: 1440, height: 900 } },
      },
    },
    {
      name: 'tablet',
      use: { ...devices['iPad (gen 7)'], video: { mode: 'on', size: devices['iPad (gen 7)'].viewport } },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'], video: { mode: 'on', size: devices['iPhone 14'].viewport } },
    },
  ],
});
