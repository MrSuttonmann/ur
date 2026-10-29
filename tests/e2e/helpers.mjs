/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Shared set-up for the end-to-end tests: a page that fails its test on any script error, a seeded
// Math.random so dice and the computer play the same way every run, and opening the game ready to play.

import { test as base, expect } from '@playwright/test';

// the game's scripts share one scope, so page.evaluate can reach `game`, `render`, `makeMove` and the rest by name

// every test's page collects its uncaught script errors, and the test fails if there were any
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.stack || error.message));
    await use(page);
    expect(errors, 'no script errors').toEqual([]);
  },
});
export { expect };

const DEFAULT_SEED = 20260101;

// What a test starts with: the guided first game already seen (unless it plays a new player), and the given
// preferences. Only written when absent, so a reload keeps whatever the game has saved since.
const BASE_PREFS = { autoMove: true, backdrop: 'none' };

// Math.random, seeded (mulberry32), installed before any of the game's scripts run
function installSeededRandom(seed) {
  let state = seed >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedStorage({ prefs, newPlayer }) {
  if (localStorage.getItem('ur-prefs') === null) {
    if (!newPlayer) localStorage.setItem('ur-guide-done', '1');
    localStorage.setItem('ur-prefs', JSON.stringify(prefs));
  }
}

// open the game on its set-up board (or at `url`, such as an invite link), with the given preferences and random
// seed; a new player hasn't seen the guided first game
export async function openGame(page, { prefs = {}, seed = DEFAULT_SEED, newPlayer = false, url = '/' } = {}) {
  await page.addInitScript(installSeededRandom, seed);
  await page.addInitScript(seedStorage, { prefs: { ...BASE_PREFS, ...prefs }, newPlayer });
  await page.goto(url);
  await waitForBoot(page);
}

// Runs the game `rate` times faster, motion still on: every animation (hops, glides) plays faster, and every
// timer (the computer's pauses, the dice tumbling) fires sooner, so a whole game fits in a test while drawing
// exactly what it would at normal speed.
export async function speedUpGame(page, rate) {
  const session = await page.context().newCDPSession(page);
  await session.send('Animation.enable');
  await session.send('Animation.setPlaybackRate', { playbackRate: rate });
  await page.evaluate((rate) => {
    const realSetTimeout = window.setTimeout,
      realSetInterval = window.setInterval;
    window.setTimeout = (fn, ms = 0, ...args) => realSetTimeout(fn, ms / rate, ...args);
    window.setInterval = (fn, ms = 0, ...args) => realSetInterval(fn, ms / rate, ...args);
  }, rate);
}

// A game's start scrolls the page to the upper player's tray, smoothly. Clicking during that scroll can miss, as
// the click is aimed where the target was, so this waits until the scroll has arrived, or the page can't go further.
export async function waitForGameInView(page) {
  await page.waitForFunction(() => {
    const top = Math.min(...['tray0', 'tray1'].map((id) => document.getElementById(id).getBoundingClientRect().top));
    const furthest = document.documentElement.scrollHeight - innerHeight;
    return Math.abs(top - 8) <= 1 || scrollY >= furthest - 1;
  });
}

// the last script has run and the board is laid out
export async function waitForBoot(page) {
  await page.waitForFunction(() => typeof game === 'object' && game !== null);
}
