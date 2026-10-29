/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Shared set-up for the online tests: the Worker run locally by `wrangler dev`, rooms made through its API, and
// two people's devices driving the page's own invite and join screens.

import { test as base, expect, openGame } from './helpers.mjs';

export const ONLINE_URL = 'http://localhost:8788'; // the tests' own Worker (see playwright.config.mjs)

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

// The tests' devices: `openDevice(url, options)` opens the game at `url` in a browser context of its own, as
// another person's phone would (or in `options.context`, as another tab on the same one); `options.prepare` is
// given a new context first, to set up its storage or network. Script errors on any of them fail the test, as on
// the usual test page.
export const test = base.extend({
  openDevice: async ({ browser }, use) => {
    const contexts = [],
      errors = [];
    await use(async (url = '/', { context, prepare, ...options } = {}) => {
      if (!context) {
        context = await browser.newContext({ baseURL: ONLINE_URL });
        contexts.push(context);
        if (prepare) await prepare(context);
      }
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.stack || error.message));
      await openGame(page, { ...options, url });
      return page;
    });
    for (const context of contexts) await context.close();
    expect(errors, 'no script errors').toEqual([]);
  },
});

// the invite link's path and hash, for opening on another device
export const linkPath = (link) => new URL(link).pathname + new URL(link).hash;

// the host chooses Online, gives their name and presses Invite a friend; resolves to the invite link
export async function inviteFriend(host, name) {
  await host.locator('label[for=mode-online]').click();
  await host.locator('#player-name').fill(name);
  await host.locator('#newgame').click();
  await expect(host.locator('#invite-link')).toHaveAttribute('data-link', /#g=\w{6}$/);
  return host.locator('#invite-link').getAttribute('data-link');
}

// the friend, on the invite link, gives their name and joins
export async function joinFriend(friend, name) {
  await friend.locator('#join-name').fill(name);
  await friend.locator('#join-go').click();
  await expect(friend.locator('#join-wait')).toBeVisible();
}

// A host invites a friend through the page and the friend joins from the link, each on their own device.
// Resolves to both pages and the link; the game hasn't started.
export async function hostAndJoin(openDevice, { hostName = 'Ted', friendName = 'Ann', friendOptions = {} } = {}) {
  const host = await openDevice('/');
  const link = await inviteFriend(host, hostName);
  const friend = await openDevice(linkPath(link), friendOptions);
  await joinFriend(friend, friendName);
  return { host, friend, link };
}

// sends an intent through the page's own socket to its room, as the page itself would (`test-set` is only allowed
// by the Worker run for the tests)
export const sendTestIntent = (page, intent) => page.evaluate((intent) => sendIntent(intent), intent);
