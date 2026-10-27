/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// ---------- painting ----------
const PATTERN = [
  ['ros', 'castle', 'five', 'shield', null, null, 'ros', 'crown'],
  ['five', 'tree', 'shield', 'ros', 'castle', 'five', 'crown', 'tree'],
  ['ros', 'shield', 'five', 'castle', null, null, 'ros', 'crown'],
];
const WASH = { ros: 'ochre', castle: 'rose', five: 'paper-deep', shield: 'woad', crown: 'sage', tree: 'ochre' };
const ink = 'fill:none;stroke:var(--ink);stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round';
const paint = (c, o = .8) => `fill:var(--${c});fill-opacity:${o}`;

function tileSVG(kind, k) {
  const w = `url(#wash${k % 4})`;
  let d = '';
  if (kind === 'ros') {
    for (let a = 0; a < 360; a += 72) {
      d += `<path d="M20 20 L18.6 6.4 L21.4 6.4 Z" transform="rotate(${a + 36} 20 20)" style="${paint('sage', .9)}"/>`;
      d += `<circle cx="20" cy="12.2" r="6.4" transform="rotate(${a} 20 20)" style="${paint('vermilion', .85)};stroke:var(--ink);stroke-width:1.1"/>`;
    }
    d += `<circle cx="20" cy="20" r="5" style="${paint('ochre', 1)};stroke:var(--ink);stroke-width:1.1"/>`;
    for (let a = 0; a < 360; a += 60) d += `<circle cx="20" cy="17.6" r=".8" transform="rotate(${a} 20 20)" style="fill:var(--ink)"/>`;
  } else if (kind === 'castle') {
    d += `<path d="M10 32 V17 H13 V13.5 H16 V17 H18.5 V13.5 H21.5 V17 H24 V13.5 H27 V17 H30 V32 Z" style="${paint('bone', .9)}"/>`;
    d += `<path d="M10 32 V17 H13 V13.5 H16 V17 H18.5 V13.5 H21.5 V17 H24 V13.5 H27 V17 H30 V32 Z M17 32 V26 Q20 22 23 26 V32 M14 21 v3 M26 21 v3" style="${ink}"/>`;
    d += `<path d="M20 13.5 V7 M20 7 l5 1.5 -5 1.5" style="${ink}"/><path d="M20 7 l5 1.5 -5 1.5 z" style="${paint('vermilion', .9)}"/>`;
  } else if (kind === 'shield') {
    d += `<path d="M11.5 9 H28.5 V19 Q28.5 28 20 33 Q11.5 28 11.5 19 Z" style="${paint('bone', .9)}"/>`;
    d += `<path d="M11.5 22 L20 14 L28.5 22 V19 Q28.5 28 20 33 Q11.5 28 11.5 19 Z" style="${paint('vermilion', .75)}"/>`;
    d += `<path d="M11.5 9 H28.5 V19 Q28.5 28 20 33 Q11.5 28 11.5 19 Z M11.5 22 L20 14 L28.5 22" style="${ink}"/>`;
  } else if (kind === 'crown') {
    d += `<path d="M10 29 L11 14 L16 21 L20 10 L24 21 L29 14 L30 29 Z" style="${paint('ochre', .95)}"/>`;
    d += `<path d="M10 29 L11 14 L16 21 L20 10 L24 21 L29 14 L30 29 Z M10.5 25 H29.5" style="${ink}"/>`;
    d += [[11, 13], [20, 9], [29, 13]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" style="${paint('vermilion', 1)};stroke:var(--ink);stroke-width:.8"/>`).join('');
  } else if (kind === 'tree') {
    d += `<path d="M19 33 V22 M21 33 V22" style="${ink}"/><path d="M19 33 V22 H21 V33 Z" style="${paint('ink-soft', .7)}"/>`;
    d += `<path d="M20 7 C27 7 31 12 30 17 C31 22 26 25 20 24 C14 25 9 22 10 17 C9 12 13 7 20 7 Z" style="${paint('sage', .9)}"/>`;
    d += `<path d="M20 7 C27 7 31 12 30 17 C31 22 26 25 20 24 C14 25 9 22 10 17 C9 12 13 7 20 7 Z" style="${ink}"/>`;
    d += [[16, 14], [24, 13], [20, 19], [26, 19]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" style="${paint('vermilion', .9)}"/>`).join('');
  } else if (kind === 'five') {
    for (const [x, y] of [[11, 11], [29, 11], [11, 29], [29, 29], [20, 20]])
      d += `<circle cx="${x}" cy="${y}" r="4" style="${paint('woad', .8)};stroke:var(--ink);stroke-width:1"/><circle cx="${x}" cy="${y}" r="1.3" style="fill:var(--bone)"/>`;
  }
  return `<svg class="tile" viewBox="0 0 40 40" aria-hidden="true">
    <rect x="1.5" y="1.5" width="37" height="37" rx="4" style="${paint(WASH[kind], .78)}" filter="${w}"/>
    <rect x="1.5" y="1.5" width="37" height="37" rx="4" style="fill:none;stroke:var(--${WASH[kind]});stroke-opacity:.6;stroke-width:2.2" filter="${w}"/>
    <rect x="2" y="2" width="36" height="36" rx="4" style="${ink};stroke-width:1.5" filter="url(#ink)"/>
    <g class="art" filter="url(#ink)">${d}</g></svg>`;
}

const pieceSVG = (p, k) => {
  let emblem;
  if (p === 0) {
    emblem = '';
    for (let a = 0; a < 360; a += 45) emblem += `<path d="M20 9.5 V6.5" transform="rotate(${a} 20 20)" style="${ink};stroke-width:1.4"/>`;
    emblem += `<circle cx="20" cy="20" r="7" style="${paint('bone', 1)};stroke:var(--ink);stroke-width:1.2"/>
      <path d="M17 19 h.1 M23 19 h.1" style="${ink};stroke-width:1.8"/><path d="M17 22.5 Q20 25 23 22.5" style="${ink}"/>`;
  } else {
    emblem = `<circle cx="18" cy="20" r="10" style="fill:#fffaf0" mask="url(#moonmask)"/>
      <circle cx="28.5" cy="13" r="1.3" style="fill:#fffaf0"/><circle cx="29.5" cy="25" r="1" style="fill:#fffaf0"/>`;
  }
  // solid disc first so the tile never shows through; the wash on top only adds texture
  return `<svg viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="18.5" style="fill:var(--bone)"/>
    <circle cx="20" cy="20" r="15.5" style="fill:var(--${p === 0 ? 'sunfire' : 'night'})"/>
    <circle cx="20" cy="20" r="15" style="${paint(p === 0 ? 'ochre' : 'woad', .55)}" filter="url(#wash${k % 4})"/>
    <g filter="url(#ink)"><circle cx="20" cy="20" r="18.5" style="${ink};stroke-width:2.2"/>
    <circle cx="20" cy="20" r="15.5" style="${ink};stroke-width:1"/>${emblem}</g></svg>`;
};

const dieSVG = (v, k) => `<svg class="die" viewBox="0 0 40 36">
  <polygon points="20,2 38,34 2,34" style="${paint('bone', 1)}" filter="url(#wash${k})"/>
  <polygon points="20,23 38,34 2,34" style="${paint('paper-deep', .9)}" filter="url(#wash${k})"/>
  <g filter="url(#ink)"><path d="M20 2 L38 34 L2 34 Z M20 2 L20 23 M2 34 L20 23 M38 34 L20 23" style="${ink};stroke-width:1.4"/>
  ${v ? `<circle cx="20" cy="23" r="4.2" style="${paint('vermilion', 1)};stroke:var(--ink);stroke-width:1"/>` : '<circle cx="20" cy="23" r="1.3" style="fill:var(--ink)"/>'}</g></svg>`;

// route numbers: each private row belongs to one player, so labels are unambiguous
const routeNum = {};
for (const p of [0, 1]) for (let k = 1; k <= 14; k++) routeNum[coord(p, k).join(',')] = k;

const cells = {};
const board = $('board');
let k = 0;
for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
  const kind = PATTERN[r][c];
  if (!kind) {
    if (c === 4) {
      const g = document.createElement('div');
      g.className = 'cell gap g1';
      g.innerHTML = r === 0 ? 'Moon’s<br>gate' : r === 2 ? 'Sun’s<br>gate' : '';
      board.appendChild(g);
    }
    continue;
  }
  const el = document.createElement('div');
  const safe = r === 1 && c === 3;
  el.className = 'cell' + (safe ? ' safe-sq' : '');
  el.title = (kind === 'ros' ? (safe ? 'Centre rose: roll again, and safe from capture' : 'Rose: roll again')
    : 'Ordinary square (the picture is decoration only)') + ` · square ${routeNum[r + ',' + c]}`;
  el.innerHTML = tileSVG(kind, k++) + `<span class="num">${routeNum[r + ',' + c]}</span><div class="slot"></div>`;
  cells[r + ',' + c] = el;
  board.appendChild(el);
}

// board key: the same painted tiles, small, with what each one does
const keyTile = (kind, seed, safe) => `<span class="key-tile${safe ? ' safe-sq' : ''}">${tileSVG(kind, seed)}</span>`;
$('key').innerHTML = `
  <span class="key-title">Board key</span>
  <span class="key-item"><span class="key-icons">${keyTile('ros', 0)}</span><span><b>Rose</b><small>Land here to roll again</small></span></span>
  <span class="key-item"><span class="key-icons" id="key-centre-tile">${keyTile('ros', 1, true)}</span><span><b>Centre rose</b><small id="key-centre">Roll again, and safe from capture</small></span></span>
  <span class="key-item"><span class="key-icons">${['castle', 'shield', 'crown', 'tree', 'five'].map((t, i) => keyTile(t, i)).join('')}</span><span><b>Ordinary squares</b><small>Pictures are decoration only</small></span></span>`;

// squares for the route diagram in the rules
$('route-cells').innerHTML = PATTERN.flatMap((row, r) => row.map((kind, c) => {
  const x = 4 + c * 30, y = 4 + r * 30;
  if (!kind) return c === 4 && r !== 1 ? `<text x="152" y="${y + 16}" text-anchor="middle" style="font:italic 9px var(--f-note);fill:var(--ink-soft)">gate</text>` : '';
  const rose = kind === 'ros', safe = r === 1 && c === 3;
  return `<rect x="${x}" y="${y}" width="26" height="26" rx="4" style="fill:var(--${rose ? 'ochre' : 'bone'});fill-opacity:${rose ? .55 : 1};stroke:${safe ? 'var(--ochre)' : 'var(--ink-soft)'};stroke-width:${safe ? 2.5 : 1}"/>`
    + (rose ? `<circle cx="${x + 13}" cy="${y + 13}" r="5" style="fill:var(--vermilion);fill-opacity:.8"/>` : '');
})).join('');

// each die lives in a persistent slot so its tumble survives the face changes
const dieSlots = [0, 1, 2, 3].map(() => {
  const s = document.createElement('span');
  s.className = 'die-slot';
  $('dice').appendChild(s);
  return s;
});
function tumbleDice() {
  if (reduced) return;
  const r = (a, b) => a + Math.random() * (b - a);
  dieSlots.forEach((s, i) => {
    const spin = (Math.random() < .5 ? -1 : 1) * r(320, 560), x = r(-7, 7);
    s.animate([
      { transform: 'translate(0,0) rotate(0)' },
      { transform: `translate(${x}px,${r(-30, -22)}px) rotate(${spin * .45}deg) scale(1.1)`, offset: .32, easing: 'ease-in' },
      { transform: `translate(${x * .6}px,0) rotate(${spin * .8}deg) scale(1.15,.8)`, offset: .62, easing: 'ease-out' },
      { transform: `translate(${x * .3}px,-8px) rotate(${spin * .93}deg)`, offset: .8, easing: 'ease-in' },
      { transform: `translate(0,0) rotate(${spin}deg) scale(1.06,.92)`, offset: .93 },
      { transform: `translate(0,0) rotate(${Math.round(spin / 120) * 120}deg)` },
    ], { duration: 520 + i * 40, easing: 'linear' });
  });
}
function drawDice(d, final) {
  (d || [0, 0, 0, 0]).forEach((v, i) => { dieSlots[i].innerHTML = dieSVG(v, i); });
  if (final && d && !reduced && $('total').textContent === '·') $('total').animate(
    [{ transform: 'scale(.3) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.35) rotate(6deg)', opacity: 1, offset: .6 }, { transform: 'none' }],
    { duration: 380, easing: 'ease-out' });
  $('dice').classList.toggle('idle', !d);
  $('total').textContent = final && d ? d.reduce((a, b) => a + b, 0) : (d ? '·' : '–');
}

function clearTargets() {
  document.querySelectorAll('.target').forEach(e => e.classList.remove('target', 'capture'));
  $('arrow-preview').setAttribute('hidden', '');
}
function showTarget(m) {
  clearTargets();
  if (S.phase !== 'move') return;  // e.g. pointing at a counter while another is still hopping
  const el = m.to === OFF ? document.querySelector(`#tray${S.turn} .home`) : cells[coord(S.turn, m.to).join(',')];
  el.classList.add('target');
  if (m.cap >= 0) el.classList.add('capture');
  const piece = document.querySelector(`[data-pid="${S.turn}-${m.i}"]`);
  if (piece) drawArrow($('arrow-preview'), piece, el);
}

// a curved dotted arrow from a counter to where it would land; it bows upwards, leaves from the
// counter's edge and stops at the target ring. Coordinates are page coordinates, so it scrolls with the board.
function drawArrow(path, fromEl, toEl) {
  const centre = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 + scrollX, y: r.top + r.height / 2 + scrollY, r: Math.min(r.width, r.height) / 2 }; };
  const a = centre(fromEl), b = centre(toEl);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
  const bow = Math.min(len * .32, 80);
  const c = { x: (a.x + b.x) / 2 + nx * bow, y: (a.y + b.y) / 2 + ny * bow };
  // on short hops, shrink the gaps so the arrow never turns inside out
  const room = Math.min(1, len / ((a.r + b.r) * 1.6));
  const along = (p, d) => { const l = Math.hypot(c.x - p.x, c.y - p.y) || 1; return { x: p.x + (c.x - p.x) * d / l, y: p.y + (c.y - p.y) * d / l }; };
  const s = along(a, a.r * .9 * room), e = along(b, (b.r * .72 + 6) * room);
  // the layer covers the whole page so nothing it draws is clipped
  const layer = $('arrow-layer');
  layer.setAttribute('width', document.documentElement.scrollWidth);
  layer.setAttribute('height', document.documentElement.scrollHeight);
  path.setAttribute('d', `M${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`);
  path.removeAttribute('hidden');
}

function makePiece(p, i, m) {
  const x = S.pos[p][i];
  const label = `${SIDE[p]} piece ${x === 0 ? 'waiting' : x === OFF ? 'home' : 'on square ' + x}`;
  const el = document.createElement(m ? 'button' : 'div');
  el.className = `piece p${p}` + (m ? ' movable' : '');
  el.dataset.pid = p + '-' + i;
  el.innerHTML = pieceSVG(p, i + p);
  if (m) {
    el.type = 'button';
    el.setAttribute('aria-label', `${label}: move to ${m.to === OFF ? 'home' : 'square ' + m.to}${m.cap >= 0 ? ', capturing' : ''}`);
    el.addEventListener('click', () => { clearTargets(); doMove(m); });
    el.addEventListener('pointerenter', () => showTarget(m));
    el.addEventListener('focus', () => showTarget(m));
    el.addEventListener('pointerleave', clearTargets);
    el.addEventListener('blur', clearTargets);
  } else {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
  }
  return el;
}

function renderTray(p) {
  const tray = $('tray' + p);
  const waiting = S.pos[p].filter(x => x === 0).length;
  const home = S.pos[p].filter(x => x === OFF).length;
  const active = S.phase !== 'over' && S.phase !== 'setup' && S.turn === p;
  tray.classList.toggle('active', active);
  tray.innerHTML = `
    <div class="tray-name">${nameOf(p)}${S.mode === 'ai' ? ` <span class="side">play${p === 0 ? '' : 's'} the ${SIDE[p]}</span>` : ''}${active ? ' <span class="chip">to move</span>' : ''}</div>
    <div class="tray-count">${waiting} waiting · ${home} of ${S.pos[p].length} home</div>
    <div class="pool wait"></div><div class="pool home"></div>`;
  return { wait: tray.querySelector('.wait'), home: tray.querySelector('.home') };
}

function render() {
  const before = new Map();
  document.querySelectorAll('[data-pid]').forEach(el => before.set(el.dataset.pid, el.getBoundingClientRect()));

  const moves = S.phase === 'move' && !isAI(S.turn) ? legalMoves(S.pos, S.turn, S.roll) : [];
  const movable = new Map(moves.map(m => [S.turn + '-' + m.i, m]));
  // keyboard numbers: the counter furthest along the route is 1
  const keyOrder = moves.slice().sort((a, b) => b.from - a.from).map(m => m.i);

  Object.values(cells).forEach(c => { c.querySelector('.slot').replaceChildren(); c.classList.remove('lastto', 'target', 'capture', 'occupied'); });
  clearTargets();  // the counters are rebuilt, so any preview ring or arrow belongs to the old ones
  if (S.lastTo) cells[S.lastTo.join(',')].classList.add('lastto');
  const trays = [renderTray(0), renderTray(1)];
  for (const p of [0, 1]) for (let i = 0; i < S.pos[p].length; i++) {
    const x = S.pos[p][i];
    const el = makePiece(p, i, movable.get(p + '-' + i));
    if (S.advice && S.phase === 'move' && p === S.turn && i === S.advice.i) el.classList.add('advised');
    const key = keyOrder.indexOf(i);
    if (movable.has(p + '-' + i) && key >= 0) {
      el.dataset.key = key + 1;
      el.setAttribute('aria-keyshortcuts', String(key + 1));
      el.setAttribute('aria-label', el.getAttribute('aria-label') + `. Key ${key + 1}`);
    }
    if (x === 0) trays[p].wait.appendChild(el);
    else if (x === OFF) trays[p].home.appendChild(el);
    else {
      const cell = cells[coord(p, x).join(',')];
      cell.classList.add('occupied');
      cell.querySelector('.slot').appendChild(el);
    }
  }

  const f = fx; fx = null;
  if (!reduced) document.querySelectorAll('[data-pid]').forEach(el => {
    const pid = el.dataset.pid;
    if (f && pid === f.moved) {
      // already hopped into place: land with a squash
      el.animate([{ transform: 'scale(1.2, .78)' }, { transform: 'scale(.93, 1.1)', offset: .45 }, { transform: 'none' }],
        { duration: 320, easing: 'ease-out' });
      return;
    }
    const b = before.get(pid);
    if (!b) return;
    const a = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    const s = b.width / a.width;
    el.style.zIndex = 5;
    const frames = f && pid === f.cap
      ? [ // knocked off the board: a wobble, then a spinning arc back to the tray
          { transform: `translate(${dx}px,${dy}px) scale(${s})` },
          { transform: `translate(${dx + 4}px,${dy - 6}px) scale(${s * 1.2}) rotate(-25deg)`, offset: .14 },
          { transform: `translate(${dx * .5}px,${dy * .5 - 90}px) scale(${s * 1.15}) rotate(380deg)`, offset: .55 },
          { transform: 'rotate(720deg)' },
        ]
      : [{ transform: `translate(${dx}px,${dy}px) scale(${s})` }, { transform: 'translateY(-8px) scale(1.12)', offset: .6 }, { transform: 'none' }];
    el.animate(frames, { duration: f && pid === f.cap ? 900 : 480, easing: 'cubic-bezier(.2,.7,.2,1)' })
      .onfinish = () => { el.style.zIndex = ''; };
  });
  if (f && f.cap) sfxCapture();
  if (f && f.cell && !reduced) {
    const cell = cells[f.cell];
    if (f.rose) burst(cell);
    if (f.cap) floatWord(cell, ['Thwack!', 'Begone!', 'Huzzah!'][Math.floor(Math.random() * 3)]);
    else if (f.rose) floatWord(cell, 'Roll again!');
  }

  if (S.phase !== 'rolling') drawDice(S.dice, true);

  const st = $('status'), btn = $('roll');
  st.classList.toggle('win', S.phase === 'over');
  const who = nameOf(S.turn), you = S.mode === 'ai' && S.turn === 0;
  let head = '', sub = '';
  if (S.phase === 'setup') {
    head = 'Ready when you are';
    sub = S.mode === 'ai' ? 'Choose your opponent, then press Start game.' : 'Press Start game when you’re both ready.';
  } else if (S.phase === 'over') {
    head = S.mode === 'ai' ? (S.winner === 0 ? 'Victory is yours!' : 'The computer triumphs.') : `The ${SIDE[S.winner]} triumphs!`;
    sub = `All ${COUNT_WORD[S.pos[S.winner].length]} counters brought home.`;
  } else if (S.phase === 'roll') {
    head = isAI(S.turn) ? 'The computer rolls…' : you ? 'Your roll' : `${who} to roll`;
    sub = S.note || (isAI(S.turn) ? '' : 'Press Space or R to roll.');
  } else if (S.phase === 'rolling') {
    head = 'The dice tumble…';
  } else {
    const has = legalMoves(S.pos, S.turn, S.roll).length;
    head = `${you ? 'You' : who} rolled ${S.roll}.`;
    const auto = has === 1 && prefs.autoMove && !S.guided && !isAI(S.turn);
    sub = S.note || (isAI(S.turn) ? 'Pondering…' : auto ? 'Only one move: playing it for you.'
      : has ? (kbdMode ? `Press ${has > 1 ? '1 to ' + has : '1'}, or use the arrows and Enter.` : 'Choose a glowing piece.') : '');
    if (S.advice) sub = 'Advice is marked on the board.';
  }
  st.innerHTML = `<strong>${head}</strong><span>${sub}</span>`;
  btn.textContent = S.phase === 'over' ? 'Play again' : 'Roll';
  btn.disabled = !(S.phase === 'over' || (S.phase === 'roll' && !isAI(S.turn)));
  // Advise me takes the Roll button's place while the player is choosing, so the dice box keeps its size
  // Advise me takes the slot whenever advice is on offer; on Knight a badge counts what's left and it greys out at 0
  const offered = adviceOffered(), left = adviceLeft(), adv = $('advise');
  btn.classList.toggle('swapped', offered);
  adv.classList.toggle('swapped', !offered);
  adv.disabled = !offered || left <= 0;
  $('advice-left').hidden = left === Infinity || !(S.level in ADVICE_LIMIT);
  $('advice-left').textContent = left === Infinity ? '' : left;
  adv.title = left <= 0 ? 'No advice left this game' : left === Infinity ? '' : `${left} piece${left === 1 ? '' : 's'} of advice left this game`;
  adv.setAttribute('aria-label', left <= 0 ? 'Advise me: no advice left this game' : left === Infinity ? 'Advise me' : `Advise me, ${left} left`);
  drawAdvice();

  // newest first; if the reader has scrolled back through older moves, keep their place as new lines arrive
  const log = $('log'), top = log.scrollTop, h = log.scrollHeight;
  log.innerHTML = S.log.length ? S.log.map((l, i) => `<li><span class="n">${S.log.length - i}.</span>${l}</li>`).join('')
    : '<li class="waiting">The scribe awaits the first move.</li>';
  if (top > 2) log.scrollTop = top + log.scrollHeight - h;
  $('level-field').hidden = S.mode !== 'ai';
  // mode and opponent can only change between games; the button invites a start, or offers a new game mid-game
  const locked = !gameIdle(), why = locked ? 'Start a new game to change this' : '';
  document.querySelectorAll('input[name=mode]').forEach(r => { r.disabled = locked; });
  $('level').disabled = locked;
  document.querySelector('.seg').title = why;
  $('level-field').title = why;
  $('newgame').classList.toggle('start', !locked);
  $('newgame').querySelector('.lbl').textContent = locked ? 'New game' : 'Start game';
  $('tally').innerHTML = S.mode === 'ai'
    ? `Wins: You <b>${tally.you}</b> · Computer <b>${tally.computer}</b>`
    : `Wins: Sun <b>${tally.sun}</b> · Moon <b>${tally.moon}</b>`;
  if (S.variant !== 'classic') $('tally').innerHTML += ` · <i>${RULES.name} rules</i>`;
  guideCheck();
  drawPortraits();
  focusFirstMovable();
}
