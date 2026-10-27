/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// ---------- controls ----------
// ---------- preferences (this browser only) ----------
const prefs = { autoMove: true, variant: 'classic', music: true, musicVol: 20 };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('ur-prefs')) || {}); } catch (e) {}
if (!VARIANTS[prefs.variant]) prefs.variant = 'classic';
const savePrefs = () => { try { localStorage.setItem('ur-prefs', JSON.stringify(prefs)); } catch (e) {} };

// show what the current variant changes: the centre rose's ring, its hover text, the key and the rules
function applyRulesUI() {
  board.classList.toggle('no-safe', !RULES.safeCentre);
  const centre = cells['1,3'];
  centre.title = (RULES.safeCentre ? 'Centre rose: roll again, and safe from capture' : 'Centre rose: roll again (not safe in these rules)') + ' · square 8';
  $('key-centre').textContent = RULES.safeCentre ? 'Roll again, and safe from capture' : 'Roll again, but not safe in these rules';
  $('key-centre-tile').firstElementChild.classList.toggle('safe-sq', RULES.safeCentre);
  const vn = $('variant-now');
  vn.hidden = S.variant === 'classic';
  vn.innerHTML = S.variant === 'classic' ? '' : `You’re playing the <b>${RULES.name}</b> variant. ${RULES.blurb} The rules below are the classic ones.`;
}

// ---------- advise me: the King-level computer suggests a move ----------
// advice is offered against the Squire (unlimited) and the Knight (five per game), never the King
const ADVICE_LIMIT = { easy: Infinity, medium: 5 };
const adviceOffered = () => S.mode === 'ai' && S.level in ADVICE_LIMIT && S.phase === 'move'
  && !isAI(S.turn) && legalMoves(S.pos, S.turn, S.roll).length > 1;
const adviceLeft = () => S.level in ADVICE_LIMIT ? ADVICE_LIMIT[S.level] - (S.stats.p[0].advice || 0) : 0;
const canAdvise = () => adviceOffered() && adviceLeft() > 0;
// chance an opposing counter can land on square sq with its next roll
function dangerTo(pos, p, sq) {
  if (sq < 5 || sq > 12 || (sq === CENTRE && RULES.safeCentre)) return 0;
  const seen = new Set(); let d = 0;
  for (const y of pos[1 - p]) if (y < sq && sq - y <= 4 && !seen.has(y)) { seen.add(y); d += PROB[sq - y]; }
  return Math.min(d, 1);
}
const listOf = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
function giveAdvice() {
  if (S.advice) return;  // asking again on the same roll shows the same advice and doesn't use another
  if (!canAdvise()) return;
  const p = S.turn, m = aiChoose(S.pos, p, S.roll, 'hard');
  const why = [];
  if (m.to === OFF) why.push('brings a counter home');
  if (m.cap >= 0) why.push(`captures their counter on square ${m.to}${m.to >= 9 ? ', which had come a long way' : ''}`);
  if (m.to === CENTRE && RULES.safeCentre) why.push('takes the centre rose, so you roll again and it’s safe there');
  else if (ROSETTES.has(m.to)) why.push('lands on a rose, so you roll again');
  else if (RULES.captureRoll && m.cap >= 0) why.push('earns another roll for the capture');
  const before = dangerTo(S.pos, p, m.from), after = m.to === OFF ? 0 : dangerTo(applyMove(S.pos, p, m), p, m.to);
  if (before >= .25 && after < before) why.push('moves a threatened counter out of danger');
  if (!why.length) why.push(m.from === 0 ? 'brings a new counter into play' : 'leaves your counters safest overall');
  let text = `Advice: move the counter ${m.from === 0 ? 'from your tray' : 'on ' + m.from} ${m.to === OFF ? 'home' : 'to ' + m.to}. It ${listOf(why)}.`;
  if (after > 0) text += ` It could be hit next turn (${Math.round(after * 100)}% chance).`;
  S.advice = { i: m.i, to: m.to, text };
  S.stats.p[p].advice = (S.stats.p[p].advice || 0) + 1;
  render();
}
function clearAdvice() {
  document.querySelectorAll('.advised-target').forEach(e => e.classList.remove('advised-target'));
  $('arrow-advice').setAttribute('hidden', '');
  $('advice-note').hidden = true;
}
// the advised landing square gets a red ring, with the reasoning in a note pinned beside it
function drawAdvice() {
  clearAdvice();
  if (!S.advice || S.phase !== 'move') return;
  const el = S.advice.to === OFF ? document.querySelector(`#tray${S.turn} .home`) : cells[coord(S.turn, S.advice.to).join(',')];
  el.classList.add('advised-target');
  $('advice-text').textContent = S.advice.text;
  $('advice-note').hidden = false;
  const piece = document.querySelector('.piece.advised');
  if (piece) drawArrow($('arrow-advice'), piece, el);
  const pieceBelow = piece && piece.getBoundingClientRect().top > el.getBoundingClientRect().bottom - 4;
  placeBubble($('advice-note'), el, pieceBelow ? 'above' : 'below');
}
$('advise').addEventListener('click', giveAdvice);

// ---------- guided first game ----------
let coachOpen = false, advancePending = false, coachAnchor = null, lastCaptureOf = null;
const guideDone = () => { try { return localStorage.getItem('ur-guide-done') === '1'; } catch (e) { return false; } };
function finishGuide() { try { localStorage.setItem('ur-guide-done', '1'); } catch (e) {} }
const cellOf = m => m.to === OFF ? $('tray0') : cells[coord(0, m.to).join(',')];

// the next tip worth showing, one idea at a time, each once per guided game
function nextTip() {
  const seen = id => S.tips[id], human = S.turn === 0, n = S.pos[0].length;
  if (!seen('welcome')) return ['welcome', $('tray0'), `You play the <b>Sun</b>. Race all ${COUNT_WORD[n]} of your counters along the board and home before the computer’s Moon. They wait here in your tray.`];
  if (S.phase === 'over') return seen('done') ? null : ['done', $('open-rules').parentElement,
    'That’s the guided game done! <b>Rules</b> and <b>Strategy</b> up here explain more, and <b>Options</b> lets you try other rules or replay this guide.'];
  if (lastCaptureOf === 0 && !seen('captured')) return ['captured', $('tray0'), 'Ouch! The computer landed on one of your counters and sent it back to your tray. It has to start the route again.'];
  if (human && S.phase === 'roll' && !seen('roll')) return ['roll', $('roll'), 'Press <b>Roll</b>, or the Space bar. Count the red tips on the four dice: that’s how many squares you move, from 0 to 4.'];
  if (human && S.phase === 'roll' && !seen('danger')) {
    const x = S.pos[0].find(x => x >= 5 && x <= 12 && !(x === CENTRE && RULES.safeCentre));
    if (x) return ['danger', cells[coord(0, x).join(',')], 'This counter has reached the <b>shared middle row</b>. The computer can land on it here and send it back to the start, so don’t linger.'];
  }
  if (human && S.phase === 'move') {
    const ms = legalMoves(S.pos, 0, S.roll);
    if (!ms.length) return seen('pass') ? null : ['pass', $('status'), S.roll === 0
      ? 'A roll of 0 means no move this time, so your turn passes.' : 'None of your counters can move exactly that far, so your turn passes.'];
    if (!seen('move')) return ['move', $('tray0'), 'Counters that can move <b>glow</b>. Point at one to see where it would land, then click it. New counters join the board through your gate.'];
    const pick = (id, test, text) => { const m = !seen(id) && ms.find(test); return m ? [id, cellOf(m), text] : null; };
    return pick('capture', m => m.cap >= 0, 'You can <b>capture</b>! Land on the computer’s counter here to send it back to the start.')
      || pick('centre', m => m.to === CENTRE, 'This is the <b>centre rose</b>, ringed in gold. Land here to roll again, and no one can capture you while you sit on it.')
      || pick('rose', m => ROSETTES.has(m.to), 'This move lands on a <b>rose</b>, so you’ll roll again.')
      || pick('home', m => m.to === OFF, 'This roll can bring a counter <b>home</b>. You need the exact number to leave: a 1 from your last square, a 2 from the one before.')
      || (canAdvise() && !seen('advise') ? ['advise', $('advise'), 'Not sure which to move? <b>Advise me</b> shows what the strongest computer would do, and why.'] : null);
  }
  return null;
}
function guideCheck() {
  if (!S || !S.guided) return;
  if (coachOpen) { placeCoach(); return; }
  const tip = nextTip();
  lastCaptureOf = null;
  if (!tip) return;
  const [id, anchor, html] = tip;
  S.tips[id] = true;
  if (id === 'done') finishGuide();
  coachOpen = true; coachAnchor = anchor;
  $('coach-text').innerHTML = html;
  $('coach-skip').hidden = id === 'done';
  $('coach').hidden = false;
  anchor.classList.add('coach-focus');
  anchor.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  placeCoach();
  setTimeout(placeCoach, 400);  // again once any smooth scroll has settled
  $('coach-ok').focus({ preventScroll: true });
}
function placeCoach() { if (coachOpen) placeBubble($('coach'), coachAnchor); }
function placeBubble(c, anchor, prefer = 'below') {
  const r = anchor.getBoundingClientRect(), w = c.offsetWidth, h = c.offsetHeight;
  const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, document.documentElement.clientWidth - w - 12));
  const fitsBelow = r.bottom + 14 + h < innerHeight, fitsAbove = r.top - h - 14 > 0;
  const below = prefer === 'above' ? !fitsAbove : fitsBelow || !fitsAbove;
  c.dataset.side = below ? 'below' : 'above';
  c.style.left = left + scrollX + 'px';
  c.style.top = (below ? r.bottom + 14 : r.top - h - 14) + scrollY + 'px';
  c.style.setProperty('--ax', Math.max(18, Math.min(r.left + r.width / 2 - left, w - 18)) + 'px');
}
addEventListener('resize', () => { placeCoach(); clearTargets(); drawAdvice(); });
// a keyboard player's focus lands on counter 1 whenever there's a move to choose, previewing where it goes
function focusFirstMovable() {
  if (!kbdMode || coachOpen || document.querySelector('dialog[open]')) return;
  if (document.activeElement && document.activeElement.classList.contains('movable')) return;
  const first = document.querySelector('.piece.movable[data-key="1"]');
  if (first) first.focus({ preventScroll: true });
}
// resume: show any next tip, otherwise let the game carry on
function dismissCoach(resume = true) {
  if (!coachOpen) return;
  coachOpen = false;
  $('coach').hidden = true;
  coachAnchor.classList.remove('coach-focus');
  if (S.phase === 'over' && S.tips.done) S.guided = false;
  if (!resume) { advancePending = false; return; }
  guideCheck();
  focusFirstMovable();
  if (!coachOpen && advancePending) { advancePending = false; advance(); }
}
$('coach-ok').addEventListener('click', () => dismissCoach());
$('coach-skip').addEventListener('click', () => { finishGuide(); S.guided = false; dismissCoach(); render(); });

// ---------- new game ----------
function newGame(opts = {}) {
  gen++; clearTimeout(timer);
  dismissCoach(false);
  if (S && S.guided && !opts.guided) finishGuide();  // leaving the guided game counts as having seen it
  if (opts.guided) { $('mode-ai').checked = true; $('level').value = 'easy'; }
  const mode = document.querySelector('input[name=mode]:checked').value;
  const variant = opts.guided ? 'classic' : prefs.variant;
  RULES = VARIANTS[variant];
  S = fresh(mode, $('level').value, variant, !!opts.guided);
  applyRulesUI();
  drawVariantNote();
  addLog(`${nameOf(S.turn)} ${S.mode === 'ai' && S.turn === 0 ? 'go' : 'goes'} first.`);
  clearSpeech();
  render();
  advance();
  speak(1, 'start', 300);
  speak(0, 'start', 1500, .6);
}
// a board laid out and waiting: the player picks mode and opponent, then presses Start game
function newSetup() {
  gen++; clearTimeout(timer);
  dismissCoach(false);
  if (S && S.guided) finishGuide();
  const mode = document.querySelector('input[name=mode]:checked').value;
  RULES = VARIANTS[prefs.variant];
  S = fresh(mode, $('level').value, prefs.variant, false, 'setup');
  clearSpeech();
  applyRulesUI();
  drawVariantNote();
  render();
}
const gameIdle = () => S.phase === 'setup' || S.phase === 'over';
// starting over loses a game that has moves in it, so ask first
let confirmed = null;
function confirmNewGame(action) {
  if (!gameUnderWay()) { action(); return; }
  confirmed = action;
  $('confirm-dlg').showModal();
  $('confirm-no').focus();
}
$('confirm-yes').addEventListener('click', () => { $('confirm-dlg').close(); const a = confirmed; confirmed = null; if (a) a(); });
$('confirm-no').addEventListener('click', () => $('confirm-dlg').close());
$('confirm-dlg').addEventListener('close', () => { confirmed = null; });
$('newgame').addEventListener('click', () => { if (gameIdle()) newGame(); else confirmNewGame(newSetup); });

// ---------- options ----------
const gameUnderWay = () => S && S.phase !== 'over' && S.stats.p[0].moves + S.stats.p[1].moves > 0;
$('variants').innerHTML = Object.entries(VARIANTS).map(([k, v]) => `
  <label class="variant"><input type="radio" name="variant" value="${k}"><span class="dot"></span>
    <span><b>${v.name}${k === 'classic' ? '' : ' <small class="house">house variant</small>'}</b><small>${v.blurb}</small></span></label>`).join('');
function drawVariantNote() {
  document.querySelector(`input[name=variant][value=${prefs.variant}]`).checked = true;
  const note = $('variant-note');
  if (S && prefs.variant !== S.variant) {
    note.innerHTML = `${VARIANTS[prefs.variant].name} rules start with your next game. <button class="btn" type="button" id="variant-now-btn">Set up a new game now</button>`;
    $('variant-now-btn').addEventListener('click', () => { $('options-dlg').close(); confirmNewGame(newSetup); });
  } else note.innerHTML = '';
}
document.querySelectorAll('input[name=variant]').forEach(r => r.addEventListener('change', () => {
  prefs.variant = r.value; savePrefs();
  if (gameIdle()) newSetup(); else drawVariantNote();
}));
$('opt-auto').checked = prefs.autoMove;
$('opt-auto').addEventListener('change', e => { prefs.autoMove = e.target.checked; savePrefs(); render(); advance(); });
$('replay-guide').addEventListener('click', () => { $('options-dlg').close(); confirmNewGame(() => newGame({ guided: true })); });

// a refresh or closed tab would lose the game, so ask first (browsers show their own wording here)
addEventListener('beforeunload', e => { if (gameUnderWay()) { e.preventDefault(); e.returnValue = ''; } });
// hand-drawn toolbar icons: ink lines with the same wobble filter as the board
const ICONS = {
  play: `<path d="M7 4.6 C7 3.9 7.7 3.6 8.3 4 L19.2 11.2 C19.8 11.6 19.8 12.4 19.2 12.8 L8.3 20 C7.7 20.4 7 20.1 7 19.4 Z" style="${paint('bone', 1)};stroke:var(--ink);stroke-width:1.6;stroke-linejoin:round"/>`,
  book: `<path d="M12 6.5 C9 4.8 5.5 4.8 2.8 5.8 V19 C5.5 18 9 18 12 19.6 C15 18 18.5 18 21.2 19 V5.8 C18.5 4.8 15 4.8 12 6.5 Z" style="${paint('bone', 1)}"/>
    <path d="M12 6.5 C9 4.8 5.5 4.8 2.8 5.8 V19 C5.5 18 9 18 12 19.6 C15 18 18.5 18 21.2 19 V5.8 C18.5 4.8 15 4.8 12 6.5 Z M12 6.5 V19.6 M5.2 9 C7 8.5 8.6 8.6 10 9.2 M5.2 12 C7 11.5 8.6 11.6 10 12.2 M14 9.2 C15.4 8.6 17 8.5 18.8 9" style="${ink}"/>
    <path d="M15.5 12 V21 L16.8 19.8 L18.1 21 V12" style="${paint('vermilion', .9)};stroke:var(--ink);stroke-width:1"/>`,
  swords: `<path d="M4.5 3.5 L15.5 14.5 M19.5 3.5 L8.5 14.5" style="${ink};stroke-width:1.9"/><path d="M4.5 3.5 L6.8 4 M4.5 3.5 L5 5.8 M19.5 3.5 L17.2 4 M19.5 3.5 L19 5.8" style="${ink}"/>
    <path d="M12.8 17.3 L17.8 12.3 M6.2 12.3 L11.2 17.3" style="${ink};stroke-width:2"/>
    <path d="M15.6 15.6 L19 19 M8.4 15.6 L5 19" style="fill:none;stroke:var(--vermilion);stroke-width:2.6;stroke-linecap:round"/>
    <circle cx="19.8" cy="19.8" r="1.5" style="${paint('ochre', 1)};stroke:var(--ink);stroke-width:1"/><circle cx="4.2" cy="19.8" r="1.5" style="${paint('ochre', 1)};stroke:var(--ink);stroke-width:1"/>`,
  route: `<path d="M4.5 19.5 C4 14 9.5 15.5 11.5 11.5 C13 8.5 10 6 13.5 4.8 C15.5 4.1 17.5 5 18.5 6.2" style="fill:none;stroke:var(--ink);stroke-width:1.8;stroke-linecap:round;stroke-dasharray:.1 3.2"/>
    <path d="M15.8 3.6 L19.2 6.6 L15 7.6" style="${ink};stroke-width:1.6"/><circle cx="4.5" cy="19.5" r="2.2" style="${paint('vermilion', .9)};stroke:var(--ink);stroke-width:1"/>`,
  owl: `<path d="M6 7.5 L5 3.5 L8.6 5.8 M18 7.5 L19 3.5 L15.4 5.8" style="${ink}"/>
    <path d="M12 5.2 C17.5 5.2 19.5 9.5 19 14 C18.5 18.5 15.5 21 12 21 C8.5 21 5.5 18.5 5 14 C4.5 9.5 6.5 5.2 12 5.2 Z" style="${paint('ochre', .9)}"/>
    <path d="M12 5.2 C17.5 5.2 19.5 9.5 19 14 C18.5 18.5 15.5 21 12 21 C8.5 21 5.5 18.5 5 14 C4.5 9.5 6.5 5.2 12 5.2 Z" style="${ink}"/>
    <circle cx="9" cy="10.5" r="2.6" style="${paint('bone', 1)};stroke:var(--ink);stroke-width:1.1"/><circle cx="15" cy="10.5" r="2.6" style="${paint('bone', 1)};stroke:var(--ink);stroke-width:1.1"/>
    <circle cx="9" cy="10.7" r="1" style="fill:var(--ink)"/><circle cx="15" cy="10.7" r="1" style="fill:var(--ink)"/>
    <path d="M11 13.3 L12 15 L13 13.3 Z" style="${paint('vermilion', 1)};stroke:var(--ink);stroke-width:.8"/><path d="M9 17 C10.5 18 13.5 18 15 17" style="${ink}"/>`,
  key: `<circle cx="7" cy="12" r="4.2" style="${paint('ochre', .9)};stroke:var(--ink);stroke-width:1.4"/><circle cx="7" cy="12" r="1.6" style="${paint('bone', 1)};stroke:var(--ink);stroke-width:1"/>
    <path d="M11.2 12 H21 M17.5 12 V15.5 M20.5 12 V14.5" style="${ink};stroke-width:1.8"/>`,
  music: `<path d="M8.5 17.5 V6.5 L19.5 4.2 V15.5 M8.5 9.5 L19.5 7.2" style="${ink};stroke-width:1.7"/>
    <ellipse cx="6.4" cy="17.6" rx="2.6" ry="2" transform="rotate(-20 6.4 17.6)" style="${paint('vermilion', .95)};stroke:var(--ink);stroke-width:1.2"/>
    <ellipse cx="17.4" cy="15.6" rx="2.6" ry="2" transform="rotate(-20 17.4 15.6)" style="${paint('vermilion', .95)};stroke:var(--ink);stroke-width:1.2"/>`,
  musicOff: `<path d="M8.5 17.5 V6.5 L19.5 4.2 V15.5 M8.5 9.5 L19.5 7.2" style="${ink};stroke-width:1.7"/>
    <ellipse cx="6.4" cy="17.6" rx="2.6" ry="2" transform="rotate(-20 6.4 17.6)" style="${paint('paper-deep', .95)};stroke:var(--ink);stroke-width:1.2"/>
    <ellipse cx="17.4" cy="15.6" rx="2.6" ry="2" transform="rotate(-20 17.4 15.6)" style="${paint('paper-deep', .95)};stroke:var(--ink);stroke-width:1.2"/>
    <path d="M3.5 3.5 L20.5 20.5" style="fill:none;stroke:var(--vermilion);stroke-width:2.2;stroke-linecap:round"/>`,
  tally: `<path d="M4.5 5.5 V18.5 M8.5 5 V19 M12.5 5.5 V18.5 M16.5 5 V19" style="${ink};stroke-width:1.9"/><path d="M2.5 15.5 L19.5 7.5" style="fill:none;stroke:var(--vermilion);stroke-width:2.2;stroke-linecap:round"/><path d="M20.5 19 V13" style="${ink};stroke-width:1.9"/>`,
  bell: `<path d="M5.5 16.5 C6 11 7.5 6.5 12 6.5 C16.5 6.5 18 11 18.5 16.5 Z" style="${paint('ochre', .95)}"/>
    <path d="M5.5 16.5 C6 11 7.5 6.5 12 6.5 C16.5 6.5 18 11 18.5 16.5 Z M4 16.5 H20 M12 6.5 V4.2 M10.3 18.6 A1.8 1.8 0 0 0 13.7 18.6" style="${ink}"/>
    <path d="M20.5 8.5 C21.6 9.8 21.6 12 20.5 13.3 M2.5 13.3 C1.4 12 1.4 9.8 2.5 8.5" style="${ink}"/>`,
  bellOff: `<path d="M5.5 16.5 C6 11 7.5 6.5 12 6.5 C16.5 6.5 18 11 18.5 16.5 Z" style="${paint('paper-deep', .9)}"/>
    <path d="M5.5 16.5 C6 11 7.5 6.5 12 6.5 C16.5 6.5 18 11 18.5 16.5 Z M4 16.5 H20 M12 6.5 V4.2 M10.3 18.6 A1.8 1.8 0 0 0 13.7 18.6" style="${ink}"/>
    <path d="M3.5 3.5 L20.5 20.5" style="fill:none;stroke:var(--vermilion);stroke-width:2.2;stroke-linecap:round"/>`,
};
const iconSVG = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><g filter="url(#ink)">${ICONS[name]}</g></svg>`;
document.querySelectorAll('[data-icon]').forEach(s => { s.innerHTML = iconSVG(s.dataset.icon); });

function drawSound() {
  const b = $('sound');
  b.querySelector('[data-icon]').innerHTML = iconSVG(muted ? 'bellOff' : 'bell');
  b.querySelector('.lbl').textContent = muted ? 'Muted' : 'Sound';
  b.setAttribute('aria-pressed', String(!muted));
  b.setAttribute('aria-label', muted ? 'Sound off, turn on' : 'Sound on, turn off');
}
$('sound').addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem('ur-muted', muted ? '1' : '0'); } catch (e) {}
  drawSound();
  if (!muted) sfxDice();
});
drawSound();

// reading modals: open at the top, close by button, backdrop click or Esc, then return focus to the opener
function readingModal(dlgId, openId, closeId) {
  const d = $(dlgId);
  $(openId).addEventListener('click', () => { d.showModal(); d.querySelector('.stats-inner').scrollTop = 0; $(closeId).focus(); });
  $(closeId).addEventListener('click', () => d.close());
  d.addEventListener('click', e => { if (e.target === d) d.close(); });  // click on the backdrop
  d.addEventListener('close', () => $(openId).focus());
}
readingModal('rules-dlg', 'open-rules', 'close-rules');
readingModal('tactics-dlg', 'open-tactics', 'close-tactics');
readingModal('options-dlg', 'open-options', 'close-options');

// chance an enemy counter this many squares behind rolls exactly the gap
$('danger-odds').innerHTML = [1, 2, 3, 4].map(g =>
  `<span class="n">${g}</span><span class="bar" style="width:${PROB[g] / PROB[2] * 100}%"></span><span class="p">${+(PROB[g] * 100).toFixed(2)}% · enemy ${g} behind</span>`).join('');

const dlg = $('stats');
$('open-stats').addEventListener('click', () => { statsTab = 'game'; resetAsk = false; drawStats(); dlg.showModal(); $('close-stats').focus(); });
$('close-stats').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });  // click on the backdrop
dlg.addEventListener('close', () => { $('tip').hidden = true; $('open-stats').focus(); });
document.querySelectorAll('.stats-tabs button').forEach(b => b.addEventListener('click', () => { statsTab = b.dataset.tab; resetAsk = false; drawStats(); }));
// one tooltip for every chart mark in the modal
dlg.addEventListener('pointermove', e => {
  const t = e.target.closest('[data-tip]'), tip = $('tip');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip; tip.hidden = false;
  const w = tip.offsetWidth;
  tip.style.left = Math.min(Math.max(8, e.clientX - w / 2), innerWidth - w - 8) + 'px';
  tip.style.top = (e.clientY - tip.offsetHeight - 12) + 'px';
});
dlg.addEventListener('pointerleave', () => { $('tip').hidden = true; });
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => { if (gameIdle()) newSetup(); }));
$('level').addEventListener('change', e => { if (gameIdle()) { S.level = e.target.value; render(); } });
$('roll').addEventListener('click', () => { if (S.phase === 'over') newGame(); else if (!isAI(S.turn)) doRoll(); });
$('route').addEventListener('click', e => {
  const on = board.classList.toggle('show-route');
  e.currentTarget.setAttribute('aria-pressed', String(on));
});
// ---------- keyboard play ----------
// number badges and the keyboard hint only show once someone uses the keyboard; the mouse hides them again
let kbdMode = false;
function setKbd(on) {
  if (kbdMode === on) return;
  kbdMode = on;
  document.body.classList.toggle('kbd', on);
  if (S && S.phase === 'move') render();
}
addEventListener('pointerdown', () => setKbd(false));
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  const tag = e.target.tagName, typing = ['SELECT', 'INPUT', 'TEXTAREA'].includes(tag);
  if (!typing && e.key !== 'Shift') setKbd(true);
  if (coachOpen && e.key === 'Escape') { dismissCoach(); return; }
  if (typing) return;
  if (e.key === 'r' || e.key === 'R' || (e.key === ' ' && !['BUTTON', 'SUMMARY'].includes(tag))) {
    if (S.phase === 'roll' && !isAI(S.turn)) { e.preventDefault(); doRoll(); }
    return;
  }
  if (S.phase !== 'move' || isAI(S.turn)) return;
  const list = [...document.querySelectorAll('.piece.movable[data-key]')].sort((a, b) => a.dataset.key - b.dataset.key);
  if (/^[1-9]$/.test(e.key)) {
    const el = list[+e.key - 1];
    if (el) { e.preventDefault(); el.click(); }
  } else if (/^Arrow(Left|Right|Up|Down)$/.test(e.key) && list.length) {
    e.preventDefault();
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1, at = list.indexOf(document.activeElement);
    list[at < 0 ? 0 : (at + dir + list.length) % list.length].focus();
  } else if ((e.key === 'a' || e.key === 'A') && canAdvise()) {
    e.preventDefault(); giveAdvice();
  }
});

// ---------- installable app, works offline ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
let installPrompt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function drawInstall() {
  const text = $('install-text'), btn = $('install-btn');
  btn.hidden = !installPrompt;
  if (standalone()) text.textContent = 'You’re playing the installed app. It works offline too.';
  else if (installPrompt) text.textContent = 'Install the game to play it from your home screen or desktop, even with no connection.';
  else if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    text.innerHTML = 'To install on iPhone or iPad, open this page in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.';
  else text.textContent = 'Install the game to play it from your home screen or desktop, even with no connection. If your browser offers it, use its Install or Add to Home Screen option.';
}
// Chrome, Edge and Android offer installing; keep the offer for our own button
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; drawInstall(); });
addEventListener('appinstalled', () => { installPrompt = null; drawInstall(); $('install-text').textContent = 'Installed. Look for The Royal Game of Ur on your home screen or in your apps.'; });
$('install-btn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  drawInstall();
});
drawInstall();

$('odds').innerHTML = PROB.map((p, n) =>
  `<span class="n">${n}</span><span class="bar" style="width:${p / PROB[2] * 100}%"></span><span class="p">${p * 16} in 16</span>`).join('');
