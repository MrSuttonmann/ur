/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// End-to-end tests: the game served as a static site, played in headless Chromium. They play the source, or,
// with SITE_ROOT=dist, the built site as it's deployed (on its own port, so a running source server isn't reused).

import { defineConfig, devices } from '@playwright/test';

const SOURCE_PORT = 4173;
const BUILT_SITE_PORT = 4174;
const PORT = Number(process.env.PORT || (process.env.SITE_ROOT ? BUILT_SITE_PORT : SOURCE_PORT));
const BASE_URL = `http://localhost:${PORT}`;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    headless: true,
    // the tests own the page: a service worker serving cached files would hide changes on disk
    serviceWorkers: 'block',
    launchOptions: { args: ['--mute-audio'] }, // the game plays music
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node tests/serve.mjs ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !CI,
  },
});
