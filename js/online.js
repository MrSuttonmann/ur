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
// each room this browser has a seat in: {[roomId]: {key, seat, opponent}}, the key being the seat's secret
const SEATS_KEY = 'ur-seats-v1';
function savedSeats() {
  try {
    return JSON.parse(localStorage.getItem(SEATS_KEY)) || {};
  } catch (e) {
    return {};
  }
}
function storeSeats(seats) {
  try {
    localStorage.setItem(SEATS_KEY, JSON.stringify(seats));
  } catch (e) {}
}
const saveSeat = (roomId, entry) => storeSeats({ ...savedSeats(), [roomId]: entry });
function forgetSeat(roomId) {
  const seats = savedSeats();
  delete seats[roomId];
  storeSeats(seats);
}

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
// the room named by the page's link (#g=K7QXM2), or null
function roomInLink() {
  const match = /^#g=([23456789A-HJKMNP-Z]{6})$/i.exec(location.hash);
  return match ? match[1].toUpperCase() : null;
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

function openSocket() {
  clearTimeout(reconnectTimer);
  const seat = savedSeats()[online.roomId];
  if (!seat) return;
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(
    `${scheme}//${location.host}/api/rooms/${online.roomId}/ws?key=${encodeURIComponent(seat.key)}`,
  );
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
  if (document.hidden) catchUpWithRoom();
  else if (online.roomId && !online.socket) openSocket();
});

// tell the room this seat is leaving, which ends the room, and stop listening to it; a socket still connecting
// says so once it's open
function leaveRoom() {
  const socket = online.socket;
  forgetSeat(online.roomId);
  online.socket = null; // so letting go of the room leaves this socket open long enough to say goodbye
  disconnectRoom();
  if (!socket) return;
  const sayLeaving = () => {
    socket.send(JSON.stringify({ t: 'leave' }));
    socket.close();
  };
  if (socket.readyState === WebSocket.OPEN) sayLeaving();
  else if (socket.readyState === WebSocket.CONNECTING) socket.addEventListener('open', sayLeaving);
}

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

// whether the room is waiting for someone to come back: it takes no rolls or moves until both are here
const roomPaused = () => isOnline() && Boolean(online.view) && !online.view.connected.every(Boolean);

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
  if (!animated) {
    takeOnRoomMessage(message);
    done();
    return;
  }
  const thisPlayback = playbackId,
    stale = () => thisPlayback !== playbackId;
  const finish = (react = () => {}) => {
    if (stale()) return;
    takeOnRoomMessage(message, true);
    react();
    done();
  };
  if (event.kind === 'roll') playRoomRoll(event, state, finish, stale);
  else playRoomMove(event, finish, stale);
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
}

// A refused roll or move (the room paused, say, or a second press that got through) puts the board back as the
// room last had it, so it's never left waiting for an answer that isn't coming. Nothing is said: a refusal
// changes nothing in the room.
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
    stats: view.stats,
    names: view.names,
    roomGameId: view.gameId,
  });
  // the opponent's name is kept with the seat, for offering to rejoin later
  const seat = savedSeats()[online.roomId],
    opponent = view.names[opponentOf(view.you)];
  if (seat && opponent && seat.opponent !== opponent) saveSeat(online.roomId, { ...seat, opponent });
  showRulesInPlay();
  render();
  continueGame(); // your own forced move plays itself
}
