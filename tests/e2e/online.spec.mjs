/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Online play in the page: inviting a friend by link, joining, and the notes for full and ended rooms. Each
// person has their own browser context, against the Worker run by `wrangler dev`.

import { expect } from '@playwright/test';
import { hostAndJoin, inviteFriend, joinFriend, linkPath, test } from './online-helpers.mjs';

const modeAndPhase = (page) => page.evaluate(() => [game.mode, game.phase]);

test('host invites, friend joins, host starts', async ({ openDevice }) => {
  const host = await openDevice('/');
  const link = await inviteFriend(host, 'Ted');
  expect(link).toMatch(/^http:\/\/localhost:8787\/#g=[23456789A-HJKMNP-Z]{6}$/);
  await expect(host.locator('#invite-qr svg')).toBeVisible();
  await expect(host.locator('#seat0')).toHaveText('Ted');
  await expect(host.locator('#invite-start')).toBeDisabled();

  const friend = await openDevice(linkPath(link));
  await expect(friend.locator('#join-dlg')).toContainText('Ted has invited you to play the Royal Game of Ur');
  await expect(friend.locator('#join-rules')).toContainText('Classic');
  await joinFriend(friend, 'Ann');
  await expect(friend.locator('#join-wait')).toContainText('Waiting for Ted to start the game…');

  await expect(host.locator('#seat1')).toHaveText('Ann');
  await expect(host.locator('#invite-start')).toBeEnabled();
  await host.locator('#invite-start').click();
  for (const page of [host, friend]) {
    await expect.poll(() => modeAndPhase(page)).toEqual(['online', 'roll']);
    await expect(page.locator('#invite-dlg')).toBeHidden();
    await expect(page.locator('#join-dlg')).toBeHidden();
    await expect(page.locator('#tray0 .tray-name')).toContainText('Ted');
    await expect(page.locator('#tray1 .tray-name')).toContainText('Ann');
  }
});

test('an empty name is refused before anything is sent', async ({ openDevice }) => {
  const host = await openDevice('/');
  await host.locator('label[for=mode-online]').click();
  await host.locator('#player-name').fill('   ');
  await host.locator('#newgame').click();
  await expect(host.locator('#invite-dlg')).toBeHidden();
  expect(await host.locator('#player-name').evaluate((input) => input.validationMessage)).toContain('your name');
});

test('a third visitor is told the game is full', async ({ openDevice }) => {
  const { link } = await hostAndJoin(openDevice);
  const third = await openDevice(linkPath(link));
  await expect(third.locator('#room-note-text')).toContainText('already has two players');
  await expect(third.locator('#join-dlg')).toBeHidden();
  await third.locator('#room-note-own').click();
  await expect(third.locator('#room-note-dlg')).toBeHidden();
  await expect(third.locator('#name-field')).toBeVisible();
});

test('an ended room’s link says so', async ({ openDevice }) => {
  const { host, friend, link } = await hostAndJoin(openDevice);
  await host.locator('#invite-cancel').click();
  await expect(host.locator('#invite-dlg')).toBeHidden();
  await expect(friend.locator('#room-note-text')).toContainText('has ended');
  const visitor = await openDevice(linkPath(link));
  await expect(visitor.locator('#room-note-text')).toContainText('has ended');
});

test('the host opening their own link rejoins as host', async ({ openDevice }) => {
  const host = await openDevice('/');
  const link = await inviteFriend(host, 'Ted');
  const again = await openDevice(linkPath(link), { context: host.context() });
  await expect(again.locator('#invite-dlg')).toBeVisible();
  await expect(again.locator('#seat0')).toHaveText('Ted');
  await expect(again.locator('#invite-link')).toHaveValue(link);
  await expect(again.locator('#join-dlg')).toBeHidden();
  // the older tab gave up its seat to the newer one, and says so
  await expect(host.locator('#room-note-text')).toContainText('another tab');
});

test('a name with markup shows as text', async ({ openDevice }) => {
  const { host, friend } = await hostAndJoin(openDevice, { friendName: '<b>Ann</b>' });
  await expect(host.locator('#seat1')).toHaveText('<b>Ann</b>');
  await expect(host.locator('#seat1 b')).toHaveCount(0);
  await host.locator('#invite-start').click();
  for (const page of [host, friend]) {
    await expect.poll(() => modeAndPhase(page)).toEqual(['online', 'roll']);
    await expect(page.locator('#tray1 .tray-name')).toContainText('<b>Ann</b>');
    await expect(page.locator('#tray1 .tray-name b, #log b, #status b')).toHaveCount(0);
  }
});

test('an invite link skips the welcome', async ({ openDevice }) => {
  const host = await openDevice('/');
  const link = await inviteFriend(host, 'Ted');
  const friend = await openDevice(linkPath(link), { newPlayer: true });
  await expect(friend.locator('#join-dlg')).toBeVisible();
  await expect(friend.locator('html')).not.toHaveClass(/booting/); // the moment the welcome would be offered
  await expect(friend.locator('#welcome-dlg')).toBeHidden();
});

test('the last name is remembered', async ({ openDevice }) => {
  const host = await openDevice('/');
  await inviteFriend(host, 'Ted');
  await host.locator('#invite-cancel').click();
  const later = await openDevice('/', { context: host.context() });
  await later.locator('label[for=mode-online]').click();
  await expect(later.locator('#player-name')).toHaveValue('Ted');
});
