/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Pinning a note (a guide tip or a piece of advice) beside the thing it's about, with its tail pointing at it.

const BUBBLE_GAP = 14, BUBBLE_EDGE_MARGIN = 12, BUBBLE_TAIL_INSET = 18;

// prefer 'below' or 'above' the anchor; the bubble flips if there isn't room on that side
function placeBubble(bubble, anchor, prefer = 'below') {
  const target = anchor.getBoundingClientRect(), width = bubble.offsetWidth, height = bubble.offsetHeight;
  const left = Math.max(BUBBLE_EDGE_MARGIN, Math.min(target.left + target.width / 2 - width / 2, document.documentElement.clientWidth - width - BUBBLE_EDGE_MARGIN));
  const fitsBelow = target.bottom + BUBBLE_GAP + height < innerHeight, fitsAbove = target.top - height - BUBBLE_GAP > 0;
  const below = prefer === 'above' ? !fitsAbove : fitsBelow || !fitsAbove;
  bubble.dataset.side = below ? 'below' : 'above';
  bubble.style.left = left + scrollX + 'px';
  bubble.style.top = (below ? target.bottom + BUBBLE_GAP : target.top - height - BUBBLE_GAP) + scrollY + 'px';
  // the tail points at the anchor's centre, kept clear of the bubble's rounded corners
  const tailX = Math.max(BUBBLE_TAIL_INSET, Math.min(target.left + target.width / 2 - left, width - BUBBLE_TAIL_INSET));
  bubble.style.setProperty('--ax', tailX + 'px');
}
