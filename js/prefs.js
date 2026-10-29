/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The player's preferences, saved in this browser only.

const DEFAULT_MUSIC_VOLUME = 20; // percent: quiet enough that the dice and counters come through
const DEFAULT_BACKDROP = 'sky';
const prefs = {
  autoMove: true,
  variant: 'classic',
  music: true,
  musicVol: DEFAULT_MUSIC_VOLUME,
  backdrop: DEFAULT_BACKDROP,
  name: '', // the name last given for online play
};
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem('ur-prefs')) || {});
} catch (e) {}
if (!VARIANTS[prefs.variant]) prefs.variant = 'classic';
const savePrefs = () => {
  try {
    localStorage.setItem('ur-prefs', JSON.stringify(prefs));
  } catch (e) {}
};
