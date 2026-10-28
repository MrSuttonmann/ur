/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Honours: achievements earned in finished games, kept in this browser. Each finished game is checked
// against the list; new ones are announced after the end banner and listed in the Chronicle.

const COMEBACK_SQUARES = 15; // how far behind in the race a win has to come from to be a comeback
const HUNTER_CAPTURES = 4; // captures in one game
const GARDEN_ROSES = 3; // rose landings in one turn
const SWIFT_MS = 5 * 60 * 1000; // a win quicker than this
const STREAK_SHORT = 3,
  STREAK_LONG = 7;
const VETERAN_GAMES = 25;
const HONOUR_NOTE_MS = 6000; // how long the "honour earned" note stays up

// Every honour: its name, how it's earned, and a test of a finished game (see honourCheckFor). Skill honours
// aren't earned in a game where you took back a move.
// Ids are saved in players' browsers, so they stay as they are.
const HONOURS = [
  { id: 'first-win', name: 'First Victory', how: 'Win a game against the computer.', test: (g) => g.won },
  { id: 'squire', name: 'Squire Bested', how: 'Beat the Squire.', test: (g) => g.won && g.level === 'easy' },
  { id: 'knight', name: 'Knight Unhorsed', how: 'Beat Sir Knight.', test: (g) => g.won && g.level === 'medium' },
  {
    id: 'own-counsel',
    name: 'Own Counsel',
    how: 'Beat Sir Knight without asking for advice.',
    test: (g) => g.won && g.level === 'medium' && g.you.adviceTaken === 0,
  },
  { id: 'king', name: 'The King Dethroned', how: 'Beat the King.', test: (g) => g.won && g.level === 'hard' },
  {
    id: 'untouchable',
    skill: true,
    name: 'Untouchable',
    how: 'Win without losing a single counter.',
    test: (g) => g.won && g.you.lost === 0,
  },
  {
    id: 'clean-sweep',
    skill: true,
    name: 'Clean Sweep',
    how: 'Win before your opponent brings a single counter home.',
    test: (g) => g.won && g.them.home === 0,
  },
  {
    id: 'whisker',
    skill: true,
    name: 'By a Whisker',
    how: 'Win when your opponent has every counter home but one.',
    test: (g) => g.won && g.them.home === g.counters - 1,
  },
  {
    id: 'comeback',
    skill: true,
    name: 'Against the Odds',
    how: `Win after falling ${COMEBACK_SQUARES} squares or more behind in the race.`,
    test: (g) => g.won && g.you.mostBehind >= COMEBACK_SQUARES,
  },
  {
    id: 'hunter',
    skill: true,
    name: 'Hunter',
    how: `Capture ${HUNTER_CAPTURES} counters in one game against the computer.`,
    test: (g) => g.vsComputer && g.you.captures >= HUNTER_CAPTURES,
  },
  {
    id: 'garden',
    skill: true,
    name: 'Garden Path',
    how: `Land on roses ${GARDEN_ROSES} times in one turn against the computer.`,
    test: (g) => g.vsComputer && g.you.longestRoseChain >= GARDEN_ROSES,
  },
  { id: 'swift', name: 'Swift', how: 'Win in under five minutes.', test: (g) => g.won && g.playMs < SWIFT_MS },
  {
    id: 'streak',
    name: 'On a Roll',
    how: `Win ${STREAK_SHORT} games in a row.`,
    test: (g) => g.won && lifetime.streak >= STREAK_SHORT,
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    how: `Win ${STREAK_LONG} games in a row.`,
    test: (g) => g.won && lifetime.streak >= STREAK_LONG,
  },
  {
    id: 'traveller',
    name: 'Well Travelled',
    how: 'Win a game with every variant.',
    test: () => Object.keys(VARIANT_DEFINITIONS).every((variant) => honours.variantsWon.includes(variant)),
  },
  { id: 'company', name: 'Good Company', how: 'Finish a two-player game.', test: (g) => !g.vsComputer },
  {
    id: 'veteran',
    name: 'Veteran',
    how: `Finish ${VETERAN_GAMES} games.`,
    test: () => lifetime.games >= VETERAN_GAMES,
  },
];

// earned: { honour id: the date it was earned }; variantsWon: variants you've beaten the computer with
const createHonours = () => ({ earned: {}, variantsWon: [] });
let honours = createHonours();
try {
  const saved = JSON.parse(localStorage.getItem('ur-honours-v1'));
  if (saved) honours = { ...honours, ...saved };
} catch (e) {}
const saveHonours = () => {
  try {
    localStorage.setItem('ur-honours-v1', JSON.stringify(honours));
  } catch (e) {}
};
const isEarned = (honour) => Boolean(honours.earned[honour.id]);

// what the tests look at: the game from your side (the Sun, against the computer)
function honourCheckFor(winner) {
  const vsComputer = game.mode === 'ai',
    sides = game.stats.bySide;
  return {
    vsComputer,
    won: vsComputer && winner === HUMAN_SIDE,
    level: game.level,
    tookBack: game.undos > 0,
    you: sides[HUMAN_SIDE],
    them: sides[COMPUTER_SIDE],
    counters: currentRules.counters,
    playMs: game.stats.playMs,
  };
}

// after a finished game (and its lifetime stats) is recorded: the honours it newly earned
function awardHonours(winner) {
  const check = honourCheckFor(winner);
  if (check.won && !honours.variantsWon.includes(game.variant)) honours.variantsWon.push(game.variant);
  const today = new Date().toISOString().slice(0, 10);
  const newlyEarned = HONOURS.filter(
    (honour) => !isEarned(honour) && !(honour.skill && check.tookBack) && honour.test(check),
  );
  newlyEarned.forEach((honour) => {
    honours.earned[honour.id] = today;
  });
  saveHonours();
  return newlyEarned;
}

// ---------- drawing ----------
// a medal on a ribbon: gold once earned, a faint outline until then
const honourMedalSVG = (
  earned,
) => `<svg class="medal-art${earned ? ' earned' : ''}" viewBox="0 0 40 48" aria-hidden="true"><g filter="url(#ink)">
  <path d="M13 2 L20 18 L27 2 Z" class="medal-ribbon"/><path d="M13 2 L20 18 L27 2" class="ink-line"/>
  <circle cx="20" cy="31" r="14" class="medal-disc"/><circle cx="20" cy="31" r="14" class="ink-line"/>
  <circle cx="20" cy="31" r="9.5" class="ink-line medal-inner"/>
  <path d="M20 24.5 L21.9 29 L26.6 29.2 L22.9 32.1 L24.2 36.7 L20 34 L15.8 36.7 L17.1 32.1 L13.4 29.2 L18.1 29 Z" class="medal-star"/>
</g></svg>`;
const formatEarnedDate = (isoDate) =>
  new Date(isoDate + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// the Honours tab of the Chronicle
function honoursHTML() {
  const earnedCount = HONOURS.filter(isEarned).length;
  return `<p class="race"><b>${earnedCount}</b> of ${HONOURS.length} honours earned.</p>
    <ul class="honours">${HONOURS.map((honour) => {
      const earned = isEarned(honour);
      return `<li class="honour${earned ? ' earned' : ''}">${honourMedalSVG(earned)}<div><b>${honour.name}</b><span>${honour.how}</span>${
        earned ? `<small>Earned ${formatEarnedDate(honours.earned[honour.id])}</small>` : ''
      }</div></li>`;
    }).join('')}</ul>
    <p class="cap">${joinAsList(HONOURS.filter((honour) => honour.skill).map((honour) => honour.name))} can’t be earned in a game where you take back a move. Saved in this browser.</p>`;
}

// the note that slides in once the end banner has gone, naming the honours just earned
let honourNoteTimers = [];
function announceHonours(newlyEarned) {
  hideHonourNote();
  if (!newlyEarned.length) return;
  const note = $('honour-note');
  note.innerHTML = `${honourMedalSVG(true)}<div><b>${newlyEarned.length === 1 ? 'Honour earned' : 'Honours earned'}</b>${`<span>${newlyEarned.map((honour) => honour.name).join(', ')}</span>`}</div>`;
  honourNoteTimers = [
    setTimeout(() => {
      note.hidden = false;
    }, BANNER_SHOW_MS),
    setTimeout(hideHonourNote, BANNER_SHOW_MS + HONOUR_NOTE_MS),
  ];
}
function hideHonourNote() {
  honourNoteTimers.forEach(clearTimeout);
  honourNoteTimers = [];
  $('honour-note').hidden = true;
}
$('honour-note').addEventListener('click', hideHonourNote);
