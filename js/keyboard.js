/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Keyboard play: R or Space rolls, number keys or arrows and Enter move, A asks for advice, U takes back a move
// (against the Squire), Esc closes a tip.
// Number badges and the keyboard hint only show once someone uses the keyboard; the mouse hides them again.

let keyboardMode = false;
function setKeyboardMode(on) {
  if (keyboardMode === on) return;
  keyboardMode = on;
  document.body.classList.toggle('kbd', on);
  if (game && game.phase === 'move') render();
}
addEventListener('pointerdown', () => setKeyboardMode(false));

// a keyboard player's focus lands on counter 1 whenever there's a move to choose, previewing where it goes
function focusFirstMovable() {
  if (!keyboardMode || guideTipOpen || document.querySelector('dialog[open]')) return;
  if (document.activeElement && document.activeElement.classList.contains('movable')) return;
  const first = document.querySelector('.piece.movable[data-key="1"]');
  if (first) first.focus({ preventScroll: true });
}

const isRollKey = (e, tag) => e.key === 'r' || e.key === 'R' || (e.key === ' ' && !['BUTTON', 'SUMMARY'].includes(tag));
const isAdviseKey = e => e.key === 'a' || e.key === 'A';
const isUndoKey = e => e.key === 'u' || e.key === 'U';
const ARROW_STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  const tag = e.target.tagName, typing = ['SELECT', 'INPUT', 'TEXTAREA'].includes(tag);
  if (!typing && e.key !== 'Shift') setKeyboardMode(true);
  if (guideTipOpen && e.key === 'Escape') { closeGuideTip(); return; }
  if (typing) return;
  if (isRollKey(e, tag)) {
    if (game.phase === 'roll' && !isComputer(game.turn)) { e.preventDefault(); rollDice(); }
    return;
  }
  if (isUndoKey(e)) {
    if (canUndo()) { e.preventDefault(); undoMove(); }
    return;
  }
  if (game.phase !== 'move' || isComputer(game.turn)) return;
  const movable = [...document.querySelectorAll('.piece.movable[data-key]')].sort((a, b) => a.dataset.key - b.dataset.key);
  if (/^[1-9]$/.test(e.key)) {
    const counter = movable[+e.key - 1];
    if (counter) { e.preventDefault(); counter.click(); }
  } else if (e.key in ARROW_STEP && movable.length) {
    e.preventDefault();
    const at = movable.indexOf(document.activeElement);
    movable[at < 0 ? 0 : (at + ARROW_STEP[e.key] + movable.length) % movable.length].focus();
  } else if (isAdviseKey(e) && canAdvise()) {
    e.preventDefault(); giveAdvice();
  }
});
