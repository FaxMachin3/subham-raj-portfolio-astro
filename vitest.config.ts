/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

const coverage = process.env.COVERAGE === '1';

export default getViteConfig({
  // Production JSX (`jsx`, not `jsxDEV`): components compile the same way as in the build, so unit and
  // browser coverage map onto identical code and merge exactly.
  oxc: { jsx: { development: false } },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.tsx'],
    environment: 'node',
    restoreMocks: true,
    setupFiles: ['tests/setup/match-media.ts', ...(coverage ? ['tests/setup/v8-coverage.ts'] : [])],
    globalSetup: ['tests/setup/content-store.ts', ...(coverage ? ['coverage-config/unit-setup.mjs'] : [])],
  },
});
