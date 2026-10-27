/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The Options window: rule variants, auto-move, replaying the guide. Also shows which rules are in play.

// show what the current variant changes: the centre rose's ring and hover text, the board key, the rules note
function showRulesInPlay() {
  const safe = currentRules.safeCentre;
  boardElement.classList.toggle('no-safe', !safe);
  boardCells[CENTRE_CELL].title = (safe ? 'Centre rose: roll again, and safe from capture' : 'Centre rose: roll again (not safe in these rules)') + ` · square ${CENTRE}`;
  $('key-centre').textContent = safe ? 'Roll again, and safe from capture' : 'Roll again, but not safe in these rules';
  $('key-centre-tile').firstElementChild.classList.toggle('safe-sq', safe);
  const note = $('variant-now'), classic = game.variant === 'classic';
  note.hidden = classic;
  note.innerHTML = classic ? '' : `You’re playing the <b>${currentRules.name}</b> variant. ${currentRules.blurb} The rules below are the classic ones.`;
}

// one card per variant
$('variants').innerHTML = Object.entries(VARIANTS).map(([id, variant]) => `
  <label class="variant"><input type="radio" name="variant" value="${id}"><span class="dot"></span>
    <span><b>${variant.name}${id === 'classic' ? '' : ' <small class="house">house variant</small>'}</b><small>${variant.blurb}</small></span></label>`).join('');

// mark the chosen variant; mid-game, explain it starts next game and offer to set one up
function renderVariantNote() {
  document.querySelector(`input[name=variant][value=${prefs.variant}]`).checked = true;
  const note = $('variant-note');
  if (game && prefs.variant !== game.variant) {
    note.innerHTML = `${VARIANTS[prefs.variant].name} rules start with your next game. <button class="btn" type="button" id="variant-now-btn">Set up a new game now</button>`;
    $('variant-now-btn').addEventListener('click', () => { $('options-dlg').close(); confirmAbandonGame(showSetupBoard); });
  } else note.innerHTML = '';
}
document.querySelectorAll('input[name=variant]').forEach(radio => radio.addEventListener('change', () => {
  prefs.variant = radio.value; savePrefs();
  if (isBetweenGames()) showSetupBoard(); else renderVariantNote();
}));

$('opt-auto').checked = prefs.autoMove;
$('opt-auto').addEventListener('change', e => { prefs.autoMove = e.target.checked; savePrefs(); render(); continueGame(); });
$('replay-guide').addEventListener('click', () => { $('options-dlg').close(); confirmAbandonGame(() => startGame({ guided: true })); });
