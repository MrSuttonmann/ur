/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// ---------- portraits: hand-drawn players beside the trays (tablets and wider) ----------
// The Sun is always the hero; the Moon is the chosen computer opponent, or a stargazer in two-player games.
// Adding a character means adding entries to CHARACTER_NAMES and OUTFIT here, its lines to LINES in speech.js, and its skin and clothes to css/portraits.css.
const CHARACTER_NAMES = { hero: 'You', heroLocal: 'Sun player', squire: 'The Squire', knight: 'Sir Knight', king: 'The King', stargazer: 'Moon player' };
const CHARACTER_FOR_LEVEL = { easy: 'squire', medium: 'knight', hard: 'king' };
function characterFor(side) {
  if (side === SUN) return game.mode === 'ai' ? 'hero' : 'heroLocal';
  return game.mode === 'ai' ? CHARACTER_FOR_LEVEL[game.level] || 'knight' : 'stargazer';
}

// the face when nothing has just happened
function baseFace(side) {
  if (game.phase === 'over') return game.winner === side ? 'happy' : characterFor(side) === 'king' ? 'angry' : 'sad';
  if (game.phase !== 'setup' && isComputer(side) && game.turn === side && game.phase !== 'roll') return 'thinking';
  return 'neutral';
}

// ---- drawing ----
// Colours and line weights are in css/portraits.css: each part is named for what it is, and each character's
// skin tone comes from its class (character-squire etc.).
function sunBack() {
  let rays = '';
  for (let a = 0; a < 360; a += 30) rays += `<path d="M60 4 L66 16 L54 16 Z" transform="rotate(${a} 60 60)" class="medal-sun-ray"/>`;
  return `<g filter="url(#ink)">${rays}</g>
    <circle cx="60" cy="60" r="46" class="medal-sun-disc"/>
    <circle cx="60" cy="60" r="46" class="medal-sun-wash" filter="url(#wash1)"/>`;
}
function moonBack() {
  const stars = [[24, 40], [92, 28], [98, 70], [30, 84], [84, 92], [70, 18]].map(([x, y], i) =>
    i % 2 ? `<circle cx="${x}" cy="${y}" r="1.6" class="medal-star"/>` : `<path d="M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z" class="medal-star"/>`).join('');
  return `<circle cx="60" cy="60" r="54" class="medal-night"/>
    <circle cx="60" cy="60" r="54" class="medal-night-wash" filter="url(#wash2)"/>
    <circle cx="36" cy="34" r="15" class="medal-moon" mask="url(#portrait-moon)"/>${stars}
`;
}
function eyes(face) {
  const dot = (x, y = 56) => `<ellipse cx="${x}" cy="${y}" rx="2.3" ry="2.9" class="pupil"/>`;
  const L = 51.5, R = 68.5;
  switch (face) {
    case 'happy': return `<path d="M${L - 3.5} 57 Q${L} 52.5 ${L + 3.5} 57 M${R - 3.5} 57 Q${R} 52.5 ${R + 3.5} 57" class="ink-line eyelid"/>`;
    case 'surprised': return [L, R].map(x => `<circle cx="${x}" cy="56" r="3.8" class="eye-white"/><circle cx="${x}" cy="56" r="1.7" class="pupil"/>`).join('')
      + `<path d="M${L - 4} 49.5 Q${L} 47 ${L + 4} 49.5 M${R - 4} 49.5 Q${R} 47 ${R + 4} 49.5" class="ink-line brow"/>`;
    case 'angry': return dot(L) + dot(R) + `<path d="M${L - 4.5} 49.5 L${L + 4} 52.5 M${R + 4.5} 49.5 L${R - 4} 52.5" class="ink-line brow-angry"/>`;
    case 'sad': return dot(L, 57) + dot(R, 57) + `<path d="M${L - 4} 52.5 L${L + 4} 50 M${R + 4} 52.5 L${R - 4} 50" class="ink-line brow-sad"/>`;
    case 'smug': return `<path d="M${L - 3.5} 55.5 H${L + 3.5} M${R - 3.5} 55.5 H${R + 3.5}" class="ink-line eyelid"/>`
      + `<path d="M${L - 2.5} 55.8 Q${L} 58.6 ${L + 2.5} 55.8 Z M${R - 2.5} 55.8 Q${R} 58.6 ${R + 2.5} 55.8 Z" class="pupil"/>`;
    case 'thinking': return `<ellipse cx="${L - 1}" cy="54.5" rx="2.2" ry="2.8" class="pupil"/><ellipse cx="${R - 1}" cy="54.5" rx="2.2" ry="2.8" class="pupil"/>`
      + `<path d="M${R - 4} 49 Q${R} 46 ${R + 4} 48.5" class="ink-line brow"/>`;
    default: return `<g class="blink">${dot(L)}${dot(R)}</g>`;
  }
}
function mouth(face) {
  switch (face) {
    case 'smile': return `<path d="M53 66 Q60 72.5 67 66" class="ink-line mouth"/>`;
    case 'happy': return `<path d="M52.5 65 Q60 77 67.5 65 Z" class="mouth-open"/><path d="M54.5 66.2 H65.5" class="teeth"/>`;
    case 'angry': return `<path d="M54 70 Q60 66 66 70" class="ink-line mouth-angry"/>`;
    case 'sad': return `<path d="M54 71 Q60 66 66 71" class="ink-line mouth"/>`;
    case 'surprised': return `<ellipse cx="60" cy="69" rx="3" ry="4" class="mouth-gasp"/>`;
    case 'smug': return `<path d="M54 68 Q61 70.5 67.5 64.5" class="ink-line mouth"/>`;
    case 'thinking': return `<path d="M55.5 68.5 Q59 67.5 64 69" class="ink-line mouth"/>`;
    default: return `<path d="M55 67 Q60 69.5 65 67" class="ink-line mouth"/>`;
  }
}
const blush = face => ['happy', 'smile'].includes(face)
  ? `<circle cx="46.5" cy="63" r="3.6" class="blush"/><circle cx="73.5" cy="63" r="3.6" class="blush"/>` : '';
// what each character wears: drawn behind the head, over the head, and as the body
const OUTFIT = {
  hero: {
    body: `<path d="M24 122 C26 96 40 86 60 86 C80 86 94 96 96 122 Z" class="hero-tunic"/><path d="M50 86 L60 98 L70 86" class="hero-collar"/>
      <circle cx="60" cy="106" r="6" class="hero-brooch"/>
      <path d="M24 122 C26 96 40 86 60 86 C80 86 94 96 96 122 M50 86 L60 98 L70 86" class="ink-line outfit-outline"/>`,
    over: [[42, 46], [47, 39], [55, 35], [64, 35], [72, 39], [78, 46], [40, 54], [80, 54]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" class="hero-curl"/>`).join(''),
  },
  squire: {
    body: `<path d="M24 122 C26 96 40 86 60 86 C80 86 94 96 96 122 Z" class="squire-tunic"/><path d="M28 110 H92" class="squire-sash"/>
      <path d="M24 122 C26 96 40 86 60 86 C80 86 94 96 96 122" class="ink-line outfit-outline"/>`,
    over: `<path d="M38.5 58 C36 33 84 33 81.5 58 C79 50 72 47 60 47 C48 47 41 50 38.5 58 Z" class="squire-hair"/>
      <g class="squire-freckles">${[[49, 62], [52, 64], [68, 62], [71, 64], [70, 60.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9"/>`).join('')}</g>`,
  },
  knight: {
    body: `<path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122 Z" class="knight-mail"/>
      <path d="M40 122 L42 92 Q60 88 78 92 L80 122 Z" class="knight-tabard"/>
      <path d="M64 100 A7 7 0 1 0 64 114 A5.5 5.5 0 1 1 64 100 Z" class="knight-badge"/>
      <path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122 M40 122 L42 92 Q60 88 78 92 L80 122" class="ink-line outfit-outline"/>`,
    over: `<path d="M60 34 C61 20 73 14 81 20 C72 21 67 26 65 35 Z" class="knight-plume"/>
      <path d="M37.5 53 C36 30 84 30 82.5 53 Q60 46.5 37.5 53 Z" class="knight-helm"/>
      <path d="M37.5 52 L36.5 75 C36.5 81 41 84 45 84 L45.5 63 C44.5 57 41.5 53.5 37.5 52 Z M82.5 52 L83.5 75 C83.5 81 79 84 75 84 L74.5 63 C75.5 57 78.5 53.5 82.5 52 Z" class="knight-cheek-guards"/>
      <path d="M38.5 41 Q60 34 81.5 41 L82 46.5 Q60 39.5 38 46.5 Z" class="knight-helm-band"/>
      <path d="M46 42.5 H74" class="knight-rivets"/>`,
  },
  king: {
    body: `<path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122 Z" class="king-robe"/>
      <path d="M30 98 C40 88 50 86 60 90 C70 86 80 88 90 98 C82 104 70 100 60 104 C50 100 38 104 30 98 Z" class="king-ermine"/>
      <g class="king-ermine-spots">${[[40, 96], [50, 94], [70, 94], [80, 96], [60, 98]].map(([x, y]) => `<path d="M${x} ${y} l-1 2.5 l2 0 Z"/>`).join('')}</g>
      <path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122" class="ink-line outfit-outline"/>`,
    behind: `<path d="M38 50 C34 62 36 74 42 80 L46 66 Z M82 50 C86 62 84 74 78 80 L74 66 Z" class="king-hair"/>`,
    beard: `<path d="M41 61 C42 80 52 88 60 88 C68 88 78 80 79 61 C74 69 68 71 60 71 C52 71 46 69 41 61 Z" class="king-beard"/>`,
    over: `<path d="M51.5 65.5 Q55.5 62 60 64 Q64.5 62 68.5 65.5 Q64.5 67.5 60 66.2 Q55.5 67.5 51.5 65.5 Z" class="king-moustache"/>
      <path d="M41 43 L43 26 L51 35 L60 23 L69 35 L77 26 L79 43 Z" class="king-crown"/>
      <path d="M41 39 H79" class="king-crown-band"/>
      ${[[43, 26], [60, 23], [77, 26]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" class="king-ruby"/>`).join('')}
      <circle cx="60" cy="38" r="2.2" class="king-sapphire"/>`,
  },
  stargazer: {
    body: `<path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122 Z" class="stargazer-robe"/>
      <path d="M60 98 L61.5 102 L66 102.5 L62.5 105.5 L63.5 110 L60 107.5 L56.5 110 L57.5 105.5 L54 102.5 L58.5 102 Z" class="stargazer-badge"/>
      <path d="M22 122 C24 96 40 86 60 86 C80 86 96 96 98 122" class="ink-line outfit-outline"/>`,
    over: `<path d="M37 46 C46 40 74 40 83 46 L61 6 Z" class="stargazer-hat"/>
      <ellipse cx="60" cy="46" rx="27" ry="5" class="stargazer-hat-brim"/>
      <circle cx="58" cy="24" r="1.6" class="stargazer-hat-star"/><circle cx="66" cy="34" r="1.3" class="stargazer-hat-star"/>
      <path d="M54 36 l1 2.4 l2.4 .4 l-1.8 1.6 l.5 2.4 l-2.1 -1.2 l-2.1 1.2 l.5 -2.4 l-1.8 -1.6 l2.4 -.4 Z" class="stargazer-hat-gold-star"/>`,
  },
};
OUTFIT.heroLocal = OUTFIT.hero;
// each side's medallion: its background, the clip that keeps the bust inside it, and its rim
const MEDALLION = { [SUN]: { background: sunBack, clip: 'sun', rimRadius: 46 }, [MOON]: { background: moonBack, clip: 'moon', rimRadius: 54 } };
function portraitSVG(side, who, face) {
  const outfit = OUTFIT[who], medallion = MEDALLION[side];
  return `<svg class="character-${who}" viewBox="0 0 120 120">
    ${medallion.background()}
    <g clip-path="url(#portrait-clip-${medallion.clip})"><g filter="url(#ink)">
      ${outfit.behind || ''}${outfit.body}
      <path d="M54 78 L54 88 L66 88 L66 78 Z" class="skin"/>
      <circle cx="39" cy="58" r="4.5" class="skin"/><circle cx="81" cy="58" r="4.5" class="skin"/>
      <ellipse cx="60" cy="58" rx="21.5" ry="23" class="skin face"/>
      ${outfit.beard || ''}${blush(face)}
      <path d="M60 58.5 Q62.5 62 59.5 63" class="ink-line"/>
      ${eyes(face)}${mouth(face)}${outfit.over || ''}
    </g></g>
    <circle cx="60" cy="60" r="${medallion.rimRadius}" class="ink-line medal-rim" filter="url(#ink)"/>
  </svg>`;
}
const drawnPortrait = SIDES.map(() => '');   // which character and face each medallion shows, to skip redrawing
function drawPortraits() {
  if (!game) return;
  for (const side of SIDES) {
    const who = characterFor(side);
    const face = mood[side].until > Date.now() ? mood[side].face : baseFace(side);
    if (drawnPortrait[side] !== who + face) {
      $('medal' + side).innerHTML = portraitSVG(side, who, face);
      drawnPortrait[side] = who + face;
    }
    $('pname' + side).textContent = CHARACTER_NAMES[who];
  }
  placePortraits();
}
// line each portrait up with its own tray
function placePortraits() {
  for (const side of SIDES) {
    const portrait = $('portrait' + side), tray = $('tray' + side);
    portrait.style.top = Math.round(tray.offsetTop + tray.offsetHeight / 2 - portrait.querySelector('.medal').offsetHeight / 2) + 'px';
  }
}
addEventListener('resize', placePortraits);
