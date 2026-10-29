/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Learning against the Squire: danger shading on the squares he could reach, and Undo. Neither against Sir Knight.

import { test, expect, openGame } from './helpers.mjs';

const LEARNER_PREFS = { autoMove: false, music: false };
const SHARED_SQUARES_AHEAD = [5, 6, 7, 9]; // the Sun's counter sits on 6, with Moon counters on 3 and 4 behind
const SUN_SQUARE = 6;
const OWN_ROW_SQUARE = 2;
const SKILL_HONOURS = ['untouchable', 'hunter', 'clean-sweep'];
// Longer than the Squire takes to roll and move (about 2.2 s), so if he were going to move, he would have.
const SQUIRE_TURN_MS = 2500;
const BLANK_DIE_RANDOM = 0.9; // a die shows its marked tip when Math.random() is under one half

// start a game against the given opponent and hold it at the Sun's move, a roll of 2 with a choice of moves
async function startAtSunsMove(page, level) {
  await openGame(page, { prefs: LEARNER_PREFS });
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.evaluate(
    ({ level, sunSquare }) => {
      $('level').value = level;
      document.getElementById('newgame').click();
      clearTimeout(pendingStep);
      game.positions[SUN] = game.positions[SUN].map((square, counter) => (counter === 0 ? sunSquare : 0));
      game.positions[MOON] = game.positions[MOON].map((square, counter) => (counter === 0 ? 4 : counter === 1 ? 3 : 0));
      game.turn = SUN;
      game.phase = 'move';
      game.roll = 2;
      game.dice = [1, 1, 0, 0];
      render();
    },
    { level, sunSquare: SUN_SQUARE },
  );
}

// move the Sun's counter 0 on by the roll of 2 (onto the centre rose, so the Sun rolls again)
const moveFirstCounter = (page) =>
  page.evaluate(() => makeMove(legalMoves(game.positions, SUN, 2).find((move) => move.counter === 0)));
const boardNow = (page) => page.evaluate(() => JSON.stringify(game.positions));

test('danger shading against the Squire matches his risk, and the board key explains it', async ({ page }) => {
  await startAtSunsMove(page, 'easy');
  const board = await page.evaluate(
    ({ squaresAhead, sunSquare, ownRowSquare }) => {
      const washFor = (square) => boardCells[routeCellKey(SUN, square)].querySelector('.danger-wash');
      const read = (square) => ({
        square,
        danger: Number(getComputedStyle(washFor(square)).getPropertyValue('--danger')),
        label: washFor(square).parentElement.querySelector('.danger-chance').textContent,
      });
      const centre = [...currentRules.shared].find((square) => isSafeSquare(square));
      return {
        ahead: squaresAhead.map(read),
        own: read(ownRowSquare),
        centre: read(centre),
        expected: dangerAt(game.positions, SUN, sunSquare),
        keyShown: !$('key-danger').hidden,
        undoShown: !$('undo').hidden,
        undoDisabled: $('undo').disabled,
      };
    },
    { squaresAhead: SHARED_SQUARES_AHEAD, sunSquare: SUN_SQUARE, ownRowSquare: OWN_ROW_SQUARE },
  );
  expect(
    board.ahead.some((cell) => cell.danger > 0 && cell.label.endsWith('%')),
    'the shared squares the Squire can reach are shaded',
  ).toBe(true);
  const sunCell = board.ahead.find((cell) => cell.square === SUN_SQUARE);
  expect(sunCell.danger, 'the shading matches the risk the AI works out').toBeCloseTo(board.expected, 9);
  expect(board.own.danger, 'your own row is never shaded').toBe(0);
  expect(board.centre.danger, 'the safe centre is never shaded').toBe(0);
  expect(board.keyShown, 'the board key explains the shading').toBe(true);
  expect(board.undoShown && board.undoDisabled, 'Undo shows, but has nothing to undo yet').toBe(true);
});

test('Undo takes back your move once, the Squire waits, and rolling again ends it', async ({ page }) => {
  await startAtSunsMove(page, 'easy');
  const before = await boardNow(page);

  await test.step('after your move, Undo is available', async () => {
    await moveFirstCounter(page);
    await page.waitForFunction(() => canUndo());
    await expect(page.locator('#undo')).toBeEnabled();
  });

  await test.step('Undo puts the board back as it was before your move', async () => {
    await page.locator('#undo').click();
    const after = await page.evaluate(() => ({
      positions: JSON.stringify(game.positions),
      phase: game.phase,
      turn: game.turn,
      roll: game.roll,
      undos: game.undos,
      note: game.note,
      canUndo: canUndo(),
    }));
    expect(after).toMatchObject({ positions: before, phase: 'move', turn: 0, roll: 2 });
    expect(after.canUndo, 'Undo is spent').toBe(false);
    expect(after.undos, 'and counted').toBe(1);
    expect(after.note).toContain('taken back');
  });

  await test.step('the Squire does not move after an undo', async () => {
    // a check that nothing happens can only wait and look
    await page.waitForTimeout(SQUIRE_TURN_MS);
    expect(await boardNow(page)).toBe(before);
    expect(await page.evaluate(() => game.phase)).toBe('move');
  });

  await test.step('rolling again ends the chance to undo', async () => {
    await moveFirstCounter(page);
    await page.waitForFunction(() => game.turn === SUN && game.phase === 'roll');
    await page.evaluate(() => rollDice());
    // the dice have landed: the old move can no longer be taken back
    await page.waitForFunction(() => game.turn === SUN && game.phase === 'move');
    expect(await page.evaluate(() => canUndo())).toBe(false);
  });
});

test('a roll of nothing still spends the chance to undo, so the Squire’s turn brings none back', async ({ page }) => {
  await startAtSunsMove(page, 'easy');
  await moveFirstCounter(page);
  await page.waitForFunction(() => game.turn === SUN && game.phase === 'roll' && canUndo());
  // every die lands blank (Math.random never under one half), so the roll has no move and play passes over
  await page.evaluate((blank) => {
    Math.random = () => blank;
    rollDice();
  }, BLANK_DIE_RANDOM);
  await page.waitForFunction(() => game.turn === MOON);
  expect(await page.evaluate(() => canUndo()), 'Undo stays spent through the Squire’s turn').toBe(false);
  await expect(page.locator('#undo')).toBeDisabled();
});

test('a won game with an undo still earns First Victory, but no skill honours', async ({ page }) => {
  await startAtSunsMove(page, 'easy');
  const earned = await page.evaluate(() => {
    clearTimeout(pendingStep);
    game.undos = 1;
    game.positions[SUN] = game.positions[SUN].map(() => currentRules.home);
    game.stats.bySide[SUN].captures = 5;
    game.stats.bySide[MOON].lost = 0;
    game.stats.bySide[SUN].lost = 0;
    finishGame(SUN);
    return game.newHonours.map((honour) => honour.id);
  });
  expect(earned).toContain('first-win');
  for (const honour of SKILL_HONOURS) expect(earned).not.toContain(honour);
  await expect(page.locator('#undo'), 'Undo hides once the game is over').toBeHidden();
});

test('against Sir Knight there is no shading and no Undo', async ({ page }) => {
  await startAtSunsMove(page, 'medium');
  const knight = await page.evaluate(() => ({
    level: game.level,
    undoHidden: $('undo').hidden,
    keyHidden: $('key-danger').hidden,
    shaded: [...document.querySelectorAll('.danger-wash')].filter(
      (wash) => wash.parentElement.querySelector('.danger-chance').textContent,
    ).length,
  }));
  expect(knight).toEqual({ level: 'medium', undoHidden: true, keyHidden: true, shaded: 0 });
});
