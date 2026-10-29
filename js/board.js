/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Drawing the board: tiles, counters, dice, move previews, and render(), which redraws the game from its state.

// ---------- painting ----------
// the picture on each board cell (null = the gap where the gates are)
const BOARD_PICTURES = [
  ['ros', 'castle', 'five', 'shield', null, null, 'ros', 'crown'],
  ['five', 'tree', 'shield', 'ros', 'castle', 'five', 'crown', 'tree'],
  ['ros', 'shield', 'five', 'castle', null, null, 'ros', 'crown'],
];
const GATE_COLUMN = 4; // first column of the gap; the gate label spans it and the next
const WASH_FILTERS = 4; // #wash0 to #wash3 vary the watercolour texture
const isCentreCell = (row, column) => cellKey([row, column]) === CENTRE_CELL;
// The drawings' colours and line weights are in css/drawings.css, by class: ink-line is the hand-inked outline,
// and each painted part is named for what it is. A tile's watercolour wash follows its picture (tile-castle etc.).

function tileSVG(kind, seed) {
  const wash = `url(#wash${seed % WASH_FILTERS})`;
  let art = '';
  if (kind === 'ros') {
    for (let angle = 0; angle < 360; angle += 72) {
      art += `<path d="M20 20 L18.6 6.4 L21.4 6.4 Z" transform="rotate(${angle + 36} 20 20)" class="rose-leaf"/>`;
      art += `<circle cx="20" cy="12.2" r="6.4" transform="rotate(${angle} 20 20)" class="rose-petal"/>`;
    }
    art += `<circle cx="20" cy="20" r="5" class="rose-heart"/>`;
    for (let angle = 0; angle < 360; angle += 60)
      art += `<circle cx="20" cy="17.6" r=".8" transform="rotate(${angle} 20 20)" class="rose-stamen"/>`;
  } else if (kind === 'castle') {
    art += `<path d="M10 32 V17 H13 V13.5 H16 V17 H18.5 V13.5 H21.5 V17 H24 V13.5 H27 V17 H30 V32 Z" class="castle-wall"/>`;
    art += `<path d="M10 32 V17 H13 V13.5 H16 V17 H18.5 V13.5 H21.5 V17 H24 V13.5 H27 V17 H30 V32 Z M17 32 V26 Q20 22 23 26 V32 M14 21 v3 M26 21 v3" class="ink-line"/>`;
    art += `<path d="M20 13.5 V7 M20 7 l5 1.5 -5 1.5" class="ink-line"/><path d="M20 7 l5 1.5 -5 1.5 z" class="castle-flag"/>`;
  } else if (kind === 'shield') {
    art += `<path d="M11.5 9 H28.5 V19 Q28.5 28 20 33 Q11.5 28 11.5 19 Z" class="shield-field"/>`;
    art += `<path d="M11.5 22 L20 14 L28.5 22 V19 Q28.5 28 20 33 Q11.5 28 11.5 19 Z" class="shield-chevron"/>`;
    art += `<path d="M11.5 9 H28.5 V19 Q28.5 28 20 33 Q11.5 28 11.5 19 Z M11.5 22 L20 14 L28.5 22" class="ink-line"/>`;
  } else if (kind === 'crown') {
    art += `<path d="M10 29 L11 14 L16 21 L20 10 L24 21 L29 14 L30 29 Z" class="crown-gold"/>`;
    art += `<path d="M10 29 L11 14 L16 21 L20 10 L24 21 L29 14 L30 29 Z M10.5 25 H29.5" class="ink-line"/>`;
    art += [
      [11, 13],
      [20, 9],
      [29, 13],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" class="crown-jewel"/>`)
      .join('');
  } else if (kind === 'tree') {
    art += `<path d="M19 33 V22 M21 33 V22" class="ink-line"/><path d="M19 33 V22 H21 V33 Z" class="tree-trunk"/>`;
    art += `<path d="M20 7 C27 7 31 12 30 17 C31 22 26 25 20 24 C14 25 9 22 10 17 C9 12 13 7 20 7 Z" class="tree-leaves"/>`;
    art += `<path d="M20 7 C27 7 31 12 30 17 C31 22 26 25 20 24 C14 25 9 22 10 17 C9 12 13 7 20 7 Z" class="ink-line"/>`;
    art += [
      [16, 14],
      [24, 13],
      [20, 19],
      [26, 19],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" class="tree-fruit"/>`)
      .join('');
  } else if (kind === 'five') {
    for (const [x, y] of [
      [11, 11],
      [29, 11],
      [11, 29],
      [29, 29],
      [20, 20],
    ])
      art += `<circle cx="${x}" cy="${y}" r="4" class="five-spot"/><circle cx="${x}" cy="${y}" r="1.3" class="five-spot-centre"/>`;
  }
  return `<svg class="tile tile-${kind}" viewBox="0 0 40 40" aria-hidden="true">
    <rect x="1.5" y="1.5" width="37" height="37" rx="4" class="tile-wash" filter="${wash}"/>
    <rect x="1.5" y="1.5" width="37" height="37" rx="4" class="tile-wash-edge" filter="${wash}"/>
    <rect x="2" y="2" width="36" height="36" rx="4" class="ink-line tile-border" filter="url(#ink)"/>
    <g class="art" filter="url(#ink)">${art}</g></svg>`;
}

// a Sun counter shows a smiling sun, a Moon counter a crescent
function counterSVG(side, seed) {
  let emblem;
  if (side === SUN) {
    emblem = '';
    for (let angle = 0; angle < 360; angle += 45)
      emblem += `<path d="M20 9.5 V6.5" transform="rotate(${angle} 20 20)" class="ink-line sun-ray"/>`;
    emblem += `<circle cx="20" cy="20" r="7" class="sun-face"/>
      <path d="M17 19 h.1 M23 19 h.1" class="ink-line sun-eyes"/><path d="M17 22.5 Q20 25 23 22.5" class="ink-line"/>`;
  } else {
    emblem = `<circle cx="18" cy="20" r="10" class="moon-crescent" mask="url(#moonmask)"/>
      <circle cx="28.5" cy="13" r="1.3" class="moon-star"/><circle cx="29.5" cy="25" r="1" class="moon-star"/>`;
  }
  // solid disc first so the tile never shows through; the wash on top only adds texture
  return `<svg class="counter-${side === SUN ? 'sun' : 'moon'}" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="18.5" class="counter-rim"/>
    <circle cx="20" cy="20" r="15.5" class="counter-face"/>
    <circle cx="20" cy="20" r="15" class="counter-wash" filter="url(#wash${seed % WASH_FILTERS})"/>
    <g filter="url(#ink)"><circle cx="20" cy="20" r="18.5" class="ink-line counter-edge"/>
    <circle cx="20" cy="20" r="15.5" class="ink-line counter-inner-edge"/>${emblem}</g></svg>`;
}

// a die seen from above; a marked tip is painted red
const dieSVG = (marked, seed) => `<svg class="die" viewBox="0 0 40 36">
  <polygon points="20,2 38,34 2,34" class="die-face" filter="url(#wash${seed})"/>
  <polygon points="20,23 38,34 2,34" class="die-shade" filter="url(#wash${seed})"/>
  <g filter="url(#ink)"><path d="M20 2 L38 34 L2 34 Z M20 2 L20 23 M2 34 L20 23 M38 34 L20 23" class="ink-line die-edges"/>
  ${marked ? '<circle cx="20" cy="23" r="4.2" class="die-mark"/>' : '<circle cx="20" cy="23" r="1.3" class="die-tip"/>'}</g></svg>`;

// ---------- building the board ----------
const boardCells = {};
const boardElement = $('board');
let tileSeed = 0;
for (let row = 0; row < BOARD_ROWS; row++)
  for (let column = 0; column < BOARD_COLUMNS; column++) {
    const kind = BOARD_PICTURES[row][column];
    if (!kind) {
      if (column === GATE_COLUMN) boardElement.appendChild(gateLabel(row));
      continue;
    }
    const key = cellKey([row, column]);
    const cell = document.createElement('div');
    cell.className = 'cell';
    placeOnBoard(cell, row, column, 1);
    cell.innerHTML =
      tileSVG(kind, tileSeed++) +
      '<span class="danger-wash" aria-hidden="true"></span><span class="num"></span><span class="num num-moon"></span><div class="slot"></div>' +
      '<span class="danger-chance" aria-hidden="true"></span>';
    boardCells[key] = cell;
    boardElement.appendChild(cell);
  }
const boardSlots = Object.values(boardCells).map((cell) => cell.querySelector('.slot')); // where counters stand on the board
// every square and gate label names its own row and column, so the friend's board can mirror the rows in CSS
function placeOnBoard(element, row, column, span) {
  element.style.setProperty('--row', row);
  element.style.gridColumn = `${column + 1} / span ${span}`;
}
function gateLabel(row) {
  const gate = document.createElement('div');
  gate.className = 'cell gap g1';
  placeOnBoard(gate, row, GATE_COLUMN, 2);
  gate.innerHTML = row === ROW.MOON ? 'Moon’s<br>gate' : row === ROW.SUN ? 'Sun’s<br>gate' : '';
  return gate;
}

// board key: the same painted tiles, small, with what each one does
const keyTile = (kind, seed, safe) => `<span class="key-tile${safe ? ' safe-sq' : ''}">${tileSVG(kind, seed)}</span>`;
$('key').innerHTML = `
  <span class="key-title">Board key</span>
  <span class="key-item"><span class="key-icons">${keyTile('ros', 0)}</span><span><b>Rose</b><small>Land here to roll again</small></span></span>
  <span class="key-item"><span class="key-icons" id="key-centre-tile">${keyTile('ros', 1, true)}</span><span><b id="key-centre-name">Centre rose</b><small id="key-centre">Roll again, and safe from capture</small></span></span>
  <span class="key-item"><span class="key-icons">${['castle', 'shield', 'crown', 'tree', 'five'].map((kind, i) => keyTile(kind, i)).join('')}</span><span><b>Ordinary squares</b><small>Pictures are decoration only</small></span></span>
  <span class="key-item" id="key-danger" hidden><span class="key-icons"><span class="key-danger-swatch"></span></span><span><b>Danger</b><small>Chance the Squire can land there next turn</small></span></span>`;

// ---------- labelling the board for the current rules ----------
// Each cell's square numbers on each side's route, written like "5/17" where a route doubles back;
// where the two sides' numbers differ (Masters' and Murray's routes), both are shown.
const routeNumbersAt = (key) => ({
  sun: (currentRules.squaresAt[SUN][key] || []).join('/'),
  moon: (currentRules.squaresAt[MOON][key] || []).join('/'),
});
const anySquareAt = (key, rules = currentRules) => (rules.squaresAt[SUN][key] || rules.squaresAt[MOON][key])[0];
function squareLabel(key) {
  const { sun, moon } = routeNumbersAt(key),
    noun = (sun || moon).includes('/') ? 'squares' : 'square';
  if (sun && moon && sun !== moon) return `${noun} ${sun} for the Sun, ${moon} for the Moon`;
  return `${noun} ${sun || moon}`;
}
// route numbers, hover text and the gold ring on safe roses
function labelBoardSquares() {
  for (const [key, cell] of Object.entries(boardCells)) {
    const { sun, moon } = routeNumbersAt(key),
      differ = sun && moon && sun !== moon;
    const [sunTag, moonTag] = cell.querySelectorAll('.num');
    sunTag.textContent = sun || moon || '';
    sunTag.classList.toggle('num-sun', !!differ);
    moonTag.textContent = differ ? moon : '';
    moonTag.hidden = !differ;
    const square = anySquareAt(key),
      rose = ROSE_CELLS.has(key),
      safe = rose && isSafeSquare(square);
    cell.classList.toggle('safe-sq', safe);
    cell.title =
      (rose
        ? safe
          ? 'Rose: roll again, and safe from capture'
          : 'Rose: roll again'
        : 'Ordinary square (the picture is decoration only)') + ` · ${squareLabel(key)}`;
  }
}

// squares for the route diagram in the rules (a 30-unit grid with 26-unit squares)
const DIAGRAM_PITCH = 30,
  DIAGRAM_SQUARE = 26,
  DIAGRAM_MARGIN = 4,
  DIAGRAM_GATE_X = 152;
$('route-cells').innerHTML = BOARD_PICTURES.flatMap((pictures, row) =>
  pictures.map((kind, column) => {
    const x = DIAGRAM_MARGIN + column * DIAGRAM_PITCH,
      y = DIAGRAM_MARGIN + row * DIAGRAM_PITCH;
    if (!kind)
      return column === GATE_COLUMN && row !== ROW.SHARED
        ? `<text x="${DIAGRAM_GATE_X}" y="${y + 16}" text-anchor="middle" class="diagram-gate">gate</text>`
        : '';
    const rose = kind === 'ros',
      middle = DIAGRAM_SQUARE / 2;
    return (
      `<rect class="diagram-square${rose ? ' diagram-rose' : ''}" data-cell="${cellKey([row, column])}" x="${x}" y="${y}" width="${DIAGRAM_SQUARE}" height="${DIAGRAM_SQUARE}" rx="4"/>` +
      (rose ? `<circle cx="${x + middle}" cy="${y + middle}" r="5" class="diagram-rose-dot"/>` : '')
    );
  }),
).join('');
// draw each side's route through the diagram, from its gate and back out; the two lines sit a little apart
const DIAGRAM_LANE = { [SUN]: { dx: 3, dy: 4 }, [MOON]: { dx: -3, dy: -4 } };
// a route's cells with a short lead-in before the first square and a lead-out after the last, in its direction of travel
const ROUTE_LEAD_IN = 0.75,
  ROUTE_LEAD_OUT = 0.9;
function routeWithLeads(cells) {
  const [first, second] = cells,
    [beforeLast, last] = cells.slice(-2);
  const beyond = (from, towards, distance) => from.map((n, i) => n + (from[i] - towards[i]) * distance);
  return [beyond(first, second, ROUTE_LEAD_IN), ...cells, beyond(last, beforeLast, ROUTE_LEAD_OUT)];
}
function drawRouteDiagram() {
  const centreOf = ([row, column], side) => [
    DIAGRAM_MARGIN + column * DIAGRAM_PITCH + DIAGRAM_SQUARE / 2 + DIAGRAM_LANE[side].dx,
    DIAGRAM_MARGIN + row * DIAGRAM_PITCH + DIAGRAM_SQUARE / 2 + DIAGRAM_LANE[side].dy,
  ];
  for (const side of SIDES) {
    const points = routeWithLeads(currentRules.cells[side]).map((cell) => centreOf(cell, side));
    $('route-' + (side === SUN ? 'sun' : 'moon')).setAttribute(
      'points',
      points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    );
  }
  // the safe roses get the gold ring in the diagram too
  document
    .querySelectorAll('#route-cells .diagram-rose')
    .forEach((rect) => rect.classList.toggle('safe-sq', isSafeSquare(anySquareAt(rect.dataset.cell))));
}

// ---------- dice ----------
// each die lives in a persistent slot so its tumble survives the face changes
const dieSlots = Array.from({ length: DICE_COUNT }, () => {
  const slot = document.createElement('span');
  slot.className = 'die-slot';
  $('dice').appendChild(slot);
  return slot;
});
function tumbleDice() {
  if (prefersReducedMotion) return;
  const between = (low, high) => low + Math.random() * (high - low);
  dieSlots.forEach((slot, i) => {
    const spin = (Math.random() < 0.5 ? -1 : 1) * between(320, 560),
      drift = between(-7, 7);
    slot.animate(
      [
        { transform: 'translate(0,0) rotate(0)' },
        {
          transform: `translate(${drift}px,${between(-30, -22)}px) rotate(${spin * 0.45}deg) scale(1.1)`,
          offset: 0.32,
          easing: 'ease-in',
        },
        {
          transform: `translate(${drift * 0.6}px,0) rotate(${spin * 0.8}deg) scale(1.15,.8)`,
          offset: 0.62,
          easing: 'ease-out',
        },
        { transform: `translate(${drift * 0.3}px,-8px) rotate(${spin * 0.93}deg)`, offset: 0.8, easing: 'ease-in' },
        { transform: `translate(0,0) rotate(${spin}deg) scale(1.06,.92)`, offset: 0.93 },
        { transform: `translate(0,0) rotate(${Math.round(spin / 120) * 120}deg)` }, // a triangle looks the same every 120°
      ],
      { duration: 520 + i * 40, easing: 'linear' },
    );
  });
}
// draw the dice; once they've landed (isFinal) the total pops in
function drawDice(dice, isFinal) {
  (dice || Array(DICE_COUNT).fill(0)).forEach((marked, i) => {
    dieSlots[i].innerHTML = dieSVG(marked, i);
  });
  if (isFinal && dice && !prefersReducedMotion && $('total').textContent === '·')
    $('total').animate(
      [
        { transform: 'scale(.3) rotate(-20deg)', opacity: 0 },
        { transform: 'scale(1.35) rotate(6deg)', opacity: 1, offset: 0.6 },
        { transform: 'none' },
      ],
      { duration: 380, easing: 'ease-out' },
    );
  $('dice').classList.toggle('idle', !dice);
  $('total').textContent = isFinal && dice ? dice.reduce((sum, die) => sum + die, 0) : dice ? '·' : '–';
}

// ---------- move preview: a ring on the landing square and an arrow to it ----------
const landingElement = (side, move) =>
  move.to === currentRules.home ? homeTrayElement(side) : squareElement(side, move.to);
function clearMovePreview() {
  document.querySelectorAll('.target').forEach((el) => el.classList.remove('target', 'capture'));
  $('arrow-preview').setAttribute('hidden', '');
}
function showMovePreview(move) {
  clearMovePreview();
  if (game.phase !== 'move') return; // e.g. pointing at a counter while another is still hopping
  const landing = landingElement(game.turn, move);
  landing.classList.add('target');
  if (move.captures >= 0) landing.classList.add('capture');
  const counter = counterElement(game.turn, move.counter);
  if (counter) drawArrow($('arrow-preview'), counter, landing);
}

// a curved dashed arrow from a counter to where it would land; it bows upwards, leaves from the
// counter's edge and stops at the target ring. Coordinates are page coordinates, so it scrolls with the board.
const ARROW_BOW = 0.32,
  ARROW_MAX_BOW = 80;
function drawArrow(path, fromEl, toEl) {
  const centreOf = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 + scrollX,
      y: r.top + r.height / 2 + scrollY,
      radius: Math.min(r.width, r.height) / 2,
    };
  };
  const from = centreOf(fromEl),
    to = centreOf(toEl);
  const dx = to.x - from.x,
    dy = to.y - from.y,
    length = Math.hypot(dx, dy) || 1;
  // perpendicular to the line, pointing upwards, so the arrow always arcs over the board
  let normalX = -dy / length,
    normalY = dx / length;
  if (normalY > 0 || (normalY === 0 && normalX < 0)) {
    normalX = -normalX;
    normalY = -normalY;
  }
  const bow = Math.min(length * ARROW_BOW, ARROW_MAX_BOW);
  const control = { x: (from.x + to.x) / 2 + normalX * bow, y: (from.y + to.y) / 2 + normalY * bow };
  // on short hops, shrink the gaps so the arrow never turns inside out
  const room = Math.min(1, length / ((from.radius + to.radius) * 1.6));
  const towardControl = (point, distance) => {
    const l = Math.hypot(control.x - point.x, control.y - point.y) || 1;
    return { x: point.x + ((control.x - point.x) * distance) / l, y: point.y + ((control.y - point.y) * distance) / l };
  };
  const start = towardControl(from, from.radius * 0.9 * room),
    end = towardControl(to, (to.radius * 0.72 + 6) * room);
  // the layer covers the whole page so nothing it draws is clipped
  const layer = $('arrow-layer');
  layer.setAttribute('width', String(document.documentElement.scrollWidth));
  layer.setAttribute('height', String(document.documentElement.scrollHeight));
  const point = (p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  path.setAttribute('d', `M${point(start)} Q${point(control)} ${point(end)}`);
  path.removeAttribute('hidden');
}

// A touchscreen can't hover, so pressing and holding a counter shows where it would go, and the preview stays
// after lifting; a quick tap moves it, as does tapping it again. Touching anywhere else clears the preview.
const PEEK_HOLD_MS = 350;
function addTouchPeek(el, move) {
  let holdTimer = null,
    peeked = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    peeked = false;
    holdTimer = setTimeout(() => {
      peeked = true;
      showMovePreview(move);
    }, PEEK_HOLD_MS);
  });
  const endPress = () => clearTimeout(holdTimer);
  el.addEventListener('pointerup', endPress);
  el.addEventListener('pointercancel', endPress);
  // runs before the move's own click handler: lifting the finger after a peek doesn't move
  el.addEventListener(
    'click',
    (e) => {
      if (peeked) {
        peeked = false;
        e.stopImmediatePropagation();
      }
    },
    { capture: true },
  );
  el.addEventListener('contextmenu', (e) => e.preventDefault()); // a long press would otherwise open the browser's menu
}
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && !(e.target instanceof Element && e.target.closest('.piece.movable')))
    clearMovePreview();
});

// ---------- counters and trays ----------
function counterLabel(side, counter) {
  const square = game.positions[side][counter];
  return `${SIDE_NAME[side]} piece ${square === IN_TRAY ? 'waiting' : square === currentRules.home ? 'home' : 'on square ' + square}`;
}
function createCounter(side, counter, move) {
  const label = counterLabel(side, counter);
  /** @type {HTMLElement} */
  const el = document.createElement(move ? 'button' : 'div');
  el.className = `piece p${side}` + (move ? ' movable' : '');
  el.dataset.pid = side + '-' + counter;
  el.innerHTML = counterSVG(side, counter + side);
  if (move) {
    el.setAttribute('type', 'button');
    el.setAttribute(
      'aria-label',
      `${label}: move to ${move.to === currentRules.home ? 'home' : 'square ' + move.to}${move.captures >= 0 ? ', capturing' : ''}`,
    );
    addTouchPeek(el, move);
    el.addEventListener('click', () => {
      clearMovePreview();
      makeMove(move);
    });
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'touch') showMovePreview(move);
    });
    el.addEventListener('focus', () => showMovePreview(move));
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch') clearMovePreview();
    });
    el.addEventListener('blur', clearMovePreview);
  } else {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
  }
  return el;
}

// A counter that can't be moved, before or after a redraw, keeps its element, so one still gliding to its place
// carries on gliding. Counters that can move are built afresh, as they carry their move.
let counterElements = new Map(); // "side-counter" → its element
function counterFor(side, counter, move) {
  const kept = counterElements.get(side + '-' + counter);
  const keepable = kept && !move && !kept.classList.contains('movable') && !kept.classList.contains('hopping');
  if (!keepable) return createCounter(side, counter, move);
  kept.setAttribute('aria-label', counterLabel(side, counter));
  return kept;
}

// Put each container's counters in it, in order, leaving any already in their place untouched. A counter
// changing place moves straight to its new container; only then are those no longer wanted taken away.
function arrangeCounters(countersIn) {
  countersIn.forEach((counters, container) =>
    counters.forEach((el, index) => {
      if (container.children[index] !== el) container.insertBefore(el, container.children[index] || null);
    }),
  );
  counterContainers().forEach((container) => {
    const wanted = (countersIn.get(container) || []).length;
    while (container.children.length > wanted) container.lastElementChild.remove();
  });
}
const counterContainers = () => [...boardSlots, ...document.querySelectorAll('.tray .pool')];

// whose turn it is shows on their tray, the dice box and their portrait, all in their side's colour
const isInPlay = () => game.phase !== 'over' && game.phase !== 'setup';
function turnTag(side) {
  if (isComputer(side)) return 'thinking…';
  if (isOnline()) return side === mySide() ? 'your turn' : 'their turn';
  return game.mode === 'ai' ? 'your turn' : `${SIDE_NAME[side]}’s turn`;
}
function renderTurn() {
  $('game').dataset.turn = isInPlay() ? SIDE_NAME[game.turn].toLowerCase() : '';
}

function renderTray(side) {
  const tray = $('tray' + side),
    squares = game.positions[side];
  const waiting = squares.filter((square) => square === IN_TRAY).length;
  const home = squares.filter((square) => square === currentRules.home).length;
  const active = isInPlay() && game.turn === side;
  const plays =
    game.mode === 'ai'
      ? ` <span class="side">${side === COMPUTER_SIDE ? 'plays' : 'play'} the ${SIDE_NAME[side]}</span>`
      : isOnline()
        ? ` <span class="side">plays the ${SIDE_NAME[side]}</span>`
        : '';
  tray.classList.toggle('active', active);
  tray.classList.toggle('off-turn', isInPlay() && !active);
  // the pools are built once and kept, so the counters in them can be too
  if (!tray.querySelector('.pool'))
    tray.innerHTML = `
    <div class="tray-name"></div><div class="tray-count"></div><div class="pool wait"></div><div class="pool home"></div>`;
  tray.querySelector('.tray-name').innerHTML =
    `${escapeHtml(playerName(side))}${plays}${active ? ` <span class="chip">${turnTag(side)}</span>` : ''}`;
  tray.querySelector('.tray-count').textContent = `${waiting} waiting · ${home} of ${squares.length} home`;
  return { waiting: tray.querySelector('.wait'), home: tray.querySelector('.home') };
}

// When a game starts, the page scrolls to the top of the upper player's tray, so the board and both trays are in
// view rather than the header. It waits a frame, until any window that started the game has closed and handed
// the focus back, which would otherwise scroll the page to wherever that focus lands.
const GAME_TOP_MARGIN = 8; // px left above the tray
function scrollToGame() {
  requestAnimationFrame(() => {
    const top = Math.min(...[$('tray0'), $('tray1')].map((tray) => tray.getBoundingClientRect().top));
    scrollTo({ top: scrollY + top - GAME_TOP_MARGIN, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });
}

// ---------- render: redraw everything from the game state ----------
function render() {
  $('game').classList.toggle('view-moon', isOnline() && mySide() === MOON); // the friend sees their own side at the bottom
  const previousPlaces = counterPlaces();
  placeCounters();
  const effects = pendingEffects;
  pendingEffects = null;
  animateCounterChanges(previousPlaces, effects);
  playLandingEffects(effects);
  if (game.phase !== 'rolling') drawDice(game.dice, true);
  renderTurn();
  renderDanger();
  renderStatus();
  renderRollOrAdvise();
  renderUndo();
  renderLedger();
  renderSetupControls();
  renderTally();
  showNextGuideTip();
  drawPortraits();
  focusFirstMovable();
}

// where every counter is on screen right now, so moved ones can glide from there
function counterPlaces() {
  const places = new Map();
  document.querySelectorAll('[data-pid]').forEach((el) => places.set(el.dataset.pid, el.getBoundingClientRect()));
  return places;
}

// rebuild every counter in its tray or on its square
function placeCounters() {
  const moves =
    game.phase === 'move' && canAct(game.turn) && !roomPaused() ? legalMoves(game.positions, game.turn, game.roll) : [];
  const moveFor = new Map(moves.map((move) => [move.counter, move]));
  // keyboard numbers: the counter furthest along the route is 1
  const keyboardOrder = moves
    .slice()
    .sort((a, b) => b.from - a.from)
    .map((move) => move.counter);

  Object.values(boardCells).forEach((cell) => cell.classList.remove('lastto', 'target', 'capture', 'occupied'));
  clearMovePreview(); // the counters are rebuilt, so any preview ring or arrow belongs to the old ones
  if (game.lastLanding) boardCells[cellKey(game.lastLanding)].classList.add('lastto');
  const trays = SIDES.map(renderTray);
  const countersIn = new Map(); // each tray pool or board slot → the counters it holds, in order
  const place = (container, el) => {
    if (!countersIn.has(container)) countersIn.set(container, []);
    countersIn.get(container).push(el);
  };
  const elements = new Map();
  for (const side of SIDES)
    game.positions[side].forEach((square, counter) => {
      const move = side === game.turn ? moveFor.get(counter) : undefined;
      const el = counterFor(side, counter, move);
      elements.set(el.dataset.pid, el);
      if (move && game.advice && game.phase === 'move' && counter === game.advice.counter) el.classList.add('advised');
      const keyNumber = move ? keyboardOrder.indexOf(counter) + 1 : 0;
      if (keyNumber) {
        el.dataset.key = keyNumber;
        el.setAttribute('aria-keyshortcuts', String(keyNumber));
        el.setAttribute('aria-label', el.getAttribute('aria-label') + `. Key ${keyNumber}`);
      }
      if (square === IN_TRAY) place(trays[side].waiting, el);
      else if (square === currentRules.home) place(trays[side].home, el);
      else {
        const cell = squareElement(side, square);
        cell.classList.add('occupied');
        place(cell.querySelector('.slot'), el);
      }
    });
  counterElements = elements;
  arrangeCounters(countersIn);
}

// glide counters that changed place; the one that just hopped lands with a squash, a captured one spins home
function animateCounterChanges(previousPlaces, effects) {
  if (prefersReducedMotion) return;
  document.querySelectorAll('[data-pid]').forEach((el) => {
    const pid = el.dataset.pid;
    if (effects && pid === effects.moved) {
      el.animate(
        [{ transform: 'scale(1.2, .78)' }, { transform: 'scale(.93, 1.1)', offset: 0.45 }, { transform: 'none' }],
        { duration: 320, easing: 'ease-out' },
      );
      return;
    }
    const was = previousPlaces.get(pid);
    if (!was) return;
    const now = el.getBoundingClientRect();
    const dx = was.left + was.width / 2 - (now.left + now.width / 2),
      dy = was.top + was.height / 2 - (now.top + now.height / 2);
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    const scale = was.width / now.width,
      captured = effects && pid === effects.captured;
    // a counter sent somewhere new mid-glide sets off from where it is now, so the old glide stops here
    el.glide?.cancel();
    el.classList.add('gliding'); // above the other counters on its way
    el.classList.toggle('knocked-off', !!captured);
    const frames = captured
      ? [
          // knocked off the board: a wobble, then a spinning arc back to the tray
          { transform: `translate(${dx}px,${dy}px) scale(${scale})` },
          { transform: `translate(${dx + 4}px,${dy - 6}px) scale(${scale * 1.2}) rotate(-25deg)`, offset: 0.14 },
          {
            transform: `translate(${dx * 0.5}px,${dy * 0.5 - 90}px) scale(${scale * 1.15}) rotate(380deg)`,
            offset: 0.55,
          },
          { transform: 'rotate(720deg)' },
        ]
      : [
          { transform: `translate(${dx}px,${dy}px) scale(${scale})` },
          { transform: 'translateY(-8px) scale(1.12)', offset: 0.6 },
          { transform: 'none' },
        ];
    el.glide = el.animate(frames, { duration: captured ? 900 : 480, easing: 'cubic-bezier(.2,.7,.2,1)' });
    el.glide.onfinish = () => el.classList.remove('gliding', 'knocked-off');
  });
}

// the capture sound, rose petals and the event scroll over the landing square
const CAPTURE_WORDS = ['Thwack!', 'Begone!', 'Huzzah!'];
function playLandingEffects(effects) {
  if (!effects) return;
  if (effects.captured) sfxCapture();
  if (!effects.cell || prefersReducedMotion) return;
  const cell = boardCells[effects.cell];
  if (effects.rose) burstPetals(cell);
  if (effects.captured) showEventScroll(cell, CAPTURE_WORDS[Math.floor(Math.random() * CAPTURE_WORDS.length)]);
  else if (effects.rose) showEventScroll(cell, 'Roll again!');
}

// the headline and hint beside the dice
function renderStatus() {
  const status = $('status');
  status.classList.toggle('win', game.phase === 'over');
  const [headline, hint] = statusText();
  const whoseCounter = isInPlay()
    ? `<span class="turn-counter" aria-hidden="true">${counterSVG(game.turn, game.turn)}</span>`
    : '';
  // a finished game's card, unless it was recorded before this page saw it (on a reload, say)
  const share =
    game.phase === 'over' && hasResultCard()
      ? `<button class="btn with-icon share-result" id="share-result" type="button">${iconSVG('share')}Share result</button>`
      : '';
  status.innerHTML = `<strong>${whoseCounter}${escapeHtml(headline)}</strong><span>${escapeHtml(hint)}</span>${share}`;
}
function statusText() {
  const [headline, hint] = statusForPhase();
  // online, while either player's connection is down the game waits for them
  const other = opponentOf(mySide());
  if (isOnline() && game.phase !== 'setup' && roomUnreachable()) return [headline, 'Reconnecting…'];
  if (isOnline() && isInPlay() && online.view && !online.view.connected[other])
    return [headline, `${playerName(other)} has lost connection…`];
  return [headline, hint];
}
// online, the end of a game: who won (or who left), and where a rematch has got to
function onlineResultText() {
  const me = mySide(),
    them = playerName(opponentOf(me));
  if (game.endedBy === 'forfeit') return [`${them} has left the game.`, 'The win is yours.'];
  const headline = game.winner === me ? 'Victory is yours!' : `${playerName(game.winner)} triumphs!`;
  const hint = game.roomClosed
    ? `${them} has left the game.`
    : game.rematch[opponentOf(me)]
      ? `${them} wants a rematch.`
      : game.rematch[me]
        ? `Waiting for ${them} to accept the rematch…`
        : `All ${COUNT_WORD[game.positions[game.winner].length]} counters brought home.`;
  return [headline, hint];
}
function statusForPhase() {
  const who = playerName(game.turn),
    yourTurn = isOnline() ? game.turn === mySide() : game.mode === 'ai' && game.turn !== COMPUTER_SIDE,
    theirs = isOnline() && !yourTurn; // online, the other player's turn
  switch (game.phase) {
    case 'setup':
      return [
        'Ready when you are',
        game.mode === 'ai'
          ? 'Choose your opponent, then press Start game.'
          : isOnline()
            ? 'Give your name, then press Invite a friend.'
            : 'Press Start game when you’re both ready.',
      ];
    case 'over': {
      if (isOnline()) return onlineResultText();
      const headline =
        game.mode !== 'ai'
          ? `The ${SIDE_NAME[game.winner]} triumphs!`
          : game.winner === COMPUTER_SIDE
            ? `${opponentName()} triumphs.`
            : 'Victory is yours!';
      return [headline, `All ${COUNT_WORD[game.positions[game.winner].length]} counters brought home.`];
    }
    case 'roll':
      return [
        isComputer(game.turn) ? `${who} rolls…` : yourTurn ? 'Your roll' : `${who} to roll`,
        game.note ||
          (isComputer(game.turn) ? '' : theirs ? `Waiting for ${who} to roll.` : 'Press Space or R to roll.'),
      ];
    case 'rolling':
      return ['The dice tumble…', ''];
    default: {
      const choices = legalMoves(game.positions, game.turn, game.roll).length;
      const autoMoving = choices === 1 && prefs.autoMove && !game.guided && canAct(game.turn);
      const yourHint = autoMoving
        ? 'Only one move: playing it for you.'
        : choices
          ? keyboardMode
            ? `Press ${choices > 1 ? '1 to ' + choices : '1'}, or use the arrows and Enter.`
            : 'Choose a glowing piece.'
          : '';
      let hint =
        game.note ||
        (isComputer(game.turn) ? 'Pondering…' : theirs ? (choices ? `Waiting for ${who} to move.` : '') : yourHint);
      if (game.advice) hint = 'Advice is marked on the board.';
      return [`${yourTurn ? 'You' : who} rolled ${game.roll}.`, hint];
    }
  }
}

// Roll and Advise me share one slot: Advise takes it while advice is on offer, so the dice box keeps its size.
// On the Knight a badge counts the advice left, and the button greys out at 0.
function renderRollOrAdvise() {
  const roll = $('roll'),
    advise = $('advise');
  if (game.phase === 'over' && isOnline()) {
    // online, a finished game is followed by a rematch, which both players ask for
    const asked = game.rematch[mySide()];
    roll.textContent = game.rematch[opponentOf(mySide())] && !asked ? 'Accept rematch' : 'Rematch';
    roll.disabled = asked || game.roomClosed || !online.roomId || roomUnreachable();
  } else {
    roll.textContent = game.phase === 'over' ? 'Play again' : 'Roll';
    roll.disabled = game.phase !== 'over' && !(game.phase === 'roll' && canAct(game.turn) && !roomPaused());
  }
  const offered = adviceOffered(),
    left = adviceLeft(),
    unlimited = left === Infinity;
  roll.classList.toggle('swapped', offered);
  advise.classList.toggle('swapped', !offered);
  advise.disabled = !offered || left <= 0;
  $('advice-left').hidden = unlimited || !(game.level in ADVICE_LIMIT);
  $('advice-left').textContent = unlimited ? '' : String(left);
  advise.title =
    left <= 0
      ? 'No advice left this game'
      : unlimited
        ? ''
        : `${left} piece${left === 1 ? '' : 's'} of advice left this game`;
  advise.setAttribute(
    'aria-label',
    left <= 0 ? 'Advise me: no advice left this game' : unlimited ? 'Advise me' : `Advise me, ${left} left`,
  );
  drawAdvice();
}

// newest first; if the reader has scrolled back through older moves, keep their place as new lines arrive
function renderLedger() {
  const log = $('log'),
    scrolledTo = log.scrollTop,
    heightBefore = log.scrollHeight;
  log.innerHTML = game.log.length
    ? game.log.map((line, i) => `<li><span class="n">${game.log.length - i}.</span>${escapeHtml(line)}</li>`).join('')
    : '<li class="waiting">The scribe awaits the first move.</li>';
  if (scrolledTo > 2) log.scrollTop = scrolledTo + log.scrollHeight - heightBefore;
}

// mode and opponent can only change between games; the button invites a start, or offers a new game mid-game
function renderSetupControls() {
  $('level-field').hidden = game.mode !== 'ai';
  $('name-field').hidden = !isOnline();
  const locked = !isBetweenGames(),
    why = locked ? 'Start a new game to change this' : '';
  // online, switching mode is a way of leaving the game, which asks first
  document.querySelectorAll('input[name=mode]').forEach((/** @type {HTMLInputElement} */ radio) => {
    radio.disabled = locked && !isOnline();
  });
  $('level').disabled = locked;
  $('player-name').disabled = locked;
  // an online room held between games waits for a rematch; changing the variant would leave it
  $('open-variants').disabled = locked || (isOnline() && Boolean(online.roomId));
  $('variant-name').textContent = VARIANTS[game.variant].name; // in a game, the rules being played
  document.querySelector('.seg').title = why;
  $('level-field').title = why;
  $('variant-field').title = why;
  $('join-code').hidden = !isOnline() || locked || Boolean(online.roomId);
  $('newgame').classList.toggle('start', !locked);
  $('newgame').querySelector('.lbl').textContent = locked ? 'New game' : isOnline() ? 'Invite a friend' : 'Start game';
}

// your record against the chosen opponent or online, or the Sun and Moon tally in two-player games
function renderTally() {
  const record = lifetime.level[game.level] || { w: 0, l: 0 };
  $('tally').innerHTML =
    game.mode === 'ai'
      ? `Wins: You <b>${record.w}</b> · ${opponentName()} <b>${record.l}</b>`
      : isOnline()
        ? `Online: Won <b>${tally.onlineWon}</b> · Lost <b>${tally.onlineLost}</b>`
        : `Wins: Sun <b>${tally.sun}</b> · Moon <b>${tally.moon}</b>`;
}
