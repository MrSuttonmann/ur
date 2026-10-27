/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Danger shading, against the Squire: on your turn, each square on your route is washed red by the chance
// that one of the Squire's counters could land there with his next roll. Safe roses and your own rows never are.

const showsDanger = () => isLearnerGame() && !game.guided && !isComputer(game.turn) && ['roll', 'rolling', 'move'].includes(game.phase);
const percent = chance => `${Math.round(chance * 100)}%`;

// a square that a route passes twice (doubling back) is as dangerous as its riskier visit
function dangerAtCell(key) {
  const squares = currentRules.squaresAt[HUMAN_SIDE][key] || [];
  return Math.max(0, ...squares.map(square => dangerAt(game.positions, HUMAN_SIDE, square)));
}

function renderDanger() {
  const showing = showsDanger();
  for (const [key, cell] of Object.entries(boardCells)) {
    const chance = showing ? dangerAtCell(key) : 0;
    cell.style.setProperty('--danger', chance);
    cell.querySelector('.danger-chance').textContent = chance ? percent(chance) : '';
  }
  $('key-danger').hidden = !showing;
}
