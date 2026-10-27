/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Choosing a variant: the picker window, with a picture and a few words on each, and showing which rules are in play.
// The rule changes themselves are described in the Rules window.

// what each variant is like to play (the rules live in rules.js; this is just the words)
const VARIANT_COPY = {
  classic: {
    tag: 'Finkel’s rules',
    prose: 'The game as Irving Finkel reconstructed it from a 2,000-year-old rulebook. Seven counters each race home, and the centre rose is a safe haven worth fighting for.',
  },
  masters: {
    tag: 'James Masters’ route',
    prose: 'A longer route that crosses your opponent’s path. Counters loop round the far end through the enemy corner, so the battle carries on right to the finish.',
  },
  quick: {
    tag: 'House rule',
    prose: 'The classic game with five counters each instead of seven. Ideal when you only have a few minutes.',
  },
  raiders: {
    tag: 'House rule',
    prose: 'Every capture earns another roll, and no rose is safe. Bold and brutal: nobody’s lead is safe.',
  },
};

// the facts at a glance, worked out from the rules themselves
function variantFacts(rules) {
  const safeRoses = [...rules.roses].filter(square => isSafeSquare(square, rules)).length;
  const facts = [`${rules.counters} counters`, `${rules.length}-square route`,
    safeRoses ? `${safeRoses === 1 ? 'centre rose' : safeRoses + ' roses'} safe` : 'no safe roses'];
  if (rules.captureRoll) facts.push('captures roll again');
  return facts.join(' · ');
}

// a little picture of the variant's board: both routes, its safe roses ringed, and its counters
const THUMB = { cell: 14, gap: 2, margin: 6 };
function variantThumbnail(rules) {
  const pitch = THUMB.cell + THUMB.gap, boardWidth = BOARD_COLUMNS * pitch, boardHeight = BOARD_ROWS * pitch;
  const centreOf = ([row, column], lane) => [THUMB.margin + column * pitch + THUMB.cell / 2 + lane, THUMB.margin + row * pitch + THUMB.cell / 2 + lane];
  let svg = '';
  BOARD_PICTURES.forEach((pictures, row) => pictures.forEach((picture, column) => {
    if (!picture) return;
    const key = cellKey([row, column]), x = THUMB.margin + column * pitch, y = THUMB.margin + row * pitch;
    const rose = ROSE_CELLS.has(key), square = rules.squareAt[SUN][key] || rules.squareAt[MOON][key];
    const safe = rose && isSafeSquare(square, rules);
    svg += `<rect x="${x}" y="${y}" width="${THUMB.cell}" height="${THUMB.cell}" rx="2.5" style="fill:var(--${rose ? 'ochre' : 'bone'});fill-opacity:${rose ? .6 : 1};stroke:${safe ? 'var(--ochre)' : 'var(--ink-soft)'};stroke-width:${safe ? 2 : .8}"/>`;
    if (rose) svg += `<circle cx="${x + THUMB.cell / 2}" cy="${y + THUMB.cell / 2}" r="2.6" style="fill:var(--vermilion)"/>`;
  }));
  const routeLine = (side, lane, style) => {
    const cells = rules.cells[side], first = cells[0], last = cells[cells.length - 1];
    const points = [[first[0], first[1] + .7], ...cells, [last[0], last[1] - .8]].map(cell => centreOf(cell, lane).map(n => n.toFixed(1)).join(','));
    return `<polyline points="${points.join(' ')}" style="fill:none;${style};stroke-width:1.8;stroke-linejoin:round"/>`;
  };
  svg += routeLine(MOON, -1.5, 'stroke:var(--c-moon);stroke-dasharray:3 2');
  svg += routeLine(SUN, 1.5, 'stroke:var(--c-sun)');
  // a row of counters below the board, and crossed swords when captures roll again
  const countersY = THUMB.margin + boardHeight + 8;
  for (let i = 0; i < rules.counters; i++)
    svg += `<circle cx="${THUMB.margin + 5 + i * 11}" cy="${countersY}" r="4" style="fill:var(--sunfire);stroke:var(--ink);stroke-width:.8"/>`;
  if (rules.captureRoll) svg += `<g transform="translate(${THUMB.margin + boardWidth - 16} ${countersY - 8}) scale(.68)">${ICONS.swords}</g>`;
  return `<svg viewBox="0 0 ${boardWidth + THUMB.margin * 2} ${countersY + 8}" aria-hidden="true">${svg}</svg>`;
}

// one card per variant; choosing one sets up a board with it
function drawVariantCards() {
  $('variant-cards').innerHTML = Object.entries(VARIANTS).map(([id, rules]) => {
    const chosen = id === prefs.variant, copy = VARIANT_COPY[id];
    return `<button type="button" class="variant-card" role="radio" aria-checked="${chosen}" data-variant="${id}">
      ${variantThumbnail(rules)}
      <span><h3>${rules.name} <span class="tag">${copy.tag}</span>${chosen ? '<span class="chosen">chosen</span>' : ''}</h3>
        <p>${copy.prose}</p><p class="facts">${variantFacts(rules)}</p></span>
    </button>`;
  }).join('');
}
$('variant-cards').addEventListener('click', e => {
  const card = e.target.closest('[data-variant]');
  if (!card) return;
  chooseVariant(card.dataset.variant);
  $('variants-dlg').close();
});
function chooseVariant(id) {
  prefs.variant = id; savePrefs();
  if (isBetweenGames()) showSetupBoard();
}
$('open-variants').addEventListener('click', () => {
  drawVariantCards();
  $('variants-dlg').showModal();
  ($('variant-cards').querySelector('[aria-checked="true"]') || $('close-variants')).focus();
});
$('close-variants').addEventListener('click', () => $('variants-dlg').close());
$('variants-dlg').addEventListener('click', e => { if (e.target === $('variants-dlg')) $('variants-dlg').close(); });   // a click on the backdrop
$('variants-dlg').addEventListener('close', () => $('open-variants').focus());

// show what the current variant changes: route numbers, safe roses, the board key, the route diagram, the rules note
function showRulesInPlay() {
  const safe = currentRules.safeRoses;
  labelBoardSquares();
  drawRouteDiagram();
  const contestedRoses = [...currentRules.roses].filter(square => isSharedSquare(square)).length;
  $('key-centre-name').textContent = contestedRoses > 1 ? 'Ringed roses' : 'Centre rose';
  $('key-centre').textContent = !safe ? 'Roll again, but not safe in these rules'
    : contestedRoses > 1 ? 'Shared with the opponent: roll again, and safe' : 'Roll again, and safe from capture';
  $('key-centre-tile').firstElementChild.classList.toggle('safe-sq', safe);
  const note = $('variant-now'), classic = game.variant === 'classic';
  note.hidden = classic;
  note.innerHTML = classic ? '' : `You’re playing <b>${currentRules.name}</b>. Its changes are under <b>Variants</b> below, and the diagram shows its route.`;
}
