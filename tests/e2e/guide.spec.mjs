/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// A new player is offered the guided first game on the set-up board, rather than put straight into it.

import { test, expect, openGame } from './helpers.mjs';

test('a new player is offered the guided game, and saying yes starts it', async ({ page }) => {
  await openGame(page, { newPlayer: true });
  const offer = page.locator('#welcome-dlg');
  await expect(offer).toBeVisible();
  expect(await page.evaluate(() => game.phase), 'the set-up board waits behind the offer').toBe('setup');
  await expect(page.locator('#welcome-yes')).toBeFocused();

  await page.locator('#welcome-yes').click();
  await expect(offer).toBeHidden();
  expect(await page.evaluate(() => ({ guided: game.guided, level: game.level, phase: game.phase }))).toMatchObject({
    guided: true,
    level: 'easy',
  });
});

test('saying no leaves the set-up board, and the offer is not made again', async ({ page }) => {
  await openGame(page, { newPlayer: true });
  await page.locator('#welcome-no').click();
  await expect(page.locator('#welcome-dlg')).toBeHidden();
  expect(await page.evaluate(() => ({ guided: game.guided, phase: game.phase }))).toEqual({
    guided: false,
    phase: 'setup',
  });

  await page.reload();
  await page.waitForFunction(() => !document.documentElement.classList.contains('booting'));
  await expect(page.locator('#welcome-dlg')).toBeHidden();
});

test('closing the offer with Escape counts as no', async ({ page }) => {
  await openGame(page, { newPlayer: true });
  await expect(page.locator('#welcome-dlg')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#welcome-dlg')).toBeHidden();
  expect(await page.evaluate(() => [game.guided, guideDone()])).toEqual([false, true]);
});

test('a player who has seen the guide is not offered it', async ({ page }) => {
  await openGame(page);
  await page.waitForFunction(() => !document.documentElement.classList.contains('booting'));
  await expect(page.locator('#welcome-dlg')).toBeHidden();
});
