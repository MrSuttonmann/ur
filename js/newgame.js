/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Starting games: the waiting set-up board, starting play, asking before a game in progress is lost.

const isBetweenGames = () => game.phase === 'setup' || game.phase === 'over';
// a game with moves in it would be lost by starting over, refreshing or closing the tab; an online game is kept
// by its room
const hasProgressToLose = () =>
  game && !isOnline() && !isBetweenGames() && game.stats.bySide.some((side) => side.moves > 0);
const chosenMode = () => /** @type {HTMLInputElement} */ (document.querySelector('input[name=mode]:checked')).value;

// throw away the current game (and anything it had scheduled) before setting up another
function abandonCurrentGame() {
  gameId++;
  clearTimeout(pendingStep);
  closeGuideTip(false);
  clearSpeech();
  hideEndBanner();
  hideHonourNote();
  forgetUndoPoint();
}

// start playing with the chosen mode and opponent; { guided: true } starts the guided first game
function startGame({ guided = false } = {}) {
  leaveOnlineGame();
  abandonCurrentGame();
  if (game && game.guided && !guided) finishGuide(); // leaving the guided game counts as having seen it
  if (guided) {
    $('mode-ai').checked = true;
    $('level').value = 'easy';
  }
  const variant = guided ? 'classic' : prefs.variant;
  currentRules = VARIANTS[variant];
  game = createGameState(chosenMode(), $('level').value, variant, guided);
  showRulesInPlay();
  const who = game.mode === 'ai' && game.turn === HUMAN_SIDE ? 'You go' : `${playerName(game.turn)} goes`;
  writeToLedger(`${who} first.`);
  render();
  scrollToGame();
  continueGame();
  speak(MOON, 'start', 300);
  speak(SUN, 'start', 1500, 0.6);
}

// a board laid out and waiting: the player picks mode and opponent, then presses Start game
function showSetupBoard() {
  leaveOnlineGame();
  abandonCurrentGame();
  if (game && game.guided) finishGuide();
  currentRules = VARIANTS[prefs.variant];
  game = createGameState(chosenMode(), $('level').value, prefs.variant, false, 'setup');
  showRulesInPlay();
  render();
}

// starting over loses a game that has moves in it, and leaving an online game in play forfeits it, so ask first
const forfeitsOnlineGame = () => isOnline() && isInPlay() && Boolean(online.roomId);
const CONFIRM_WORDS = {
  lose: ['Start a new game?', 'The game in progress will be lost.', 'Start a new game'],
  forfeit: ['Leave this game?', 'Leaving now counts as a loss.', 'Leave and forfeit'],
};
let afterConfirming = null;
function confirmAbandonGame(action) {
  const forfeits = forfeitsOnlineGame();
  if (!hasProgressToLose() && !forfeits) {
    action();
    return;
  }
  afterConfirming = action;
  const [title, text, yes] = CONFIRM_WORDS[forfeits ? 'forfeit' : 'lose'];
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  $('confirm-yes').textContent = yes;
  $('confirm-dlg').showModal();
  $('confirm-no').focus();
}
$('confirm-yes').addEventListener('click', () => {
  const action = afterConfirming;
  $('confirm-dlg').close();
  if (action) action();
});
$('confirm-no').addEventListener('click', () => $('confirm-dlg').close());
$('confirm-dlg').addEventListener('close', () => {
  afterConfirming = null;
});
$('newgame').addEventListener('click', () => {
  if (isBetweenGames() && isOnline()) startInviting();
  else if (isBetweenGames()) startGame();
  else confirmAbandonGame(showSetupBoard);
});

// a refresh or closed tab would lose the game, so ask first (browsers show their own wording here)
addEventListener('beforeunload', (e) => {
  if (hasProgressToLose()) {
    e.preventDefault();
    e.returnValue = '';
  }
});
