/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The guided first game: parchment tips that point things out the first time they come up.
// While a tip is open the game waits; closing it lets the game carry on.

let guideTipOpen = false;      // a tip is showing
let resumeAfterTip = false;    // the game wanted to move on while the tip was open
let guideTipAnchor = null;     // what the open tip points at
let lastCapturedSide = null;   // set when a capture happens, so the guide can mention it once

const guideDone = () => { try { return localStorage.getItem('ur-guide-done') === '1'; } catch (e) { return false; } };
function finishGuide() { try { localStorage.setItem('ur-guide-done', '1'); } catch (e) {} }

// where a move by your counters lands: a board square, or your home tray
const yourLanding = move => landingElement(HUMAN_SIDE, move);

// the next tip worth showing, one idea at a time, each once per guided game: [id, anchor element, text]
function nextGuideTip() {
  const seen = id => game.tips[id], yourTurn = game.turn === HUMAN_SIDE, yourTray = $('tray' + HUMAN_SIDE);
  const counters = game.positions[HUMAN_SIDE].length;
  if (!seen('welcome')) return ['welcome', yourTray, `You play the <b>Sun</b>. Race all ${COUNT_WORD[counters]} of your counters along the board and home before ${opponentNameMidSentence()}’s Moon. They wait here in your tray.`];
  if (game.phase === 'over') return seen('done') ? null : ['done', $('open-rules').parentElement,
    'That’s the guided game done! <b>Rules</b> and <b>Strategy</b> up here explain more, and <b>Options</b> lets you try other rules or replay this guide.'];
  if (lastCapturedSide === HUMAN_SIDE && !seen('captured')) return ['captured', yourTray, `Ouch! ${opponentName()} landed on one of your counters and sent it back to your tray. It has to start the route again.`];
  if (yourTurn && game.phase === 'roll' && !seen('roll')) return ['roll', $('roll'), 'Press <b>Roll</b>, or the Space bar. Count the red tips on the four dice: that’s how many squares you move, from 0 to 4.'];
  if (yourTurn && game.phase === 'roll' && !seen('danger')) {
    const exposed = game.positions[HUMAN_SIDE].find(square => isSharedSquare(square) && !isSafeSquare(square, currentRules));
    if (exposed) return ['danger', squareElement(HUMAN_SIDE, exposed), `This counter has reached the <b>shared middle row</b>. ${opponentName()} can land on it here and send it back to the start, so don’t linger.`];
  }
  if (yourTurn && game.phase === 'move') {
    const moves = legalMoves(game.positions, HUMAN_SIDE, game.roll);
    if (!moves.length) return seen('pass') ? null : ['pass', $('status'), game.roll === 0
      ? 'A roll of 0 means no move this time, so your turn passes.' : 'None of your counters can move exactly that far, so your turn passes.'];
    if (!seen('move')) return ['move', yourTray, 'Counters that can move <b>glow</b>. Point at one to see where it would land, then click it. New counters join the board through your gate.'];
    const tipFor = (id, isRelevant, text) => { const move = !seen(id) && moves.find(isRelevant); return move ? [id, yourLanding(move), text] : null; };
    return tipFor('capture', move => move.captures >= 0, `You can <b>capture</b>! Land on ${opponentNameMidSentence()}’s counter here to send it back to the start.`)
      || tipFor('centre', move => move.to === CENTRE, 'This is the <b>centre rose</b>, ringed in gold. Land here to roll again, and no one can capture you while you sit on it.')
      || tipFor('rose', move => ROSETTES.has(move.to), 'This move lands on a <b>rose</b>, so you’ll roll again.')
      || tipFor('home', move => move.to === HOME, 'This roll can bring a counter <b>home</b>. You need the exact number to leave: a 1 from your last square, a 2 from the one before.')
      || (canAdvise() && !seen('advise') ? ['advise', $('advise'), 'Not sure which to move? <b>Advise me</b> shows what the King would do, and why.'] : null);
  }
  return null;
}

// show the next tip, if this is the guided game and one is due
function showNextGuideTip() {
  if (!game || !game.guided) return;
  if (guideTipOpen) { placeGuideTip(); return; }
  const tip = nextGuideTip();
  lastCapturedSide = null;
  if (!tip) return;
  const [id, anchor, html] = tip;
  game.tips[id] = true;
  if (id === 'done') finishGuide();
  guideTipOpen = true; guideTipAnchor = anchor;
  $('coach-text').innerHTML = html;
  $('coach-skip').hidden = id === 'done';
  $('coach').hidden = false;
  anchor.classList.add('coach-focus');
  anchor.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  placeGuideTip();
  setTimeout(placeGuideTip, 400);  // again once any smooth scroll has settled
  $('coach-ok').focus({ preventScroll: true });
}
function placeGuideTip() { if (guideTipOpen) placeBubble($('coach'), guideTipAnchor); }
addEventListener('resize', () => { placeGuideTip(); clearMovePreview(); drawAdvice(); });

// close the tip; with resume, show any next tip, otherwise let the game carry on
function closeGuideTip(resume = true) {
  if (!guideTipOpen) return;
  guideTipOpen = false;
  $('coach').hidden = true;
  guideTipAnchor.classList.remove('coach-focus');
  if (game.phase === 'over' && game.tips.done) game.guided = false;
  if (!resume) { resumeAfterTip = false; return; }
  showNextGuideTip();
  focusFirstMovable();
  if (!guideTipOpen && resumeAfterTip) { resumeAfterTip = false; continueGame(); }
}
$('coach-ok').addEventListener('click', () => closeGuideTip());
$('coach-skip').addEventListener('click', () => { finishGuide(); game.guided = false; closeGuideTip(); render(); });
