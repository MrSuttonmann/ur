/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The online rooms' HTTP and socket API, as the Worker serves it under `wrangler dev`.

import { expect, test } from '@playwright/test';
import { ONLINE_URL, createRoomViaApi, joinViaApi } from './online-helpers.mjs';

test.use({ baseURL: ONLINE_URL });

const socketUrl = (id, key) => `${ONLINE_URL.replace(/^http/, 'ws')}/api/rooms/${id}/ws?key=${key}`;

// resolves to the close code once the socket closes
const closeCode = (socket) =>
  new Promise((resolve) => socket.addEventListener('close', (event) => resolve(event.code)));

// resolves to the first message the socket receives, parsed
const firstMessage = (socket) =>
  new Promise((resolve) =>
    socket.addEventListener('message', (event) => resolve(JSON.parse(event.data)), { once: true }),
  );

// resolves to the first message from now on that passes `wanted`, parsed
const messageWhere = (socket, wanted) =>
  new Promise((resolve) =>
    socket.addEventListener('message', function listen(event) {
      const message = JSON.parse(event.data);
      if (!wanted(message)) return;
      socket.removeEventListener('message', listen);
      resolve(message);
    }),
  );

test('creating a room returns an id and a key', async ({ request }) => {
  const room = await createRoomViaApi(request, 'Ennigaldi', 'classic');
  expect(room.id).toMatch(/^[23456789A-HJKMNP-Z]{6}$/);
  expect(room.key).toMatch(/^[0-9a-f]{32}$/);
  expect(room.seat).toBe(0);
});

test('invite info names the host and variant and never the key', async ({ request }) => {
  const room = await createRoomViaApi(request, 'Ennigaldi', 'classic');
  const response = await request.get(`/api/rooms/${room.id}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  const text = await response.text();
  expect(JSON.parse(text)).toEqual({ host: 'Ennigaldi', variant: 'classic', status: 'open' });
  expect(text).not.toContain(room.key);
});

test('the second join is told the game is full', async ({ request }) => {
  const room = await createRoomViaApi(request, 'Ennigaldi', 'classic');
  const friend = await joinViaApi(request, room.id, 'Nabonidus');
  expect(friend.seat).toBe(1);
  expect(friend.key).toMatch(/^[0-9a-f]{32}$/);
  const response = await request.post(`/api/rooms/${room.id}/join`, { data: { name: 'Belshalti' } });
  expect(response.status()).toBe(409);
  expect(await response.json()).toEqual({ error: 'full' });
});

test('a blank name is refused', async ({ request }) => {
  const response = await request.post('/api/rooms', { data: { name: '   ', variant: 'classic' } });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: 'name' });
});

test('an unknown room is missing', async ({ request }) => {
  const response = await request.get('/api/rooms/222222');
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: 'missing' });
});

test('a socket without the right key is refused', async ({ request }) => {
  const room = await createRoomViaApi(request, 'Ennigaldi', 'classic');
  const response = await request.get(`/api/rooms/${room.id}/ws?key=${'0'.repeat(32)}`, {
    headers: { Upgrade: 'websocket' },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: 'seat' });
});

test('a second socket for a seat replaces the first', async ({ request }) => {
  // under wrangler dev the replaced socket's close takes Node's whole close-handshake wait (about 10 seconds)
  test.slow();
  const room = await createRoomViaApi(request, 'Ennigaldi', 'classic');
  const first = new WebSocket(socketUrl(room.id, room.key));
  const hello = await firstMessage(first);
  // the first state already counts this socket as here: connecting was the room's first change (seq 1)
  expect(hello).toMatchObject({
    type: 'state',
    seq: 1,
    event: null,
    state: { you: 0, seq: 1, names: ['Ennigaldi', null], connected: [true, false] },
  });
  const firstClosed = closeCode(first);
  const second = new WebSocket(socketUrl(room.id, room.key));
  const again = await firstMessage(second);
  expect(again).toMatchObject({ seq: 1, event: null, state: { you: 0, connected: [true, false] } });
  expect(await firstClosed).toBe(4000);
  second.close();
});

test('a socket acts for its own seat: nonsense is refused, and leaving frees the lobby seat or ends the room', async ({
  request,
}) => {
  const room = await createRoomViaApi(request, 'Ennigaldi', 'classic');
  const friend = await joinViaApi(request, room.id, 'Nabonidus');
  const host = new WebSocket(socketUrl(room.id, room.key));
  const guest = new WebSocket(socketUrl(room.id, friend.key));
  await Promise.all([firstMessage(host), firstMessage(guest)]);
  const refused = messageWhere(host, (message) => message.type === 'error');
  host.send('not json');
  expect(await refused).toEqual({ type: 'error', code: 'bad-message' });

  // the friend leaving the lobby frees their seat: only their socket is ended, and the link still works
  const friendLeft = messageWhere(host, (message) => message.event?.kind === 'left');
  const guestClosed = closeCode(guest);
  guest.send(JSON.stringify({ t: 'leave', seat: 0 }));
  expect(await friendLeft).toMatchObject({
    event: { kind: 'left', seat: 1, forfeit: false },
    state: { phase: 'lobby', names: ['Ennigaldi', null] },
  });
  expect(await guestClosed).toBe(4001);
  expect(host.readyState).toBe(WebSocket.OPEN);
  expect(await (await request.get(`/api/rooms/${room.id}`)).json()).toMatchObject({ status: 'open' });
  const refusedSeat = await request.get(`/api/rooms/${room.id}/ws?key=${friend.key}`, {
    headers: { Upgrade: 'websocket' },
  });
  expect(refusedSeat.status()).toBe(403);

  // the host leaving the lobby ends the room
  const hostClosed = closeCode(host);
  host.send(JSON.stringify({ t: 'leave' }));
  expect(await hostClosed).toBe(4001);
  expect(await (await request.get(`/api/rooms/${room.id}`)).json()).toMatchObject({ status: 'closed' });
});

test('the site itself is still served', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('Royal Game of Ur');
});
