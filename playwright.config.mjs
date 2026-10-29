/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// End-to-end tests: the game served as a static site, played in headless Chromium. They play the source, or,
// with SITE_ROOT=dist, the built site as it's deployed (on its own port, so a running source server isn't reused).
// The online tests also need the Worker, built and run by `wrangler dev`.

import { defineConfig, devices } from '@playwright/test';

const SOURCE_PORT = 4173;
const BUILT_SITE_PORT = 4174;
const WORKER_PORT = 8788; // keep in step with ONLINE_URL in tests/e2e/online-helpers.mjs
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
  webServer: [
    {
      command: `node tests/serve.mjs ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !CI,
    },
    // The online tests' Worker and rooms, run locally with the test hooks on. It has a port and rooms of its own,
    // so a running `npm run dev` (on 8787, without the hooks) is never reused, nor its rooms shared.
    {
      command: `npm run build && npx wrangler dev --env e2e --port ${WORKER_PORT} --persist-to .wrangler/e2e-state`,
      url: `http://localhost:${WORKER_PORT}`,
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
