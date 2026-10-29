/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The Worker: the built site from static assets, and the online rooms' API under /api/, each room handed to its
// own Room Durable Object by id.
//
//   POST /api/rooms {name, variant}  a new room: 201 {id, key, seat: 0}
//   GET  /api/rooms/:id              the invite: 200 {host, variant, status}
//   POST /api/rooms/:id/join {name}  the friend's seat: 200 {key, seat: 1}
//   GET  /api/rooms/:id/ws?key=…     the seat's socket (Upgrade: websocket)

import { ROOM_ID_ALPHABET, ROOM_ID_LENGTH, isRoomId } from './room-logic.mjs';
import { Room, json, parseJson } from './room.mjs';

// a new room tries this many ids before giving up, in case one is taken
const CREATE_TRIES = 5;
const ROOM_PATH = /^\/api\/rooms\/([^/]+)(\/join|\/ws)?$/;

function randomRoomId() {
  const picks = crypto.getRandomValues(new Uint32Array(ROOM_ID_LENGTH));
  return Array.from(picks, (pick) => ROOM_ID_ALPHABET[pick % ROOM_ID_ALPHABET.length]).join('');
}

const roomFor = (env, id) => env.ROOMS.get(env.ROOMS.idFromName(id));
const postTo = (room, path, body) => room.fetch(`https://room${path}`, { method: 'POST', body: JSON.stringify(body) });

// the request's JSON object, or null if its body isn't one
async function readBody(request) {
  const body = parseJson(await request.text());
  return body && typeof body === 'object' ? body : null;
}

async function createRoom(request, env) {
  const body = await readBody(request);
  if (!body) return json({ error: 'bad-message' }, 400);
  for (let tries = 0; tries < CREATE_TRIES; tries++) {
    const id = randomRoomId();
    const response = await postTo(roomFor(env, id), '/create', { id, name: body.name, variant: body.variant });
    if (response.status !== 409) return response;
  }
  return json({ error: 'busy' }, 503);
}

// the room id is checked before any Durable Object is touched
async function routeApi(request, env, pathname) {
  if (pathname === '/api/rooms' && request.method === 'POST') return createRoom(request, env);
  const match = ROOM_PATH.exec(pathname);
  if (!match || !isRoomId(match[1])) return json({ error: 'missing' }, 404);
  const [, id, action] = match;
  const room = roomFor(env, id);
  if (!action && request.method === 'GET') return room.fetch('https://room/info');
  if (action === '/join' && request.method === 'POST') {
    const body = await readBody(request);
    if (!body) return json({ error: 'bad-message' }, 400);
    return postTo(room, '/join', { name: body.name });
  }
  if (action === '/ws' && request.method === 'GET') {
    const key = new URL(request.url).searchParams.get('key') ?? '';
    return room.fetch(`https://room/ws?key=${encodeURIComponent(key)}`, { headers: request.headers });
  }
  return json({ error: 'missing' }, 404);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) return routeApi(request, env, pathname);
    return env.ASSETS.fetch(request);
  },
};

export { Room };
