/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Unit tests for js/rules.js. It has no page code, so it runs in Node on its own: it's a plain script, not a
// module, so it's loaded into a vm context and the names it declares are gathered from there.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, describe } from 'node:test';
import vm from 'node:vm';

const RULES_SCRIPT = new URL('../../js/rules.js', import.meta.url);
const EXPORTED_NAMES = [
  'SUN',
  'MOON',
  'IN_TRAY',
  'VARIANTS',
  'routeCell',
  'legalMoves',
  'applyMove',
  'allHome',
  'chooseComputerMove',
  'captureRisk',
  'ROLL_CHANCE',
  'isSafeSquare',
  'cellKey',
  'isCentre',
];
const RANDOM_SEED = 20260101;

// a seeded Math.random (mulberry32), so random positions and the computer's random moves repeat every run
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadRules() {
  const context = vm.createContext({ seededRandom: seededRandom(RANDOM_SEED) });
  // top-level const and function names stay in the script's scope, so the script hands them out itself
  const source = `Math.random = seededRandom;\n${readFileSync(RULES_SCRIPT, 'utf8')}\n;this.exported = { ${EXPORTED_NAMES.join(', ')} };`;
  vm.runInContext(source, context, { filename: 'js/rules.js' });
  return context.exported;
}

const R = loadRules();
const random = seededRandom(RANDOM_SEED);
const { classic, raiders, masters, murray, doubling } = R.VARIANTS;
const COUNTERS = 7;
const EPSILON = 1e-12;

const emptyBoard = (counters = COUNTERS) => [Array(counters).fill(R.IN_TRAY), Array(counters).fill(R.IN_TRAY)];
const route = (rules, side = R.SUN) =>
  Array.from({ length: rules.length }, (_, i) => R.cellKey(R.routeCell(side, i + 1, rules))).join(' ');
const cellOf = (side, square, rules) => R.cellKey(R.routeCell(side, square, rules));
const assertClose = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < EPSILON, `${message ?? ''} ${actual} vs ${expected}`);
const canMoveTo = (positions, side, roll, rules, square) =>
  R.legalMoves(positions, side, roll, rules).some((move) => move.to === square);
const canMoveFrom = (positions, side, roll, rules, square) =>
  R.legalMoves(positions, side, roll, rules).some((move) => move.from === square);
const moveTo = (positions, side, roll, rules, square) =>
  R.legalMoves(positions, side, roll, rules).find((move) => move.to === square);
// a board with the given squares occupied: { sun: [...], moon: [...] }, counter 0 first
function board({ sun = [], moon = [] }) {
  const positions = emptyBoard();
  sun.forEach((square, counter) => (positions[R.SUN][counter] = square));
  moon.forEach((square, counter) => (positions[R.MOON][counter] = square));
  return positions;
}

describe('classic', () => {
  test('the route matches the original mapping for every square', () => {
    // the hand-written mapping the game used before routes were data
    const originalCell = (side, square) => {
      const ownRow = side === R.SUN ? 2 : 0;
      if (square <= 4) return [ownRow, 4 - square];
      if (square <= 12) return [1, square - 5];
      return [ownRow, 20 - square];
    };
    for (const side of [R.SUN, R.MOON])
      for (let square = 1; square <= classic.length; square++)
        assert.equal(String(R.routeCell(side, square, classic)), String(originalCell(side, square)));
  });

  test('14 squares, home is 15, roses 4/8/14, shared 5–12, centre 8', () => {
    assert.equal(classic.length, 14);
    assert.equal(classic.home, 15);
    assert.equal([...classic.roses].join(), '4,8,14');
    assert.equal([...classic.shared].join(), '5,6,7,8,9,10,11,12');
    assert.ok(R.isCentre(R.SUN, 8, classic) && R.isCentre(R.MOON, 8, classic));
  });

  test('rolling 0 gives no moves', () => {
    assert.equal(R.legalMoves(emptyBoard(), R.SUN, 0, classic).length, 0);
  });

  test('from the start, one move: enter to square 4', () => {
    const moves = R.legalMoves(emptyBoard(), R.SUN, 4, classic);
    assert.equal(moves.length, 1);
    assert.equal(moves[0].from, 0);
    assert.equal(moves[0].to, 4);
  });

  test("can't land on your own counter", () => {
    assert.ok(!canMoveTo(board({ sun: [2, 4] }), R.SUN, 2, classic, 4));
  });

  test('the safe centre blocks a capture in Classic', () => {
    assert.ok(!canMoveTo(board({ sun: [6], moon: [8] }), R.SUN, 2, classic, 8));
  });

  test('Raiders allows capturing on the centre, and a capture sends the counter back to the tray', () => {
    const positions = board({ sun: [6], moon: [8] });
    const raid = moveTo(positions, R.SUN, 2, raiders, 8);
    assert.ok(raid);
    assert.equal(raid.captures, 0);
    const after = R.applyMove(positions, R.SUN, raid);
    assert.equal(after[R.MOON][0], R.IN_TRAY);
    assert.equal(after[R.SUN][0], 8);
  });

  test('bearing off needs the exact roll', () => {
    const positions = board({ sun: [13] });
    assert.ok(canMoveTo(positions, R.SUN, 2, classic, classic.home));
    assert.ok(!canMoveFrom(positions, R.SUN, 3, classic, 13));
  });

  test('all home is a win', () => {
    assert.ok(R.allHome([Array(COUNTERS).fill(classic.home), Array(COUNTERS).fill(0)], R.SUN, classic));
  });

  test('roll chances add up to 1', () => {
    assertClose(
      R.ROLL_CHANCE.reduce((sum, chance) => sum + chance, 0),
      1,
    );
  });

  test('capture risk two squares ahead is 6 in 16', () => {
    assertClose(R.captureRisk(board({ moon: [4] }), R.SUN, 6, classic), 6 / 16);
  });
});

describe("Masters' route", () => {
  test('the Sun route follows the diagram', () => {
    assert.equal(route(masters), '2,3 2,2 2,1 2,0 1,0 1,1 1,2 1,3 1,4 1,5 1,6 0,6 0,7 1,7 2,7 2,6');
  });

  test('16 squares, home is 17, roses 4/8/12/16, shared 5–16', () => {
    assert.equal(masters.length, 16);
    assert.equal(masters.home, 17);
    assert.equal([...masters.roses].join(), '4,8,12,16');
    assert.equal([...masters.shared].join(), '5,6,7,8,9,10,11,12,13,14,15,16');
  });

  test('the Moon route is the mirror', () => {
    assert.equal(cellOf(R.MOON, 12, masters), '2,6');
    assert.equal(cellOf(R.MOON, 16, masters), '0,6');
  });

  // the Sun's square 13 (cell 0,7) is the Moon's square 15
  test('captures across different square numbers on the same cell', () => {
    const cross = moveTo(board({ sun: [11], moon: [15] }), R.SUN, 2, masters, 13);
    assert.ok(cross);
    assert.equal(cross.captures, 0);
  });

  test('risk is measured on the opponent’s numbering', () => {
    assert.equal(R.captureRisk(board({ sun: [11], moon: [15] }), R.MOON, 15, masters), R.ROLL_CHANCE[2]);
  });

  // the Sun's 12 (cell 0,6) is the Moon's 16, a contested rose
  test('a contested rose is safe', () => {
    assert.ok(R.isSafeSquare(12, masters));
    assert.ok(!canMoveTo(board({ sun: [10], moon: [16] }), R.SUN, 2, masters, 12));
  });

  test('bearing off from 15 needs a 2', () => {
    const positions = board({ sun: [15] });
    assert.ok(canMoveTo(positions, R.SUN, 2, masters, masters.home));
    assert.ok(!canMoveFrom(positions, R.SUN, 3, masters, 15));
  });

  test('same-index squares are not confused (Sun 13 vs Moon 13)', () => {
    const move = moveTo(board({ sun: [11], moon: [13] }), R.SUN, 2, masters, 13);
    assert.ok(move);
    assert.equal(move.captures, -1);
  });
});

describe("Murray's route", () => {
  test('follows Masters, then back down the middle and along your own row', () => {
    assert.equal(
      route(murray),
      '2,3 2,2 2,1 2,0 1,0 1,1 1,2 1,3 1,4 1,5 1,6 0,6 0,7 1,7 2,7 2,6 1,6 1,5 1,4 1,3 1,2 1,1 1,0 2,0 2,1 2,2 2,3',
    );
  });

  test('27 squares, home is 28, a rose every fourth square', () => {
    assert.equal(murray.length, 27);
    assert.equal(murray.home, 28);
    assert.equal([...murray.roses].join(), '4,8,12,16,20,24');
  });

  test('the centre is squares 8 and 20', () => {
    assert.ok(R.isCentre(R.SUN, 8, murray) && R.isCentre(R.SUN, 20, murray));
  });

  test('your own counter on 27 blocks entering on 1 (the same cell)', () => {
    assert.ok(!canMoveFrom(board({ sun: [27] }), R.SUN, 1, murray, 0));
  });

  // cell 1,4 is Sun 9 on the way out and Moon 19 on the way back
  test('an outbound counter captures a homebound one on the same cell', () => {
    const capture = moveTo(board({ sun: [7], moon: [19] }), R.SUN, 2, murray, 9);
    assert.ok(capture);
    assert.equal(capture.captures, 0);
  });

  test('the centre is safe on the way back too', () => {
    assert.ok(!canMoveTo(board({ sun: [18], moon: [20] }), R.SUN, 2, murray, 20));
  });

  // a Moon counter on 6 reaches 1,4 (its 9) with a 3; one on 17 reaches it (its 19) with a 2
  test('risk counts counters heading either way', () => {
    assertClose(R.captureRisk(board({ moon: [6, 17] }), R.SUN, 9, murray), R.ROLL_CHANCE[3] + R.ROLL_CHANCE[2]);
  });
});

describe('Doubling back', () => {
  test('the Sun route follows the Wikipedia diagram', () => {
    assert.equal(route(doubling), '2,0 2,1 2,2 2,3 1,3 1,4 1,5 1,6 2,6 2,7 1,7 0,7 0,6 1,6 1,5 1,4 1,3 1,2 1,1 1,0');
  });

  test('20 squares, home is 21, a rose every fourth square', () => {
    assert.equal(doubling.length, 20);
    assert.equal(doubling.home, 21);
    assert.equal([...doubling.roses].join(), '1,5,9,13,17');
  });

  test('the Moon route is the mirror', () => {
    assert.ok(route(doubling, R.MOON).startsWith('0,0 0,1 0,2 0,3 1,3'));
    assert.equal(cellOf(R.MOON, 9, doubling), '0,6');
  });

  test('your counter on 17 blocks moving onto 5 (both the centre)', () => {
    assert.ok(!canMoveTo(board({ sun: [4, 17] }), R.SUN, 1, doubling, 5));
  });

  test('a homebound counter captures an outbound one (Sun 16 and Moon 6 are both 1,4)', () => {
    const back = moveTo(board({ sun: [13], moon: [6] }), R.SUN, 3, doubling, 16);
    assert.ok(back);
    assert.equal(back.captures, 0);
  });

  test('bearing off from 19 needs a 2', () => {
    const positions = board({ sun: [19] });
    assert.ok(canMoveTo(positions, R.SUN, 2, doubling, doubling.home));
    assert.ok(!canMoveFrom(positions, R.SUN, 3, doubling, 19));
  });

  test('the corner rose (square 1) is private, so not marked safe', () => {
    assert.ok(!R.isSafeSquare(1, doubling));
    assert.ok(R.isSafeSquare(9, doubling) && R.isSafeSquare(13, doubling));
  });
});

describe('the computer', () => {
  const TRIALS = 60;
  const LEVELS = ['easy', 'medium'];
  const ROLLS = [1, 2, 3, 4];
  const IN_TRAY_WEIGHT = 3; // three in four counters wait in the tray, the rest anywhere on the route or home

  // a random position that could happen in play: no two counters, of either side, on one cell
  function randomPosition(rules) {
    const pick = (count) => Math.floor(random() * count);
    const positions = [0, 1].map(() =>
      Array.from({ length: COUNTERS }, () => (pick(IN_TRAY_WEIGHT + 1) < IN_TRAY_WEIGHT ? 0 : pick(rules.home + 1))),
    );
    const taken = new Set();
    for (const side of [R.SUN, R.MOON])
      positions[side] = positions[side].map((square) => {
        if (square === 0 || square === rules.home) return square;
        const key = cellOf(side, square, rules);
        if (taken.has(key)) return 0;
        taken.add(key);
        return square;
      });
    return positions;
  }

  for (const [name, rules] of [
    ['classic', classic],
    ['Masters', masters],
    ['Murray', murray],
    ['Doubling', doubling],
  ])
    test(`always picks a legal move (${name})`, () => {
      for (let trial = 0; trial < TRIALS; trial++) {
        const positions = randomPosition(rules);
        for (const roll of ROLLS)
          for (const level of LEVELS) {
            const moves = R.legalMoves(positions, R.MOON, roll, rules);
            if (!moves.length) continue;
            const choice = R.chooseComputerMove(positions, R.MOON, roll, level, rules);
            assert.ok(
              moves.some((move) => move.counter === choice.counter && move.to === choice.to),
              `illegal ${JSON.stringify(choice)} from ${JSON.stringify(positions)}, roll ${roll}, ${level}`,
            );
          }
      }
    });
});
