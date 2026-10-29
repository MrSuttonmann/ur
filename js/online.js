/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Online play's connection to its room: the seats this browser holds, the room API, the room's socket (which
// comes back by itself after a drop), and putting the room's game on the board. The room is the one true copy of
// the game; the page only shows what it's told and sends what the player asks for.

const online = {
  roomId: null, // the room this page is in, or null
  seat: null, // SUN for the host, MOON for the friend
  socket: null,
  seq: 0, // the sequence number of the last state the room sent
  queue: [], // the room's messages waiting to play out on the board, one at a time
  busy: false, // a message is playing out
  view: null, // the room as last told to this seat
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
// {type: 'closed', code} when the room has closed this page's socket for good
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
    if (message.type === 'state') {
      online.seq = message.seq;
      online.view = message.state;
    }
    tellRoomHandlers(message);
  });
  socket.addEventListener('close', (e) => {
    if (!current()) return;
    online.socket = null;
    if (e.code === CLOSE_REPLACED || e.code === CLOSE_ENDED) tellRoomHandlers({ type: 'closed', code: e.code });
    else reconnectLater();
  });
}

function reconnectLater() {
  const delay = RECONNECT_DELAYS_MS[reconnectTries] ?? RECONNECT_EVERY_MS;
  reconnectTries++;
  reconnectTimer = setTimeout(openSocket, delay);
}
// a phone that slept has usually lost its socket; try again as soon as the page is looked at
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && online.roomId && !online.socket) openSocket();
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

function sendIntent(intent) {
  if (online.socket && online.socket.readyState === WebSocket.OPEN) online.socket.send(JSON.stringify(intent));
}

// ---------- the room's game on the board ----------
const PHASE_FROM_ROOM = { lobby: 'setup', closed: 'over' };
function adoptRoomState(view) {
  if (!isOnline() || game.gameId !== view.gameId) {
    abandonCurrentGame();
    if (game && game.guided) finishGuide();
    game = createGameState('online', game.level, view.variant, false);
  }
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
    gameId: view.gameId,
  });
  // the opponent's name is kept with the seat, for offering to rejoin later
  const seat = savedSeats()[online.roomId],
    opponent = view.names[opponentOf(view.you)];
  if (seat && opponent && seat.opponent !== opponent) saveSeat(online.roomId, { ...seat, opponent });
  showRulesInPlay();
  render();
}
