/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Pure game logic: the board, the rules and the computer opponent. Nothing in this file touches the page.

// ---------- sides ----------
const SUN = 0, MOON = 1;
const SIDES = [SUN, MOON];
const SIDE_NAME = { [SUN]: 'Sun', [MOON]: 'Moon' };
const COMPUTER_SIDE = MOON;          // when playing the computer, it always takes the Moon…
const HUMAN_SIDE = SUN;              // …and you take the Sun (also the guided game's side)
const opponentOf = side => side === SUN ? MOON : SUN;

// ---------- the board ----------
// board rows, top to bottom; each side has its own outer row, and the middle row is shared
const ROW = { MOON: 0, SHARED: 1, SUN: 2 };
const BOARD_ROWS = 3, BOARD_COLUMNS = 8;
const cellKey = ([row, column]) => row + ',' + column;
const ROSE_CELLS = new Set(['0,0', '0,6', '1,3', '2,0', '2,6']);
const CENTRE_CELL = '1,3';
// the Moon's half of the board mirrors the Sun's
const mirrorRow = row => row === ROW.SUN ? ROW.MOON : row === ROW.MOON ? ROW.SUN : row;

// ---------- routes ----------
// A route lists the cells a Sun counter visits, square 1 first; the Moon's is the same, mirrored.
// Counters wait in the tray (square 0) and leave the board one step past the last square.
const SUN_ENTRY = [[2, 3], [2, 2], [2, 1], [2, 0]];             // squares 1–4: right to left along your own row
const MIDDLE_ROW = column => [ROW.SHARED, column];
const ROUTES = {
  // Finkel's route: along the middle row, then back into your own row for the last two squares
  finkel: [...SUN_ENTRY, ...[0, 1, 2, 3, 4, 5, 6, 7].map(MIDDLE_ROW), [2, 7], [2, 6]],
  // James Masters' route: stop one short on the middle row, then loop round the far end of the board
  // through the opponent's row and back into your own (16 squares)
  masters: [...SUN_ENTRY, ...[0, 1, 2, 3, 4, 5, 6].map(MIDDLE_ROW), [0, 6], [0, 7], [1, 7], [2, 7], [2, 6]],
};
const IN_TRAY = 0;

// Everything the rules need to know about a route, worked out once per variant: each side's cells,
// which square sits on which cell, which squares are roses, and which are shared with the opponent.
function buildRules(variant) {
  const sunCells = ROUTES[variant.route];
  const cells = { [SUN]: sunCells, [MOON]: sunCells.map(([row, column]) => [mirrorRow(row), column]) };
  const squareAt = {};   // squareAt[side][cellKey] = that side's square number on the cell
  for (const side of SIDES) squareAt[side] = Object.fromEntries(cells[side].map((cell, i) => [cellKey(cell), i + 1]));
  const roses = new Set(), shared = new Set();   // the board is symmetric, so these hold for both sides
  sunCells.forEach((cell, i) => {
    const key = cellKey(cell), square = i + 1;
    if (ROSE_CELLS.has(key)) roses.add(square);
    if (key in squareAt[MOON]) shared.add(square);
  });
  return { ...variant, cells, squareAt, roses, shared,
    length: sunCells.length, home: sunCells.length + 1, centre: squareAt[SUN][CENTRE_CELL], lastShared: Math.max(...shared) };
}

// ---------- dice ----------
// four tetrahedral dice, each with two of four tips marked: chances of rolling 0 to 4
const MAX_ROLL = 4;
const ROLL_CHANCE = [1, 4, 6, 4, 1].map(ways => ways / 16);

// ---------- rule variants ----------
// Classic is Finkel's reconstruction; Masters' route is James Masters'; the others are house variants.
// Adding a variant means adding an entry here (and a route above if it needs a new one).
const VARIANT_DEFINITIONS = {
  classic: { name: 'Classic', route: 'finkel', counters: 7, safeRoses: true, captureRoll: false, house: false },
  masters: { name: 'Masters’ route', route: 'masters', counters: 7, safeRoses: true, captureRoll: false, house: false },
  quick: { name: 'Quick', route: 'finkel', counters: 5, safeRoses: true, captureRoll: false, house: true },
  raiders: { name: 'Raiders', route: 'finkel', counters: 7, safeRoses: false, captureRoll: true, house: true },
};
const VARIANTS = Object.fromEntries(Object.entries(VARIANT_DEFINITIONS).map(([id, definition]) => [id, buildRules(definition)]));
let currentRules = VARIANTS.classic;
const COUNT_WORD = { 5: 'five', 7: 'seven' };

// the board cell [row, column] a side's route square sits on
const routeCell = (side, square, rules = currentRules) => rules.cells[side][square - 1];
const isRose = (square, rules = currentRules) => rules.roses.has(square);
const isSharedSquare = (square, rules = currentRules) => rules.shared.has(square);
// a rose that the opponent's route also crosses, in rules where roses protect
const isSafeSquare = (square, rules = currentRules) => rules.safeRoses && rules.roses.has(square) && rules.shared.has(square);
const rollsAgain = (move, rules = currentRules) => isRose(move.to, rules) || (rules.captureRoll && move.captures >= 0);
// the opponent's square number on the same cell as one of yours (undefined if their route doesn't cross it)
const opponentSquareAt = (side, square, rules) => rules.squareAt[opponentOf(side)][cellKey(routeCell(side, square, rules))];

// ---------- moves ----------
// A move: { counter, from, to, captures } where captures is the index of the opposing counter taken, or -1.
// positions[side][counter] is the route square each counter is on.
function legalMoves(positions, side, roll, rules = currentRules) {
  const moves = [];
  if (!roll) return moves;
  const own = positions[side], theirs = positions[opponentOf(side)];
  const triedSquares = new Set();   // counters on the same square (the tray) make the same move
  own.forEach((from, counter) => {
    if (from === rules.home || triedSquares.has(from)) return;
    triedSquares.add(from);
    const to = from + roll;
    if (to > rules.home) return;                          // bearing off needs the exact roll
    if (to < rules.home && own.includes(to)) return;      // can't land on your own counter
    let captures = -1;
    if (isSharedSquare(to, rules)) {
      // the same cell has a different square number on the opponent's route
      const target = theirs.indexOf(opponentSquareAt(side, to, rules));
      if (target >= 0) {
        if (isSafeSquare(to, rules)) return;        // the safe centre can't be taken
        captures = target;
      }
    }
    moves.push({ counter, from, to, captures });
  });
  return moves;
}
function applyMove(positions, side, move) {
  const next = [positions[SUN].slice(), positions[MOON].slice()];
  next[side][move.counter] = move.to;
  if (move.captures >= 0) next[opponentOf(side)][move.captures] = IN_TRAY;
  return next;
}
const allHome = (positions, side, rules = currentRules) => positions[side].every(square => square === rules.home);

// ---------- computer opponent: expectiminimax over the dice ----------
// How a position is valued. Tuning the opponent's style means changing these, not the search.
const SCORE = {
  perSquare: 1,            // progress along the route
  home: 22,                // a counter borne off
  safeRose: 4,             // holding a safe rose the opponent wants (the centre, in the classic rules)
  rosette: 1.5,            // sitting on any other rose
  lastStretch: 1,          // past the last shared square, out of danger
  riskPerSquare: 1,        // expected loss if captured scales with how far a counter has come…
  riskExtra: 2,            // …plus a little for the turn it costs
};
const WIN = 10000;
const SEARCH_DEPTH = { easy: 1, medium: 2, hard: 4 };
const EASY_RANDOM_MOVE_CHANCE = 0.4;
const SCORE_TIE = 1e-9;

// chance that some opposing counter lands exactly on `side`'s `square` with its next roll
function captureRisk(positions, side, square, rules = currentRules) {
  const theirSquare = opponentSquareAt(side, square, rules);
  if (theirSquare === undefined) return 0;
  let risk = 0;
  const gaps = new Set();
  for (const theirs of positions[opponentOf(side)]) {
    const gap = theirSquare - theirs;
    if (gap >= 1 && gap <= MAX_ROLL && !gaps.has(gap)) { gaps.add(gap); risk += ROLL_CHANCE[gap]; }
  }
  return Math.min(risk, 1);
}
function sideValue(positions, side, rules) {
  let value = 0;
  for (const square of positions[side]) {
    if (square === rules.home) { value += SCORE.home; continue; }
    if (square === IN_TRAY) continue;
    value += square * SCORE.perSquare;
    if (isSafeSquare(square, rules)) value += SCORE.safeRose;
    else if (isRose(square, rules)) value += SCORE.rosette;
    if (square > rules.lastShared) value += SCORE.lastStretch;
    if (isSharedSquare(square, rules) && !isSafeSquare(square, rules))
      value -= captureRisk(positions, side, square, rules) * (square * SCORE.riskPerSquare + SCORE.riskExtra);
  }
  return value;
}
const positionScore = (positions, side, rules) => sideValue(positions, side, rules) - sideValue(positions, opponentOf(side), rules);

// the expected score over every roll for the side about to roll
function expectedOverRolls(positions, toMove, depth, me, rules) {
  let expected = 0;
  for (let roll = 0; roll <= MAX_ROLL; roll++) expected += ROLL_CHANCE[roll] * bestAfterRoll(positions, toMove, roll, depth, me, rules);
  return expected;
}
// the score after the side to move makes its best move with this roll (best for them, worst for us)
function bestAfterRoll(positions, toMove, roll, depth, me, rules) {
  const moves = legalMoves(positions, toMove, roll, rules);
  if (!moves.length) return depth <= 1 ? positionScore(positions, me, rules) : expectedOverRolls(positions, opponentOf(toMove), depth - 1, me, rules);
  const ourTurn = toMove === me;
  let best = ourTurn ? -Infinity : Infinity;
  for (const move of moves) {
    const score = scoreAfterMove(positions, toMove, move, depth, me, rules);
    if (ourTurn ? score > best : score < best) best = score;
  }
  return best;
}
// the score once `side` has made `move`, looking `depth` turns ahead
function scoreAfterMove(positions, side, move, depth, me, rules) {
  const next = applyMove(positions, side, move);
  if (allHome(next, side, rules)) return side === me ? WIN + depth : -WIN - depth;   // sooner wins score higher
  if (depth <= 1) return positionScore(next, me, rules);
  const nextToMove = rollsAgain(move, rules) ? side : opponentOf(side);
  return expectedOverRolls(next, nextToMove, depth - 1, me, rules);
}
// the computer's choice of move at a given strength
function chooseComputerMove(positions, side, roll, level, rules = currentRules) {
  const moves = legalMoves(positions, side, roll, rules);
  if (moves.length === 1) return moves[0];
  if (level === 'easy' && Math.random() < EASY_RANDOM_MOVE_CHANCE) return moves[Math.floor(Math.random() * moves.length)];
  const depth = SEARCH_DEPTH[level] || SEARCH_DEPTH.medium;
  let best = [], bestScore = -Infinity;
  for (const move of moves) {
    const score = scoreAfterMove(positions, side, move, depth, side, rules);
    if (score > bestScore + SCORE_TIE) { bestScore = score; best = [move]; }
    else if (Math.abs(score - bestScore) <= SCORE_TIE) best.push(move);
  }
  return best[Math.floor(Math.random() * best.length)];
}
