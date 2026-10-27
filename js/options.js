/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The Options window: auto-move, the background and replaying the guide (music volume and installing are wired in music.js and install.js).

$('opt-auto').checked = prefs.autoMove;
$('opt-auto').addEventListener('change', e => { prefs.autoMove = e.target.checked; savePrefs(); render(); continueGame(); });
$('opt-backdrop').innerHTML = Object.entries(BACKDROP_STYLES).map(([id, style]) => `<option value="${id}">${style.name}</option>`).join('');
$('opt-backdrop').value = prefs.backdrop;
$('opt-backdrop').addEventListener('change', e => { prefs.backdrop = e.target.value; savePrefs(); startBackdrop(); });
$('replay-guide').addEventListener('click', () => { $('options-dlg').close(); confirmAbandonGame(() => startGame({ guided: true })); });
