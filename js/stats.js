/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// ---------- stats ----------
function freshStats() {
  const side = () => ({ rolls: 0, dist: [0, 0, 0, 0, 0], moves: 0, pips: 0, passes: 0, caps: 0, lost: 0, roses: 0, chain: 0, bestChain: 0, home: 0, ms: 0 });
  return { ms: 0, p: [side(), side()], heat: Array(24).fill(0), leader: null, leadChanges: 0 };
}
const toGo = (pos, p) => pos[p].reduce((s, x) => s + OFF - x, 0);

function recordMove(p, m, again) {
  const st = S.stats, me = st.p[p];
  me.moves++; me.pips += m.to - m.from;
  if (m.cap >= 0) { me.caps++; st.p[1 - p].lost++; }
  if (again) { me.roses++; me.chain++; me.bestChain = Math.max(me.bestChain, me.chain); }
  if (m.to === OFF) me.home++;
  else { const [r, c] = coord(p, m.to); st.heat[r * 8 + c]++; }
  // whoever has fewer squares left to travel is ahead in the race
  const a = toGo(S.pos, 0), b = toGo(S.pos, 1);
  const lead = a === b ? st.leader : a < b ? 0 : 1;
  if (st.leader !== null && lead !== st.leader) st.leadChanges++;
  st.leader = lead;
}

// lifetime totals: finished games only, kept in this browser
const freshLife = () => ({
  games: 0, ms: 0, rolls: 0, moves: 0, caps: 0, roses: 0, home: 0, dist: [0, 0, 0, 0, 0],
  level: { easy: { w: 0, l: 0 }, medium: { w: 0, l: 0 }, hard: { w: 0, l: 0 } },
  local: { sun: 0, moon: 0 }, streak: 0, bestStreak: 0, quickest: null, fewestMoves: null,
});
let life = freshLife();
try { const l = JSON.parse(localStorage.getItem('ur-stats-v1')); if (l) life = { ...life, ...l }; } catch (e) {}
const saveLife = () => { try { localStorage.setItem('ur-stats-v1', JSON.stringify(life)); } catch (e) {} };

function recordGame(winner) {
  const st = S.stats, [a, b] = st.p;
  life.games++; life.ms += st.ms;
  life.rolls += a.rolls + b.rolls; life.moves += a.moves + b.moves;
  life.caps += a.caps + b.caps; life.roses += a.roses + b.roses; life.home += a.home + b.home;
  for (let v = 0; v <= 4; v++) life.dist[v] += a.dist[v] + b.dist[v];
  if (S.mode === 'ai') {
    const rec = life.level[S.level] || (life.level[S.level] = { w: 0, l: 0 });
    if (winner === 0) { rec.w++; life.streak++; life.bestStreak = Math.max(life.bestStreak, life.streak); }
    else { rec.l++; life.streak = 0; }
  } else life.local[winner === 0 ? 'sun' : 'moon']++;
  if (life.quickest === null || st.ms < life.quickest) life.quickest = st.ms;
  const wm = st.p[winner].moves;
  if (life.fewestMoves === null || wm < life.fewestMoves) life.fewestMoves = wm;
  saveLife();
}

// the game clock only runs while the page is visible and the game is unfinished
setInterval(() => {
  if (!S || S.phase === 'over' || S.phase === 'setup' || document.visibilityState !== 'visible') return;
  S.stats.ms += 1000; S.stats.p[S.turn].ms += 1000;
  if ($('stats').open && statsTab === 'game') drawStats();
}, 1000);

const fmtClock = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`; };
const fmtLong = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const avgRoll = s => s.rolls ? (s.dist.reduce((t, n, v) => t + n * v, 0) / s.rolls).toFixed(2) : '–';
const COLORS = ['var(--c-sun)', 'var(--c-moon)'];

// horizontal bars: share of each side's rolls per value, with the true odds marked
function rollChart(series) {
  const total = series.reduce((t, s) => t + s.dist.reduce((a, b) => a + b, 0), 0);
  if (!total) return '<p class="empty">No dice rolled yet. The chart fills in as you play.</p>';
  const pcts = series.map(s => { const n = s.dist.reduce((a, b) => a + b, 0); return s.dist.map(c => n ? c / n * 100 : 0); });
  const top = Math.max(40, ...pcts.flat());
  const step = top > 60 ? 20 : 10, max = Math.ceil(top / step) * step;
  const x = v => (v / max * 100).toFixed(2) + '%';
  let h = `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}<span><i class="exp-key"></i>True odds</span></div><div class="rc">`;
  for (let v = 0; v <= 4; v++) {
    h += `<div class="rc-v">${v}</div><div class="rc-track" style="background-size:${(step / max * 100).toFixed(2)}% 100%"><span class="rc-exp" style="left:${x(PROB[v] * 100)}" data-tip="True odds of a ${v}: ${PROB[v] * 16} in 16 (${(PROB[v] * 100).toFixed(1)}%)"></span>`;
    series.forEach((s, i) => {
      const n = s.dist.reduce((a, b) => a + b, 0);
      h += `<span class="rc-bar" style="width:${x(pcts[i][v])};background:${s.color}" data-tip="${s.name} rolled ${v}: ${s.dist[v]} of ${n} rolls (${pcts[i][v].toFixed(1)}%)"></span>`;
    });
    h += '</div>';
  }
  h += '<div></div><div class="rc-axis">';
  for (let t = 0; t <= max; t += step) h += `<span style="left:${x(t)}">${t}%</span>`;
  h += `</div></div><p class="cap">Share of ${series.length > 1 ? 'each side’s' : 'all'} rolls that came up 0 to 4. The dashed mark shows the true odds.</p>`;
  h += `<details class="tbl"><summary>Show as a table</summary><table><thead><tr><th>Roll</th>${series.map(s => `<th>${s.name}</th>`).join('')}<th>True odds</th></tr></thead><tbody>${
    [0, 1, 2, 3, 4].map(v => `<tr><td>${v}</td>${series.map(s => `<td>${s.dist[v]}</td>`).join('')}<td>${PROB[v] * 16} in 16</td></tr>`).join('')}</tbody></table></details>`;
  return h;
}

function heatmap(heat) {
  const max = Math.max(...heat);
  if (!max) return '<p class="empty">No counters have landed yet.</p>';
  let h = '<div class="heat">';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    if (!PATTERN[r][c]) { h += '<span class="hg"></span>'; continue; }
    const n = heat[r * 8 + c], a = n / max;
    const where = r === 1 ? 'Shared' : r === 0 ? 'Moon’s' : 'Sun’s', rose = PATTERN[r][c] === 'ros';
    h += `<span class="hc${rose ? ' rose' : ''}" style="--a:${(.06 + a * .84).toFixed(2)};color:${a > .55 ? 'var(--bone)' : 'var(--ink)'}" data-tip="${where} square ${routeNum[r + ',' + c]}${rose ? ' (rose)' : ''}: ${n} landing${n === 1 ? '' : 's'}">${n || ''}</span>`;
  }
  return h + '</div><p class="cap">Where counters landed this game, both sides together. Darker squares saw more landings; ringed squares are roses.</p>';
}

let statsTab = 'game', resetAsk = false;
function drawStats() {
  const body = $('stats-body');
  document.querySelectorAll('.stats-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === statsTab)));
  if (statsTab === 'game') {
    const st = S.stats, [a, b] = st.p, n = [nameOf(0), nameOf(1)];
    const tiles = [['Time played', fmtClock(st.ms)], ['Moves', a.moves + b.moves], ['Dice rolls', a.rolls + b.rolls], ['Captures', a.caps + b.caps]];
    const rows = [
      ['Moves made', a.moves, b.moves],
      ['Dice rolls', a.rolls, b.rolls],
      ['Average roll', avgRoll(a), avgRoll(b)],
      ['Squares travelled', a.pips, b.pips],
      ['Counters captured', a.caps, b.caps, 'hi', 'Times this side landed on an opponent'],
      ['Counters lost', a.lost, b.lost, 'lo', 'Times this side was landed on'],
      ['Rose landings', a.roses, b.roses, 'hi'],
      ['Longest rose chain', a.bestChain, b.bestChain, 'hi', 'Most rose landings in a single turn'],
      ['Turns passed', a.passes, b.passes, 'lo', 'Rolled 0, or no legal move'],
      ['Counters home', a.home, b.home, 'hi'],
      ['Squares still to go', toGo(S.pos, 0), toGo(S.pos, 1), 'lo', 'The race: fewer is further ahead'],
      ['Time on turn', fmtClock(a.ms), fmtClock(b.ms)],
    ];
    const cell = (v, o, better) => {
      const lead = better && v !== o && (better === 'hi' ? v > o : v < o);
      return `<td${lead ? ' class="lead"' : ''}>${v}</td>`;
    };
    const ahead = st.leader === null ? 'Nobody has moved yet.' : `${n[st.leader]} ${S.mode === 'ai' && st.leader === 0 ? 'are' : 'is'} ahead in the race`;
    body.innerHTML = `
      <div class="tiles">${tiles.map(([k, v]) => `<div class="tile-s"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <p class="race">${S.phase === 'over' ? `${n[S.winner]} won.` : ahead + (st.leader === null ? '' : '.')} The lead has changed hands ${st.leadChanges} time${st.leadChanges === 1 ? '' : 's'}.</p>
      <h3>Side by side</h3>
      <div class="scroll-x"><table class="cmp"><thead><tr><th></th>${n.map((x, i) => `<th><i style="background:${COLORS[i]}"></i>${x}</th>`).join('')}</tr></thead><tbody>${
        rows.map(([k, x, y, better, note]) => `<tr><th scope="row">${k}${note ? `<small>${note}</small>` : ''}</th>${cell(x, y, better)}${cell(y, x, better)}</tr>`).join('')}</tbody></table></div>
      <h3>Dice luck</h3>
      ${rollChart([{ name: n[0], color: COLORS[0], dist: a.dist }, { name: n[1], color: COLORS[1], dist: b.dist }])}
      <h3>Busiest squares</h3>
      ${heatmap(st.heat)}`;
  } else {
    const L = life, lv = [['easy', 'Squire'], ['medium', 'Knight'], ['hard', 'King']];
    const tiles = [['Games finished', L.games], ['Time played', fmtLong(L.ms)], ['Dice rolls', L.rolls], ['Captures', L.caps], ['Rose landings', L.roses], ['Counters home', L.home]];
    body.innerHTML = `
      <div class="tiles">${tiles.map(([k, v]) => `<div class="tile-s"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <h3>Against the computer</h3>
      <div class="scroll-x"><table class="cmp"><thead><tr><th>Level</th><th>Won</th><th>Lost</th><th>Win rate</th></tr></thead><tbody>${
        lv.map(([k, name]) => { const r = L.level[k] || { w: 0, l: 0 }, t = r.w + r.l;
          return `<tr><th scope="row">${name}</th><td>${r.w}</td><td>${r.l}</td><td>${t ? Math.round(r.w / t * 100) + '%' : '–'}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="race">Current win streak: <b>${L.streak}</b> · Best streak: <b>${L.bestStreak}</b></p>
      <h3>Two-player games</h3>
      <p class="race">Sun won <b>${L.local.sun}</b> · Moon won <b>${L.local.moon}</b></p>
      <h3>Records</h3>
      <p class="race">Quickest game: <b>${L.quickest === null ? '–' : fmtClock(L.quickest)}</b> · Fewest moves to win: <b>${L.fewestMoves ?? '–'}</b></p>
      <h3>Dice luck, all games</h3>
      ${rollChart([{ name: 'All rolls', color: COLORS[1], dist: L.dist }])}
      <p class="cap">Counts finished games only. Saved in this browser.</p>
      <div class="reset">${resetAsk
        ? 'Erase all lifetime stats and the win tally? <button class="btn danger" type="button" id="reset-yes">Erase</button> <button class="btn" type="button" id="reset-no">Keep them</button>'
        : '<button class="btn" type="button" id="reset-ask">Reset lifetime stats</button>'}</div>`;
    $('reset-ask')?.addEventListener('click', () => { resetAsk = true; drawStats(); $('reset-no').focus(); });
    $('reset-no')?.addEventListener('click', () => { resetAsk = false; drawStats(); $('reset-ask').focus(); });
    $('reset-yes')?.addEventListener('click', () => {
      life = freshLife(); saveLife();
      tally = { you: 0, computer: 0, sun: 0, moon: 0 }; saveTally();
      resetAsk = false; drawStats(); render(); $('reset-ask').focus();
    });
  }
}
