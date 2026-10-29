/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Online play's connection to its room: the seats this browser holds, the room API, the room's socket (which
// comes back by itself after a drop), and putting the room's game on the board. The room is the one true copy of
// the game; the page only shows what it's told and sends what the player asks for.

const online = {
  roomId: null, // the room this page is in, or null
  seat: null, // SUN for the host, MOON for the friend
  socket: null,
  seq: 0, // the sequence number of the last state from the room that the board has taken on
  queue: [], // the room's messages waiting to play out on the board, one at a time
  busy: false, // a message is playing out
  view: null, // the room as the board last took it on
};

// ---------- seats ----------
// each room this browser has a seat in: {[roomId]: {key, seat, opponent, savedAt, leaving}}, the key being the
// seat's secret; `leaving` marks a seat whose leave the room hasn't confirmed yet, as {game}: the room's id for the
// game left, or null for the lobby. They're kept in memory too, so online play still works for the visit should
// storage be blocked.
const SEATS_KEY = 'ur-seats-v1';
let seatsHere = {};
function savedSeats() {
  try {
    return JSON.parse(localStorage.getItem(SEATS_KEY)) || seatsHere;
  } catch (e) {
    return seatsHere;
  }
}
function storeSeats(seats) {
  seatsHere = seats;
  try {
    localStorage.setItem(SEATS_KEY, JSON.stringify(seats));
  } catch (e) {}
}
const saveSeat = (roomId, entry) => storeSeats({ ...savedSeats(), [roomId]: { ...entry, savedAt: Date.now() } });
// a seat is forgotten only if it's still the one that holds `key`, when given (the browser may have joined again)
function forgetSeat(roomId, key = null) {
  const seats = savedSeats();
  if (key && seats[roomId] && seats[roomId].key !== key) return;
  delete seats[roomId];
  storeSeats(seats);
}
// the saved seats' room ids, the most recently saved first
const seatsNewestFirst = () =>
  Object.entries(savedSeats())
    .sort(([, a], [, b]) => (b.savedAt || 0) - (a.savedAt || 0))
    .map(([roomId]) => roomId);

// ---------- the room API ----------
// resolves to the response's status and JSON body; a network failure resolves to status 0
async function roomApi(method, path, body) {
  try {
    const response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    let data = null;
    try {
      data = await response.json();
    } catch (e) {}
    return { status: response.status, data };
  } catch (e) {
    return { status: 0, data: null };
  }
}

const inviteLink = (roomId) => location.origin + '/#g=' + roomId;
// a room's code: six of these letters and digits, leaving out the ones easily mistaken for each other
const ROOM_CODE = /^[23456789A-HJKMNP-Z]{6}$/;
// the room named by the page's link (#g=K7QXM2), or null
function roomInLink() {
  const code = location.hash.startsWith('#g=') ? location.hash.slice('#g='.length).toUpperCase() : '';
  return ROOM_CODE.test(code) ? code : null;
}
const setLinkRoom = (roomId) => history.replaceState(null, '', roomId ? '#g=' + roomId : location.pathname);

// ---------- the socket ----------
// the room closes a socket with these when another tab takes its seat, or when the room has ended
const CLOSE_REPLACED = 4000;
const CLOSE_ENDED = 4001;
// after a drop, try again after 1, 2, 4 and 8 seconds, then every 15
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000];
const RECONNECT_EVERY_MS = 15000;
let reconnectTries = 0,
  reconnectTimer = null;

// lobby and game code hear every message here: {type: 'state', seq, event, state} or {type: 'error', code}, and
// {type: 'closed', code, roomId} when the room has closed this page's socket for good (this page has let go of it)
const roomHandlers = [];
const onRoomState = (handler) => roomHandlers.push(handler);
function tellRoomHandlers(message) {
  for (const handler of roomHandlers) handler(message);
}

// join the room's conversation as this browser's seat, leaving any other room first
function connectRoom(roomId) {
  disconnectRoom();
  online.roomId = roomId;
  online.seat = savedSeats()[roomId].seat;
  online.seq = 0;
  online.view = null;
  openSocket();
}

// stop listening to the room (it isn't told; leaving is an intent of its own)
function disconnectRoom() {
  clearTimeout(reconnectTimer);
  stopPlaying();
  const socket = online.socket;
  Object.assign(online, { roomId: null, seat: null, socket: null, seq: 0, queue: [], busy: false, view: null });
  if (socket) socket.close();
}

function socketTo(roomId, key) {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${scheme}//${location.host}/api/rooms/${roomId}/ws?key=${encodeURIComponent(key)}`);
}
function openSocket() {
  clearTimeout(reconnectTimer);
  const seat = savedSeats()[online.roomId];
  if (!seat) return;
  const socket = socketTo(online.roomId, seat.key);
  online.socket = socket;
  // a socket this page has since replaced or let go of is ignored
  const current = () => socket === online.socket;
  socket.addEventListener('open', () => {
    if (current()) reconnectTries = 0;
  });
  socket.addEventListener('message', (e) => {
    if (!current()) return;
    let message;
    try {
      message = JSON.parse(e.data);
    } catch (error) {
      return;
    }
    tellRoomHandlers(message);
  });
  socket.addEventListener('close', (e) => {
    if (!current()) return;
    online.socket = null;
    if (e.code !== CLOSE_REPLACED && e.code !== CLOSE_ENDED) {
      reconnectLater();
      if (isOnline() && !online.busy) render(); // to say so; a move playing out shows it when it ends
      return;
    }
    // closed for good: let go of the room, so nothing reconnects to it, then say which room it was
    const roomId = online.roomId;
    disconnectRoom();
    tellRoomHandlers({ type: 'closed', code: e.code, roomId });
  });
}

function reconnectLater() {
  const delay = RECONNECT_DELAYS_MS[reconnectTries] ?? RECONNECT_EVERY_MS;
  reconnectTries++;
  reconnectTimer = setTimeout(openSocket, delay);
}
// a phone that slept has usually lost its socket; try again as soon as the page is looked at. A page put away
// mid-move skips to the latest state, as its animations would otherwise wait for it to come back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    catchUpWithRoom();
    return;
  }
  if (online.roomId && !online.socket) openSocket();
  retryLeaves();
});

// ---------- leaving ----------
// Leaving tells the room, which ends it (or, for a friend still in the lobby, frees their seat). Until the room
// confirms it (a closed state, or ending this socket), the seat is kept, marked as leaving, and the leave is said
// again whenever the page might reach the room: on loading, on coming back online and on being looked at again.
// Otherwise a leave lost on the way would leave the room waiting, and the other player with no way to win.
const goodbyes = {}; // the sockets saying goodbye now, by room id

// tell the room this seat is leaving, and stop listening to it; the page's own socket says so if it's open or
// opening, and otherwise one is opened just to say so. The leave names the game on the board (null in the lobby),
// so one that arrives late can't forfeit a game begun since.
function leaveRoom() {
  const roomId = online.roomId,
    seats = savedSeats(),
    seat = seats[roomId];
  const inGame = isOnline() && online.view && online.view.phase !== 'lobby';
  const leaving = { game: inGame ? game.roomGameId : null };
  const socket = online.socket;
  online.socket = null; // so letting go of the room leaves this socket open long enough to say goodbye
  disconnectRoom();
  if (!seat) return;
  storeSeats({ ...seats, [roomId]: { ...seat, leaving } });
  sayGoodbye(roomId, socket);
}

function sayGoodbye(roomId, socket = null) {
  const seat = savedSeats()[roomId];
  if (!seat || goodbyes[roomId]) return;
  if (!socket || socket.readyState > WebSocket.OPEN) socket = socketTo(roomId, seat.key);
  goodbyes[roomId] = socket;
  const confirmed = () => {
    forgetSeat(roomId, seat.key);
    socket.close();
  };
  const sayLeaving = () => socket.send(JSON.stringify({ t: 'leave', game: seat.leaving.game }));
  if (socket.readyState === WebSocket.OPEN) sayLeaving();
  else socket.addEventListener('open', sayLeaving);
  socket.addEventListener('message', (e) => {
    try {
      const message = JSON.parse(e.data);
      if (message.type === 'state' && message.state.phase === 'closed') confirmed();
    } catch (error) {}
  });
  // anything but the room ending this socket leaves the seat marked, to try again later
  socket.addEventListener('close', (e) => {
    if (goodbyes[roomId] === socket) delete goodbyes[roomId];
    if (e.code === CLOSE_ENDED) forgetSeat(roomId, seat.key);
  });
}

// say again each leave the room hasn't confirmed; a room that's gone, or closed already, needs no goodbye
let retryingLeaves = false;
async function retryLeaves() {
  if (retryingLeaves) return;
  retryingLeaves = true;
  try {
    for (const [roomId, seat] of Object.entries(savedSeats())) {
      if (!seat.leaving || goodbyes[roomId]) continue;
      const { status, data } = await roomApi('GET', `/api/rooms/${roomId}`);
      if (status === 404 || (status === 200 && data && data.status === 'closed')) forgetSeat(roomId, seat.key);
      else if (status === 200 && data && data.status) sayGoodbye(roomId);
    }
  } finally {
    retryingLeaves = false;
  }
}
addEventListener('online', retryLeaves);

// says whether it was sent: it can't be while the socket is down
function sendIntent(intent) {
  if (!online.socket || online.socket.readyState !== WebSocket.OPEN) return false;
  online.socket.send(JSON.stringify(intent));
  return true;
}

// ---------- the room's game on the board ----------
// The room's states play out on the board one at a time, in the order it sent them: a roll or a move animates as
// it would in a game on one device, then the board takes on the room's state exactly. A state that doesn't follow
// on from the last (a fresh connection's, or after a gap), or that arrives while the page is out of sight, is
// taken on at once, with nothing animated.

// whether this page has lost its own connection to its room (it comes back by itself)
const roomUnreachable = () =>
  isOnline() && Boolean(online.roomId) && !(online.socket && online.socket.readyState === WebSocket.OPEN);
// whether play waits: for this page to reach the room again, or for someone to come back to it (the room takes no
// rolls or moves until both are here)
const roomPaused = () =>
  isOnline() && Boolean(online.view) && (roomUnreachable() || !online.view.connected.every(Boolean));

// online, a roll or move is the room's to make: ask it, and hold the board still (so a second press does nothing)
// until its answer plays out
function askRoom(intent, waitingPhase) {
  if (!canAct(game.turn) || roomPaused() || !sendIntent(intent)) return;
  game.phase = waitingPhase;
  render();
}

let playing = null, // the message playing out now
  playbackId = 0; // changes when playing out is cut short, so its timers and animations can tell they're stale

function queueRoomMessage(message) {
  online.queue.push(message);
  // a fresh connection's full state is the room as it stands now, so it wins over anything still to play out
  if (!message.event || document.hidden) catchUpWithRoom();
  else if (!online.busy) playNextRoomMessage();
}
function playNextRoomMessage() {
  playing = online.queue.shift() || null;
  online.busy = Boolean(playing);
  if (playing) playRoomMessage(playing, playNextRoomMessage);
}
// stop playing out the current message, wherever it has got to
function stopPlaying() {
  playbackId++;
  playing = null;
  online.busy = false;
}
// skip whatever is still to play out and take on the newest state the room has sent
function catchUpWithRoom() {
  const newest = online.queue.at(-1) || playing;
  if (!newest) return;
  online.queue = [];
  stopPlaying();
  takeOnRoomMessage(newest);
}

function playRoomMessage(message, done) {
  const { event, seq, state } = message;
  const animated =
    event &&
    (event.kind === 'roll' || event.kind === 'move') &&
    seq === online.seq + 1 &&
    game.roomGameId === state.gameId &&
    !document.hidden;
  // whatever goes wrong in taking a message on, the ones after it still play out
  if (!animated) {
    try {
      takeOnRoomMessage(message);
    } finally {
      done();
    }
    return;
  }
  const thisPlayback = playbackId,
    stale = () => thisPlayback !== playbackId;
  let finished = false;
  const finish = (react = () => {}) => {
    if (stale() || finished) return;
    finished = true;
    try {
      takeOnRoomMessage(message, true);
      react();
    } finally {
      done();
    }
  };
  try {
    if (event.kind === 'roll') playRoomRoll(event, state, finish, stale);
    else playRoomMove(event, finish, stale);
  } catch (error) {
    finish(); // the board takes on the room's state without the rest of the animation
    throw error;
  }
}

// the dice tumble and land on the room's roll; a roll with no move shows the pass for a moment
function playRoomRoll({ side, dice, roll, passed }, state, finish, stale) {
  game.phase = 'rolling';
  game.note = '';
  shakeDice(
    () => dice,
    () => {
      Object.assign(game, { dice, roll, phase: 'move' });
      if (!passed) {
        if (roll === MAX_ROLL) speak(side, 'bigRoll', 0, 0.35);
        finish();
        return;
      }
      speak(side, 'pass', 0, 0.5);
      game.note = passNote(roll);
      game.log = state.log; // the ledger's "no move"
      render();
      setTimeout(() => {
        if (stale()) return;
        game.note = '';
        finish();
      }, DELAY.pass);
    },
    stale,
  );
}

// the counter hops along its route and lands with its effects, then the players react
function playRoomMove({ side, move, landsOnRose, again, finished }, finish, stale) {
  game.phase = 'animating';
  animateHops(side, move, () => {
    if (stale()) return;
    markLanding(side, move, landsOnRose);
    game.note = finished ? '' : againNote(landsOnRose, again);
    finish(() => reactToMove(side, move, landsOnRose, finished));
  });
}

// The board takes on a state the room sent, as it is. One not played out still marks where a move landed; after a
// jump, what happened in between (and so the last landing and its note) isn't known.
function takeOnRoomMessage({ event, seq, state }, played = false) {
  const follows = event && seq === online.seq + 1;
  if (!played && (!follows || event.kind !== 'presence')) {
    const rules = VARIANTS[state.variant],
      move = follows && event.kind === 'move' ? event.move : null;
    game.lastLanding = move && move.to !== rules.home ? routeCell(event.side, move.to, rules) : null;
    game.note = '';
  }
  online.seq = seq;
  adoptRoomState(state);
  if (game.phase === 'over') finishGame(game.winner);
  else continueGame(); // your own forced move plays itself
}

// A refused roll or move (the room paused, say, or a second press that got through) puts the board back as the
// room last had it, so it's never left waiting for an answer that isn't coming. Nothing is said: a refusal
// changes nothing in the room. A forced move isn't tried again, so one the room refuses can't repeat for ever.
onRoomState((message) => {
  if (message.type !== 'error' || online.busy || !online.view || !isOnline()) return;
  if (game.phase === 'rolling' || game.phase === 'animating') adoptRoomState(online.view);
});

const PHASE_FROM_ROOM = { lobby: 'setup', closed: 'over' };
function adoptRoomState(view) {
  if (!isOnline() || game.roomGameId !== view.gameId) {
    abandonCurrentGame();
    if (game && game.guided) finishGuide();
    game = createGameState('online', game.level, view.variant, false);
  }
  online.view = view;
  $('mode-online').checked = true;
  currentRules = VARIANTS[view.variant];
  Object.assign(game, {
    variant: view.variant,
    positions: view.positions,
    turn: view.turn ?? SUN,
    phase: PHASE_FROM_ROOM[view.phase] || view.phase,
    roll: view.roll,
    dice: view.dice,
    winner: view.winner,
    log: view.log,
    stats: structuredClone(view.stats), // the page's own clock ticks into this copy, never into the room's
    names: view.names,
    roomGameId: view.gameId,
    seat: view.you,
    endedBy: view.endedBy,
    rematch: view.rematch,
    roomClosed: view.phase === 'closed',
  });
  // the opponent's name is kept with the seat, for offering to rejoin later
  const seat = savedSeats()[online.roomId],
    opponent = view.names[opponentOf(view.you)];
  if (seat && opponent && seat.opponent !== opponent) saveSeat(online.roomId, { ...seat, opponent });
  showRulesInPlay();
  render();
}

// ---------- records ----------
// Each browser records a finished online game once, by the room's id for it, however often it sees the game's end.
// The ids of the last few recorded are kept (and in memory too, should storage be blocked).
const RECORDED_KEY = 'ur-online-recorded-v1';
const RECORDED_KEPT = 50;
let recordedHere = [];
function recordedGames() {
  try {
    return JSON.parse(localStorage.getItem(RECORDED_KEY)) || recordedHere;
  } catch (e) {
    return recordedHere;
  }
}
// the room's finished game in this browser's stats, honours and tally; says whether it was recorded just now
function recordOnlineGame(view) {
  const recorded = recordedGames();
  if (recorded.includes(view.gameId)) return false;
  recordedHere = [...recorded, view.gameId].slice(-RECORDED_KEPT);
  try {
    localStorage.setItem(RECORDED_KEY, JSON.stringify(recordedHere));
  } catch (e) {}
  // a game left part-way is a win or loss, but earns no honours and sets no records
  const forfeit = view.endedBy === 'forfeit';
  game.stats = view.stats;
  recordGame(view.winner, { forfeit });
  game.newHonours = forfeit ? [] : awardHonours(view.winner);
  tally[view.winner === mySide() ? 'onlineWon' : 'onlineLost']++;
  saveTally();
  return true;
}

// The page leaves its room's game for something else. Mid-game that forfeits it: the loss is recorded here, under
// the room's id for the game so it can never be counted twice, and the room gives the other player the win. Between
// games it records nothing more, but for a game whose end hasn't played out here yet.
function leaveOnlineGame() {
  if (!online.roomId) return;
  const newest = (online.queue.at(-1) || playing || { state: online.view }).state;
  if (isOnline() && newest && newest.gameId === game.roomGameId) {
    if (newest.phase === 'roll' || newest.phase === 'move')
      recordOnlineGame({ ...newest, winner: opponentOf(mySide()), endedBy: 'forfeit' });
    else if (newest.phase === 'over') recordOnlineGame(newest);
  }
  leaveRoom();
  setLinkRoom(null);
}
