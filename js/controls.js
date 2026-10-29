/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The game's buttons: Roll (or Play again), Sound, Route, and the mode and opponent choices.

$('roll').addEventListener('click', () => {
  if (game.phase === 'over') {
    if (isOnline()) sendIntent({ t: 'rematch' });
    else startGame();
  } else if (canAct(game.turn)) rollDice();
});

// mode and opponent only change between games, and then just update the waiting board; online, switching mode
// mid-game leaves the game, once the player has agreed to forfeit it
document.querySelectorAll('input[name=mode]').forEach((/** @type {HTMLInputElement} */ radio) =>
  radio.addEventListener('change', () => {
    if (forfeitsOnlineGame()) {
      $('mode-online').checked = true; // until the player agrees
      confirmAbandonGame(() => {
        radio.checked = true;
        showSetupBoard();
      });
      return;
    }
    if (!isBetweenGames()) return;
    showSetupBoard();
    if (isOnline() && !$('player-name').value) $('player-name').focus(); // online starts with your name
  }),
);
$('level').addEventListener('change', (e) => {
  if (isBetweenGames()) {
    game.level = e.target.value;
    render();
  }
});

// Route numbers every square along each side's route
$('route').addEventListener('click', (e) => {
  const showing = boardElement.classList.toggle('show-route');
  e.currentTarget.setAttribute('aria-pressed', String(showing));
});

// Sound switches the sound effects (the music has its own button)
function drawSoundButton() {
  const button = $('sound');
  button.querySelector('[data-icon]').innerHTML = iconSVG(muted ? 'bellOff' : 'bell');
  button.querySelector('.lbl').textContent = muted ? 'Muted' : 'Sound';
  button.setAttribute('aria-pressed', String(!muted));
  button.setAttribute('aria-label', muted ? 'Sound off, turn on' : 'Sound on, turn off');
}
$('sound').addEventListener('click', () => {
  muted = !muted;
  try {
    localStorage.setItem('ur-muted', muted ? '1' : '0');
  } catch (e) {}
  drawSoundButton();
  if (!muted) sfxDice();
});
drawSoundButton();
