/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

const OFF = 15, CENTRE = 8;
const ROSETTES = new Set([4, 8, 14]);

// rule variants: Classic is Finkel's reconstruction; the others are house variants
const VARIANTS = {
  classic: { name: 'Classic', counters: 7, safeCentre: true, captureRoll: false,
    blurb: 'Irving Finkel’s reconstruction from the British Museum tablet. Seven counters each; roses give another roll and the centre rose is safe.' },
  quick: { name: 'Quick', counters: 5, safeCentre: true, captureRoll: false,
    blurb: 'The classic rules with five counters each, for a game about two-thirds as long.' },
  raiders: { name: 'Raiders', counters: 7, safeCentre: false, captureRoll: true,
    blurb: 'A fiercer game: every capture earns another roll, and the centre rose gives no protection.' },
};
let RULES = VARIANTS.classic;
const rollsAgain = m => ROSETTES.has(m.to) || (RULES.captureRoll && m.cap >= 0);
const COUNT_WORD = { 5: 'five', 7: 'seven' };
const PROB = [1, 4, 6, 4, 1].map(x => x / 16);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SIDE = ['Sun', 'Moon'];

// ---------- rules ----------
// player 0 = Sun (bottom row), player 1 = Moon (top row)
function coord(p, pos) {
  const own = p === 0 ? 2 : 0;
  if (pos <= 4) return [own, 4 - pos];
  if (pos <= 12) return [1, pos - 5];
  return [own, 20 - pos];
}
function legalMoves(pos, p, roll) {
  const res = [];
  if (!roll) return res;
  const seen = new Set();
  for (let i = 0; i < pos[p].length; i++) {
    const x = pos[p][i];
    if (x === OFF || seen.has(x)) continue;
    seen.add(x);
    const t = x + roll;
    if (t > OFF) continue;
    if (t < OFF && pos[p].includes(t)) continue;
    let cap = -1;
    if (t >= 5 && t <= 12) {
      const j = pos[1 - p].indexOf(t);
      if (j >= 0) { if (t === CENTRE && RULES.safeCentre) continue; cap = j; }
    }
    res.push({ i, from: x, to: t, cap });
  }
  return res;
}
function applyMove(pos, p, m) {
  const np = [pos[0].slice(), pos[1].slice()];
  np[p][m.i] = m.to;
  if (m.cap >= 0) np[1 - p][m.cap] = 0;
  return np;
}
const won = (pos, p) => pos[p].every(x => x === OFF);

// ---------- AI: expectiminimax over dice rolls ----------
function sideScore(pos, me) {
  const opp = pos[1 - me];
  let s = 0;
  for (const x of pos[me]) {
    if (x === OFF) { s += 22; continue; }
    if (x === 0) continue;
    s += x;
    const safeHere = x === CENTRE && RULES.safeCentre;
    if (safeHere) s += 4;
    else if (ROSETTES.has(x)) s += 1.5;
    if (x >= 13) s += 1;
    if (x >= 5 && x <= 12 && !safeHere) {
      let danger = 0;
      for (const y of opp) if (y < x && x - y <= 4) danger += PROB[x - y];
      s -= Math.min(danger, 1) * (x + 2);
    }
  }
  return s;
}
const evaluate = (pos, me) => sideScore(pos, me) - sideScore(pos, 1 - me);

function chanceNode(pos, toMove, depth, me) {
  let v = 0;
  for (let r = 0; r <= 4; r++) v += PROB[r] * moveNode(pos, toMove, r, depth, me);
  return v;
}
function moveNode(pos, toMove, r, depth, me) {
  const ms = legalMoves(pos, toMove, r);
  if (!ms.length) return depth <= 1 ? evaluate(pos, me) : chanceNode(pos, 1 - toMove, depth - 1, me);
  const maxing = toMove === me;
  let best = maxing ? -Infinity : Infinity;
  for (const m of ms) {
    const v = afterMove(pos, toMove, m, depth, me);
    if (maxing ? v > best : v < best) best = v;
  }
  return best;
}
function afterMove(pos, p, m, depth, me) {
  const np = applyMove(pos, p, m);
  if (won(np, p)) return p === me ? 1e4 + depth : -1e4 - depth;
  if (depth <= 1) return evaluate(np, me);
  return chanceNode(np, rollsAgain(m) ? p : 1 - p, depth - 1, me);
}
function aiChoose(pos, p, roll, level) {
  const ms = legalMoves(pos, p, roll);
  if (ms.length === 1) return ms[0];
  if (level === 'easy' && Math.random() < 0.4) return ms[Math.floor(Math.random() * ms.length)];
  const depth = { easy: 1, medium: 2, hard: 4 }[level] || 2;
  let best = [], bestV = -Infinity;
  for (const m of ms) {
    const v = afterMove(pos, p, m, depth, p);
    if (v > bestV + 1e-9) { bestV = v; best = [m]; } else if (Math.abs(v - bestV) <= 1e-9) best.push(m);
  }
  return best[Math.floor(Math.random() * best.length)];
}
