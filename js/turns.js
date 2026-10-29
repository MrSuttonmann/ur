/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// What a move adds to the game's record, and how the ledger words it. Like rules.js it touches nothing on the
// page, and the online room runs this same code, so both ends tell the same story. Every function takes the
// rules it plays by, so none leans on the page's current ones.

const createSideStats = () => ({
  rolls: 0,
  rollCounts: Array(MAX_ROLL + 1).fill(0),
  moves: 0,
  squaresTravelled: 0,
  passes: 0,
  captures: 0,
  lost: 0,
  roses: 0,
  roseChain: 0,
  longestRoseChain: 0,
  home: 0,
  msOnTurn: 0,
  adviceTaken: 0,
  mostBehind: 0, // the furthest behind in the race this side has been, in squares
});
function createGameStats() {
  return { playMs: 0, bySide: SIDES.map(createSideStats), landings: {}, leader: null, leadChanges: 0 };
}
// total squares a side's counters still have to travel: the race
const squaresToGo = (positions, side, rules) =>
  positions[side].reduce((total, square) => total + rules.home - square, 0);

// adds a move to the stats; positionsAfter is the board once the move has been made
function recordMove(stats, positionsAfter, side, move, landsOnRose, rules) {
  const mine = stats.bySide[side];
  mine.moves++;
  mine.squaresTravelled += move.to - move.from;
  if (move.captures >= 0) {
    mine.captures++;
    stats.bySide[opponentOf(side)].lost++;
  }
  if (landsOnRose) {
    mine.roses++;
    mine.roseChain++;
    mine.longestRoseChain = Math.max(mine.longestRoseChain, mine.roseChain);
  }
  if (move.to === rules.home) mine.home++;
  else {
    const key = cellKey(routeCell(side, move.to, rules));
    stats.landings[key] = (stats.landings[key] || 0) + 1;
  }
  // whoever has fewer squares left to travel is ahead in the race
  const sunToGo = squaresToGo(positionsAfter, SUN, rules),
    moonToGo = squaresToGo(positionsAfter, MOON, rules);
  const leader = sunToGo === moonToGo ? stats.leader : sunToGo < moonToGo ? SUN : MOON;
  if (stats.leader !== null && leader !== stats.leader) stats.leadChanges++;
  stats.leader = leader;
  stats.bySide[SUN].mostBehind = Math.max(stats.bySide[SUN].mostBehind, sunToGo - moonToGo);
  stats.bySide[MOON].mostBehind = Math.max(stats.bySide[MOON].mostBehind, moonToGo - sunToGo);
}

function describeMove(side, move, landsOnRose, again, rules) {
  let text =
    move.from === IN_TRAY
      ? `entered a piece${move.to > 1 ? ' to ' + move.to : ''}`
      : move.to === rules.home
        ? 'brought a piece home'
        : `moved ${move.from} → ${move.to}`;
  if (move.captures >= 0) text += `, captured a ${SIDE_NAME[opponentOf(side)]} piece`;
  if (landsOnRose) text += ', landed on a rose and rolls again';
  else if (again) text += ' and rolls again';
  return text;
}
