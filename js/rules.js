/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Pure game logic: the board, the rules and the computer opponent. Nothing in this file touches the page.

// ---------- sides ----------
const SUN = 0, MOON = 1;
const SIDES = [SUN, MOON];
const SIDE_NAME = { [SUN]: 'Sun', [MOON]: 'Moon' };
const COMPUTER_SIDE = MOON;          // when playing the computer, it always takes the Moon…
const HUMAN_SIDE = SUN;              // …and you take the Sun (also the guided game's side)
const opponentOf = side => side === SUN ? MOON : SUN;

// ---------- the route ----------
// Each side counts its own route from 1 to 14. 0 means waiting in the tray; HOME means borne off.
const IN_TRAY = 0;
const LAST_PRIVATE_ENTRY_SQUARE = 4;  // squares 1–4 are in the side's own row
const FIRST_SHARED_SQUARE = 5, LAST_SHARED_SQUARE = 12;
const LAST_SQUARE = 14, HOME = 15;
const CENTRE = 8;
const ROSETTES = new Set([4, 8, 14]);
const isSharedSquare = square => square >= FIRST_SHARED_SQUARE && square <= LAST_SHARED_SQUARE;

// board rows, top to bottom, and which row is each side's own
const ROW = { MOON: 0, SHARED: 1, SUN: 2 };
const OWN_ROW = { [SUN]: ROW.SUN, [MOON]: ROW.MOON };
const BOARD_ROWS = 3, BOARD_COLUMNS = 8;
const LAST_COLUMN = BOARD_COLUMNS - 1;

// the board cell [row, column] a side's route square sits on
function routeCell(side, square) {
  const own = OWN_ROW[side];
  if (square <= LAST_PRIVATE_ENTRY_SQUARE) return [own, LAST_PRIVATE_ENTRY_SQUARE - square];       // 1–4: right to left
  if (square <= LAST_SHARED_SQUARE) return [ROW.SHARED, square - FIRST_SHARED_SQUARE];          // 5–12: left to right
  return [own, LAST_COLUMN - (square - LAST_SHARED_SQUARE - 1)];                                // 13–14: from the far end back
}
const cellKey = ([row, column]) => row + ',' + column;

// ---------- dice ----------
// four tetrahedral dice, each with two of four tips marked: chances of rolling 0 to 4
const MAX_ROLL = 4;
const ROLL_CHANCE = [1, 4, 6, 4, 1].map(ways => ways / 16);

// ---------- rule variants ----------
// Classic is Finkel's reconstruction; the others are house variants. Adding a variant means adding an entry here.
const VARIANTS = {
  classic: { name: 'Classic', counters: 7, safeCentre: true, captureRoll: false,
    blurb: 'Irving Finkel’s reconstruction from the British Museum tablet. Seven counters each; roses give another roll and the centre rose is safe.' },
  quick: { name: 'Quick', counters: 5, safeCentre: true, captureRoll: false,
    blurb: 'The classic rules with five counters each, for a game about two-thirds as long.' },
  raiders: { name: 'Raiders', counters: 7, safeCentre: false, captureRoll: true,
    blurb: 'A fiercer game: every capture earns another roll, and the centre rose gives no protection.' },
};
let currentRules = VARIANTS.classic;
const COUNT_WORD = { 5: 'five', 7: 'seven' };

const isSafeSquare = (square, rules) => square === CENTRE && rules.safeCentre;
const rollsAgain = (move, rules = currentRules) => ROSETTES.has(move.to) || (rules.captureRoll && move.captures >= 0);

// ---------- moves ----------
// A move: { counter, from, to, captures } where captures is the index of the opposing counter taken, or -1.
// positions[side][counter] is the route square each counter is on.
function legalMoves(positions, side, roll, rules = currentRules) {
  const moves = [];
  if (!roll) return moves;
  const own = positions[side], theirs = positions[opponentOf(side)];
  const triedSquares = new Set();   // counters on the same square (the tray) make the same move
  own.forEach((from, counter) => {
    if (from === HOME || triedSquares.has(from)) return;
    triedSquares.add(from);
    const to = from + roll;
    if (to > HOME) return;                          // bearing off needs the exact roll
    if (to < HOME && own.includes(to)) return;      // can't land on your own counter
    let captures = -1;
    if (isSharedSquare(to)) {
      const target = theirs.indexOf(to);
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
const allHome = (positions, side) => positions[side].every(square => square === HOME);

// ---------- computer opponent: expectiminimax over the dice ----------
// How a position is valued. Tuning the opponent's style means changing these, not the search.
const SCORE = {
  perSquare: 1,            // progress along the route
  home: 22,                // a counter borne off
  safeCentre: 4,           // holding the safe centre rose
  rosette: 1.5,            // sitting on any other rose
  lastStretch: 1,          // squares 13–14, past all danger
  riskPerSquare: 1,        // expected loss if captured scales with how far a counter has come…
  riskExtra: 2,            // …plus a little for the turn it costs
};
const WIN = 10000;
const SEARCH_DEPTH = { easy: 1, medium: 2, hard: 4 };
const EASY_RANDOM_MOVE_CHANCE = 0.4;
const SCORE_TIE = 1e-9;

// chance that some opposing counter lands exactly on `square` with its next roll
function captureRisk(square, opposing) {
  let risk = 0;
  const behind = new Set();
  for (const theirs of opposing) {
    const gap = square - theirs;
    if (gap >= 1 && gap <= MAX_ROLL && !behind.has(gap)) { behind.add(gap); risk += ROLL_CHANCE[gap]; }
  }
  return Math.min(risk, 1);
}
function sideValue(positions, side, rules) {
  const opposing = positions[opponentOf(side)];
  let value = 0;
  for (const square of positions[side]) {
    if (square === HOME) { value += SCORE.home; continue; }
    if (square === IN_TRAY) continue;
    value += square * SCORE.perSquare;
    if (isSafeSquare(square, rules)) value += SCORE.safeCentre;
    else if (ROSETTES.has(square)) value += SCORE.rosette;
    if (square > LAST_SHARED_SQUARE) value += SCORE.lastStretch;
    if (isSharedSquare(square) && !isSafeSquare(square, rules))
      value -= captureRisk(square, opposing) * (square * SCORE.riskPerSquare + SCORE.riskExtra);
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
  if (allHome(next, side)) return side === me ? WIN + depth : -WIN - depth;   // sooner wins score higher
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
