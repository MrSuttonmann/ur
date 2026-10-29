/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Unit tests for worker/room-logic.mjs: the lobby half of the online room.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GAME_IDLE_MS,
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
