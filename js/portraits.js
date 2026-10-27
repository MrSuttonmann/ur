/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// ---------- portraits: hand-drawn players beside the trays (wide screens only) ----------
// Sun is always the hero; the Moon side is the chosen computer opponent, or a stargazer in two-player games
const CHARACTER_NAMES = { hero: 'You', heroLocal: 'Sun player', squire: 'The Squire', knight: 'Sir Knight', king: 'The King', stargazer: 'Moon player' };
const characterOf = side => side === 0 ? 'hero'
  : S.mode === 'ai' ? ({ easy: 'squire', medium: 'knight', hard: 'king' }[S.level] || 'knight') : 'stargazer';

const LINES = {
  hero: {
    start: ['Let’s play!', 'Ready when you are.'],
    rose: ['Again!', 'A rose for me!'],
    capture: ['Gotcha!', 'Back you go!'],
    captured: ['Oh, come on!', 'Not that one!'],
    pass: ['Rats.', 'Nothing at all…'],
    home: ['One safely home!'],
    centre: ['Safe and sound.'],
    win: ['Victory!', 'Ha! I win!'],
    lose: ['Next time…', 'Well played.'],
  },
  squire: {
    start: ['A real match! I’ll do my best, I promise!', 'Be gentle with me?'],
    rose: ['A flower! Do I get another go?', 'Ooh, a lucky rose!'],
    capture: ['Sorry! Sorry! Rules are rules!', 'I got one! Did you see?'],
    captured: ['Hey! That was my favourite one.', 'Oh no, back to the start…'],
    pass: ['Nothing? Not even one?', 'The dice don’t like me.'],
    home: ['Made it home!', 'One safe!'],
    centre: ['The middle rose! Nobody can touch me here.'],
    win: ['I won? I WON! Wait till I tell Sir Knight!'],
    lose: ['Well played! Can we go again?'],
  },
  knight: {
    start: ['Let us play with honour.', 'En garde, good friend.'],
    rose: ['The rose favours the bold!', 'Onward, once more!'],
    capture: ['Yield!', 'A fair strike, fairly made.'],
    captured: ['A worthy blow. I shall return.', 'Bested, but not beaten!'],
    pass: ['Patience is a knight’s virtue.', 'No matter. I hold my ground.'],
    home: ['Another safe within the walls.'],
    centre: ['I hold the keep!'],
    win: ['Victory, with honour!'],
    lose: ['Well fought. You have my respect.'],
  },
  king: {
    start: ['You may begin. We shall allow it.', 'Kneel. …After the game.'],
    rose: ['Naturally. The roses know their king.', 'Again! As is our right.'],
    capture: ['Off with its head!', 'Back to the peasantry with you.'],
    captured: ['How DARE you.', 'Guards! …Guards?'],
    pass: ['The dice are clearly broken.', 'We meant to do that.'],
    home: ['Another loyal subject returns.'],
    centre: ['We shall sit upon our throne.'],
    win: ['As was always destined.'],
    lose: ['We shall be speaking to the royal dice-maker.', 'This game is declared a draw.'],
  },
  stargazer: {
    start: ['The moon is rising.', 'The stars are watching.'],
    rose: ['The heavens smile on me.', 'Written in the stars!'],
    capture: ['Eclipsed!', 'The night swallows you.'],
    captured: ['A cloud across my moon…', 'The stars did not foresee that.'],
    pass: ['The moon waits.', 'Even stars must rest.'],
    home: ['Safe beneath the moon.'],
    centre: ['A quiet orbit, safe from harm.'],
    win: ['The moon prevails!'],
    lose: ['The sun has its day.'],
  },
};
LINES.heroLocal = LINES.hero;
const EVENT_FACE = { start: 'smile', rose: 'happy', capture: 'smug', captured: 'angry', pass: 'sad', home: 'happy', centre: 'smug', win: 'happy', lose: 'sad' };
const FACE_OVERRIDE = { squire: { captured: 'sad' }, knight: { pass: 'neutral', captured: 'surprised' }, king: { pass: 'angry', lose: 'angry' } };

const mood = [{ face: null, until: 0 }, { face: null, until: 0 }];
let speechTimers = [];
function baseFace(side) {
  if (S.phase === 'over') return S.winner === side ? 'happy' : characterOf(side) === 'king' ? 'angry' : 'sad';
  if (S.phase !== 'setup' && isAI(side) && S.turn === side && S.phase !== 'roll') return 'thinking';
  return 'neutral';
}
function clearSpeech() {
  speechTimers.forEach(clearTimeout); speechTimers = [];
  mood.forEach(m => { m.face = null; m.until = 0; });
  document.querySelectorAll('.speech').forEach(b => { b.hidden = true; });
}
// a reaction: a face for a few seconds and, usually, a line in a speech bubble
function speak(side, event, delay = 0, chance = 1) {
  if (Math.random() > chance) return;
  const g = gen;
  speechTimers.push(setTimeout(() => {
    if (g !== gen) return;
    const who = characterOf(side) === 'hero' && S.mode !== 'ai' ? 'heroLocal' : characterOf(side);
    const lines = LINES[who][event];
    mood[side] = { face: (FACE_OVERRIDE[who] || {})[event] || EVENT_FACE[event], until: Date.now() + 3200 };
    const bubble = $('speech' + side);
    bubble.textContent = lines[Math.floor(Math.random() * lines.length)];
    bubble.hidden = false;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    drawPortraits();
    speechTimers.push(setTimeout(() => { if (g === gen) { bubble.hidden = true; drawPortraits(); } }, 3300));
  }, delay));
}

// ---- drawing ----
const SKIN = { hero: '#f3cfa6', heroLocal: '#f3cfa6', squire: '#f6d6b3', knight: '#e8c29a', king: '#efc9a4', stargazer: '#e9cdb4' };
function sunBack() {
  let rays = '';
  for (let a = 0; a < 360; a += 30) rays += `<path d="M60 4 L66 16 L54 16 Z" transform="rotate(${a} 60 60)" style="${paint('ochre', 1)};stroke:var(--ink);stroke-width:1.4;stroke-linejoin:round"/>`;
  return `<g filter="url(#ink)">${rays}</g>
    <circle cx="60" cy="60" r="46" style="fill:var(--sunfire)"/>
    <circle cx="60" cy="60" r="46" style="${paint('ochre', .6)}" filter="url(#wash1)"/>`;
}
function moonBack() {
  const stars = [[24, 40], [92, 28], [98, 70], [30, 84], [84, 92], [70, 18]].map(([x, y], i) =>
    i % 2 ? `<circle cx="${x}" cy="${y}" r="1.6" style="fill:#fffaf0"/>` : `<path d="M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z" style="fill:#fffaf0"/>`).join('');
  return `<circle cx="60" cy="60" r="54" style="fill:var(--night)"/>
    <circle cx="60" cy="60" r="54" style="${paint('woad', .5)}" filter="url(#wash2)"/>
    <circle cx="36" cy="34" r="15" style="fill:#fffaf0" mask="url(#portrait-moon)"/>${stars}
`;
}
function eyes(face) {
  const dot = (x, y = 56) => `<ellipse cx="${x}" cy="${y}" rx="2.3" ry="2.9" style="fill:var(--ink)"/>`;
  const L = 51.5, R = 68.5;
  switch (face) {
    case 'happy': return `<path d="M${L - 3.5} 57 Q${L} 52.5 ${L + 3.5} 57 M${R - 3.5} 57 Q${R} 52.5 ${R + 3.5} 57" style="${ink};stroke-width:2.2"/>`;
    case 'surprised': return [L, R].map(x => `<circle cx="${x}" cy="56" r="3.8" style="fill:#fffaf0;stroke:var(--ink);stroke-width:1.3"/><circle cx="${x}" cy="56" r="1.7" style="fill:var(--ink)"/>`).join('')
      + `<path d="M${L - 4} 49.5 Q${L} 47 ${L + 4} 49.5 M${R - 4} 49.5 Q${R} 47 ${R + 4} 49.5" style="${ink};stroke-width:1.8"/>`;
    case 'angry': return dot(L) + dot(R) + `<path d="M${L - 4.5} 49.5 L${L + 4} 52.5 M${R + 4.5} 49.5 L${R - 4} 52.5" style="${ink};stroke-width:2.4"/>`;
    case 'sad': return dot(L, 57) + dot(R, 57) + `<path d="M${L - 4} 52.5 L${L + 4} 50 M${R + 4} 52.5 L${R - 4} 50" style="${ink};stroke-width:2"/>`;
    case 'smug': return `<path d="M${L - 3.5} 55.5 H${L + 3.5} M${R - 3.5} 55.5 H${R + 3.5}" style="${ink};stroke-width:2.2"/>`
      + `<path d="M${L - 2.5} 55.8 Q${L} 58.6 ${L + 2.5} 55.8 Z M${R - 2.5} 55.8 Q${R} 58.6 ${R + 2.5} 55.8 Z" style="fill:var(--ink)"/>`;
    case 'thinking': return `<ellipse cx="${L - 1}" cy="54.5" rx="2.2" ry="2.8" style="fill:var(--ink)"/><ellipse cx="${R - 1}" cy="54.5" rx="2.2" ry="2.8" style="fill:var(--ink)"/>`
      + `<path d="M${R - 4} 49 Q${R} 46 ${R + 4} 48.5" style="${ink};stroke-width:1.8"/>`;
    default: return `<g class="blink">${dot(L)}${dot(R)}</g>`;
  }
}
function mouth(face) {
  switch (face) {
    case 'smile': return `<path d="M53 66 Q60 72.5 67 66" style="${ink};stroke-width:2"/>`;
    case 'happy': return `<path d="M52.5 65 Q60 77 67.5 65 Z" style="fill:#7a2a1e;stroke:var(--ink);stroke-width:1.6;stroke-linejoin:round"/><path d="M54.5 66.2 H65.5" style="fill:none;stroke:#fffaf0;stroke-width:1.8"/>`;
    case 'angry': return `<path d="M54 70 Q60 66 66 70" style="${ink};stroke-width:2.2"/>`;
    case 'sad': return `<path d="M54 71 Q60 66 66 71" style="${ink};stroke-width:2"/>`;
    case 'surprised': return `<ellipse cx="60" cy="69" rx="3" ry="4" style="fill:#7a2a1e;stroke:var(--ink);stroke-width:1.4"/>`;
    case 'smug': return `<path d="M54 68 Q61 70.5 67.5 64.5" style="${ink};stroke-width:2"/>`;
    case 'thinking': return `<path d="M55.5 68.5 Q59 67.5 64 69" style="${ink};stroke-width:2"/>`;
    default: return `<path d="M55 67 Q60 69.5 65 67" style="${ink};stroke-width:2"/>`;
  }
}
const blush = face => ['happy', 'smile'].includes(face)
  ? `<circle cx="46.5" cy="63" r="3.6" style="fill:var(--rose);fill-opacity:.55"/><circle cx="73.5" cy="63" r="3.6" style="fill:var(--rose);fill-opacity:.55"/>` : '';
// what each character wears: drawn behind the head, over the head, and as the body
const OUTFIT = {
  hero: {
    body: `<path d="M24 122 C26 96 40 86 60 86 C80 86 94 96 96 122 Z" style="${paint('ochre', 1)}"/><path d="M50 86 L60 98 L70 86" style="${paint('bone', 1)}"/>
      <circle cx="60" cy="106" r="6" style="${paint('sunfire', 1)};stroke:var(--ink);stroke-width:1.3"/>
      <path d="M24 122 C26 96 40 86 60 86 C80 86 94 96 96 122 M50 86 L60 98 L70 86" style="${ink};stroke-width:1.6"/>`,
    over: [[42, 46], [47, 39], [55, 35], [64, 35], [72, 39], [78, 46], [40, 54], [80, 54]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" style="${paint('rose', 1)};stroke:var(--ink);stroke-width:1.3"/>`).join('').replace(/var\(--rose\)/g, '#9a4f2a'),
  },
  squire: {
    body: `<path d="M24 122 C26 96 40 86 60 86 C80 86 94 96 96 122 Z" style="${paint('sage', 1)}"/><path d="M28 110 H92" style="fill:none;stroke:var(--ochre);stroke-width:4"/>
      <path d="M24 122 C26 96 40 86 60 86 C80 86 94 96 96 122" style="${ink};stroke-width:1.6"/>`,
    over: `<path d="M38.5 58 C36 33 84 33 81.5 58 C79 50 72 47 60 47 C48 47 41 50 38.5 58 Z" style="fill:#8a5a2b;stroke:var(--ink);stroke-width:1.5"/>
      <g style="fill:#b5764a">${[[49, 62], [52, 64], [68, 62], [71, 64], [70, 60.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9"/>`).join('')}</g>`,
  },
  knight: {
    body: `<path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122 Z" style="fill:#a7adb5"/>
      <path d="M40 122 L42 92 Q60 88 78 92 L80 122 Z" style="${paint('woad', 1)}"/>
      <path d="M64 100 A7 7 0 1 0 64 114 A5.5 5.5 0 1 1 64 100 Z" style="fill:#fffaf0"/>
      <path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122 M40 122 L42 92 Q60 88 78 92 L80 122" style="${ink};stroke-width:1.6"/>`,
    over: `<path d="M60 34 C61 20 73 14 81 20 C72 21 67 26 65 35 Z" style="${paint('vermilion', 1)};stroke:var(--ink);stroke-width:1.4"/>
      <path d="M37.5 53 C36 30 84 30 82.5 53 Q60 46.5 37.5 53 Z" style="fill:#b3b9c1;stroke:var(--ink);stroke-width:1.6;stroke-linejoin:round"/>
      <path d="M37.5 52 L36.5 75 C36.5 81 41 84 45 84 L45.5 63 C44.5 57 41.5 53.5 37.5 52 Z M82.5 52 L83.5 75 C83.5 81 79 84 75 84 L74.5 63 C75.5 57 78.5 53.5 82.5 52 Z" style="fill:#b3b9c1;stroke:var(--ink);stroke-width:1.5;stroke-linejoin:round"/>
      <path d="M38.5 41 Q60 34 81.5 41 L82 46.5 Q60 39.5 38 46.5 Z" style="fill:#8e959e;stroke:var(--ink);stroke-width:1.4"/>
      <path d="M46 42.5 H74" style="fill:none;stroke:var(--ink);stroke-width:1.2;stroke-dasharray:3 2"/>`,
  },
  king: {
    body: `<path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122 Z" style="${paint('vermilion', 1)}"/>
      <path d="M30 98 C40 88 50 86 60 90 C70 86 80 88 90 98 C82 104 70 100 60 104 C50 100 38 104 30 98 Z" style="fill:#fffaf0;stroke:var(--ink);stroke-width:1.3"/>
      <g style="fill:var(--ink)">${[[40, 96], [50, 94], [70, 94], [80, 96], [60, 98]].map(([x, y]) => `<path d="M${x} ${y} l-1 2.5 l2 0 Z"/>`).join('')}</g>
      <path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122" style="${ink};stroke-width:1.6"/>`,
    behind: `<path d="M38 50 C34 62 36 74 42 80 L46 66 Z M82 50 C86 62 84 74 78 80 L74 66 Z" style="fill:#e6e0d2;stroke:var(--ink);stroke-width:1.2"/>`,
    beard: `<path d="M41 61 C42 80 52 88 60 88 C68 88 78 80 79 61 C74 69 68 71 60 71 C52 71 46 69 41 61 Z" style="fill:#e6e0d2;stroke:var(--ink);stroke-width:1.4"/>`,
    over: `<path d="M51.5 65.5 Q55.5 62 60 64 Q64.5 62 68.5 65.5 Q64.5 67.5 60 66.2 Q55.5 67.5 51.5 65.5 Z" style="fill:#d8d1c1;stroke:var(--ink);stroke-width:1.1"/>
      <path d="M41 43 L43 26 L51 35 L60 23 L69 35 L77 26 L79 43 Z" style="${paint('ochre', 1)};stroke:var(--ink);stroke-width:1.6;stroke-linejoin:round"/>
      <path d="M41 39 H79" style="fill:none;stroke:var(--ink);stroke-width:1.2"/>
      ${[[43, 26], [60, 23], [77, 26]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" style="${paint('vermilion', 1)};stroke:var(--ink);stroke-width:1"/>`).join('')}
      <circle cx="60" cy="38" r="2.2" style="${paint('woad', 1)};stroke:var(--ink);stroke-width:.9"/>`,
  },
  stargazer: {
    body: `<path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122 Z" style="${paint('woad', 1)}"/>
      <path d="M60 98 L61.5 102 L66 102.5 L62.5 105.5 L63.5 110 L60 107.5 L56.5 110 L57.5 105.5 L54 102.5 L58.5 102 Z" style="fill:#fffaf0"/>
      <path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122" style="${ink};stroke-width:1.6"/>`,
    over: `<path d="M37 46 C46 40 74 40 83 46 L61 6 Z" style="fill:var(--night);stroke:var(--ink);stroke-width:1.6;stroke-linejoin:round"/>
      <ellipse cx="60" cy="46" rx="27" ry="5" style="fill:var(--night);stroke:var(--ink);stroke-width:1.6"/>
      <circle cx="58" cy="24" r="1.6" style="fill:#fffaf0"/><circle cx="66" cy="34" r="1.3" style="fill:#fffaf0"/>
      <path d="M54 36 l1 2.4 l2.4 .4 l-1.8 1.6 l.5 2.4 l-2.1 -1.2 l-2.1 1.2 l.5 -2.4 l-1.8 -1.6 l2.4 -.4 Z" style="fill:var(--ochre)"/>`,
  },
};
OUTFIT.heroLocal = OUTFIT.hero;
function portraitSVG(side, who, face) {
  const o = OUTFIT[who], skin = SKIN[who];
  return `<svg viewBox="0 0 120 120">
    ${side === 0 ? sunBack() : moonBack()}
    <g clip-path="url(#portrait-clip-${side === 0 ? 'sun' : 'moon'})"><g filter="url(#ink)">
      ${o.behind || ''}${o.body}
      <path d="M54 78 L54 88 L66 88 L66 78 Z" style="fill:${skin};stroke:var(--ink);stroke-width:1.3"/>
      <circle cx="39" cy="58" r="4.5" style="fill:${skin};stroke:var(--ink);stroke-width:1.3"/><circle cx="81" cy="58" r="4.5" style="fill:${skin};stroke:var(--ink);stroke-width:1.3"/>
      <ellipse cx="60" cy="58" rx="21.5" ry="23" style="fill:${skin};stroke:var(--ink);stroke-width:1.6"/>
      ${o.beard || ''}${blush(face)}
      <path d="M60 58.5 Q62.5 62 59.5 63" style="${ink};stroke-width:1.3"/>
      ${eyes(face)}${mouth(face)}${o.over || ''}
    </g></g>
    <circle cx="60" cy="60" r="${side === 0 ? 46 : 54}" style="${ink};stroke-width:2" filter="url(#ink)"/>
  </svg>`;
}
const drawn = ['', ''];
function drawPortraits() {
  if (!S) return;
  for (const side of [0, 1]) {
    const who = characterOf(side) === 'hero' && S.mode !== 'ai' ? 'heroLocal' : characterOf(side);
    const face = mood[side].until > Date.now() ? mood[side].face : baseFace(side);
    const key = who + face;
    if (drawn[side] !== key) {
      $('medal' + side).innerHTML = portraitSVG(side, who, face);
      drawn[side] = key;
    }
    $('pname' + side).textContent = CHARACTER_NAMES[who];
  }
  placePortraits();
}
// line each portrait up with its own tray
function placePortraits() {
  for (const side of [0, 1]) {
    const pr = $('portrait' + side), tray = $('tray' + side);
    pr.style.top = Math.round(tray.offsetTop + tray.offsetHeight / 2 - 75) + 'px';
  }
}
addEventListener('resize', placePortraits);
