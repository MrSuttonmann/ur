/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Advise me: the King-level search suggests a move for you, explains it, and marks it on the board.

// advice is offered against the Squire (unlimited) and the Knight (five per game), never the King
const ADVICE_LIMIT = { easy: Infinity, medium: 5 };
const ADVISER_LEVEL = 'hard';
const THREATENED = .25;              // a counter this likely to be hit counts as "in danger"
const LONG_WAY_SQUARE = 9;           // capturing a counter this far along is worth pointing out

const adviceOffered = () => game.mode === 'ai' && game.level in ADVICE_LIMIT && game.phase === 'move'
  && !isComputer(game.turn) && legalMoves(game.positions, game.turn, game.roll).length > 1;
const adviceLeft = () => game.level in ADVICE_LIMIT ? ADVICE_LIMIT[game.level] - game.stats.bySide[HUMAN_SIDE].adviceTaken : 0;
const canAdvise = () => adviceOffered() && adviceLeft() > 0;

// chance an opposing counter could land on this square next turn (0 off the shared row or on the safe centre)
function dangerAt(positions, side, square) {
  if (!isSharedSquare(square) || isSafeSquare(square, currentRules)) return 0;
  return captureRisk(positions, side, square);
}
// "a", "a and b", "a, b and c"
const joinAsList = items => items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];

function giveAdvice() {
  if (game.advice) return;  // asking again on the same roll shows the same advice and doesn't use another
  if (!canAdvise()) return;
  const side = game.turn, move = chooseComputerMove(game.positions, side, game.roll, ADVISER_LEVEL);
  game.advice = { counter: move.counter, to: move.to, text: explainMove(side, move) };
  game.stats.bySide[side].adviceTaken++;
  render();
}
function explainMove(side, move) {
  const reasons = [];
  if (move.to === currentRules.home) reasons.push('brings a counter home');
  if (move.captures >= 0) reasons.push(`captures their counter on square ${move.to}${move.to >= LONG_WAY_SQUARE ? ', which had come a long way' : ''}`);
  if (isSafeSquare(move.to, currentRules)) reasons.push(move.to === currentRules.centre
    ? 'takes the centre rose, so you roll again and it’s safe there' : 'takes a contested rose, so you roll again and it’s safe there');
  else if (isRose(move.to)) reasons.push('lands on a rose, so you roll again');
  else if (currentRules.captureRoll && move.captures >= 0) reasons.push('earns another roll for the capture');
  const dangerBefore = dangerAt(game.positions, side, move.from);
  const dangerAfter = move.to === currentRules.home ? 0 : dangerAt(applyMove(game.positions, side, move), side, move.to);
  if (dangerBefore >= THREATENED && dangerAfter < dangerBefore) reasons.push('moves a threatened counter out of danger');
  if (!reasons.length) reasons.push(move.from === IN_TRAY ? 'brings a new counter into play' : 'leaves your counters safest overall');
  const from = move.from === IN_TRAY ? 'from your tray' : 'on ' + move.from, to = move.to === currentRules.home ? 'home' : 'to ' + move.to;
  let text = `Advice: move the counter ${from} ${to}. It ${joinAsList(reasons)}.`;
  if (dangerAfter > 0) text += ` It could be hit next turn (${Math.round(dangerAfter * 100)}% chance).`;
  return text;
}

function clearAdvice() {
  document.querySelectorAll('.advised-target').forEach(el => el.classList.remove('advised-target'));
  $('arrow-advice').setAttribute('hidden', '');
  $('advice-note').hidden = true;
}
// the advised landing square gets a red ring and an arrow, with the reasoning in a note pinned beside it
function drawAdvice() {
  clearAdvice();
  if (!game.advice || game.phase !== 'move') return;
  const landing = landingElement(game.turn, game.advice);
  landing.classList.add('advised-target');
  $('advice-text').textContent = game.advice.text;
  $('advice-note').hidden = false;
  const counter = document.querySelector('.piece.advised');
  if (counter) drawArrow($('arrow-advice'), counter, landing);
  // keep the note off the counter it's talking about
  const counterBelow = counter && counter.getBoundingClientRect().top > landing.getBoundingClientRect().bottom - 4;
  placeBubble($('advice-note'), landing, counterBelow ? 'above' : 'below');
}
$('advise').addEventListener('click', giveAdvice);
