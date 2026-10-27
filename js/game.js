/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// ---------- state ----------
let S, gen = 0, timer = null;
const $ = id => document.getElementById(id);

function fresh(mode, level, variant, guided, phase = 'roll') {
  const n = VARIANTS[variant].counters;
  return {
    pos: [Array(n).fill(0), Array(n).fill(0)],
    turn: guided ? 0 : Math.random() < 0.5 ? 0 : 1,
    phase, roll: null, dice: null,
    winner: null, lastTo: null, note: '', advice: null,
    mode, level, variant, guided, tips: {}, log: [], stats: freshStats(),
  };
}
const isAI = p => S.mode === 'ai' && p === 1;
const nameOf = p => S.mode === 'ai' ? (p === 0 ? 'You' : 'Computer') : SIDE[p];

let tally = { you: 0, computer: 0, sun: 0, moon: 0 };
try { const t = JSON.parse(localStorage.getItem('ur-tally-v2')); if (t) tally = { ...tally, ...t }; } catch (e) {}
function saveTally() { try { localStorage.setItem('ur-tally-v2', JSON.stringify(tally)); } catch (e) {} }

function schedule(fn, ms) {
  const g = gen;
  clearTimeout(timer);
  timer = setTimeout(() => { if (g === gen) fn(); }, ms);
}

function advance() {
  if (S.phase === 'over' || S.phase === 'setup') return;
  // while a guide tip is open the game waits; dismissing it calls advance() again
  if (coachOpen) { advancePending = true; return; }
  if (S.phase === 'roll') { if (isAI(S.turn)) schedule(doRoll, 750); return; }
  if (S.phase === 'move') {
    const ms = legalMoves(S.pos, S.turn, S.roll);
    if (!ms.length) schedule(() => endTurn(false), 1400);
    else if (isAI(S.turn)) schedule(() => doMove(aiChoose(S.pos, S.turn, S.roll, S.level)), 700);
    // the forced move is worked out again when the timer fires, in case the player already moved
    else if (ms.length === 1 && prefs.autoMove && !S.guided) schedule(() => {
      const now = S.phase === 'move' && !isAI(S.turn) ? legalMoves(S.pos, S.turn, S.roll) : [];
      if (now.length === 1) doMove(now[0]);
    }, 750);
  }
}

function doRoll() {
  if (S.phase !== 'roll') return;
  S.phase = 'rolling';
  S.advice = null;
  dismissCoach(false);
  sfxDice();
  tumbleDice();
  const g = gen;
  const final = [0, 1, 2, 3].map(() => (Math.random() < 0.5 ? 1 : 0));
  let n = 0;
  const steps = reduced ? 0 : 9;
  const tick = () => {
    if (g !== gen) return;
    if (n++ < steps) {
      drawDice([0, 1, 2, 3].map(() => (Math.random() < 0.5 ? 1 : 0)), false);
      setTimeout(tick, 70);
      return;
    }
    S.dice = final;
    S.roll = final.reduce((a, b) => a + b, 0);
    S.phase = 'move';
    const ms = legalMoves(S.pos, S.turn, S.roll);
    const st = S.stats.p[S.turn];
    st.rolls++; st.dist[S.roll]++;
    if (!ms.length) {
      st.passes++;
      speak(S.turn, 'pass', 0, .5);
      S.note = S.roll === 0 ? 'Rolled 0. Turn passes.' : `No legal move with a ${S.roll}. Turn passes.`;
      addLog(`${nameOf(S.turn)} rolled ${S.roll}: no move`);
    } else S.note = '';
    render();
    advance();
  };
  render();
  tick();
}

// the counter hops square by square along its route before the move is committed
function hopAlong(p, m, done) {
  const el = document.querySelector(`[data-pid="${p}-${m.i}"]`);
  if (reduced || !el) { sfxHop(0, 0, true); return done(); }
  clearTargets();
  el.classList.remove('movable');
  el.style.zIndex = 20;
  const r0 = el.getBoundingClientRect();
  const cx0 = r0.left + r0.width / 2, cy0 = r0.top + r0.height / 2;
  const cellW = cells['1,0'].getBoundingClientRect().width;
  const pts = [];
  for (let s = m.from + 1; s <= m.to; s++) {
    let x, y, w;
    if (s === OFF) {
      const h = document.querySelector(`#tray${p} .home`).getBoundingClientRect();
      w = cellW * .55; x = h.right - w / 2; y = h.top + h.height / 2;
    } else {
      const c = cells[coord(p, s).join(',')].getBoundingClientRect();
      w = cellW * .8; x = c.left + c.width / 2; y = c.top + c.height / 2;
    }
    pts.push({ dx: x - cx0, dy: y - cy0, s: w / r0.width });
  }
  const n = pts.length, lift = cellW * .45;
  const frames = [{ transform: 'none', offset: 0, easing: 'ease-out' }];
  let prev = { dx: 0, dy: 0, s: 1 };
  pts.forEach((pt, k) => {
    frames.push({
      transform: `translate(${(prev.dx + pt.dx) / 2}px, ${(prev.dy + pt.dy) / 2 - lift}px) scale(${pt.s * 1.12}) rotate(${k % 2 ? 8 : -8}deg)`,
      offset: (k + .5) / n, easing: 'ease-in',
    });
    frames.push({ transform: `translate(${pt.dx}px, ${pt.dy}px) scale(${pt.s * 1.1}, ${pt.s * .86})`, offset: (k + 1) / n, easing: 'ease-out' });
    prev = pt;
  });
  const dur = n * 190 + (m.from === 0 ? 120 : 0);
  for (let k = 0; k < n; k++) sfxHop((k + 1) / n * dur / 1000, k, k === n - 1);
  const a = el.animate(frames, { duration: dur, fill: 'forwards' });
  a.onfinish = done;
}

let fx = null;
function burst(cell) {
  for (let i = 0; i < 12; i++) {
    const sp = document.createElement('span');
    sp.className = 'petal' + (i % 3 === 0 ? ' alt' : '');
    cell.appendChild(sp);
    const ang = i / 12 * Math.PI * 2 + Math.random() * .4, dist = cell.offsetWidth * (.6 + Math.random() * .4);
    sp.animate([
      { transform: 'translate(0,0) rotate(0) scale(.4)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + 14}px) rotate(${200 + Math.random() * 200}deg) scale(1)`, opacity: 0 },
    ], { duration: 750 + Math.random() * 250, easing: 'cubic-bezier(.2,.8,.4,1)' }).onfinish = () => sp.remove();
  }
}
function floatWord(cell, word) {
  const w = document.createElement('span');
  w.className = 'float-word';
  w.textContent = word;
  cell.appendChild(w);
  // unfurl sideways, hold, then drift upward and fade
  w.animate([
    { transform: 'translate(-50%, 4px) rotate(-3deg) scaleX(.05)', opacity: 0 },
    { transform: 'translate(-50%, -6px) rotate(-3deg) scaleX(1.06)', opacity: 1, offset: .18 },
    { transform: 'translate(-50%, -10px) rotate(-2deg) scaleX(1)', opacity: 1, offset: .3 },
    { transform: 'translate(-50%, -26px) rotate(1deg)', opacity: 1, offset: .7 },
    { transform: 'translate(-50%, -52px) rotate(2deg)', opacity: 0 },
  ], { duration: 1700, easing: 'ease-out' }).onfinish = () => w.remove();
}

function doMove(m) {
  if (S.phase !== 'move') return;
  clearTimeout(timer);  // a pending auto-move must not fire into a later turn
  S.phase = 'animating';
  S.advice = null;
  clearAdvice();
  dismissCoach(false);
  hopAlong(S.turn, m, () => finishMove(m));
}

function finishMove(m) {
  const p = S.turn, rose = ROSETTES.has(m.to), again = rollsAgain(m);
  fx = {
    moved: p + '-' + m.i,
    cap: m.cap >= 0 ? (1 - p) + '-' + m.cap : null,
    cell: m.to === OFF ? null : coord(p, m.to).join(','),
    rose,
  };
  if (m.cap >= 0) lastCaptureOf = 1 - p;
  let desc = m.from === 0 ? `entered a piece${m.to > 1 ? ' to ' + m.to : ''}` : m.to === OFF ? 'brought a piece home' : `moved ${m.from} → ${m.to}`;
  if (m.cap >= 0) desc += `, captured a ${SIDE[1 - p]} piece`;
  if (rose) desc += ', landed on a rose and rolls again';
  else if (again) desc += ' and rolls again';
  addLog(`${nameOf(p)} rolled ${S.roll}: ${desc}`);
  S.pos = applyMove(S.pos, p, m);
  S.lastTo = m.to === OFF ? null : coord(p, m.to);
  recordMove(p, m, rose);
  const over = won(S.pos, p);
  if (!over) {
    if (m.cap >= 0) { speak(p, 'capture'); speak(1 - p, 'captured', 900); }
    else if (m.to === CENTRE && RULES.safeCentre) speak(p, 'centre', 0, .8);
    else if (m.to === OFF) speak(p, 'home', 0, .6);
    else if (rose) speak(p, 'rose', 0, .5);
  } else { speak(p, 'win', 300); speak(1 - p, 'lose', 1500); }
  if (m.to === OFF) sfxHome();
  if (rose) sfxRose();
  if (won(S.pos, p)) {
    sfxFanfare(.5);
    S.phase = 'over'; S.winner = p;
    if (S.mode === 'ai') tally[p === 0 ? 'you' : 'computer']++; else tally[p === 0 ? 'sun' : 'moon']++;
    saveTally();
    recordGame(p);
    render();
    return;
  }
  S.note = rose ? 'A rose! Roll again.' : again ? 'A capture! Roll again.' : '';
  endTurn(again);
}

function endTurn(again) {
  if (!again) { S.stats.p[S.turn].chain = 0; S.turn = 1 - S.turn; S.note = ''; }
  S.phase = 'roll'; S.roll = null;
  render();
  advance();
}

function addLog(s) { S.log.unshift(s); }
