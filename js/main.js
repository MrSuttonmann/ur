/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// ---------- boot ----------
// a first visit is offered the guided game; anyone with games already recorded is a returning player
const returning = lifetime.games > 0 || Object.values(tally).some((v) => v > 0);
const offersGuide = !guideDone() && !returning;
showSetupBoard();

// ---------- reveal ----------
// the page was hidden while the scripts built it (see base.css); show it once the fonts are in, so no text
// reflows after, but never keep it hidden long for a slow font
const FONT_WAIT_MS = 1500;
Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS))]).then(() => {
  document.documentElement.classList.remove('booting');
  if (offersGuide) offerGuidedGame(); // once the page it sits over can be seen
});
