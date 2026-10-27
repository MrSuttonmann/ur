/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// ---------- boot ----------
// first visit gets the guided game; anyone with games already recorded is a returning player
const returning = lifetime.games > 0 || Object.values(tally).some(v => v > 0);
if (!guideDone() && !returning) startGame({ guided: true }); else showSetupBoard();
