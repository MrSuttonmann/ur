/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Honours: awarded when a game ends, announced in a note, drawn on the result card, listed in the Chronicle,
// and kept after a reload.

import { test, expect, openGame, waitForBoot } from './helpers.mjs';

const TOTAL_HONOURS = 17;
// what winning the staged game below should earn: the first win, beating the Squire, losing no counter,
// winning by all seven, four captures, three roses in a turn, and under five minutes
const EXPECTED_HONOURS = ['first-win', 'squire', 'untouchable', 'clean-sweep', 'hunter', 'garden', 'swift'];
const MIN_CARD_BYTES = 20_000; // a drawn 1200×630 card; a blank or failed one is far smaller
const CARD_FILE_NAME = 'royal-game-of-ur-result.png';
const PLAY_MINUTES = 4;
const NOTE_WAIT_MS = 10_000; // the note waits for the end banner (3.6 s) to go first

// Against the Squire, with everything home but one Sun counter, which then makes the winning move. The stats
// are set to earn a known set of honours.
function playWinningMove(playMs) {
  clearTimeout(pendingStep);
  const home = currentRules.home;
  game.positions[SUN] = game.positions[SUN].map((square, counter) => (counter === 0 ? home - 2 : home));
  game.positions[MOON] = game.positions[MOON].map((square, counter) => (counter < 3 ? 6 + counter : 0));
  Object.assign(game.stats.bySide[SUN], { moves: 30, home: 6, captures: 4, roses: 5, longestRoseChain: 3 });
  Object.assign(game.stats.bySide[MOON], { moves: 27, home: 0, captures: 0, lost: 4 });
  game.stats.playMs = playMs;
  game.turn = SUN;
  game.phase = 'move';
  game.roll = 2;
  render();
  makeMove(legalMoves(game.positions, SUN, 2).find((move) => move.to === home));
}

test('honours are awarded, announced, shared and kept', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 1000 });
  await openGame(page);
  await page.evaluate(() => {
    $('level').value = 'easy';
    document.getElementById('newgame').click();
  });
  await page.evaluate(playWinningMove, PLAY_MINUTES * 60 * 1000);
  await page.waitForFunction(() => game.phase === 'over');

  const over = await page.evaluate(() => ({
    earned: game.newHonours.map((honour) => honour.id),
    share: Boolean(document.getElementById('share-result')),
    noteHidden: $('honour-note').hidden,
  }));
  await test.step('the game ends with the expected honours', () => {
    expect(over.earned).toEqual(expect.arrayContaining(EXPECTED_HONOURS));
    expect(over.earned).not.toContain('king');
  });
  await test.step('a Share result button shows', () => expect(over.share).toBe(true));

  await test.step('the honour note shows after the banner', async () => {
    expect(over.noteHidden, 'hidden while the banner shows').toBe(true);
    await expect(page.locator('#honour-note')).toBeVisible({ timeout: NOTE_WAIT_MS });
    await expect(page.locator('#honour-note')).toContainText('Squire Bested');
  });

  await test.step('the result card is drawn', async () => {
    const card = await page.evaluate(async () => {
      const ready = await resultCard;
      return ready && { name: ready.file.name, type: ready.file.type, size: ready.file.size };
    });
    expect(card).toMatchObject({ name: CARD_FILE_NAME, type: 'image/png' });
    expect(card.size).toBeGreaterThan(MIN_CARD_BYTES);
  });

  await test.step('the shared words keep the opponent played, even if the Opponent choice changes after', async () => {
    const text = await page.evaluate(async () => {
      game.level = 'hard';
      return (await resultCard).text;
    });
    expect(text).toContain('Squire');
    expect(text).not.toContain('King');
  });

  await test.step('Share result saves the card where there is no share sheet', async () => {
    await page.evaluate(() => {
      window.savedFiles = [];
      window.saveFile = (file) => window.savedFiles.push(file.name);
      // headless Chromium may offer navigator.share; take it away so the no-share-sheet path runs
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    });
    await page.locator('#share-result').click();
    await page.waitForFunction(() => window.savedFiles.length > 0);
    expect(await page.evaluate(() => window.savedFiles)).toEqual([CARD_FILE_NAME]);
  });

  await test.step('the Honours tab lists every honour, the earned ones marked', async () => {
    await page.locator('#honour-note').click();
    await page.locator('#open-stats').click();
    await page.locator('[data-tab=honours]').click();
    await expect(page.locator('.honour')).toHaveCount(TOTAL_HONOURS);
    await expect(page.locator('.honour.earned')).toHaveCount(over.earned.length);
    expect(await page.evaluate(() => HONOURS.length)).toBe(TOTAL_HONOURS);
  });

  await test.step('honours are kept after a reload', async () => {
    await page.reload();
    await waitForBoot(page);
    expect(await page.evaluate(() => HONOURS.filter(isEarned).map((honour) => honour.id))).toEqual(
      expect.arrayContaining(over.earned),
    );
    expect(await page.evaluate(() => HONOURS.filter(isEarned).length)).toBe(over.earned.length);
  });
});
