/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Shared set-up for the online tests: the Worker run locally by `wrangler dev`, and rooms made through its API.

import { expect } from '@playwright/test';

export const ONLINE_URL = 'http://localhost:8787';

// a new room hosted by `name`; resolves to {id, key, seat}
export async function createRoomViaApi(request, name, variant) {
  const response = await request.post(`${ONLINE_URL}/api/rooms`, { data: { name, variant } });
  expect(response.status()).toBe(201);
  return response.json();
}

// the friend's seat in room `id`; resolves to {key, seat}
export async function joinViaApi(request, id, name) {
  const response = await request.post(`${ONLINE_URL}/api/rooms/${id}/join`, { data: { name } });
  expect(response.status()).toBe(200);
  return response.json();
}
