/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Undo, against the Squire: take back your last move, and whatever the Squire has done since, to choose again
// with the same roll. The game is saved each time you choose between moves; a forced move has nothing to undo.

let undoPoint = null; // the game as it stood when you last chose a move

function saveUndoPoint() {
  const choosing =
    isLearnerGame() &&
    !game.guided &&
    !isComputer(game.turn) &&
    legalMoves(game.positions, game.turn, game.roll).length > 1;
  if (choosing) undoPoint = structuredClone(game);
}
// Until you roll again, so an undo can't buy a new roll; never mid-roll or mid-hop (their timers aren't
// cancelled by an undo), and not once the game is won or lost.
const canUndo = () =>
  Boolean(undoPoint) && isLearnerGame() && (game.phase === 'roll' || (game.phase === 'move' && isComputer(game.turn)));

function undoMove() {
  if (!canUndo()) return;
  const undos = game.undos + 1;
  gameId++;
  clearTimeout(pendingStep); // the Squire's next roll or move belonged to the game being undone
  closeGuideTip(false);
  clearSpeech();
  game = undoPoint;
  undoPoint = null;
  game.undos = undos;
  game.note = 'Move taken back. Choose again.';
  writeToLedger('You took back a move.');
  render();
  continueGame();
}
// a new game starts with nothing to undo
function forgetUndoPoint() {
  undoPoint = null;
}

$('undo').addEventListener('click', undoMove);
function renderUndo() {
  $('undo').hidden = !isLearnerGame() || game.guided || isBetweenGames();
  $('undo').disabled = !canUndo();
}
