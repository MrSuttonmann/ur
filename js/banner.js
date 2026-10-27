/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The end-of-game banner: the result written on a curved scroll that pops up over the game, plays out,
// and pops away again. A win brings trumpets and roses in bloom; a loss, wilted roses dropping their petals.
// A click or Escape sends it away early. The animations are in css/banner.css.

const BANNER_SHOW_MS = 3600;   // from popping up to starting to pop away
const BANNER_EXIT_MS = 450;    // the pop-away animation's length in banner.css
const LONG_TITLE = 12;         // longer titles are set smaller so they fit along the scroll
let bannerTimer = null;

function showEndBanner(winner) {
  const lost = game.mode === 'ai' && winner === COMPUTER_SIDE;
  const title = game.mode !== 'ai' ? `The ${SIDE_NAME[winner]} triumphs!` : lost ? 'Defeat' : 'Victory!';
  const banner = $('end-banner');
  banner.className = `end-banner ${lost ? 'lost' : 'won'}`;
  banner.innerHTML = `<svg viewBox="0 -30 400 320">
    ${lost ? '' : bannerTrumpets()}
    ${bannerScroll(title)}
    ${lost ? wiltedRoses() : bloomingRoses()}
  </svg>`;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(hideEndBanner, BANNER_SHOW_MS);
}
function hideEndBanner() {
  const banner = $('end-banner');
  if (banner.hidden || banner.classList.contains('leaving')) return;
  clearTimeout(bannerTimer);
  banner.classList.add('leaving');
  bannerTimer = setTimeout(() => { banner.hidden = true; banner.classList.remove('leaving'); }, prefersReducedMotion ? 0 : BANNER_EXIT_MS);
}
$('end-banner').addEventListener('click', hideEndBanner);
addEventListener('keydown', e => { if (e.key === 'Escape') hideEndBanner(); });

// the scroll: a ribbon arching over the middle, its forked tails tucked behind each end, and the title along the curve
function bannerScroll(title) {
  const tail = 'M80 150 L14 160 L32 184 L14 208 L86 200 Z', fold = 'M50 180 L68 198 L68 176 Z';
  const mirrored = path => `<path d="${path}" transform="translate(400 0) scale(-1 1)"`;
  return `<g class="scroll" filter="url(#ink)">
    <path d="${tail}" class="scroll-tail"/>${mirrored(tail)} class="scroll-tail"/>
    <path d="${fold}" class="scroll-fold"/>${mirrored(fold)} class="scroll-fold"/>
    <path d="M50 130 Q200 70 350 130 L350 180 Q200 120 50 180 Z" class="scroll-band"/>
    <path d="M62 140 Q200 84 338 140" class="scroll-rule"/><path d="M62 172 Q200 116 338 172" class="scroll-rule"/>
  </g>
  <path id="banner-curve" d="M40 166 Q200 104 360 166" fill="none"/>
  <text class="scroll-title${title.length > LONG_TITLE ? ' long' : ''}"><textPath href="#banner-curve" startOffset="50%" text-anchor="middle">${title}</textPath></text>`;
}

// two gold trumpets fanning up from behind the scroll, each with a pennant; they swing up and toot.
// Each is drawn pointing along +x from its mouthpiece, with the pennant on the side that hangs downwards.
const TRUMPET_ANGLE = -130;
function bannerTrumpets() {
  const trumpet = `<g class="trumpet-swing">
      <path d="M100 -3 H160 V-42 L130 -32 L100 -42 Z" class="trumpet-pennant"/>
      <circle cx="130" cy="-20" r="6.5" class="trumpet-pennant-sun"/>
      <path d="M0 -3 H152 L194 -20 Q199 0 194 20 L152 3 H0 Z" class="trumpet-brass"/>
      <path d="M194 -20 Q199 0 194 20" class="trumpet-mouth"/>
    </g>`;
  return `<g class="trumpets" filter="url(#ink)">
    <g transform="translate(208 150) rotate(${TRUMPET_ANGLE})">${trumpet}</g>
    <g transform="translate(192 150) scale(-1 1) rotate(${TRUMPET_ANGLE})">${trumpet}</g>
  </g>`;
}

// three roses that bloom in turn, and petals drifting down over the scroll
function bannerRose(x, y) {
  const petals = [0, 72, 144, 216, 288].map(angle => `<ellipse cx="0" cy="-8" rx="7" ry="9" transform="rotate(${angle})" class="banner-rose-petal"/>`).join('');
  return `<g transform="translate(${x} ${y})"><g class="bloom">
    <path d="M-4 6 Q-22 14 -26 2 Q-14 -2 -4 6 Z M4 6 Q22 14 26 2 Q14 -2 4 6 Z" class="banner-rose-leaf"/>
    ${petals}<circle r="5" class="banner-rose-heart"/>
  </g></g>`;
}
const PETAL_STARTS = [[90, 40], [150, 20], [205, 32], [262, 18], [318, 42], [120, 64], [290, 70]];
function bloomingRoses() {
  const falling = PETAL_STARTS.map(([x, y]) => `<g transform="translate(${x} ${y})"><ellipse rx="4" ry="6" class="falling-petal"/></g>`).join('');
  return `<g class="banner-roses" filter="url(#ink)">${bannerRose(166, 222)}${bannerRose(234, 222)}${bannerRose(200, 206)}</g>
    <g class="banner-petals">${falling}</g>`;
}

// three wilted roses: their heads droop over on bent stems, and dried petals fall away
// a wilted rose seen side-on: the stem hooks over and the closed, dusty head hangs from its tip
function wiltedRose(x, lean) {
  return `<g transform="translate(${x} 286) scale(${lean} 1)">
    <path d="M0 0 C0 -40 4 -70 24 -66 C30 -65 31 -60 30 -56" class="wilted-stem"/>
    <path d="M2 -30 Q-14 -40 -19 -29 Q-8 -22 2 -30 Z" class="wilted-leaf"/>
    <g transform="translate(30 -56)"><g class="droop">
      <path d="M-5 0 L0 7 L5 0" class="wilted-sepal"/>
      <path d="M-8 5 Q-12 20 0 27 Q12 20 8 5 Q0 10 -8 5 Z" class="wilted-petal"/>
      <path d="M-8 5 Q-15 13 -12 22 Q-6 17 -6 9" class="wilted-petal"/>
      <path d="M-2 10 Q0 18 3 23" class="wilted-crease"/>
    </g></g>
    <g transform="translate(36 -34)"><ellipse rx="3.5" ry="5" class="dry-petal"/></g>
  </g>`;
}
function wiltedRoses() {
  return `<g class="wilted-roses" filter="url(#ink)">${wiltedRose(160, -1)}${wiltedRose(200, 1)}${wiltedRose(240, 1)}</g>`;
}
