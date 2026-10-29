/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Background music: kept out of the page, started by the first tap with a fade in, stopped by the Music button.

import { test, expect, openGame } from './helpers.mjs';

const MEDIA_ELEMENTS = 'audio, video';
const FADE_IN_MS = 1500; // the game's own fade-in time
const PLAYBACK_WAIT_MS = FADE_IN_MS + 5000; // the fade, plus loading the track

test('music starts on the first tap, fades in, and the Music button stops it', async ({ page }) => {
  await openGame(page, { prefs: { music: true } });

  await test.step('the page holds no audio or video elements', async () => {
    await expect(page.locator(MEDIA_ELEMENTS)).toHaveCount(0);
    expect(await page.evaluate(() => musicPlayer.paused), 'nothing plays before a tap').toBe(true);
  });

  await test.step('the music starts on the first tap and fades in', async () => {
    await page.mouse.click(5, 5); // a corner of the page, away from any control
    await page.waitForFunction(
      () => !musicPlayer.paused && musicPlayer.currentTime > 0 && musicPlayer.volume > 0,
      null,
      { timeout: PLAYBACK_WAIT_MS },
    );
    await expect(page.locator(MEDIA_ELEMENTS), 'still none after it starts').toHaveCount(0);
    await expect(page.locator('#now-playing')).toContainText('Now playing');
  });

  await test.step('the Music button stops it', async () => {
    await page.locator('#music').click();
    await page.waitForFunction(() => musicPlayer.paused);
    expect(await page.evaluate(() => document.querySelector('#music').getAttribute('aria-pressed'))).toBe('false');
  });
});
