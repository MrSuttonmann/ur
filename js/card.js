/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The result card: a picture of a finished game to share. It shows the outcome, the final board drawn with
// the game's own tiles and counters, a few numbers, and any honours earned. It goes to the device's share
// sheet where there is one, and is saved as a picture where there isn't.

const CARD = { width: 1200, height: 630, inset: 22, textLeft: 74, textWidth: 520 };
const CARD_TILE = 64;                         // a board square on the card, in pixels
const SVG_TILE = 40;                          // a board square in the drawings' own units
const SVG_COUNTER_INSET = 4;                  // a counter sits this far inside its square
const CARD_FILE_NAME = 'royal-game-of-ur-result.png';

const cssValue = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// The drawings are styled by class (css/drawings.css) with the page's colours (:root in css/base.css), and
// filtered by the shared #ink and #wash filters. A picture drawn from SVG can't see the page, so it carries copies.
function drawingStyles() {
  const rules = [];
  for (const sheet of document.styleSheets) {
    const href = sheet.href || '';
    const isDrawings = href.endsWith('/drawings.css'), isBase = href.endsWith('/base.css');
    if (!isDrawings && !isBase) continue;
    try {
      for (const rule of sheet.cssRules) if (isDrawings || rule.selectorText === ':root') rules.push(rule.cssText);
    } catch (e) {}
  }
  return rules.join('\n');
}
const placeDrawing = (svg, x, y, size) => svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${size}" height="${size}" `);

// the board as it ended: every tile, and every counter still on it
function finalBoardSVG() {
  const columns = BOARD_PICTURES[0].length, rows = BOARD_PICTURES.length;
  let drawings = '', tileSeed = 0;
  BOARD_PICTURES.forEach((pictures, row) => pictures.forEach((kind, column) => {
    if (kind) drawings += placeDrawing(tileSVG(kind, tileSeed++), column * SVG_TILE, row * SVG_TILE, SVG_TILE);
  }));
  for (const side of SIDES) game.positions[side].forEach((square, counter) => {
    if (!isOnBoard(square)) return;
    const [row, column] = routeCell(side, square);
    drawings += placeDrawing(counterSVG(side, counter + side),
      column * SVG_TILE + SVG_COUNTER_INSET, row * SVG_TILE + SVG_COUNTER_INSET, SVG_TILE - 2 * SVG_COUNTER_INSET);
  });
  const width = columns * SVG_TILE, height = rows * SVG_TILE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${columns * CARD_TILE}" height="${rows * CARD_TILE}">
    <style>${drawingStyles()}</style>${document.querySelector('.svg-defs defs').outerHTML}${drawings}</svg>`;
}

const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

// ---------- the words on the card ----------
function resultTitle() {
  if (game.mode !== 'ai') return `The ${SIDE_NAME[game.winner]} triumphs!`;
  return game.winner === COMPUTER_SIDE ? 'Defeat' : 'Victory!';
}
function resultSubtitle() {
  const variant = VARIANT_DEFINITIONS[game.variant].name;
  return game.mode === 'ai' ? `against ${opponentNameMidSentence()} · ${variant}` : `Two players · ${variant}`;
}
function resultNumbers() {
  const sides = game.stats.bySide, both = field => sides[SUN][field] + sides[MOON][field];
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const loser = opponentOf(game.winner);
  return [
    `${sides[game.winner].home} – ${sides[loser].home} counters home`,
    `${plural(both('moves'), 'move')} · ${plural(both('captures'), 'capture')} · ${plural(both('roses'), 'rose')} · ${formatClock(game.stats.playMs)}`,
  ];
}
// the words that go with the picture when it's shared
function resultSentence() {
  const where = location.origin + location.pathname;
  if (game.mode !== 'ai') return `The ${SIDE_NAME[game.winner]} won our game of the Royal Game of Ur. ${where}`;
  return game.winner === COMPUTER_SIDE
    ? `${opponentName()} beat me at the Royal Game of Ur. ${where}`
    : `I beat ${opponentNameMidSentence()} at the Royal Game of Ur! ${where}`;
}

// ---------- drawing the card ----------
// shrink a line's font until it fits the width it has
function fitFont(context, text, size, family, maxWidth, style = '') {
  let fitted = size;
  do context.font = `${style} ${fitted}px ${family}`; while (context.measureText(text).width > maxWidth && --fitted > 10);
}
// words wrapped onto as many lines as they need; returns the y below the last line
function wrapText(context, text, x, y, maxWidth, lineHeight) {
  let line = '';
  for (const word of text.split(' ')) {
    const tried = line ? line + ' ' + word : word;
    if (context.measureText(tried).width > maxWidth && line) { context.fillText(line, x, y); line = word; y += lineHeight; }
    else line = tried;
  }
  context.fillText(line, x, y);
  return y + lineHeight;
}
// a small gold medal, as on the Honours tab
function drawMedal(context, x, y, radius) {
  context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = cssValue('--ochre'); context.fill();
  context.lineWidth = 2; context.strokeStyle = cssValue('--ink'); context.stroke();
  context.beginPath(); context.arc(x, y, radius * .62, 0, Math.PI * 2); context.lineWidth = 1; context.stroke();
}

async function drawResultCard() {
  const fonts = { display: cssValue('--f-display'), body: cssValue('--f-body'), note: cssValue('--f-note') };
  await Promise.all([`80px ${fonts.display}`, `28px ${fonts.body}`, `italic 30px ${fonts.note}`].map(font => document.fonts.load(font))).catch(() => {});
  const boardSVG = finalBoardSVG();
  const board = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(boardSVG));

  const canvas = document.createElement('canvas');
  canvas.width = CARD.width; canvas.height = CARD.height;
  const context = canvas.getContext('2d');
  const ink = cssValue('--ink'), inkSoft = cssValue('--ink-soft');

  // parchment, darker towards the edges, inside an inked double rule
  const parchment = context.createRadialGradient(CARD.width / 2, CARD.height / 2, CARD.height * .3, CARD.width / 2, CARD.height / 2, CARD.width * .7);
  parchment.addColorStop(0, cssValue('--bone')); parchment.addColorStop(1, cssValue('--paper-deep'));
  context.fillStyle = parchment; context.fillRect(0, 0, CARD.width, CARD.height);
  context.strokeStyle = ink; context.lineWidth = 3;
  context.strokeRect(CARD.inset, CARD.inset, CARD.width - 2 * CARD.inset, CARD.height - 2 * CARD.inset);
  context.strokeStyle = inkSoft; context.lineWidth = 1;
  context.strokeRect(CARD.inset + 9, CARD.inset + 9, CARD.width - 2 * (CARD.inset + 9), CARD.height - 2 * (CARD.inset + 9));

  // the words, down the left
  const x = CARD.textLeft;
  context.textBaseline = 'alphabetic';
  context.fillStyle = inkSoft; context.font = `30px ${fonts.display}`;
  context.fillText('The Royal Game of Ur', x, 112);
  const lost = game.mode === 'ai' && game.winner === COMPUTER_SIDE;
  context.fillStyle = lost ? ink : cssValue('--vermilion');
  fitFont(context, resultTitle(), 88, fonts.display, CARD.textWidth);
  context.fillText(resultTitle(), x, 212);
  context.fillStyle = ink;
  fitFont(context, resultSubtitle(), 32, fonts.note, CARD.textWidth, 'italic');
  context.fillText(resultSubtitle(), x, 264);
  const [score, numbers] = resultNumbers();
  context.font = `40px ${fonts.display}`; context.fillText(score, x, 342);
  fitFont(context, numbers, 27, fonts.body, CARD.textWidth);
  context.fillText(numbers, x, 388);
  if (game.newHonours.length) {
    const MEDAL_RADIUS = 15;
    drawMedal(context, x + MEDAL_RADIUS, 446, MEDAL_RADIUS);
    context.fillStyle = ink; context.font = `italic 27px ${fonts.note}`;
    const label = `${game.newHonours.length === 1 ? 'Honour' : 'Honours'} earned: ${game.newHonours.map(honour => honour.name).join(', ')}`;
    wrapText(context, label, x + 2 * MEDAL_RADIUS + 14, 456, CARD.textWidth - 2 * MEDAL_RADIUS - 14, 34);
  }
  context.fillStyle = inkSoft; context.font = `italic 22px ${fonts.note}`;
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  context.fillText(`${location.host}${location.pathname.replace(/\/$/, '')} · ${date}`, x, CARD.height - 62);

  // the final board on the right, with each side's name and how many it brought home
  const boardX = CARD.width - CARD.textLeft - board.width, boardY = (CARD.height - board.height) / 2;
  context.save();
  context.shadowColor = 'rgba(40,28,18,.35)'; context.shadowBlur = 18; context.shadowOffsetY = 6;
  context.drawImage(board, boardX, boardY);
  context.restore();
  const sideLabel = side => `${playerName(side)} · ${game.stats.bySide[side].home} of ${game.positions[side].length} home`;
  context.font = `italic 26px ${fonts.note}`;
  context.fillStyle = cssValue('--c-moon');
  context.fillText(sideLabel(MOON), boardX, boardY - 18);
  context.fillStyle = cssValue('--c-sun');
  context.fillText(sideLabel(SUN), boardX, boardY + board.height + 38);
  return canvas;
}

// ---------- sharing ----------
// the card is drawn as soon as the game ends, so Share can hand it over at once: browsers only allow sharing
// straight after a tap, not after waiting for a drawing
let resultCardFile = null;
function prepareResultCard() {
  const forGame = gameId;
  resultCardFile = drawResultCard()
    .then(canvas => new Promise(resolve => canvas.toBlob(resolve, 'image/png')))
    .then(blob => forGame === gameId && blob ? new File([blob], CARD_FILE_NAME, { type: 'image/png' }) : null)
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
    try { await navigator.share({ files: [file], title: 'The Royal Game of Ur', text: resultSentence() }); }
    catch (e) { if (e.name !== 'AbortError') saveFile(file); }   // AbortError: the player closed the share sheet
  } else saveFile(file);
}
$('status').addEventListener('click', e => { if (e.target.closest('#share-result')) shareResultCard(); });
