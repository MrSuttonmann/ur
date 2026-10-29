/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Unit tests for worker/room-logic.mjs: the lobby half of the online room.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOON, SUN, VARIANTS } from '../../worker/generated/shared.mjs';
import {
  GAME_IDLE_MS,
  applyIntent,
  setConnected,
  LOBBY_IDLE_MS,
  cleanName,
  createRoom,
  expiresAt,
  inviteInfo,
  isRoomId,
  joinRoom,
  publicState,
  seatForKey,
} from '../../worker/room-logic.mjs';

const HOST_KEY = 'a'.repeat(32);
const FRIEND_KEY = 'b'.repeat(32);
const newRoom = () => createRoom('K7QXM2', 'Ann', 'classic', HOST_KEY, 1000);

test('cleanName trims, collapses, strips controls and caps the length', () => {
  assert.equal(cleanName('  Ann   Lee '), 'Ann Lee');
  assert.equal(cleanName('\u0007Bob'), 'Bob');
  assert.equal(cleanName('a'.repeat(200)), 'a'.repeat(20));
  assert.equal(cleanName('   '), null);
  assert.equal(cleanName('<b>Ann</b>'), '<b>Ann</b>');
  assert.equal(cleanName('😀'.repeat(30)), '😀'.repeat(20));
});

test('isRoomId accepts six characters of the alphabet only', () => {
  assert.equal(isRoomId('K7QXM2'), true);
  for (const bad of ['k7qxm2', 'K7QXM', 'K7QXM0', '../x']) assert.equal(isRoomId(bad), false, bad);
});

test('createRoom seats the host first, in the lobby', () => {
  const room = newRoom();
  assert.deepEqual(room.seats, [{ name: 'Ann', key: HOST_KEY }, null]);
  assert.equal(room.phase, 'lobby');
  assert.equal(room.seq, 0);
  assert.throws(() => createRoom('K7QXM2', 'Ann', 'nope', HOST_KEY, 0));
  assert.throws(() => createRoom('K7QXM2', '  ', 'classic', HOST_KEY, 0));
});

test('joinRoom fills seat 1, then refuses a second join', () => {
  const room = newRoom();
  const joined = joinRoom(room, 'Bea', FRIEND_KEY, 2000);
  assert.equal(joined.room.seats[1].name, 'Bea');
  assert.equal(joined.room.seq, 1);
  assert.equal(joined.room.touched, 2000);
  assert.deepEqual(joinRoom(room, 'Cy', 'c'.repeat(32), 3000), { error: 'full' });
  assert.equal(room.touched, 2000);
});

test('joinRoom refuses a closed room or a blank name without changing anything', () => {
  const closed = newRoom();
  closed.phase = 'closed';
  assert.deepEqual(joinRoom(closed, 'Bea', FRIEND_KEY, 2000), { error: 'closed' });
  assert.equal(closed.seats[1], null);
  const room = newRoom();
  assert.deepEqual(joinRoom(room, '  ', FRIEND_KEY, 2000), { error: 'name' });
  assert.equal(room.seats[1], null);
  assert.equal(room.seq, 0);
  assert.equal(room.touched, 1000);
});

test('seatForKey finds the seat a key opens', () => {
  const room = newRoom();
  joinRoom(room, 'Bea', FRIEND_KEY, 2000);
  assert.equal(seatForKey(room, HOST_KEY), 0);
  assert.equal(seatForKey(room, FRIEND_KEY), 1);
  assert.equal(seatForKey(room, 'c'.repeat(32)), null);
});

test('inviteInfo goes open, full, closed', () => {
  const room = newRoom();
  assert.deepEqual(inviteInfo(room), { host: 'Ann', variant: 'classic', status: 'open' });
  joinRoom(room, 'Bea', FRIEND_KEY, 2000);
  assert.equal(inviteInfo(room).status, 'full');
  room.phase = 'closed';
  assert.equal(inviteInfo(room).status, 'closed');
});

test('publicState never includes a seat key', () => {
  const room = newRoom();
  joinRoom(room, 'Bea', FRIEND_KEY, 2000);
  room.clockFrom = 123456;
  const view = publicState(room, 1);
  const text = JSON.stringify(view);
  assert.ok(!text.includes(HOST_KEY) && !text.includes(FRIEND_KEY));
  assert.ok(!('clockFrom' in view) && !('seats' in view));
  assert.equal(view.you, 1);
  assert.deepEqual(view.names, ['Ann', 'Bea']);
  assert.equal(view.gameId, 'K7QXM2-0');
});

test('expiresAt is a day after the last touch in the lobby and a week once started', () => {
  const room = newRoom();
  assert.equal(expiresAt(room), 1000 + LOBBY_IDLE_MS);
  room.phase = 'roll';
  assert.equal(expiresAt(room), 1000 + GAME_IDLE_MS);
});

// ---------- play ----------

// an rng that gives the scripted numbers in turn; a roll of n is n marked tips then the rest blank
const scripted =
  (...values) =>
  () => {
    assert.ok(values.length, 'the test ran out of random numbers');
    return values.shift();
  };
const rolling = (n) => scripted(...[0, 1, 2, 3].map((die) => (die < n ? 0.1 : 0.9)));
const SUN_FIRST = () => 0.1;
const MOON_FIRST = () => 0.9;

// a started room with both seated and connected; Sun (Ann, the host) goes first unless told otherwise
function startedRoom(rng = SUN_FIRST) {
  const room = newRoom();
  joinRoom(room, 'Bea', FRIEND_KEY, 1500);
  setConnected(room, 0, true, 2000);
  setConnected(room, 1, true, 2000);
  assert.equal(applyIntent(room, 0, { t: 'start' }, 2000, rng).event.kind, 'start');
  return room;
}
const snapshot = (room) => structuredClone(room);

// a game Sun has just won, by test-set then a roll of 1
function finishedRoom() {
  const room = startedRoom();
  const rules = VARIANTS.classic;
  const positions = [Array(rules.counters).fill(rules.home), room.positions[MOON]];
  positions[SUN][0] = rules.home - 1;
  const hooks = { testHooks: true };
  applyIntent(room, 0, { t: 'test-set', positions, turn: SUN }, 3000, SUN_FIRST, hooks);
  applyIntent(room, 0, { t: 'roll' }, 3100, rolling(1));
  applyIntent(room, 0, { t: 'move', counter: 0 }, 3200, SUN_FIRST);
  return room;
}

test('createRoom refuses variant ids inherited from Object.prototype', () => {
  for (const variant of ['constructor', '__proto__', 'toString'])
    assert.throws(() => createRoom('K7QXM2', 'Ann', variant, HOST_KEY, 1), /Unknown variant/);
});

test('only the host can start, and only with two players', () => {
  const room = newRoom();
  assert.deepEqual(applyIntent(room, 0, { t: 'start' }, 2000, SUN_FIRST), { error: 'not-ready' });
  joinRoom(room, 'Bea', FRIEND_KEY, 1500);
  assert.deepEqual(applyIntent(room, 1, { t: 'start' }, 2000, SUN_FIRST), { error: 'not-host' });
  assert.equal(room.phase, 'lobby');
  const { event } = applyIntent(room, 0, { t: 'start' }, 2000, MOON_FIRST); // not connected: start still works
  assert.deepEqual(event, { kind: 'start', first: MOON });
  assert.equal(room.phase, 'roll');
  assert.equal(room.turn, MOON);
  assert.equal(room.gameNo, 1);
  assert.deepEqual(room.log, ['Bea goes first.']);
  assert.deepEqual(applyIntent(room, 0, { t: 'start' }, 2001, SUN_FIRST), { error: 'wrong-phase' });
});

test('rolling is refused while either player is disconnected', () => {
  const room = startedRoom();
  setConnected(room, 1, false, 3000);
  const before = snapshot(room);
  assert.deepEqual(applyIntent(room, 0, { t: 'roll' }, 4000, rolling(2)), { error: 'paused' });
  assert.deepEqual(room, before);
  setConnected(room, 1, true, 5000);
  assert.equal(applyIntent(room, 0, { t: 'roll' }, 6000, rolling(2)).event.kind, 'roll');
});

test('rolling out of turn is refused', () => {
  const room = startedRoom();
  const before = snapshot(room);
  assert.deepEqual(applyIntent(room, 1, { t: 'roll' }, 3000, rolling(2)), { error: 'not-your-turn' });
  assert.deepEqual(room, before);
});

test('moving before rolling is refused', () => {
  const room = startedRoom();
  const before = snapshot(room);
  assert.deepEqual(applyIntent(room, 0, { t: 'move', counter: 0 }, 3000, SUN_FIRST), { error: 'wrong-phase' });
  assert.deepEqual(room, before);
});

test('an illegal counter is refused', () => {
  const room = startedRoom();
  applyIntent(room, 0, { t: 'roll' }, 3000, rolling(2));
  const before = snapshot(room);
  for (const counter of [99, -1, 'x', undefined])
    assert.deepEqual(applyIntent(room, 0, { t: 'move', counter }, 4000, SUN_FIRST), { error: 'illegal' });
  assert.deepEqual(room, before);
});

test('second move of a double-click is rejected', () => {
  const room = startedRoom();
  applyIntent(room, 0, { t: 'roll' }, 3000, rolling(2));
  assert.equal(applyIntent(room, 0, { t: 'move', counter: 0 }, 3100, SUN_FIRST).event.kind, 'move');
  const before = snapshot(room);
  const second = applyIntent(room, 0, { t: 'move', counter: 0 }, 3101, SUN_FIRST);
  assert.ok(['wrong-phase', 'not-your-turn'].includes(second.error));
  assert.deepEqual(room, before);
});

test('a roll with no move passes the turn and logs it', () => {
  const room = startedRoom();
  const { event } = applyIntent(room, 0, { t: 'roll' }, 3000, rolling(0));
  assert.deepEqual(event, { kind: 'roll', side: SUN, dice: [0, 0, 0, 0], roll: 0, passed: true });
  assert.equal(room.turn, MOON);
  assert.equal(room.phase, 'roll');
  assert.equal(room.log[0], 'Ann rolled 0: no move');
  const mine = room.stats.bySide[SUN];
  assert.equal(mine.rolls, 1);
  assert.equal(mine.passes, 1);
  assert.equal(mine.rollCounts[0], 1);
});

test('a move applies, is logged and passes the turn', () => {
  const room = startedRoom();
  applyIntent(room, 0, { t: 'roll' }, 3000, rolling(2));
  assert.equal(room.phase, 'move');
  const { event } = applyIntent(room, 0, { t: 'move', counter: 0 }, 3100, SUN_FIRST);
  assert.deepEqual(event, {
    kind: 'move',
    side: SUN,
    move: { counter: 0, from: 0, to: 2, captures: -1 },
    landsOnRose: false,
    again: false,
    finished: false,
  });
  assert.equal(room.positions[SUN][0], 2);
  assert.equal(room.turn, MOON);
  assert.equal(room.phase, 'roll');
  assert.match(room.log[0], /^Ann rolled 2: /);
  assert.equal(room.stats.bySide[SUN].moves, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(event)), event);
});

test('landing on a rose keeps the turn', () => {
  const room = startedRoom();
  applyIntent(room, 0, { t: 'roll' }, 3000, rolling(4));
  const { event } = applyIntent(room, 0, { t: 'move', counter: 0 }, 3100, SUN_FIRST);
  assert.equal(event.landsOnRose, true);
  assert.equal(event.again, true);
  assert.equal(room.turn, SUN);
  assert.equal(room.phase, 'roll');
  assert.equal(room.stats.bySide[SUN].roseChain, 1);
});

test('test-set is refused without testHooks', () => {
  const room = startedRoom();
  const before = snapshot(room);
  const intent = { t: 'test-set', positions: room.positions, turn: SUN };
  assert.deepEqual(applyIntent(room, 0, intent, 3000, SUN_FIRST), { error: 'illegal' });
  assert.deepEqual(room, before);
});

test('bringing the last counter home wins', () => {
  const room = finishedRoom();
  assert.equal(room.phase, 'over');
  assert.equal(room.winner, SUN);
  assert.equal(room.endedBy, 'win');
  assert.equal(room.log[0].startsWith('Ann rolled 1: '), true);
});

test('the clock only runs with both players connected', () => {
  const room = startedRoom(); // started at 2000 with both connected
  setConnected(room, 1, false, 3000); // 1 s counted
  setConnected(room, 1, true, 8000); // 5 s away, not counted
  applyIntent(room, 0, { t: 'roll' }, 9000, rolling(2)); // 1 s more
  assert.equal(room.stats.playMs, 2000);
  assert.equal(room.stats.bySide[SUN].msOnTurn, 2000);
  assert.equal(room.stats.bySide[MOON].msOnTurn, 0);
});

test('simultaneous rematch starts one game', () => {
  const room = finishedRoom();
  assert.deepEqual(applyIntent(room, 0, { t: 'rematch' }, 4000, SUN_FIRST).event, { kind: 'rematch-offer', seat: 0 });
  assert.equal(room.phase, 'over');
  const second = applyIntent(room, 1, { t: 'rematch' }, 4001, MOON_FIRST);
  assert.deepEqual(second.event, { kind: 'start', first: MOON });
  assert.equal(room.gameNo, 2);
  assert.equal(room.phase, 'roll');
  assert.equal(room.winner, null);
  assert.deepEqual(room.rematch, [false, false]);
  assert.equal(room.stats.playMs, 0);
  for (const seat of [0, 1])
    assert.deepEqual(applyIntent(room, seat, { t: 'rematch' }, 4002, SUN_FIRST), { error: 'wrong-phase' });
  assert.equal(room.gameNo, 2);
});

test('leaving mid-game forfeits to the other player', () => {
  const room = startedRoom();
  const { event } = applyIntent(room, 1, { t: 'leave' }, 3000, SUN_FIRST);
  assert.deepEqual(event, { kind: 'left', seat: 1, forfeit: true });
  assert.equal(room.winner, SUN);
  assert.equal(room.endedBy, 'forfeit');
  assert.equal(room.log[0], 'Bea left the game.');
  assert.equal(room.phase, 'closed');
  assert.deepEqual(applyIntent(room, 0, { t: 'roll' }, 3001, SUN_FIRST), { error: 'wrong-phase' });
});

test('leaving between games closes the room without a winner change', () => {
  const room = finishedRoom();
  const { event } = applyIntent(room, 1, { t: 'leave' }, 4000, SUN_FIRST);
  assert.deepEqual(event, { kind: 'left', seat: 1, forfeit: false });
  assert.equal(room.phase, 'closed');
  assert.equal(room.winner, SUN);
  assert.equal(room.endedBy, 'win');
  const lobby = newRoom();
  assert.equal(applyIntent(lobby, 0, { t: 'leave' }, 2000, SUN_FIRST).event.forfeit, false);
  assert.equal(lobby.phase, 'closed');
});

test('the friend leaving the lobby frees their seat and keeps the room open', () => {
  const room = newRoom();
  joinRoom(room, 'Bea', FRIEND_KEY, 1500);
  setConnected(room, 1, true, 1600);
  const seq = room.seq;
  const { event } = applyIntent(room, 1, { t: 'leave' }, 2000, SUN_FIRST);
  assert.deepEqual(event, { kind: 'left', seat: 1, forfeit: false });
  assert.equal(room.phase, 'lobby');
  assert.equal(room.seats[1], null);
  assert.equal(room.connected[1], false);
  assert.equal(room.seq, seq + 1);
  assert.equal(room.touched, 2000);
  assert.equal(seatForKey(room, FRIEND_KEY), null);
  assert.equal(inviteInfo(room).status, 'open');
  assert.deepEqual(applyIntent(room, 0, { t: 'start' }, 2100, SUN_FIRST), { error: 'not-ready' });
  // the link still works for someone else
  assert.equal(joinRoom(room, 'Cy', 'c'.repeat(32), 2200).room.seats[1].name, 'Cy');
});

test('the host leaving the lobby still closes the room, with a friend seated or not', () => {
  const room = newRoom();
  joinRoom(room, 'Bea', FRIEND_KEY, 1500);
  assert.deepEqual(applyIntent(room, 0, { t: 'leave' }, 2000, SUN_FIRST).event, {
    kind: 'left',
    seat: 0,
    forfeit: false,
  });
  assert.equal(room.phase, 'closed');
  assert.equal(room.seats[1].name, 'Bea');
});

test('seq rises by one on every accepted intent and not on a refused one', () => {
  const room = startedRoom();
  const seq = room.seq;
  applyIntent(room, 1, { t: 'roll' }, 3000, rolling(2));
  assert.equal(room.seq, seq);
  assert.equal(room.touched, 2000);
  applyIntent(room, 0, { t: 'roll' }, 3000, rolling(2));
  assert.equal(room.seq, seq + 1);
  assert.equal(room.touched, 3000);
  setConnected(room, 1, false, 3500);
  assert.equal(room.seq, seq + 2);
  applyIntent(room, 0, { t: 'move', counter: 0 }, 4000, SUN_FIRST); // paused
  assert.equal(room.seq, seq + 2);
});

// A leave names the game it was meant for (null for the lobby): one held up on the way can't forfeit a later game
test('a lobby leave that arrives after the game has started closes the room without a forfeit', () => {
  const room = startedRoom();
  const { event } = applyIntent(room, 1, { t: 'leave', game: null }, 3000, SUN_FIRST);
  assert.deepEqual(event, { kind: 'left', seat: 1, forfeit: false });
  assert.equal(room.phase, 'closed');
  assert.equal(room.winner, null);
  assert.equal(room.endedBy, null);
  assert.equal(room.seats[1].name, 'Bea');
});

test('a leave meant for the last game closes a rematch without a forfeit', () => {
  const room = finishedRoom();
  applyIntent(room, 1, { t: 'rematch' }, 4000, SUN_FIRST);
  applyIntent(room, 0, { t: 'rematch' }, 4001, SUN_FIRST);
  assert.equal(room.gameNo, 2);
  const { event } = applyIntent(room, 1, { t: 'leave', game: 'K7QXM2-1' }, 5000, SUN_FIRST);
  assert.deepEqual(event, { kind: 'left', seat: 1, forfeit: false });
  assert.equal(room.phase, 'closed');
  assert.equal(room.winner, null);
  assert.equal(room.endedBy, null);
  assert.notEqual(room.log[0], 'Bea left the game.');
});

test('a leave meant for the game in play forfeits it', () => {
  const room = startedRoom();
  const { event } = applyIntent(room, 1, { t: 'leave', game: 'K7QXM2-1' }, 3000, SUN_FIRST);
  assert.deepEqual(event, { kind: 'left', seat: 1, forfeit: true });
  assert.equal(room.winner, SUN);
  assert.equal(room.endedBy, 'forfeit');
});

test('a lobby leave from the friend still frees their seat while the room is in the lobby', () => {
  const room = newRoom();
  joinRoom(room, 'Bea', FRIEND_KEY, 1500);
  applyIntent(room, 1, { t: 'leave', game: null }, 2000, SUN_FIRST);
  assert.equal(room.phase, 'lobby');
  assert.equal(room.seats[1], null);
});
