/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The result card: a picture of a finished game to share, kept simple: the outcome, who it was against,
// the score in counters home, and any honours earned. It goes to the device's share sheet where there is
// one, and is saved as a picture where there isn't. It's drawn only with the page's colours and fonts, which
// a page can always read, so it looks the same however the game was opened.

const CARD = { width: 1200, height: 630, inset: 22, innerRuleGap: 9, textWidth: 960, minFontSize: 10 };
const CARD_FILE_NAME = 'royal-game-of-ur-result.png';
const CARD_TITLE = 'The Royal Game of Ur';
const FLOURISH_SCALE = 1.6;
// the honours line wraps onto a second line rather than squeezing; more than that and the last line squeezes
const HONOURS_LINE = { size: 28, top: 494, lineHeight: 34, maxLines: 2, medalRadius: 14, medalGap: 14 };

const cssValue = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// the game's home: the page's canonical address, or, in a copy without one, wherever it was opened from
function siteUrl() {
  const canonical = /** @type {HTMLLinkElement | null} */ (document.querySelector('link[rel=canonical]'));
  return canonical ? canonical.href : location.href.split('#')[0];
}
// the address as people write it: host and path, without the scheme or a trailing slash
function displayAddress(url) {
  const { host, pathname } = new URL(url);
  return (host + pathname).replace(/\/$/, '');
}

// ---------- the words on the card ----------
function resultTitle() {
  if (game.mode !== 'ai') return `The ${SIDE_NAME[game.winner]} triumphs!`;
  return game.winner === COMPUTER_SIDE ? 'Defeat' : 'Victory!';
}
function resultSubtitle() {
  const players = game.mode === 'ai' ? `against ${opponentNameMidSentence()}` : 'Two players';
  return `${players} · ${VARIANT_DEFINITIONS[game.variant].name}`;
}
const resultScore = () =>
  `${game.stats.bySide[game.winner].home} – ${game.stats.bySide[opponentOf(game.winner)].home} counters home`;
function honoursLabel() {
  const names = game.newHonours.map((honour) => honour.name);
  return `${names.length === 1 ? 'Honour' : 'Honours'} earned: ${joinAsList(names)}`;
}
// the words that go with the picture when it's shared
function resultSentence() {
  let sentence;
  if (game.mode !== 'ai') sentence = `The ${SIDE_NAME[game.winner]} won our game of the Royal Game of Ur.`;
  else if (game.winner === COMPUTER_SIDE) sentence = `${opponentName()} beat me at the Royal Game of Ur.`;
  else sentence = `I beat ${opponentNameMidSentence()} at the Royal Game of Ur!`;
  return `${sentence} ${siteUrl()}`;
}

// ---------- drawing the card ----------
// the page's colours and fonts, read once per card
function cardStyle() {
  return {
    ink: cssValue('--ink'),
    inkSoft: cssValue('--ink-soft'),
    vermilion: cssValue('--vermilion'),
    ochre: cssValue('--ochre'),
    bone: cssValue('--bone'),
    paperDeep: cssValue('--paper-deep'),
    displayFont: cssValue('--f-display'),
    noteFont: cssValue('--f-note'),
  };
}

// sets the font, shrunk if need be so the text fits the width; measures once to estimate, then confirms
function fitFont(context, text, size, family, style = '', maxWidth = CARD.textWidth) {
  const fontAt = (pixels) => `${style} ${pixels}px ${family}`.trim();
  context.font = fontAt(size);
  const width = context.measureText(text).width;
  if (width <= maxWidth) return;
  let fitted = Math.max(CARD.minFontSize, Math.floor((size * maxWidth) / width));
  context.font = fontAt(fitted);
  while (fitted > CARD.minFontSize && context.measureText(text).width > maxWidth) context.font = fontAt(--fitted);
}
function centredLine(context, text, y, size, family, style = '') {
  fitFont(context, text, size, family, style);
  context.fillText(text, CARD.width / 2, y);
}
// the words of the text in lines no wider than the width
function wrapWords(context, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const longer = line ? `${line} ${word}` : word;
    if (line && context.measureText(longer).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = longer;
  }
  return [...lines, line];
}

// the page's hand-drawn header flourish, with its own dot and line weight, centred under the heading
function drawFlourish(context, y, style) {
  const svg = document.querySelector('.flourish');
  const line = svg && svg.querySelector('path');
  if (!line) return;
  const viewWidth = Number(svg.getAttribute('viewBox').split(' ')[2]);
  context.save();
  context.translate(CARD.width / 2 - (viewWidth * FLOURISH_SCALE) / 2, y);
  context.scale(FLOURISH_SCALE, FLOURISH_SCALE);
  context.strokeStyle = style.ink;
  context.lineWidth = parseFloat(getComputedStyle(line).strokeWidth);
  context.lineCap = 'round';
  context.stroke(new Path2D(line.getAttribute('d')));
  const dot = svg.querySelector('circle');
  if (dot) {
    context.beginPath();
    context.arc(
      Number(dot.getAttribute('cx')),
      Number(dot.getAttribute('cy')),
      Number(dot.getAttribute('r')),
      0,
      Math.PI * 2,
    );
    context.fillStyle = style.vermilion;
    context.fill();
  }
  context.restore();
}
// a small gold medal, as on the Honours tab
function drawMedal(context, x, y, radius, style) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = style.ochre;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = style.ink;
  context.stroke();
  context.beginPath();
  context.arc(x, y, radius * 0.62, 0, Math.PI * 2);
  context.lineWidth = 1;
  context.stroke();
}
// the honours earned, beside a medal, wrapped onto a second line if they need it
function drawHonours(context, style) {
  const { size, top, lineHeight, maxLines, medalRadius, medalGap } = HONOURS_LINE;
  const medalRoom = 2 * medalRadius + medalGap;
  const textWidth = CARD.textWidth - medalRoom;
  context.font = `italic ${size}px ${style.noteFont}`;
  let lines = wrapWords(context, honoursLabel(), textWidth);
  if (lines.length > maxLines) lines = [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(' ')];
  const blockWidth = Math.min(textWidth, Math.max(...lines.map((line) => context.measureText(line).width)));
  const left = CARD.width / 2 - (blockWidth + medalRoom) / 2;
  drawMedal(context, left + medalRadius, top - size / 3, medalRadius, style);
  context.fillStyle = style.ink;
  const textCentre = left + medalRoom + blockWidth / 2;
  lines.forEach((line, row) => context.fillText(line, textCentre, top + row * lineHeight, textWidth));
}

async function drawResultCard() {
  const style = cardStyle();
  await Promise.all(
    [`80px ${style.displayFont}`, `italic 30px ${style.noteFont}`].map((font) => document.fonts.load(font)),
  ).catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  const context = canvas.getContext('2d');

  // parchment, darker towards the edges, inside an inked double rule
  const centre = { x: CARD.width / 2, y: CARD.height / 2 };
  const parchment = context.createRadialGradient(
    centre.x,
    centre.y,
    CARD.height * 0.3,
    centre.x,
    centre.y,
    CARD.width * 0.7,
  );
  parchment.addColorStop(0, style.bone);
  parchment.addColorStop(1, style.paperDeep);
  context.fillStyle = parchment;
  context.fillRect(0, 0, CARD.width, CARD.height);
  const inner = CARD.inset + CARD.innerRuleGap;
  context.strokeStyle = style.ink;
  context.lineWidth = 3;
  context.strokeRect(CARD.inset, CARD.inset, CARD.width - 2 * CARD.inset, CARD.height - 2 * CARD.inset);
  context.strokeStyle = style.inkSoft;
  context.lineWidth = 1;
  context.strokeRect(inner, inner, CARD.width - 2 * inner, CARD.height - 2 * inner);

  context.textAlign = 'center';
  context.fillStyle = style.inkSoft;
  centredLine(context, CARD_TITLE, 112, 36, style.displayFont);
  drawFlourish(context, 132, style);
  const lost = game.mode === 'ai' && game.winner === COMPUTER_SIDE;
  context.fillStyle = lost ? style.ink : style.vermilion;
  centredLine(context, resultTitle(), 290, 120, style.displayFont);
  context.fillStyle = style.ink;
  centredLine(context, resultSubtitle(), 350, 36, style.noteFont, 'italic');
  centredLine(context, resultScore(), 432, 46, style.displayFont);
  if (game.newHonours.length) drawHonours(context, style);
  context.fillStyle = style.inkSoft;
  centredLine(context, displayAddress(siteUrl()), CARD.height - 60, 24, style.noteFont, 'italic');
  return canvas;
}

// ---------- sharing ----------
// The card is drawn as soon as the game ends, so Share can hand it over at once: browsers only allow sharing
// straight after a tap, not after waiting for a drawing. The words are settled then too, so changing the
// opponent before sharing can't change who the words say you played.
let resultCard = null; // a promise of { file, text }, or null
const nextTask = () => new Promise((resolve) => setTimeout(resolve));
function prepareResultCard() {
  const forGame = gameId;
  const text = resultSentence();
  resultCard = nextTask() // after the end banner has had its first frame
    .then(() => (forGame === gameId ? drawResultCard() : null))
    .then((canvas) => canvas && new Promise((resolve) => canvas.toBlob(resolve, 'image/png')))
    .then((blob) =>
      forGame === gameId && blob ? { file: new File([blob], CARD_FILE_NAME, { type: 'image/png' }), text } : null,
    )
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
  const card = await resultCard;
  if (!card) return;
  const { file, text } = card;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: CARD_TITLE, text });
    } catch (e) {
      if (e.name !== 'AbortError') saveFile(file); // AbortError: the player closed the share sheet
    }
  } else saveFile(file);
}
$('status').addEventListener('click', (e) => {
  if (e.target.closest('#share-result')) shareResultCard();
});
