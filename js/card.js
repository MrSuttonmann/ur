/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The result card: a picture of a finished game to share, kept simple: the outcome, who it was against,
// the score in counters home, and any honours earned. It goes to the device's share sheet where there is
// one, and is saved as a picture where there isn't. It's drawn only with the page's colours and fonts, which
// a page can always read, so it looks the same however the game was opened.

const CARD = { width: 1200, height: 630, inset: 22, textWidth: 960 };
const CARD_FILE_NAME = 'royal-game-of-ur-result.png';
const SITE_URL = document.querySelector('link[rel=canonical]').href; // the game's home, wherever this copy runs
const FLOURISH = { path: document.querySelector('.flourish path').getAttribute('d'), width: 260, scale: 1.6 };

const cssValue = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---------- the words on the card ----------
function resultTitle() {
  if (game.mode !== 'ai') return `The ${SIDE_NAME[game.winner]} triumphs!`;
  return game.winner === COMPUTER_SIDE ? 'Defeat' : 'Victory!';
}
function resultSubtitle() {
  const variant = VARIANT_DEFINITIONS[game.variant].name;
  return game.mode === 'ai'
    ? `against ${opponentNameMidSentence()} · ${variant} rules`
    : `Two players · ${variant} rules`;
}
const resultScore = () =>
  `${game.stats.bySide[game.winner].home} – ${game.stats.bySide[opponentOf(game.winner)].home} counters home`;
// the words that go with the picture when it's shared
function resultSentence() {
  if (game.mode !== 'ai') return `The ${SIDE_NAME[game.winner]} won our game of the Royal Game of Ur. ${SITE_URL}`;
  return game.winner === COMPUTER_SIDE
    ? `${opponentName()} beat me at the Royal Game of Ur. ${SITE_URL}`
    : `I beat ${opponentNameMidSentence()} at the Royal Game of Ur! ${SITE_URL}`;
}

// ---------- drawing the card ----------
// a centred line, its font shrunk until it fits
function centredLine(context, text, y, size, family, style = '') {
  let fitted = size;
  do context.font = `${style} ${fitted}px ${family}`;
  while (context.measureText(text).width > CARD.textWidth && --fitted > 10);
  context.fillText(text, CARD.width / 2, y);
}
// the page's hand-drawn flourish, centred under the heading
function drawFlourish(context, y) {
  context.save();
  context.translate(CARD.width / 2 - (FLOURISH.width * FLOURISH.scale) / 2, y);
  context.scale(FLOURISH.scale, FLOURISH.scale);
  context.strokeStyle = cssValue('--ink');
  context.lineWidth = 1.4;
  context.lineCap = 'round';
  context.stroke(new Path2D(FLOURISH.path));
  context.beginPath();
  context.arc(FLOURISH.width / 2, 8, 2.4, 0, Math.PI * 2);
  context.fillStyle = cssValue('--vermilion');
  context.fill();
  context.restore();
}
// a small gold medal, as on the Honours tab
function drawMedal(context, x, y, radius) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = cssValue('--ochre');
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = cssValue('--ink');
  context.stroke();
  context.beginPath();
  context.arc(x, y, radius * 0.62, 0, Math.PI * 2);
  context.lineWidth = 1;
  context.stroke();
}

async function drawResultCard() {
  const fonts = { display: cssValue('--f-display'), body: cssValue('--f-body'), note: cssValue('--f-note') };
  await Promise.all(
    [`80px ${fonts.display}`, `italic 30px ${fonts.note}`].map((font) => document.fonts.load(font)),
  ).catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  const context = canvas.getContext('2d');
  const ink = cssValue('--ink'),
    inkSoft = cssValue('--ink-soft');

  // parchment, darker towards the edges, inside an inked double rule
  const parchment = context.createRadialGradient(
    CARD.width / 2,
    CARD.height / 2,
    CARD.height * 0.3,
    CARD.width / 2,
    CARD.height / 2,
    CARD.width * 0.7,
  );
  parchment.addColorStop(0, cssValue('--bone'));
  parchment.addColorStop(1, cssValue('--paper-deep'));
  context.fillStyle = parchment;
  context.fillRect(0, 0, CARD.width, CARD.height);
  context.strokeStyle = ink;
  context.lineWidth = 3;
  context.strokeRect(CARD.inset, CARD.inset, CARD.width - 2 * CARD.inset, CARD.height - 2 * CARD.inset);
  context.strokeStyle = inkSoft;
  context.lineWidth = 1;
  context.strokeRect(
    CARD.inset + 9,
    CARD.inset + 9,
    CARD.width - 2 * (CARD.inset + 9),
    CARD.height - 2 * (CARD.inset + 9),
  );

  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.fillStyle = inkSoft;
  centredLine(context, 'The Royal Game of Ur', 112, 36, fonts.display);
  drawFlourish(context, 132);
  const lost = game.mode === 'ai' && game.winner === COMPUTER_SIDE;
  context.fillStyle = lost ? ink : cssValue('--vermilion');
  centredLine(context, resultTitle(), 290, 120, fonts.display);
  context.fillStyle = ink;
  centredLine(context, resultSubtitle(), 350, 36, fonts.note, 'italic');
  centredLine(context, resultScore(), 432, 46, fonts.display);
  if (game.newHonours.length) {
    const MEDAL_RADIUS = 14,
      GAP = 14;
    const label = `${game.newHonours.length === 1 ? 'Honour' : 'Honours'} earned: ${joinAsList(game.newHonours.map((honour) => honour.name))}`;
    context.font = `italic 28px ${fonts.note}`;
    const width = Math.min(context.measureText(label).width, CARD.textWidth - 2 * MEDAL_RADIUS - GAP);
    const left = CARD.width / 2 - (width + 2 * MEDAL_RADIUS + GAP) / 2;
    drawMedal(context, left + MEDAL_RADIUS, 490, MEDAL_RADIUS);
    context.fillStyle = ink;
    context.textAlign = 'left';
    context.fillText(label, left + 2 * MEDAL_RADIUS + GAP, 500, width);
    context.textAlign = 'center';
  }
  context.fillStyle = inkSoft;
  centredLine(context, new URL(SITE_URL).host, CARD.height - 60, 24, fonts.note, 'italic');
  return canvas;
}

// ---------- sharing ----------
// the card is drawn as soon as the game ends, so Share can hand it over at once: browsers only allow sharing
// straight after a tap, not after waiting for a drawing
let resultCardFile = null;
function prepareResultCard() {
  const forGame = gameId;
  resultCardFile = drawResultCard()
    .then((canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png')))
    .then((blob) => (forGame === gameId && blob ? new File([blob], CARD_FILE_NAME, { type: 'image/png' }) : null))
    .catch(() => null);
}
function saveFile(file) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
async function shareResultCard() {
  const file = await resultCardFile;
  if (!file) return;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'The Royal Game of Ur', text: resultSentence() });
    } catch (e) {
      if (e.name !== 'AbortError') saveFile(file);
    } // AbortError: the player closed the share sheet
  } else saveFile(file);
}
$('status').addEventListener('click', (e) => {
  if (e.target.closest('#share-result')) shareResultCard();
});
