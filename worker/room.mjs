/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// One online room as a Durable Object: it keeps the room from room-logic.mjs in storage, holds both players'
// sockets (hibernating while nobody speaks), and tells each seat its own view after every change. The Worker in
// index.mjs reaches it on internal paths: /create, /info, /join and /ws.

import { DurableObject } from 'cloudflare:workers';
import { VARIANTS } from './generated/shared.mjs';
import {
  applyIntent,
  cleanName,
  createRoom,
  expiresAt,
  inviteInfo,
  joinRoom,
  publicState,
  seatForKey,
  setConnected,
} from './room-logic.mjs';

// a socket is closed with these when another tab takes its seat, or when the room has ended
const CLOSE_REPLACED = 4000;
const CLOSE_ENDED = 4001;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

// the parsed JSON, or undefined if the text isn't JSON
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const randomKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

const seatOf = (socket) => socket.deserializeAttachment().seat;
const isOpen = (socket) => socket.readyState === WebSocket.OPEN;

class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) ?? null;
    });
  }

  async fetch(request) {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname === '/create') return this.create(parseJson(await request.text()));
    if (!this.room) return json({ error: 'missing' }, 404);
    if (pathname === '/info') return json(inviteInfo(this.room));
    if (pathname === '/join') return this.join(parseJson(await request.text()));
    if (pathname === '/ws') return this.connect(request, searchParams.get('key'));
    return json({ error: 'missing' }, 404);
  }

  async create(body) {
    if (this.room) return json({ error: 'taken' }, 409);
    const { id, name, variant } = body ?? {};
    if (!Object.hasOwn(VARIANTS, variant)) return json({ error: 'variant' }, 400);
    if (!cleanName(name)) return json({ error: 'name' }, 400);
    const key = randomKey();
    this.room = createRoom(id, name, variant, key, Date.now());
    await this.save();
    return json({ id, key, seat: 0 }, 201);
  }

  async join(body) {
    const key = randomKey();
    const outcome = joinRoom(this.room, body?.name, key, Date.now());
    if (outcome.error) return json({ error: outcome.error }, { full: 409, closed: 410 }[outcome.error] ?? 400);
    await this.save();
    this.broadcast({ kind: 'join' });
    return json({ key, seat: 1 });
  }

  // the seat comes only from the key the socket presents, never from anything it sends later
  async connect(request, key) {
    const seat = seatForKey(this.room, key);
    if (seat === null) return json({ error: 'seat' }, 403);
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'upgrade' }, 426);
    const [client, server] = Object.values(new WebSocketPair());
    for (const older of this.ctx.getWebSockets(String(seat))) older.close(CLOSE_REPLACED, 'replaced');
    this.ctx.acceptWebSocket(server, [String(seat)]);
    server.serializeAttachment({ seat });
    server.send(this.stateMessage(seat, null));
    if (this.room.phase === 'closed') server.close(CLOSE_ENDED, 'closed');
    else await this.updatePresence(seat, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, message) {
    const intent = typeof message === 'string' ? parseJson(message) : undefined;
    if (!intent || typeof intent !== 'object') {
      socket.send(JSON.stringify({ type: 'error', code: 'bad-message' }));
      return;
    }
    const testHooks = this.env.TEST_HOOKS === '1';
    const outcome = applyIntent(this.room, seatOf(socket), intent, Date.now(), rng, { testHooks });
    if (outcome.error) {
      socket.send(JSON.stringify({ type: 'error', code: outcome.error }));
      return;
    }
    await this.save();
    this.broadcast(outcome.event);
    if (this.room.phase === 'closed') this.closeAll();
  }

  async webSocketClose(socket) {
    await this.updatePresence(seatOf(socket), null);
  }

  async webSocketError(socket) {
    await this.updatePresence(seatOf(socket), null);
  }

  // an expired room is forgotten entirely, so it reads as missing; otherwise the alarm waits again
  async alarm() {
    if (!this.room) return;
    if (Date.now() < expiresAt(this.room)) {
      await this.ctx.storage.setAlarm(expiresAt(this.room));
      return;
    }
    this.closeAll();
    this.room = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  // a seat is present while it has an open socket; if that changed, everyone is told (bar a socket just sent the state)
  async updatePresence(seat, alreadyTold) {
    if (!this.room || this.room.phase === 'closed') return;
    const connected = this.ctx.getWebSockets(String(seat)).some(isOpen);
    if (this.room.connected[seat] === connected) return;
    const { event } = setConnected(this.room, seat, connected, Date.now());
    await this.save();
    this.broadcast(event, alreadyTold);
  }

  async save() {
    await this.ctx.storage.put('room', this.room);
    await this.ctx.storage.setAlarm(expiresAt(this.room));
  }

  // publicState shares arrays with the room, so it's serialised straight away
  stateMessage(seat, event) {
    return JSON.stringify({ type: 'state', seq: this.room.seq, event, state: publicState(this.room, seat) });
  }

  broadcast(event, except = null) {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== except && isOpen(socket)) socket.send(this.stateMessage(seatOf(socket), event));
    }
  }

  closeAll() {
    for (const socket of this.ctx.getWebSockets()) if (isOpen(socket)) socket.close(CLOSE_ENDED, 'closed');
  }
}

export { Room, json, parseJson };
