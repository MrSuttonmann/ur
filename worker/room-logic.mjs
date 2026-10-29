/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The online room as plain data and pure functions: no Cloudflare APIs, so Node can test it. This half is the
// lobby (ids, names, seats, invites, expiry); the play half is added below it. Functions that change a room
// change it in place and return it, so a caller holds one room object; a refused change touches nothing.

import {
  IN_TRAY,
  MOON,
  SIDES,
  SUN,
  VARIANTS,
  allHome,
  applyMove,
  createGameStats,
  describeMove,
  isRose,
  legalMoves,
  opponentOf,
  recordMove,
  rollsAgain,
} from './generated/shared.mjs';

const ROOM_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ROOM_ID_LENGTH = 6;
const NAME_MAX = 20;
const LOBBY_IDLE_MS = 24 * 3600_000;
const GAME_IDLE_MS = 7 * 24 * 3600_000;

const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`);
const isRoomId = (text) => typeof text === 'string' && ROOM_ID_PATTERN.test(text);

// a name as shown to the other player: control characters gone, spaces collapsed, at most NAME_MAX characters;
// null when nothing is left. It is text, never HTML: the page escapes it.
function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const name = [...text].slice(0, NAME_MAX).join('').trim();
  return name || null;
}

const freshPositions = (rules) => SIDES.map(() => Array(rules.counters).fill(IN_TRAY));

function createRoom(id, hostName, variant, hostKey, now) {
  if (!Object.hasOwn(VARIANTS, variant)) throw new Error(`Unknown variant: ${variant}`);
  const name = cleanName(hostName);
  if (!name) throw new Error('A room needs a host name');
  return {
    id,
    variant,
    seats: [{ name, key: hostKey }, null],
    phase: 'lobby',
    gameNo: 0,
    positions: freshPositions(VARIANTS[variant]),
    turn: null,
    roll: null,
    dice: null,
    winner: null,
    endedBy: null,
    log: [],
    stats: createGameStats(),
    rematch: [false, false],
    connected: [false, false],
    clockFrom: null,
    seq: 0,
    touched: now,
  };
}

function joinRoom(room, name, key, now) {
  if (room.phase === 'closed') return { error: 'closed' };
  if (room.seats[1]) return { error: 'full' };
  const clean = cleanName(name);
  if (!clean) return { error: 'name' };
  room.seats[1] = { name: clean, key };
  room.touched = now;
  room.seq++;
  return { room };
}

function seatForKey(room, key) {
  const seat = room.seats.findIndex((taken) => taken && taken.key === key);
  return seat < 0 ? null : seat;
}

const inviteInfo = (room) => ({
  host: room.seats[0].name,
  variant: room.variant,
  status: room.phase === 'closed' ? 'closed' : room.seats[1] ? 'full' : 'open',
});

const expiresAt = (room) => room.touched + (room.phase === 'lobby' ? LOBBY_IDLE_MS : GAME_IDLE_MS);

// what a seat is told: the room without anyone's key or the server's clock
function publicState(room, seat) {
  const view = { ...room, you: seat, names: room.seats.map((taken) => (taken ? taken.name : null)) };
  delete view.seats;
  delete view.clockFrom;
  view.gameId = `${room.id}-${room.gameNo}`;
  return view;
}

// ---------- play ----------
// the same turn sequence as js/game.js (landDice, completeMove, endTurn, finishGame), run by the server

const bothHere = (room) => room.connected[0] && room.connected[1];
const clockRuns = (room) => (room.phase === 'roll' || room.phase === 'move') && bothHere(room);

// adds the time since the clock last looked to the game and to whoever's turn it was; the caller then changes the
// state and restarts the clock
function settleClock(room, now) {
  if (room.clockFrom !== null && clockRuns(room)) {
    const elapsed = Math.max(0, now - room.clockFrom);
    room.stats.playMs += elapsed;
    room.stats.bySide[room.turn].msOnTurn += elapsed;
  }
}
const restartClock = (room, now) => {
  room.clockFrom = clockRuns(room) ? now : null;
};

const sideName = (room, side) => room.seats[side].name;
const writeToLedger = (room, line) => room.log.unshift(line);

function beginGame(room, rng) {
  const first = rng() < 0.5 ? SUN : MOON;
  room.positions = freshPositions(VARIANTS[room.variant]);
  room.stats = createGameStats();
  room.gameNo++;
  room.turn = first;
  room.roll = null;
  room.dice = null;
  room.winner = null;
  room.endedBy = null;
  room.rematch = [false, false];
  room.log = [`${sideName(room, first)} goes first.`];
  room.phase = 'roll';
  return { kind: 'start', first };
}

function rollDice(room, rng) {
  const dice = Array.from({ length: 4 }, () => (rng() < 0.5 ? 1 : 0));
  const roll = dice.reduce((sum, die) => sum + die, 0);
  const side = room.turn;
  const mine = room.stats.bySide[side];
  mine.rolls++;
  mine.rollCounts[roll]++;
  room.dice = dice;
  room.roll = roll;
  const passed = !legalMoves(room.positions, side, roll, VARIANTS[room.variant]).length;
  if (passed) {
    mine.passes++;
    mine.roseChain = 0;
    writeToLedger(room, `${sideName(room, side)} rolled ${roll}: no move`);
    room.turn = opponentOf(side);
    room.roll = null;
    room.phase = 'roll';
  } else room.phase = 'move';
  return { kind: 'roll', side, dice: dice.slice(), roll, passed };
}

function makeMove(room, move) {
  const rules = VARIANTS[room.variant];
  const side = room.turn;
  const landsOnRose = isRose(move.to, rules);
  const again = rollsAgain(move, rules);
  const rolled = `${sideName(room, side)} rolled ${room.roll}: `;
  writeToLedger(room, rolled + describeMove(side, move, landsOnRose, again, rules));
  room.positions = applyMove(room.positions, side, move);
  recordMove(room.stats, room.positions, side, move, landsOnRose, rules);
  const finished = allHome(room.positions, side, rules);
  if (finished) {
    room.winner = side;
    room.endedBy = 'win';
    room.phase = 'over';
  } else {
    if (!again) {
      room.stats.bySide[side].roseChain = 0;
      room.turn = opponentOf(side);
    }
    room.phase = 'roll';
  }
  room.roll = null;
  return { kind: 'move', side, move: { ...move }, landsOnRose, again, finished };
}

function validPositions(room, positions) {
  const { counters, home } = VARIANTS[room.variant];
  return (
    Array.isArray(positions) &&
    positions.length === SIDES.length &&
    positions.every(
      (own) =>
        Array.isArray(own) &&
        own.length === counters &&
        own.every((square) => Number.isInteger(square) && square >= IN_TRAY && square <= home),
    )
  );
}

function runIntent(room, seat, intent, now, rng, testHooks) {
  const refuse = (error) => ({ error });
  if (room.phase === 'closed') return refuse('wrong-phase');
  if (seat !== 0 && seat !== 1) return refuse('not-your-turn');
  const playing = room.phase === 'roll' || room.phase === 'move';
  switch (intent && intent.t) {
    case 'start':
      if (seat !== 0) return refuse('not-host');
      if (room.phase !== 'lobby') return refuse('wrong-phase');
      if (!room.seats[1]) return refuse('not-ready');
      return { event: beginGame(room, rng) };
    case 'roll':
      if (room.phase !== 'roll') return refuse('wrong-phase');
      if (room.turn !== seat) return refuse('not-your-turn');
      if (!bothHere(room)) return refuse('paused');
      settleClock(room, now);
      return { event: rollDice(room, rng) };
    case 'move': {
      if (room.phase !== 'move') return refuse('wrong-phase');
      if (room.turn !== seat) return refuse('not-your-turn');
      if (!bothHere(room)) return refuse('paused');
      const moves = legalMoves(room.positions, seat, room.roll, VARIANTS[room.variant]);
      const move = moves.find((candidate) => candidate.counter === intent.counter);
      if (!move) return refuse('illegal');
      settleClock(room, now);
      return { event: makeMove(room, move) };
    }
    case 'rematch':
      if (room.phase !== 'over' || room.endedBy !== 'win' || room.rematch[seat]) return refuse('wrong-phase');
      room.rematch[seat] = true;
      if (room.rematch[opponentOf(seat)]) return { event: beginGame(room, rng) };
      return { event: { kind: 'rematch-offer', seat } };
    case 'leave':
      // a friend leaving the lobby frees their seat for someone else; the host can still invite them by link
      if (room.phase === 'lobby' && seat === 1) {
        room.seats[1] = null;
        room.connected[1] = false;
        return { event: { kind: 'left', seat, forfeit: false } };
      }
      settleClock(room, now);
      if (playing) {
        room.winner = opponentOf(seat);
        room.endedBy = 'forfeit';
        writeToLedger(room, `${sideName(room, seat)} left the game.`);
      }
      room.phase = 'closed';
      return { event: { kind: 'left', seat, forfeit: playing } };
    case 'test-set':
      if (!testHooks) return refuse('illegal');
      if (!playing) return refuse('wrong-phase');
      if (!validPositions(room, intent.positions) || !SIDES.includes(intent.turn)) return refuse('illegal');
      settleClock(room, now);
      room.positions = intent.positions.map((own) => own.slice());
      room.turn = intent.turn;
      room.roll = null;
      room.dice = null;
      room.phase = 'roll';
      return { event: { kind: 'test-set' } };
    default:
      return refuse('illegal');
  }
}

// Carries out a seat's intent if it is allowed. The work is done on a copy that replaces the room's contents only
// on success, so a refused intent leaves the room (clock, touched and seq too) exactly as it was.
function applyIntent(room, seat, intent, now, rng, { testHooks = false } = {}) {
  const draft = structuredClone(room);
  const outcome = runIntent(draft, seat, intent, now, rng, testHooks);
  if (outcome.error) return outcome;
  restartClock(draft, now);
  draft.touched = now;
  draft.seq++;
  Object.assign(room, draft);
  return { room, event: outcome.event };
}

// a seat's connection coming or going; time so far counts under the old arrangement, so the clock is settled first
function setConnected(room, seat, connected, now) {
  settleClock(room, now);
  room.connected[seat] = connected;
  restartClock(room, now);
  room.touched = now;
  room.seq++;
  return { room, event: { kind: 'presence' } };
}

export {
  applyIntent,
  setConnected,
  ROOM_ID_ALPHABET,
  ROOM_ID_LENGTH,
  NAME_MAX,
  LOBBY_IDLE_MS,
  GAME_IDLE_MS,
  isRoomId,
  cleanName,
  createRoom,
  joinRoom,
  seatForKey,
  inviteInfo,
  expiresAt,
  publicState,
};
