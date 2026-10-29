/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The online room as plain data and pure functions: no Cloudflare APIs, so Node can test it. This half is the
// lobby (ids, names, seats, invites, expiry); the play half is added below it. Functions that change a room
// change it in place and return it, so a caller holds one room object; a refused change touches nothing.

import { IN_TRAY, SIDES, VARIANTS, createGameStats } from './generated/shared.mjs';

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

function createRoom(id, hostName, variant, hostKey, now) {
  const rules = VARIANTS[variant];
  if (!rules) throw new Error(`Unknown variant: ${variant}`);
  const name = cleanName(hostName);
  if (!name) throw new Error('A room needs a host name');
  return {
    id,
    variant,
    seats: [{ name, key: hostKey }, null],
    phase: 'lobby',
    gameNo: 0,
    positions: SIDES.map(() => Array(rules.counters).fill(IN_TRAY)),
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

export {
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
