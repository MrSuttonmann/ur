/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The game in progress: its state, the turn sequence, and making moves (with their animation).

// ---------- state ----------
let game;                  // the game in progress (see createGameState)
let gameId = 0;            // changes with every new game, so timers from an old game can tell they're stale
let pendingStep = null;    // the one scheduled next step (a computer roll or move, a pass, an auto-move)
const $ = id => document.getElementById(id);
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// phases of a game: 'setup' (waiting for Start) → 'roll' → 'rolling' → 'move' → 'animating' → … → 'over'
function createGameState(mode, level, variant, guided, phase = 'roll') {
  const counters = VARIANTS[variant].counters;
  return {
    positions: SIDES.map(() => Array(counters).fill(IN_TRAY)),   // positions[side][counter] = route square
    turn: guided ? SUN : Math.random() < 0.5 ? SUN : MOON,
    phase, roll: null, dice: null,
    winner: null, lastLanding: null, note: '', advice: null,
    mode, level, variant, guided, tips: {}, log: [], stats: createGameStats(),
    newHonours: [],   // honours the game earned, once it's over
    undos: 0,         // moves you took back
  };
}
const isComputer = side => game.mode === 'ai' && side === COMPUTER_SIDE;
// against the Squire the game helps you learn: it shades the squares in danger and lets you take back a move
const LEARNER_LEVEL = 'easy';
const isLearnerGame = () => game.mode === 'ai' && game.level === LEARNER_LEVEL;

// against the computer, the Moon side goes by the opponent's name
const OPPONENT_NAME = { easy: 'The Squire', medium: 'Sir Knight', hard: 'The King' };
const playerName = side => game.mode !== 'ai' ? SIDE_NAME[side]
  : side === COMPUTER_SIDE ? OPPONENT_NAME[game.level] || 'Computer' : 'You';
// the same name mid-sentence: "the Squire" rather than "The Squire"
const playerNameMidSentence = side => playerName(side).replace(/^The /, 'the ');
const opponentName = () => playerName(COMPUTER_SIDE);
const opponentNameMidSentence = () => playerNameMidSentence(COMPUTER_SIDE);

let tally = { you: 0, computer: 0, sun: 0, moon: 0 };
try { const saved = JSON.parse(localStorage.getItem('ur-tally-v2')); if (saved) tally = { ...tally, ...saved }; } catch (e) {}
function saveTally() { try { localStorage.setItem('ur-tally-v2', JSON.stringify(tally)); } catch (e) {} }

// ---------- pacing ----------
const DELAY = {
  computerRoll: 750,       // before the computer rolls
  computerMove: 700,       // before it moves, so the roll can be read
  pass: 1400,              // showing "turn passes" before play moves on
  autoMove: 750,           // before a forced move plays itself
};
const DICE_COUNT = 4;
const DICE_TUMBLE_FRAMES = 9, DICE_TUMBLE_FRAME_MS = 70;
const HOP_MS = 190, ENTRY_HOP_EXTRA_MS = 120;

// run fn after ms, unless a new game has started in the meantime; only one step is ever pending
function scheduleStep(fn, ms) {
  const thisGame = gameId;
  clearTimeout(pendingStep);
  pendingStep = setTimeout(() => { if (thisGame === gameId) fn(); }, ms);
}

// decide what happens next on its own: the computer's roll or move, a pass, or a forced move
function continueGame() {
  if (game.phase === 'over' || game.phase === 'setup') return;
  // while a guide tip is open the game waits; dismissing it calls continueGame() again
  if (guideTipOpen) { resumeAfterTip = true; return; }
  if (game.phase === 'roll') { if (isComputer(game.turn)) scheduleStep(rollDice, DELAY.computerRoll); return; }
  if (game.phase === 'move') {
    const moves = legalMoves(game.positions, game.turn, game.roll);
    if (!moves.length) scheduleStep(() => endTurn(false), DELAY.pass);
    else if (isComputer(game.turn)) scheduleStep(() => makeMove(chooseComputerMove(game.positions, game.turn, game.roll, game.level)), DELAY.computerMove);
    else if (moves.length === 1 && prefs.autoMove && !game.guided) scheduleStep(playForcedMove, DELAY.autoMove);
  }
}
// the forced move is worked out again when the timer fires, in case the player already moved
function playForcedMove() {
  const moves = game.phase === 'move' && !isComputer(game.turn) ? legalMoves(game.positions, game.turn, game.roll) : [];
  if (moves.length === 1) makeMove(moves[0]);
}

// ---------- rolling ----------
const throwDie = () => (Math.random() < 0.5 ? 1 : 0);   // each die shows a marked tip or not
const throwDice = () => Array.from({ length: DICE_COUNT }, throwDie);

function rollDice() {
  if (game.phase !== 'roll') return;
  game.phase = 'rolling';
  game.advice = null;
  closeGuideTip(false);
  sfxDice();
  tumbleDice();
  const thisGame = gameId, result = throwDice();
  let frame = 0;
  const frames = prefersReducedMotion ? 0 : DICE_TUMBLE_FRAMES;
  const tick = () => {
    if (thisGame !== gameId) return;
    if (frame++ < frames) { drawDice(throwDice(), false); setTimeout(tick, DICE_TUMBLE_FRAME_MS); return; }
    landDice(result);
  };
  render();
  tick();
}
function landDice(result) {
  game.dice = result;
  game.roll = result.reduce((sum, die) => sum + die, 0);
  game.phase = 'move';
  const sideStats = game.stats.bySide[game.turn];
  sideStats.rolls++; sideStats.rollCounts[game.roll]++;
  if (!legalMoves(game.positions, game.turn, game.roll).length) {
    sideStats.passes++;
    speak(game.turn, 'pass', 0, .5);
    game.note = game.roll === 0 ? 'Rolled 0. Turn passes.' : `No legal move with a ${game.roll}. Turn passes.`;
    writeToLedger(`${playerName(game.turn)} rolled ${game.roll}: no move`);
  } else {
    game.note = '';
    if (game.roll === MAX_ROLL) speak(game.turn, 'bigRoll', 0, .35);
  }
  remarkIfSlow();
  render();
  continueGame();
}

// ---------- moving ----------
const counterElement = (side, counter) => document.querySelector(`[data-pid="${side}-${counter}"]`);
const squareElement = (side, square) => boardCells[cellKey(routeCell(side, square))];
const homeTrayElement = side => document.querySelector(`#tray${side} .home`);

// the counter hops square by square along its route before the move is committed
function animateHops(side, move, done) {
  const el = counterElement(side, move.counter);
  if (prefersReducedMotion || !el) { sfxHop(0, 0, true); return done(); }
  clearMovePreview();
  el.classList.remove('movable');
  el.classList.add('hopping');   // above everything it passes over
  const start = el.getBoundingClientRect();
  const startX = start.left + start.width / 2, startY = start.top + start.height / 2;
  const cellWidth = boardCells[cellKey([ROW.SHARED, 0])].getBoundingClientRect().width;
  const stops = [];
  for (let square = move.from + 1; square <= move.to; square++) {
    let x, y, width;
    if (square === currentRules.home) {
      const tray = homeTrayElement(side).getBoundingClientRect();
      width = cellWidth * .55; x = tray.right - width / 2; y = tray.top + tray.height / 2;
    } else {
      const cell = squareElement(side, square).getBoundingClientRect();
      width = cellWidth * .8; x = cell.left + cell.width / 2; y = cell.top + cell.height / 2;
    }
    stops.push({ dx: x - startX, dy: y - startY, scale: width / start.width });
  }
  const hops = stops.length, lift = cellWidth * .45;
  const frames = [{ transform: 'none', offset: 0, easing: 'ease-out' }];
  let previous = { dx: 0, dy: 0, scale: 1 };
  stops.forEach((stop, hop) => {
    frames.push({   // the top of the hop, tilting alternately
      transform: `translate(${(previous.dx + stop.dx) / 2}px, ${(previous.dy + stop.dy) / 2 - lift}px) scale(${stop.scale * 1.12}) rotate(${hop % 2 ? 8 : -8}deg)`,
      offset: (hop + .5) / hops, easing: 'ease-in',
    });
    frames.push({   // landing, with a squash
      transform: `translate(${stop.dx}px, ${stop.dy}px) scale(${stop.scale * 1.1}, ${stop.scale * .86})`, offset: (hop + 1) / hops, easing: 'ease-out' });
    previous = stop;
  });
  const duration = hops * HOP_MS + (move.from === IN_TRAY ? ENTRY_HOP_EXTRA_MS : 0);
  for (let hop = 0; hop < hops; hop++) sfxHop((hop + 1) / hops * duration / 1000, hop, hop === hops - 1);
  el.animate(frames, { duration, fill: 'forwards' }).onfinish = done;
}

let pendingEffects = null;   // what the next render should animate: the landing, a capture, rose petals
function burstPetals(cell) {
  const PETALS = 12;
  for (let i = 0; i < PETALS; i++) {
    const petal = document.createElement('span');
    petal.className = 'petal' + (i % 3 === 0 ? ' alt' : '');
    cell.appendChild(petal);
    const angle = i / PETALS * Math.PI * 2 + Math.random() * .4, distance = cell.offsetWidth * (.6 + Math.random() * .4);
    petal.animate([
      { transform: 'translate(0,0) rotate(0) scale(.4)', opacity: 1 },
      { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance + 14}px) rotate(${200 + Math.random() * 200}deg) scale(1)`, opacity: 0 },
    ], { duration: 750 + Math.random() * 250, easing: 'cubic-bezier(.2,.8,.4,1)' }).onfinish = () => petal.remove();
  }
}
function showEventScroll(cell, word) {
  const scroll = document.createElement('span');
  scroll.className = 'float-word';
  scroll.textContent = word;
  cell.appendChild(scroll);
  // unfurl sideways, hold, then drift upward and fade
  scroll.animate([
    { transform: 'translate(-50%, 4px) rotate(-3deg) scaleX(.05)', opacity: 0 },
    { transform: 'translate(-50%, -6px) rotate(-3deg) scaleX(1.06)', opacity: 1, offset: .18 },
    { transform: 'translate(-50%, -10px) rotate(-2deg) scaleX(1)', opacity: 1, offset: .3 },
    { transform: 'translate(-50%, -26px) rotate(1deg)', opacity: 1, offset: .7 },
    { transform: 'translate(-50%, -52px) rotate(2deg)', opacity: 0 },
  ], { duration: 1700, easing: 'ease-out' }).onfinish = () => scroll.remove();
}

function makeMove(move) {
  if (game.phase !== 'move') return;
  clearTimeout(pendingStep);  // a pending auto-move must not fire into a later turn
  saveUndoPoint();
  game.phase = 'animating';
  game.advice = null;
  clearAdvice();
  closeGuideTip(false);
  animateHops(game.turn, move, () => completeMove(move));
}

// once the hops have played: record the move, apply it, react to it, then end the turn or the game
function completeMove(move) {
  const side = game.turn, landsOnRose = isRose(move.to), again = rollsAgain(move);
  writeToLedger(`${playerName(side)} rolled ${game.roll}: ${describeMove(side, move, landsOnRose, again)}`);
  applyMoveToGame(side, move, landsOnRose);
  const finished = allHome(game.positions, side);
  reactToMove(side, move, landsOnRose, finished);
  if (finished) { finishGame(side); return; }
  game.note = landsOnRose ? 'A rose! Roll again.' : again ? 'A capture! Roll again.' : '';
  endTurn(again);
}
function describeMove(side, move, landsOnRose, again) {
  let text = move.from === IN_TRAY ? `entered a piece${move.to > 1 ? ' to ' + move.to : ''}`
    : move.to === currentRules.home ? 'brought a piece home' : `moved ${move.from} → ${move.to}`;
  if (move.captures >= 0) text += `, captured a ${SIDE_NAME[opponentOf(side)]} piece`;
  if (landsOnRose) text += ', landed on a rose and rolls again';
  else if (again) text += ' and rolls again';
  return text;
}
function applyMoveToGame(side, move, landsOnRose) {
  pendingEffects = {
    moved: side + '-' + move.counter,
    captured: move.captures >= 0 ? opponentOf(side) + '-' + move.captures : null,
    cell: move.to === currentRules.home ? null : cellKey(routeCell(side, move.to)),
    rose: landsOnRose,
  };
  if (move.captures >= 0) lastCapturedSide = opponentOf(side);
  game.positions = applyMove(game.positions, side, move);
  game.lastLanding = move.to === currentRules.home ? null : routeCell(side, move.to);
  recordMove(side, move, landsOnRose);
}
// sounds and the players' reactions
function reactToMove(side, move, landsOnRose, finished) {
  const countersLeft = game.positions[side].filter(square => square !== currentRules.home).length;
  if (finished) { speak(side, 'win', 300); speak(opponentOf(side), 'lose', 1500); }
  else if (move.captures >= 0) { speak(side, 'capture'); speak(opponentOf(side), 'captured', 900); }
  else if (isSafeSquare(move.to, currentRules)) speak(side, isCentre(side, move.to) ? 'centre' : 'safeRose', 0, .8);
  else if (move.to === currentRules.home && countersLeft === 1) { speak(side, 'lastOne', 0, .9); speak(opponentOf(side), 'worried', 1200, .7); }
  else if (move.to === currentRules.home) speak(side, 'home', 0, .6);
  else if (landsOnRose) speak(side, 'rose', 0, .5);
  if (move.to === currentRules.home) sfxHome();
  if (landsOnRose) sfxRose();
  if (finished) (isComputer(side) ? sfxLament : sfxFanfare)(.5);   // a computer win is your loss
}
function finishGame(winner) {
  game.phase = 'over'; game.winner = winner;
  if (game.mode === 'ai') tally[winner === COMPUTER_SIDE ? 'computer' : 'you']++;
  else tally[winner === SUN ? 'sun' : 'moon']++;
  saveTally();
  recordGame(winner);
  game.newHonours = awardHonours(winner);
  render();
  prepareResultCard();
  showEndBanner(winner);
  announceHonours(game.newHonours);
}

function endTurn(again) {
  if (!again) { game.stats.bySide[game.turn].roseChain = 0; game.turn = opponentOf(game.turn); game.note = ''; }
  game.phase = 'roll'; game.roll = null;
  render();
  continueGame();
}

function writeToLedger(line) { game.log.unshift(line); }
