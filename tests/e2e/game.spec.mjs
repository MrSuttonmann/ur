/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Whole games against the computer, motion on: after every redraw, each counter is drawn exactly once, in its place.

import { test, expect, openGame, speedUpGame } from './helpers.mjs';

const VARIANTS = ['classic', 'murray', 'doubling'];
const GAME_LIMIT_MS = 180_000; // Murray's 27-square route makes for a long game, even sped up
const GAME_SPEED = 12; // times normal speed, timers and animations alike
const MIN_RENDERS = 50; // a whole game redraws far more often than this
const MAX_PROBLEMS_REPORTED = 8;

// plays a whole game in the page, the Sun always taking its first legal move, and checks every redraw
function playWholeGame({ variant, limitMs, maxProblems }) {
  const STEP_MS = 60;
  return new Promise((resolve) => {
    const problems = [];
    let renders = 0;
    chooseVariant(variant);
    const realRender = render;
    window.render = function checkedRender() {
      realRender();
      renders++;
      const drawn = new Map();
      document
        .querySelectorAll('[data-pid]')
        .forEach((el) => drawn.set(el.dataset.pid, (drawn.get(el.dataset.pid) || 0) + 1));
      for (const side of SIDES)
        game.positions[side].forEach((square, counter) => {
          const pid = side + '-' + counter;
          const el = document.querySelector(`[data-pid="${pid}"]`);
          if (drawn.get(pid) !== 1) problems.push(`${pid} drawn ${drawn.get(pid) || 0}x`);
          const tray =
            square === IN_TRAY ? `#tray${side} .wait` : square === currentRules.home ? `#tray${side} .home` : null;
          const inPlace =
            el &&
            (tray
              ? el.parentElement === document.querySelector(tray)
              : el.parentElement === squareElement(side, square).querySelector('.slot'));
          if (!inPlace) problems.push(`${pid} misplaced at ${square}`);
        });
      const counters = SIDES.reduce((total, side) => total + game.positions[side].length, 0);
      if (drawn.size !== counters) problems.push(`stray counters: ${drawn.size}`);
    };
    document.getElementById('newgame').click();
    const started = performance.now();
    const step = () => {
      if (game.phase === 'over' || performance.now() - started > limitMs)
        return resolve({
          renders,
          variant: game.variant,
          over: game.phase === 'over',
          problems: [...new Set(problems)].slice(0, maxProblems),
        });
      if (!isComputer(game.turn) && game.phase === 'roll') $('roll').click();
      if (!isComputer(game.turn) && game.phase === 'move') {
        const moves = legalMoves(game.positions, game.turn, game.roll);
        if (moves.length) makeMove(moves[0]);
      }
      setTimeout(step, STEP_MS);
    };
    step();
  });
}

for (const variant of VARIANTS) {
  test(`${variant}: a whole game with every counter drawn once, in its place`, async ({ page }) => {
    test.setTimeout(GAME_LIMIT_MS + 30_000);
    await openGame(page);
    await speedUpGame(page, GAME_SPEED);
    const result = await page.evaluate(playWholeGame, {
      variant,
      limitMs: GAME_LIMIT_MS,
      maxProblems: MAX_PROBLEMS_REPORTED,
    });
    expect(result.variant).toBe(variant);
    expect(result.over, 'the game reached its end').toBe(true);
    expect(result.renders).toBeGreaterThan(MIN_RENDERS);
    expect(result.problems).toEqual([]);
  });
}

// how far the upper player's tray sits from the top of the window, in whole pixels
const upperTrayTop = (page) =>
  page.evaluate(() =>
    Math.round(Math.min(...['tray0', 'tray1'].map((id) => document.getElementById(id).getBoundingClientRect().top))),
  );

test('starting a game scrolls to the top of the upper player’s tray', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // a phone, where the header pushes the board down
  await openGame(page);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.locator('#newgame').click();
  await expect.poll(() => upperTrayTop(page)).toBe(8);
});
