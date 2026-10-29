/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Unit tests for js/turns.js, through the shared module the server also uses (npm run build:shared makes it).

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { SUN, MOON, VARIANTS, createGameStats, recordMove, describeMove } from '../../worker/generated/shared.mjs';

const rules = VARIANTS.classic;
const positionsOf = (sun, moon) => [sun, moon];

describe('recordMove', () => {
  test('counts a capture for the mover and a loss for the victim', () => {
    const stats = createGameStats();
    const after = positionsOf([7, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]);
    recordMove(stats, after, SUN, { counter: 0, from: 5, to: 7, captures: 2 }, false, rules);
    assert.equal(stats.bySide[SUN].captures, 1);
    assert.equal(stats.bySide[MOON].lost, 1);
    assert.equal(stats.bySide[SUN].moves, 1);
    assert.equal(stats.bySide[SUN].squaresTravelled, 2);
  });

  test('extends the rose chain', () => {
    const stats = createGameStats();
    const after = positionsOf([4, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]);
    recordMove(stats, after, SUN, { counter: 0, from: 0, to: 4, captures: -1 }, true, rules);
    recordMove(stats, after, SUN, { counter: 0, from: 4, to: 4, captures: -1 }, true, rules);
    assert.equal(stats.bySide[SUN].roseChain, 2);
    assert.equal(stats.bySide[SUN].longestRoseChain, 2);
  });
});

describe('describeMove', () => {
  test('words an entry onto a rose that rolls again', () => {
    const move = { counter: 0, from: 0, to: 4, captures: -1 };
    assert.equal(describeMove(SUN, move, true, true, rules), 'entered a piece to 4, landed on a rose and rolls again');
  });

  test('words a move home', () => {
    const move = { counter: 0, from: 12, to: rules.home, captures: -1 };
    assert.equal(describeMove(SUN, move, false, false, rules), 'brought a piece home');
  });
});
