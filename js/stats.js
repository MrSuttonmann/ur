/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Stats: recording the current game and lifetime totals, and drawing the Stats window.

// ---------- lifetime: finished games only, kept in this browser ----------
// These field names are saved in players' browsers, so they stay as they are:
// w/l are wins and losses, dist counts each roll, caps counts captures, ms is time played.
const createLifetimeStats = () => ({
  games: 0,
  ms: 0,
  rolls: 0,
  moves: 0,
  caps: 0,
  roses: 0,
  home: 0,
  dist: Array(MAX_ROLL + 1).fill(0),
  level: { easy: { w: 0, l: 0 }, medium: { w: 0, l: 0 }, hard: { w: 0, l: 0 } },
  local: { sun: 0, moon: 0 },
  streak: 0,
  bestStreak: 0,
  quickest: null,
  fewestMoves: null,
});
let lifetime = createLifetimeStats();
try {
  const saved = JSON.parse(localStorage.getItem('ur-stats-v1'));
  if (saved) lifetime = { ...lifetime, ...saved };
} catch (e) {}
const saveLifetime = () => {
  try {
    localStorage.setItem('ur-stats-v1', JSON.stringify(lifetime));
  } catch (e) {}
};

function recordGame(winner) {
  const stats = game.stats,
    sides = stats.bySide;
  const bothSides = (field) => sides[SUN][field] + sides[MOON][field];
  lifetime.games++;
  lifetime.ms += stats.playMs;
  lifetime.rolls += bothSides('rolls');
  lifetime.moves += bothSides('moves');
  lifetime.caps += bothSides('captures');
  lifetime.roses += bothSides('roses');
  lifetime.home += bothSides('home');
  for (let roll = 0; roll <= MAX_ROLL; roll++)
    lifetime.dist[roll] += sides[SUN].rollCounts[roll] + sides[MOON].rollCounts[roll];
  if (game.mode === 'ai') {
    const record = lifetime.level[game.level] || (lifetime.level[game.level] = { w: 0, l: 0 });
    if (winner !== COMPUTER_SIDE) {
      record.w++;
      lifetime.streak++;
      lifetime.bestStreak = Math.max(lifetime.bestStreak, lifetime.streak);
    } else {
      record.l++;
      lifetime.streak = 0;
    }
  } else lifetime.local[winner === SUN ? 'sun' : 'moon']++;
  if (lifetime.quickest === null || stats.playMs < lifetime.quickest) lifetime.quickest = stats.playMs;
  const winningMoves = sides[winner].moves;
  if (lifetime.fewestMoves === null || winningMoves < lifetime.fewestMoves) lifetime.fewestMoves = winningMoves;
  saveLifetime();
}

// the game clock only runs while the page is visible and the game is unfinished
const CLOCK_TICK_MS = 1000;
setInterval(() => {
  if (!game || game.phase === 'over' || game.phase === 'setup' || document.visibilityState !== 'visible') return;
  game.stats.playMs += CLOCK_TICK_MS;
  game.stats.bySide[game.turn].msOnTurn += CLOCK_TICK_MS;
  if ($('stats').open && statsTab === 'game') drawStats();
}, CLOCK_TICK_MS);

// ---------- formatting ----------
const formatClock = (ms) => {
  const seconds = Math.floor(ms / 1000),
    hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${minutes}:${pad(seconds % 60)}`;
};
const formatDuration = (ms) => {
  const minutes = Math.round(ms / 60000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};
const averageRoll = (sideStats) =>
  sideStats.rolls
    ? (sideStats.rollCounts.reduce((total, count, roll) => total + count * roll, 0) / sideStats.rolls).toFixed(2)
    : '–';
const SIDE_SWATCH = { [SUN]: 'swatch-sun', [MOON]: 'swatch-moon' }; // each side's chart colour, as a class
const total = (counts) => counts.reduce((sum, n) => sum + n, 0);
const ROLLS = Array.from({ length: MAX_ROLL + 1 }, (_, roll) => roll); // 0 to 4

// ---------- charts ----------
// horizontal bars: share of each side's rolls per value, with the true odds marked
function rollChart(series) {
  if (!series.some((s) => total(s.counts)))
    return '<p class="empty">No dice rolled yet. The chart fills in as you play.</p>';
  const percents = series.map((s) => {
    const n = total(s.counts);
    return s.counts.map((c) => (n ? (c / n) * 100 : 0));
  });
  const top = Math.max(40, ...percents.flat());
  const step = top > 60 ? 20 : 10,
    max = Math.ceil(top / step) * step;
  const along = (value) => ((value / max) * 100).toFixed(2) + '%';
  let html = `<div class="legend">${series.map((s) => `<span><i class="${s.swatch}"></i>${s.name}</span>`).join('')}<span><i class="exp-key"></i>True odds</span></div><div class="rc">`;
  for (const roll of ROLLS) {
    const chance = ROLL_CHANCE[roll];
    html += `<div class="rc-v">${roll}</div><div class="rc-track" style="background-size:${((step / max) * 100).toFixed(2)}% 100%"><span class="rc-exp" style="left:${along(chance * 100)}" data-tip="True odds of a ${roll}: ${chance * 16} in 16 (${(chance * 100).toFixed(1)}%)"></span>`;
    series.forEach((s, i) => {
      html += `<span class="rc-bar ${s.swatch}" style="width:${along(percents[i][roll])}" data-tip="${s.name} rolled ${roll}: ${s.counts[roll]} of ${total(s.counts)} rolls (${percents[i][roll].toFixed(1)}%)"></span>`;
    });
    html += '</div>';
  }
  html += '<div></div><div class="rc-axis">';
  for (let tick = 0; tick <= max; tick += step) html += `<span style="left:${along(tick)}">${tick}%</span>`;
  html += `</div></div><p class="cap">Share of ${series.length > 1 ? 'each side’s' : 'all'} rolls that came up 0 to 4. The dashed mark shows the true odds.</p>`;
  html += `<details class="tbl"><summary>Show as a table</summary><table><thead><tr><th>Roll</th>${series.map((s) => `<th>${s.name}</th>`).join('')}<th>True odds</th></tr></thead><tbody>${ROLLS.map(
    (roll) =>
      `<tr><td>${roll}</td>${series.map((s) => `<td>${s.counts[roll]}</td>`).join('')}<td>${ROLL_CHANCE[roll] * 16} in 16</td></tr>`,
  ).join('')}</tbody></table></details>`;
  return html;
}

// the board drawn small, each square shaded by how often counters landed there
function heatmap(landings) {
  const most = Math.max(0, ...Object.values(landings));
  if (!most) return '<p class="empty">No counters have landed yet.</p>';
  const rowName = { [ROW.SHARED]: 'Shared', [ROW.MOON]: 'Moon’s', [ROW.SUN]: 'Sun’s' };
  let html = '<div class="heat">';
  for (let row = 0; row < BOARD_ROWS; row++)
    for (let column = 0; column < BOARD_COLUMNS; column++) {
      const picture = BOARD_PICTURES[row][column];
      if (!picture) {
        html += '<span class="hg"></span>';
        continue;
      }
      const key = cellKey([row, column]),
        count = landings[key] || 0,
        share = count / most,
        rose = picture === 'ros';
      html += `<span class="hc${rose ? ' rose' : ''}${share > 0.55 ? ' busy' : ''}" style="--a:${(0.06 + share * 0.84).toFixed(2)}" data-tip="${rowName[row]} row, ${squareLabel(key)}${rose ? ' (rose)' : ''}: ${count} landing${count === 1 ? '' : 's'}">${count || ''}</span>`;
    }
  return (
    html +
    '</div><p class="cap">Where counters landed this game, both sides together. Darker squares saw more landings; ringed squares are roses.</p>'
  );
}

// ---------- the Stats window ----------
let statsTab = 'game',
  resetAsk = false;
function drawStats() {
  document
    .querySelectorAll('.stats-tabs button')
    .forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === statsTab)));
  const TAB_HTML = { game: thisGameStatsHTML, life: lifetimeStatsHTML, honours: honoursHTML };
  $('stats-body').innerHTML = TAB_HTML[statsTab]();
  if (statsTab === 'life') wireResetButtons();
}

const statTiles = (tiles) =>
  `<div class="tiles">${tiles.map(([label, value]) => `<div class="tile-s"><span>${label}</span><b>${value}</b></div>`).join('')}</div>`;

function thisGameStatsHTML() {
  const stats = game.stats,
    sun = stats.bySide[SUN],
    moon = stats.bySide[MOON];
  const names = { [SUN]: playerName(SUN), [MOON]: playerName(MOON) };
  // [label, Sun value, Moon value, which is better ('more' / 'fewer'), note]
  const rows = [
    ['Moves made', sun.moves, moon.moves],
    ['Dice rolls', sun.rolls, moon.rolls],
    ['Average roll', averageRoll(sun), averageRoll(moon)],
    ['Squares travelled', sun.squaresTravelled, moon.squaresTravelled],
    ['Counters captured', sun.captures, moon.captures, 'more', 'Times this side landed on an opponent'],
    ['Counters lost', sun.lost, moon.lost, 'fewer', 'Times this side was landed on'],
    ['Rose landings', sun.roses, moon.roses, 'more'],
    ['Longest rose chain', sun.longestRoseChain, moon.longestRoseChain, 'more', 'Most rose landings in a single turn'],
    ['Turns passed', sun.passes, moon.passes, 'fewer', 'Rolled 0, or no legal move'],
    ['Counters home', sun.home, moon.home, 'more'],
    [
      'Squares still to go',
      squaresToGo(game.positions, SUN, currentRules),
      squaresToGo(game.positions, MOON, currentRules),
      'fewer',
      'The race: fewer is further ahead',
    ],
    ['Time on turn', formatClock(sun.msOnTurn), formatClock(moon.msOnTurn)],
  ];
  const cell = (value, other, better) => {
    const leads = better && value !== other && (better === 'more' ? value > other : value < other);
    return `<td${leads ? ' class="lead"' : ''}>${value}</td>`;
  };
  const verb = (side) => (game.mode === 'ai' && side !== COMPUTER_SIDE ? 'are' : 'is');
  const race =
    game.phase === 'over'
      ? `${names[game.winner]} won.`
      : stats.leader === null
        ? 'Nobody has moved yet.'
        : `${names[stats.leader]} ${verb(stats.leader)} ahead in the race.`;
  return `
    ${statTiles([
      ['Time played', formatClock(stats.playMs)],
      ['Moves', sun.moves + moon.moves],
      ['Dice rolls', sun.rolls + moon.rolls],
      ['Captures', sun.captures + moon.captures],
    ])}
    <p class="race">${race} The lead has changed hands ${stats.leadChanges} time${stats.leadChanges === 1 ? '' : 's'}.</p>
    <h3>Side by side</h3>
    <div class="scroll-x"><table class="cmp"><thead><tr><th></th>${SIDES.map((side) => `<th><i class="${SIDE_SWATCH[side]}"></i>${names[side]}</th>`).join('')}</tr></thead><tbody>${rows
      .map(
        ([label, sunValue, moonValue, better, note]) =>
          `<tr><th scope="row">${label}${note ? `<small>${note}</small>` : ''}</th>${cell(sunValue, moonValue, better)}${cell(moonValue, sunValue, better)}</tr>`,
      )
      .join('')}</tbody></table></div>
    <h3>Dice luck</h3>
    ${rollChart(SIDES.map((side) => ({ name: names[side], swatch: SIDE_SWATCH[side], counts: stats.bySide[side].rollCounts })))}
    <h3>Busiest squares</h3>
    ${heatmap(stats.landings)}`;
}

function lifetimeStatsHTML() {
  const levels = [
    ['easy', 'Squire'],
    ['medium', 'Knight'],
    ['hard', 'King'],
  ];
  return `
    ${statTiles([
      ['Games finished', lifetime.games],
      ['Time played', formatDuration(lifetime.ms)],
      ['Dice rolls', lifetime.rolls],
      ['Captures', lifetime.caps],
      ['Rose landings', lifetime.roses],
      ['Counters home', lifetime.home],
    ])}
    <h3>Against your opponents</h3>
    <div class="scroll-x"><table class="cmp"><thead><tr><th>Level</th><th>Won</th><th>Lost</th><th>Win rate</th></tr></thead><tbody>${levels
      .map(([level, name]) => {
        const record = lifetime.level[level] || { w: 0, l: 0 },
          played = record.w + record.l;
        return `<tr><th scope="row">${name}</th><td>${record.w}</td><td>${record.l}</td><td>${played ? Math.round((record.w / played) * 100) + '%' : '–'}</td></tr>`;
      })
      .join('')}</tbody></table></div>
    <p class="race">Current win streak: <b>${lifetime.streak}</b> · Best streak: <b>${lifetime.bestStreak}</b></p>
    <h3>Two-player games</h3>
    <p class="race">Sun won <b>${lifetime.local.sun}</b> · Moon won <b>${lifetime.local.moon}</b></p>
    <h3>Records</h3>
    <p class="race">Quickest game: <b>${lifetime.quickest === null ? '–' : formatClock(lifetime.quickest)}</b> · Fewest moves to win: <b>${lifetime.fewestMoves ?? '–'}</b></p>
    <h3>Dice luck, all games</h3>
    ${rollChart([{ name: 'All rolls', swatch: SIDE_SWATCH[MOON], counts: lifetime.dist }])}
    <p class="cap">Counts finished games only. Saved in this browser.</p>
    <div class="reset">${
      resetAsk
        ? 'Erase all lifetime stats, honours and the win tally? <button class="btn danger" type="button" id="reset-yes">Erase</button> <button class="btn" type="button" id="reset-no">Keep them</button>'
        : '<button class="btn" type="button" id="reset-ask">Reset lifetime stats</button>'
    }</div>`;
}
function wireResetButtons() {
  $('reset-ask')?.addEventListener('click', () => {
    resetAsk = true;
    drawStats();
    $('reset-no').focus();
  });
  $('reset-no')?.addEventListener('click', () => {
    resetAsk = false;
    drawStats();
    $('reset-ask').focus();
  });
  $('reset-yes')?.addEventListener('click', () => {
    lifetime = createLifetimeStats();
    saveLifetime();
    honours = createHonours();
    saveHonours();
    tally = { you: 0, computer: 0, sun: 0, moon: 0 };
    saveTally();
    resetAsk = false;
    drawStats();
    render();
    $('reset-ask').focus();
  });
}
