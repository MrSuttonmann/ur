/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Online play in the page: inviting a friend by link, joining, the notes for full and ended rooms, and playing a
// game in step on both devices. Each person has their own browser context, against the Worker run by
// `wrangler dev`. The room rolls its own dice, so the play tests work with whatever it rolls.

import { expect } from '@playwright/test';
import { speedUpGame } from './helpers.mjs';
import {
  createRoomViaApi,
  hostAndJoin,
  inviteFriend,
  joinFriend,
  linkPath,
  sendTestIntent,
  test,
  fakeCamera,
} from './online-helpers.mjs';

const modeAndPhase = (page) => page.evaluate(() => [game.mode, game.phase]);

// a context's saved seats before its first page loads, kept through reloads
const seedSeats = (seats) => (context) =>
  context.addInitScript((seats) => {
    if (localStorage.getItem('ur-seats-v1') === null) localStorage.setItem('ur-seats-v1', JSON.stringify(seats));
  }, seats);
const savedRoomIds = (page) =>
  page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ur-seats-v1') || '{}')));

test('host invites, friend joins, host starts', async ({ openDevice }) => {
  const host = await openDevice('/');
  const link = await inviteFriend(host, 'Ted');
  expect(link).toMatch(/^http:\/\/localhost:8788\/#g=[23456789A-HJKMNP-Z]{6}$/);
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

test('on a phone the invite shows the whole code, and the name fields don’t make iPhones zoom', async ({
  openDevice,
}) => {
  const host = await openDevice('/');
  await host.setViewportSize({ width: 390, height: 844 }); // an iPhone 13 Pro
  const link = await inviteFriend(host, 'Ted');
  const roomId = new URL(link).hash.slice('#g='.length);
  await expect(host.locator('#invite-code')).toHaveText(roomId);
  await expect(host.locator('#invite-host')).toHaveText(new URL(link).host);
  const fits = await host.evaluate(() => {
    const panel = document.querySelector('#invite-dlg .stats-inner').getBoundingClientRect();
    return [...document.querySelectorAll('#invite-code, #invite-host')].every((el) => {
      const box = el.getBoundingClientRect();
      return box.left >= panel.left && box.right <= panel.right && el.scrollWidth <= el.clientWidth + 1;
    });
  });
  expect(fits).toBe(true);
  // iPhones zoom in on a text field whose text is smaller than 16px
  for (const field of ['#player-name', '#join-name'])
    expect(
      await host.locator(field).evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
});

test('an empty name is refused before anything is sent', async ({ openDevice }) => {
  const host = await openDevice('/');
  await host.locator('label[for=mode-online]').click();
  await host.locator('#player-name').fill('   ');
  await host.locator('#newgame').click();
  await expect(host.locator('#invite-dlg')).toBeHidden();
  expect(await host.locator('#player-name').evaluate((input) => input.validationMessage)).toContain('your name');
});

test('a friend already on the site can join with just the code', async ({ openDevice }) => {
  const host = await openDevice('/');
  const link = await inviteFriend(host, 'Ted');
  const code = await host.locator('#invite-code').textContent();

  const friend = await openDevice('/');
  await expect(friend.locator('#join-code')).toBeHidden(); // only offered in Online mode
  await friend.locator('label[for=mode-online]').click();
  await friend.locator('#join-code').click();
  // typed in lower case with a space in the middle, it's still the code
  await friend.locator('#code-input').fill(`${code.slice(0, 3)} ${code.slice(3)}`.toLowerCase());
  await friend.locator('#code-go').click();
  await expect(friend.locator('#code-dlg')).toBeHidden();
  await expect(friend.locator('#join-dlg')).toContainText('Ted has invited you to play the Royal Game of Ur');
  expect(await friend.evaluate(() => location.hash)).toBe(new URL(link).hash); // a reload comes back here
  await joinFriend(friend, 'Ann');
  await expect(host.locator('#seat1')).toHaveText('Ann');
  await expect(friend.locator('#join-code')).toBeHidden(); // not while holding a seat
});

test('a mistyped or unknown code says so on one line, and the window stays open', async ({ openDevice }) => {
  const page = await openDevice('/');
  await page.setViewportSize({ width: 375, height: 667 }); // the narrowest iPhones in use
  // the lines the message's text runs over, counted by where each line's boxes start
  const lines = () =>
    page.locator('#code-error').evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].map((box) => Math.round(box.top))).size;
    });
  await page.locator('label[for=mode-online]').click();
  await page.locator('#join-code').click();
  await page.locator('#code-input').fill('K7Q');
  await page.locator('#code-go').click();
  await expect(page.locator('#code-error')).toContainText('isn’t a game code');
  expect(await lines()).toBe(1);
  await page.locator('#code-input').fill('ZZZZZZ');
  await expect(page.locator('#code-error')).toBeHidden(); // typing clears the message
  await page.locator('#code-go').click();
  await expect(page.locator('#code-error')).toContainText('no game with that code');
  expect(await lines()).toBe(1);
  await expect(page.locator('#code-dlg')).toBeVisible();
  await expect(page.locator('#join-dlg')).toBeHidden();
  await page.locator('#code-cancel').click();
  await expect(page.locator('#code-dlg')).toBeHidden();
});

test('scanning an invite’s QR code in the code window joins the game', async ({ openDevice }) => {
  const host = await openDevice('/');
  const link = await inviteFriend(host, 'Ted');
  const friend = await openDevice('/');
  await friend.locator('label[for=mode-online]').click();
  await friend.locator('#join-code').click();
  await fakeCamera(friend, { text: link });
  await friend.locator('#code-scan').click();
  await expect(friend.locator('#join-dlg')).toContainText('Ted has invited you to play the Royal Game of Ur');
  await expect(friend.locator('#code-dlg')).toBeHidden();
  expect(await friend.evaluate(() => window.fakeCameraStream.getTracks().map((track) => track.readyState))).toEqual([
    'ended',
  ]); // the camera is off once the code is read
  await expect(friend.locator('video')).toHaveCount(0); // and its video is gone, so Brave's Playlist has nothing to offer
  await joinFriend(friend, 'Ann');
  await expect(host.locator('#seat1')).toHaveText('Ann');
});

test('a QR code that isn’t an invite, or a refused camera, says so on one line', async ({ openDevice }) => {
  const page = await openDevice('/');
  await page.setViewportSize({ width: 375, height: 667 });
  const lines = () =>
    page.locator('#code-error').evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].map((box) => Math.round(box.top))).size;
    });
  await page.locator('label[for=mode-online]').click();
  await page.locator('#join-code').click();

  await fakeCamera(page, { text: 'https://example.com/menu' });
  await page.locator('#code-scan').click();
  await expect(page.locator('#code-error')).toContainText('isn’t an invite');
  expect(await lines()).toBe(1);
  await expect(page.locator('#code-viewfinder')).toBeVisible(); // still looking for the right one
  await page.locator('#code-cancel').click();
  // the window's close event comes a moment after the click; then the camera is off
  await expect.poll(() => page.evaluate(() => window.fakeCameraStream.getTracks()[0].readyState)).toBe('ended');
  await expect(page.locator('video')).toHaveCount(0);

  await page.locator('#join-code').click();
  await fakeCamera(page, { refuse: 'NotAllowedError' });
  await page.locator('#code-scan').click();
  await expect(page.locator('#code-error')).toContainText('camera wasn’t allowed');
  expect(await lines()).toBe(1);
  await expect(page.locator('#code-viewfinder')).toBeHidden();
  await expect(page.locator('#code-scan')).toBeVisible(); // to try again, or type the code instead
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

test('a friend can leave the waiting room, and the link still works for someone else', async ({ openDevice }) => {
  const { host, friend, link } = await hostAndJoin(openDevice);
  await expect(host.locator('#invite-start')).toBeEnabled();
  await friend.locator('#join-leave').click();

  // the friend is back on a set-up board of their own, with the room let go and their seat forgotten
  await expect(friend.locator('#join-dlg')).toBeHidden();
  await expect(friend.locator('#room-note-dlg')).toBeHidden();
  expect(await modeAndPhase(friend)).toEqual(['online', 'setup']);
  expect(await friend.evaluate(() => [online.roomId, location.hash])).toEqual([null, '']);
  await expect.poll(() => friend.evaluate(() => Object.keys(savedSeats()))).toEqual([]);

  // the host waits for a friend again, with the room still open
  await expect(host.locator('#seat1')).toHaveText('Waiting for a friend…');
  await expect(host.locator('#invite-start')).toBeDisabled();
  await expect(host.locator('#invite-dlg')).toBeVisible();
  await expect(host.locator('#room-note-dlg')).toBeHidden();

  const another = await openDevice(linkPath(link));
  await expect(another.locator('#join-host')).toContainText('Ted has invited you');
  await joinFriend(another, 'Cy');
  await expect(host.locator('#seat1')).toHaveText('Cy');
  await expect(host.locator('#invite-start')).toBeEnabled();
  await host.locator('#invite-start').click();
  await expect.poll(() => modeAndPhase(another)).toEqual(['online', 'roll']);
  await friend.waitForTimeout(500);
  expect(await modeAndPhase(friend)).toEqual(['online', 'setup']); // not pulled back in
});

test('the host opening their own link rejoins as host', async ({ openDevice }) => {
  const host = await openDevice('/');
  const link = await inviteFriend(host, 'Ted');
  const again = await openDevice(linkPath(link), { context: host.context() });
  await expect(again.locator('#invite-dlg')).toBeVisible();
  await expect(again.locator('#seat0')).toHaveText('Ted');
  await expect(again.locator('#invite-link')).toHaveAttribute('data-link', link);
  await expect(again.locator('#join-dlg')).toBeHidden();
  // the older tab gave up its seat to the newer one, and says so
  await expect(host.locator('#room-note-text')).toContainText('another tab');
});

test('a name with markup shows as text', async ({ openDevice }) => {
  const name = '"><b>Ann</b>'; // a quote too, to break out of an attribute
  const { host, friend } = await hostAndJoin(openDevice, { friendName: name });
  await expect(host.locator('#seat1')).toHaveText(name);
  await expect(host.locator('#seat1 b')).toHaveCount(0);
  await host.locator('#invite-start').click();
  for (const page of [host, friend]) {
    await expect.poll(() => modeAndPhase(page)).toEqual(['online', 'roll']);
    await expect(page.locator('#tray1 .tray-name')).toContainText(name);
    await expect(page.locator('#tray1 .tray-name b, #log b, #status b')).toHaveCount(0);
    // the Stats window's side-by-side table and dice chart (given a roll to chart) name both players
    await page.locator('#open-stats').click();
    await page.evaluate(() => {
      game.stats.bySide[MOON].rollCounts[2] = 1;
      drawStats();
    });
    await expect(page.locator('#stats-body .cmp thead')).toContainText(name);
    await expect(page.locator('#stats-body .legend')).toContainText(name);
    await expect(page.locator('#stats-body b', { hasText: 'Ann' })).toHaveCount(0); // its own <b>s hold numbers
    const tips = await page
      .locator('#stats-body .rc-bar[data-tip]')
      .evaluateAll((bars) => bars.map((bar) => bar.dataset.tip));
    expect(tips).toContain(`${name} rolled 2: 1 of 1 rolls (100.0%)`);
    await page.locator('#close-stats').click();
  }
});

test('a room that closes without a word says it has ended, and isn’t reconnected', async ({ openDevice }) => {
  const host = await openDevice('/');
  const link = await inviteFriend(host, 'Ted');
  const friend = await openDevice(linkPath(link));
  // the friend's socket goes through the test, which can close it as the room does when it expires: 4001, no state
  const sockets = [];
  await friend.routeWebSocket(/\/api\/rooms\/\w+\/ws/, (socket) => {
    socket.connectToServer();
    sockets.push(socket);
  });
  await joinFriend(friend, 'Ann');
  expect(sockets).toHaveLength(1);
  await sockets[0].close({ code: 4001, reason: 'closed' });
  await expect(friend.locator('#room-note-text')).toContainText('has ended');
  await expect(friend.locator('#join-dlg')).toBeHidden();
  expect(await friend.evaluate(() => [online.roomId, Object.keys(savedSeats())])).toEqual([null, []]);
  // neither looking at the page again nor the retry timers open another socket
  await friend.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await friend.waitForTimeout(2500); // past the first two retry delays
  expect(sockets).toHaveLength(1);
});

test('an invite link skips the welcome', async ({ openDevice }) => {
  const host = await openDevice('/');
  const link = await inviteFriend(host, 'Ted');
  const friend = await openDevice(linkPath(link), { newPlayer: true });
  await expect(friend.locator('#join-dlg')).toBeVisible();
  await expect(friend.locator('html')).not.toHaveClass(/booting/); // the moment the welcome would be offered
  await expect(friend.locator('#welcome-dlg')).toBeHidden();
});

// a page that answers every room request in its place, as a captive portal or a site's fallback page would
const answerWithAPage = (context) =>
  context.route('**/api/rooms/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Sign in</title>' }),
  );

test('a reply that isn’t the room’s counts as not reaching it', async ({ openDevice }) => {
  const visitor = await openDevice('/#g=K7QXM2', { prepare: answerWithAPage });
  await expect(visitor.locator('#room-note-title')).toHaveText('Can’t reach the game');
  // a new player with a saved seat that can't be checked is still offered the guided game
  const prepare = async (context) => {
    await answerWithAPage(context);
    await seedSeats({ K7QXM2: { key: 'a'.repeat(32), seat: 0, opponent: 'Ann', savedAt: 1 } })(context);
  };
  const newcomer = await openDevice('/', { prepare, newPlayer: true });
  await expect(newcomer.locator('#welcome-dlg')).toBeVisible();
  await expect(newcomer.locator('#rejoin-dlg')).toBeHidden();
  expect(await savedRoomIds(newcomer)).toEqual(['K7QXM2']);
});

test('online play works for the visit with storage blocked', async ({ openDevice }) => {
  const blockSeats = (context) =>
    context.addInitScript(() => {
      for (const name of ['getItem', 'setItem']) {
        const real = Storage.prototype[name];
        Storage.prototype[name] = function (key, ...rest) {
          if (key === 'ur-seats-v1') throw new DOMException('Storage is blocked', 'SecurityError');
          return real.call(this, key, ...rest);
        };
      }
    });
  const host = await openDevice('/', { prepare: blockSeats });
  const link = await inviteFriend(host, 'Ted');
  const friend = await openDevice(linkPath(link), { prepare: blockSeats });
  await joinFriend(friend, 'Ann');
  await expect(host.locator('#seat1')).toHaveText('Ann');
  await host.locator('#invite-start').click();
  for (const page of [host, friend]) await expect.poll(() => modeAndPhase(page)).toEqual(['online', 'roll']);
});

test('an invite link pasted into an open tab is followed between games', async ({ openDevice }) => {
  const host = await openDevice('/');
  const link = await inviteFriend(host, 'Ted');
  const busy = await openDevice('/');
  await busy.locator('#newgame').click(); // a game against the computer, in play
  await busy.evaluate((hash) => (location.hash = hash), new URL(link).hash);
  await busy.waitForTimeout(500);
  await expect(busy.locator('#join-dlg')).toBeHidden();
  expect((await modeAndPhase(busy))[0]).toBe('ai');

  const friend = await openDevice('/');
  await friend.evaluate((hash) => (location.hash = hash), new URL(link).hash);
  await expect(friend.locator('#join-host')).toContainText('Ted has invited you');
  await joinFriend(friend, 'Ann');
  await expect(host.locator('#seat1')).toHaveText('Ann');
});

test('the last name is remembered', async ({ openDevice }) => {
  const host = await openDevice('/');
  await inviteFriend(host, 'Ted');
  await host.locator('#invite-cancel').click();
  const later = await openDevice('/', { context: host.context() });
  await later.locator('label[for=mode-online]').click();
  await expect(later.locator('#player-name')).toHaveValue('Ted');
});

// ---------- playing in step ----------

const SUN_SIDE = 0,
  MOON_SIDE = 1,
  IN = 0; // in the tray

// what both screens must agree on, and whether the page has played out everything the room has sent
const boardOf = (page) =>
  page.evaluate(() => ({
    positions: game.positions,
    turn: game.turn,
    log: game.log,
    phase: game.phase,
    settled: !online.busy && !online.queue.length,
  }));
// both pages show the same game, with nothing left to play out
async function expectInStep(pages) {
  await expect
    .poll(async () => {
      const [a, b] = await Promise.all(pages.map(boardOf));
      return a.settled && b.settled && JSON.stringify(a) === JSON.stringify(b);
    })
    .toBe(true);
}

// a started game between Ted (the host, Sun) and Ann (the friend, Moon), played quickly; pages[side] is that
// side's device. Forced moves wait to be clicked, so each test makes its own moves.
async function startOnlineGame(openDevice) {
  const { host, friend, link } = await hostAndJoin(openDevice);
  await host.locator('#invite-start').click();
  const pages = [host, friend];
  for (const page of pages) {
    await expect.poll(() => modeAndPhase(page)).toEqual(['online', 'roll']);
    await page.evaluate(() => (prefs.autoMove = false));
    await speedUpGame(page, 4);
  }
  return { host, friend, link, pages };
}
const whoseTurn = (page) => page.evaluate(() => game.turn);

// whoever's turn it is presses Roll; resolves to true when there's a move to choose, false when the turn passed
async function rollOnce(pages) {
  const page = pages[await whoseTurn(pages[0])],
    lines = await page.evaluate(() => game.log.length);
  await page.locator('#roll').click();
  // a pass shows its "no move" line at once, and passes the turn a moment later
  const outcome = () =>
    page.evaluate(
      (lines) => (game.log.length > lines ? 'passed' : game.phase === 'move' && !online.busy ? 'move' : 'rolling'),
      lines,
    );
  await expect.poll(outcome).not.toBe('rolling');
  return (await outcome()) === 'move';
}
// whoever's turn it is moves their first movable counter
async function moveFirst(pages) {
  // movable counters bob, so never hold still for Playwright's checks
  await pages[await whoseTurn(pages[0])].locator('.piece.movable').first().click({ force: true });
}

// put the game as given, with `turn` to roll, through the room's test hook; both pages catch up
async function setUpGame(pages, positions, turn) {
  await sendTestIntent(pages[0], { t: 'test-set', positions, turn });
  await expect
    .poll(() => Promise.all(pages.map((page) => page.evaluate(() => [game.turn, game.phase]))))
    .toEqual([
      [turn, 'roll'],
      [turn, 'roll'],
    ]);
  await expectInStep(pages);
}

test('both screens agree after several turns', async ({ openDevice }) => {
  const { pages } = await startOnlineGame(openDevice);
  for (let turn = 0; turn < 12; turn++) {
    if (await rollOnce(pages)) await moveFirst(pages);
    await expectInStep(pages);
  }
  expect(await pages[0].evaluate(() => game.log.length)).toBe(13); // who went first, then a line a turn
});

test('you can’t roll on your friend’s turn', async ({ openDevice }) => {
  const { pages } = await startOnlineGame(openDevice);
  const waiting = pages[1 - (await whoseTurn(pages[0]))];
  await expect(waiting.locator('#roll')).toBeDisabled();
  await waiting.locator('body').press('r');
  await waiting.waitForTimeout(500);
  expect(await waiting.evaluate(() => [game.phase, game.log.length])).toEqual(['roll', 1]);
  await expectInStep(pages);
});

test('opponent’s rose turn plays out in order on both screens', async ({ openDevice }) => {
  const { host, friend, pages } = await startOnlineGame(openDevice);
  // the friend's page notes each new ledger line as it's drawn
  await friend.evaluate(() => {
    const draw = render;
    window.linesSeen = [];
    window.render = () => {
      draw();
      if (game.log[0] !== window.linesSeen.at(-1)) window.linesSeen.push(game.log[0]);
    };
  });
  // Sun's counters sit where any roll but 0 can reach a rose; the room's dice decide, so try again after a 0
  const positions = [[3, 6, 5, 10, IN, IN, IN], Array(7).fill(IN)];
  let moves = [];
  for (let attempt = 0; attempt < 10 && moves.length < 2; attempt++) {
    moves = [];
    await setUpGame(pages, positions, SUN_SIDE);
    if (!(await rollOnce(pages))) continue;
    const onRose = await host.evaluate(() =>
      legalMoves(game.positions, game.turn, game.roll).find((move) => isRose(move.to)),
    );
    await host.locator(`.piece.movable[data-pid="0-${onRose.counter}"]`).click({ force: true });
    await expectInStep(pages);
    moves.push(await host.evaluate(() => game.log[0]));
    expect(await whoseTurn(host)).toBe(SUN_SIDE); // a rose: Sun rolls again at once
    if (!(await rollOnce(pages))) continue;
    await moveFirst(pages);
    await expectInStep(pages);
    moves.push(await host.evaluate(() => game.log[0]));
  }
  expect(moves).toHaveLength(2);
  // the friend saw the rose move before the second move, and their ledger has both, newest first
  const seen = await friend.evaluate(() => window.linesSeen);
  expect(seen.indexOf(moves[0])).toBeGreaterThanOrEqual(0);
  expect(seen.indexOf(moves[0])).toBeLessThan(seen.indexOf(moves[1]));
  expect(await friend.evaluate(() => game.log.slice(0, 2))).toEqual([moves[1], moves[0]]);
});

test('double-clicking a counter makes one move', async ({ openDevice }) => {
  const { pages } = await startOnlineGame(openDevice);
  while (!(await rollOnce(pages))) await expectInStep(pages); // until there's a move to make
  const page = pages[await whoseTurn(pages[0])],
    lines = await page.evaluate(() => game.log.length);
  await page.locator('.piece.movable').first().dblclick({ force: true });
  await expectInStep(pages);
  await page.waitForTimeout(500); // time for a second move, had one been sent
  await expectInStep(pages);
  expect(await page.evaluate(() => game.log.length)).toBe(lines + 1);
  await expect(page.locator('#status')).not.toContainText(/wrong|refused|error|couldn/i);
});

test('a move the room refuses leaves the board as it was', async ({ openDevice }) => {
  const { pages } = await startOnlineGame(openDevice);
  while (!(await rollOnce(pages))) await expectInStep(pages);
  const page = pages[await whoseTurn(pages[0])],
    before = await boardOf(page);
  // a counter that isn't there: the page waits for the room, which says no
  await page.evaluate(() => makeMove({ counter: 99, from: 0, to: 1, captures: -1 }));
  await expect.poll(() => boardOf(page)).toEqual(before);
  await expect(page.locator('.piece.movable').first()).toBeVisible();
  await expect(page.locator('#status')).not.toContainText(/wrong|refused|error|couldn|illegal/i);
  await moveFirst(pages);
  await expectInStep(pages);
});

test('reloading mid-game puts you back where you were', async ({ openDevice }) => {
  const { friend, pages } = await startOnlineGame(openDevice);
  for (let turn = 0; turn < 3; turn++) {
    if (await rollOnce(pages)) await moveFirst(pages);
    await expectInStep(pages);
  }
  await friend.reload();
  await expect.poll(() => modeAndPhase(friend)).toEqual(['online', 'roll']);
  await expectInStep(pages);
  expect(await friend.evaluate(() => game.log.length)).toBe(4);
});

test('the host sees the friend drop out, and the game waits', async ({ openDevice }) => {
  const { host, friend, link, pages } = await startOnlineGame(openDevice);
  await setUpGame(pages, [Array(7).fill(IN), Array(7).fill(IN)], SUN_SIDE);
  await expect(host.locator('#roll')).toBeEnabled();
  const context = friend.context();
  await friend.close();
  await expect(host.locator('#status')).toContainText('Ann has lost connection');
  await expect(host.locator('#roll')).toBeDisabled();
  await host.locator('body').press('r');
  expect(await host.evaluate(() => game.phase)).toBe('roll');

  const back = await openDevice(linkPath(link), { context });
  await expect.poll(() => modeAndPhase(back)).toEqual(['online', 'roll']);
  await expect(host.locator('#status')).not.toContainText('lost connection');
  await expect(host.locator('#roll')).toBeEnabled();
  await back.evaluate(() => (prefs.autoMove = false));
  if (await rollOnce([host, back])) await moveFirst([host, back]);
  await expectInStep([host, back]);
});

test('your own lost connection is shown, and play waits for it', async ({ openDevice }) => {
  const { friend, pages } = await startOnlineGame(openDevice);
  await setUpGame(pages, [Array(7).fill(IN), Array(7).fill(IN)], MOON_SIDE);
  await expect(friend.locator('#roll')).toBeEnabled();
  // the socket closes as a dropped connection's would; the page is read as it closes, as the sped-up game soon
  // reconnects
  const dropped = await friend.evaluate(
    () =>
      new Promise((resolve) => {
        const socket = online.socket;
        socket.addEventListener('close', () => resolve([$('status').textContent, $('roll').disabled]));
        socket.close();
      }),
  );
  expect(dropped).toEqual([expect.stringContaining('Reconnecting…'), true]);
  await expect(friend.locator('#status')).not.toContainText('Reconnecting…'); // back by itself
  await expect(friend.locator('#roll')).toBeEnabled();
});

test('advice, undo and danger shading are not offered online', async ({ openDevice }) => {
  const { pages } = await startOnlineGame(openDevice);
  while (!(await rollOnce(pages))) await expectInStep(pages);
  const page = pages[await whoseTurn(pages[0])];
  await expect(page.locator('#advise')).toHaveClass(/swapped/);
  await expect(page.locator('#roll')).not.toHaveClass(/swapped/);
  await page.locator('body').press('a');
  expect(await page.evaluate(() => game.advice)).toBeNull();
  await expect(page.locator('#undo')).toBeHidden();
  await expect(page.locator('#key-danger')).toBeHidden();
  const shaded = await page.evaluate(
    () => Object.values(boardCells).filter((cell) => Number(cell.style.getPropertyValue('--danger')) > 0).length,
  );
  expect(shaded).toBe(0);
  await moveFirst(pages);
  await expectInStep(pages);
  await expect(page.locator('#undo')).toBeHidden();
});

test('a fresh full state wins over a roll still playing out', async ({ openDevice }) => {
  const { friend, pages } = await startOnlineGame(openDevice);
  await expectInStep(pages);
  // a roll starts to play out, then the room's full state (as on reconnecting) says it never happened
  const atOnce = await friend.evaluate(() => {
    const view = online.view,
      seq = online.seq;
    const rolled = { ...view, phase: 'move', roll: 2, dice: [1, 1, 0, 0] };
    const event = { kind: 'roll', side: view.turn, dice: [1, 1, 0, 0], roll: 2, passed: false };
    queueRoomMessage({ type: 'state', seq: seq + 1, event, state: rolled });
    queueRoomMessage({ type: 'state', seq: seq + 1, event: null, state: view });
    return [game.phase, online.busy];
  });
  expect(atOnce).toEqual(['roll', false]);
  await friend.waitForTimeout(1000); // past where the cut-short roll would have landed
  await expectInStep(pages);
  expect(await friend.evaluate(() => [game.phase, game.roll])).toEqual(['roll', null]);
});

test('a message that fails to play out doesn’t hold up the ones after it', async ({ openDevice }) => {
  const { friend, pages } = await startOnlineGame(openDevice);
  await expectInStep(pages);
  const after = await friend.evaluate(() => {
    const view = online.view,
      seq = online.seq,
      presence = { kind: 'presence' };
    const realAdopt = adoptRoomState;
    adoptRoomState = () => {
      adoptRoomState = realAdopt;
      throw new Error('a broken message');
    };
    try {
      queueRoomMessage({ type: 'state', seq: seq + 1, event: presence, state: view });
    } catch {
      // the broken message throws here, as it would to the socket's handler
    }
    queueRoomMessage({ type: 'state', seq: seq + 2, event: presence, state: view });
    return [online.seq - seq, online.busy, online.queue.length];
  });
  expect(after).toEqual([2, false, 0]);
});

test('a refused intent puts the board back without trying again', async ({ openDevice }) => {
  const { friend, pages } = await startOnlineGame(openDevice);
  await expectInStep(pages);
  const after = await friend.evaluate(() => {
    let continued = 0;
    const realContinue = continueGame;
    continueGame = () => continued++;
    game.phase = 'animating';
    tellRoomHandlers({ type: 'error', code: 'illegal' });
    continueGame = realContinue;
    return [game.phase, continued];
  });
  expect(after).toEqual(['roll', 0]);
});

// ---------- the board turned for the friend ----------

const boxOf = (page, selector) => page.locator(selector).boundingBox();
const cellBox = (page, side, square) =>
  page.evaluate(
    ([side, square]) => {
      const r = squareElement(side, square).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },
    [side, square],
  );

test('the friend sees their own pieces at the bottom', async ({ openDevice }) => {
  const { friend } = await startOnlineGame(openDevice);
  const board = await boxOf(friend, '#board'),
    tray = await boxOf(friend, '#tray1'),
    theirs = await boxOf(friend, '#tray0');
  expect(tray.y).toBeGreaterThan(board.y + board.height);
  expect(theirs.y + theirs.height).toBeLessThan(board.y);
  // the shared row is 5, and Moon's own row (squares 1–4) lies below it
  const own = await cellBox(friend, MOON_SIDE, 1),
    shared = await cellBox(friend, MOON_SIDE, 5);
  expect(own.y).toBeGreaterThan(shared.y);
  // the columns stay put: Moon's route still starts at the right of its row and runs left
  expect(own.x).toBeGreaterThan((await cellBox(friend, MOON_SIDE, 4)).x);
});

test('the host’s board is unchanged', async ({ openDevice }) => {
  const { host } = await startOnlineGame(openDevice);
  const board = await boxOf(host, '#board');
  expect((await boxOf(host, '#tray0')).y).toBeGreaterThan(board.y + board.height);
  expect((await boxOf(host, '#tray1')).y + (await boxOf(host, '#tray1')).height).toBeLessThan(board.y);
  expect((await cellBox(host, 0, 1)).y).toBeGreaterThan((await cellBox(host, 0, 5)).y);
});

test('move arrows point from the right counter to the right square on the turned board', async ({ openDevice }) => {
  const { friend, pages } = await startOnlineGame(openDevice);
  await setUpGame(pages, [Array(7).fill(IN), [IN, 2, IN, IN, IN, IN, IN]], MOON_SIDE);
  while (!(await rollOnce(pages))) await expectInStep(pages);
  const piece = friend.locator('.piece.movable').first();
  await piece.focus();
  const arrow = friend.locator('#arrow-preview');
  await expect(arrow).toBeVisible();
  const [end, landing] = await friend.evaluate(() => {
    const path = $('arrow-preview'),
      point = path.getPointAtLength(path.getTotalLength()),
      move = legalMoves(game.positions, game.turn, game.roll).find(
        (m) => `${game.turn}-${m.counter}` === document.activeElement.dataset.pid,
      );
    const r = landingElement(game.turn, move).getBoundingClientRect();
    return [
      { x: point.x - scrollX, y: point.y - scrollY },
      { x: r.x, y: r.y, width: r.width, height: r.height },
    ];
  });
  expect(end.x).toBeGreaterThanOrEqual(landing.x);
  expect(end.x).toBeLessThanOrEqual(landing.x + landing.width);
  expect(end.y).toBeGreaterThanOrEqual(landing.y);
  expect(end.y).toBeLessThanOrEqual(landing.y + landing.height);
});

// ---------- the end of a game ----------

// what each page has recorded of finished games
const recordOf = (page) =>
  page.evaluate(() => ({ games: lifetime.games, ms: lifetime.ms, online: { ...lifetime.online } }));

// the Sun has every counter home but one, a square from home, and the Moon has none out; play until the Sun brings
// it home
async function playToSunWin(pages) {
  const home = await pages[0].evaluate(() => currentRules.home);
  await setUpGame(pages, [[home - 1, ...Array(6).fill(home)], Array(7).fill(IN)], SUN_SIDE);
  while ((await pages[0].evaluate(() => game.phase)) !== 'over') {
    if (await rollOnce(pages)) await moveFirst(pages);
    await expectInStep(pages);
  }
}

test('a finished game is recorded once on each side', async ({ openDevice }) => {
  const { host, friend, pages } = await startOnlineGame(openDevice);
  const [hostBefore, friendBefore] = await Promise.all(pages.map(recordOf));
  await playToSunWin(pages);
  await expect
    .poll(() => recordOf(host))
    .toMatchObject({
      games: hostBefore.games + 1,
      online: { w: hostBefore.online.w + 1, l: hostBefore.online.l },
    });
  await expect
    .poll(() => recordOf(friend))
    .toMatchObject({
      games: friendBefore.games + 1,
      online: { w: friendBefore.online.w, l: friendBefore.online.l + 1 },
    });
  await expect(host.locator('#status')).toContainText('Victory is yours!');
  await expect(friend.locator('#status')).toContainText('Ted triumphs!');
  const friendAfter = await recordOf(friend);
  await friend.reload();
  await expect.poll(() => modeAndPhase(friend)).toEqual(['online', 'over']);
  await friend.waitForTimeout(500);
  expect(await recordOf(friend)).toEqual(friendAfter);
});

test('both players record the same time played', async ({ openDevice }) => {
  const { host, friend, pages } = await startOnlineGame(openDevice);
  await playToSunWin(pages);
  await expect.poll(() => friend.evaluate(() => lifetime.games)).toBe(1);
  await expect.poll(() => host.evaluate(() => lifetime.games)).toBe(1);
  expect((await recordOf(host)).ms).toBe((await recordOf(friend)).ms);
});

test('computer-only honours aren’t earned online, Good Company is', async ({ openDevice }) => {
  const { host, pages } = await startOnlineGame(openDevice);
  await playToSunWin(pages);
  await expect.poll(() => host.evaluate(() => Object.keys(honours.earned))).toContain('company');
  expect(await host.evaluate(() => Object.keys(honours.earned))).not.toContain('first-win');
  expect(await host.evaluate(() => honours.variantsWon)).toEqual([]);
});

test('the page’s own clock doesn’t run into the room’s figures', async ({ openDevice }) => {
  const { friend } = await startOnlineGame(openDevice);
  const before = await friend.evaluate(() => online.view.stats.playMs);
  await friend.waitForTimeout(2500);
  const [roomMs, shownMs] = await friend.evaluate(() => [online.view.stats.playMs, game.stats.playMs]);
  expect(roomMs).toBe(before);
  expect(shownMs).toBeGreaterThan(before); // the Stats window still counts the time
});

test('the variant can’t change while an online room is held between games', async ({ openDevice }) => {
  const { host, friend, pages } = await startOnlineGame(openDevice);
  await playToSunWin(pages);
  for (const page of pages) {
    await expect.poll(() => modeAndPhase(page)).toEqual(['online', 'over']);
    await expect(page.locator('#open-variants')).toBeDisabled();
  }
  await friend.locator('label[for=mode-ai]').click();
  await expect(friend.locator('#open-variants')).toBeEnabled();
  // once the other player has gone, the room is let go and the variant is free again
  await expect(host.locator('#status')).toContainText('Ann has left the game.');
  await expect(host.locator('#open-variants')).toBeEnabled();
});

test('rematch starts a new game for both', async ({ openDevice }) => {
  const { host, friend, pages } = await startOnlineGame(openDevice);
  const firstGame = await host.evaluate(() => game.roomGameId);
  await playToSunWin(pages);
  await expect(host.locator('#roll')).toHaveText('Rematch');
  await host.locator('#roll').click();
  await expect(friend.locator('#status')).toContainText('Ted wants a rematch');
  await expect(friend.locator('#roll')).toHaveText('Accept rematch');
  await friend.locator('#roll').click();
  for (const page of pages) {
    await expect.poll(() => modeAndPhase(page)).toEqual(['online', 'roll']);
    expect(await page.evaluate(() => game.roomGameId)).not.toBe(firstGame);
  }
  await expectInStep(pages);
});

test('leaving mid-game forfeits', async ({ openDevice }) => {
  const { host, friend, link } = await startOnlineGame(openDevice);
  await friend.locator('label[for=mode-ai]').click();
  await expect(friend.locator('#confirm-title')).toHaveText('Leave this game?');
  await expect(friend.locator('#confirm-text')).toHaveText('Leaving now counts as a loss.');
  await expect(friend.locator('#confirm-no')).toHaveText('Keep playing');
  await expect(friend.locator('#confirm-yes')).toHaveText('Leave and forfeit');
  await friend.locator('#confirm-yes').click();

  await expect(host.locator('#status')).toContainText('Ann has left the game.');
  await expect.poll(() => recordOf(host)).toMatchObject({ games: 1, online: { w: 1, l: 0 } });
  expect(await recordOf(friend)).toMatchObject({ games: 1, online: { w: 0, l: 1 } });
  await expect(host.locator('#room-note-dlg')).toBeHidden();

  // the friend is back on a page of their own, which the room no longer pulls back into the game
  await friend.locator('#newgame').click();
  await friend.waitForTimeout(500);
  expect(await modeAndPhase(friend)).toEqual(['ai', 'roll']);
  await expect(friend.locator('#game')).not.toHaveClass(/view-moon/);
  expect(await host.evaluate(() => lifetime.games)).toBe(1);

  const visitor = await openDevice(linkPath(link));
  await expect(visitor.locator('#room-note-text')).toContainText('has ended');
});

test('a leave made while the connection is down reaches the room once it’s back', async ({ openDevice }) => {
  const { host, friend } = await startOnlineGame(openDevice);
  const roomId = await friend.evaluate(() => online.roomId);
  // from here the friend's sockets go through the test, which cuts them off while `down`
  let down = true;
  await friend.routeWebSocket(/\/api\/rooms\/\w+\/ws/, (socket) => {
    if (down) socket.close();
    else socket.connectToServer();
  });
  await friend.evaluate(() => online.socket.close());
  await expect(host.locator('#status')).toContainText('Ann has lost connection');

  const gameId = await friend.evaluate(() => game.roomGameId);
  await friend.locator('label[for=mode-ai]').click();
  await friend.locator('#confirm-yes').click();
  expect(await recordOf(friend)).toMatchObject({ games: 1, online: { w: 0, l: 1 } });
  // the room hasn't heard, so the seat is kept until it has, with the game it leaves
  await friend.waitForTimeout(1000);
  expect(await friend.evaluate((roomId) => savedSeats()[roomId].leaving, roomId)).toEqual({ game: gameId });
  await expect(host.locator('#status')).not.toContainText('has left');

  down = false;
  await friend.evaluate(() => dispatchEvent(new Event('online')));
  await expect(host.locator('#status')).toContainText('Ann has left the game.');
  await expect.poll(() => recordOf(host)).toMatchObject({ games: 1, online: { w: 1, l: 0 } });
  await expect.poll(() => friend.evaluate(() => Object.keys(savedSeats()))).toEqual([]);
  expect(await recordOf(friend)).toMatchObject({ games: 1, online: { w: 0, l: 1 } });
  expect(await modeAndPhase(friend)).toEqual(['ai', 'setup']);
});

for (const [leaver, stayer, leaverName, stayerSide] of [
  ['friend', 'host', 'Ann', SUN_SIDE],
  ['host', 'friend', 'Ted', MOON_SIDE],
]) {
  test(`after the ${leaver} leaves, the ${stayer}’s board stays theirs`, async ({ openDevice }) => {
    const devices = await startOnlineGame(openDevice);
    const leaving = devices[leaver],
      staying = devices[stayer];
    await leaving.locator('label[for=mode-ai]').click();
    await leaving.locator('#confirm-yes').click();
    await expect(staying.locator('#status')).toContainText(`${leaverName} has left the game.`);
    await expect.poll(() => staying.evaluate(() => online.roomId)).toBeNull();
    // anything that redraws the board later still shows it from the stayer's side
    const after = await staying.evaluate(() => {
      render();
      return {
        side: mySide(),
        status: $('status').textContent,
        title: resultTitle(),
        subtitle: resultSubtitle(),
        turned: $('game').classList.contains('view-moon'),
      };
    });
    expect(after.side).toBe(stayerSide);
    expect(after.status).toContain(`${leaverName} has left the game.`);
    expect(after.title).toBe('Victory!');
    expect(after.subtitle).toContain(`against ${leaverName}`);
    expect(after.turned).toBe(stayerSide === MOON_SIDE);
    await expect(staying.locator('#share-result')).toBeVisible();
  });
}

test('a finished game seen again after a reload offers no card to share', async ({ openDevice }) => {
  const { friend, pages } = await startOnlineGame(openDevice);
  await playToSunWin(pages);
  await expect(friend.locator('#share-result')).toBeVisible();
  await friend.reload();
  await expect.poll(() => modeAndPhase(friend)).toEqual(['online', 'over']);
  await expect(friend.locator('#status')).toContainText('Ted triumphs!');
  await expect(friend.locator('#share-result')).toHaveCount(0);
});

test('keeping playing stays in the game', async ({ openDevice }) => {
  const { friend, pages } = await startOnlineGame(openDevice);
  await friend.locator('label[for=mode-ai]').click();
  await friend.locator('#confirm-no').click();
  expect(await modeAndPhase(friend)).toEqual(['online', 'roll']);
  await expect(friend.locator('#mode-online')).toBeChecked();
  if (await rollOnce(pages)) await moveFirst(pages);
  await expectInStep(pages);
});

test('leaving after a game records nothing more', async ({ openDevice }) => {
  const { host, friend, pages } = await startOnlineGame(openDevice);
  await playToSunWin(pages);
  await expect.poll(() => friend.evaluate(() => lifetime.games)).toBe(1);
  await expect.poll(() => host.evaluate(() => lifetime.games)).toBe(1);
  const [hostAfter, friendAfter] = await Promise.all(pages.map(recordOf));
  await friend.locator('label[for=mode-ai]').click();
  await expect(friend.locator('#confirm-dlg')).toBeHidden();
  expect(await modeAndPhase(friend)).toEqual(['ai', 'setup']);
  await expect(host.locator('#status')).toContainText('Ann has left the game.');
  await expect(host.locator('#roll')).toBeDisabled();
  await host.waitForTimeout(500);
  expect(await recordOf(host)).toEqual(hostAfter);
  expect(await recordOf(friend)).toEqual(friendAfter);
});

test('opening the site without the link offers to rejoin', async ({ openDevice }) => {
  const { host, friend, pages } = await startOnlineGame(openDevice);
  for (let turn = 0; turn < 2; turn++) {
    if (await rollOnce(pages)) await moveFirst(pages);
    await expectInStep(pages);
  }
  const context = friend.context();
  await friend.close();
  const back = await openDevice('/', { context });
  await expect(back.locator('#rejoin-dlg')).toBeVisible();
  await expect(back.locator('#rejoin-text')).toHaveText('Rejoin your game with Ted?');
  await expect(back.locator('#welcome-dlg')).toBeHidden();
  await back.locator('#rejoin-yes').click();
  await expect.poll(() => modeAndPhase(back)).toEqual(['online', 'roll']);
  await expectInStep([host, back]);
  expect(await back.evaluate(() => game.log.length)).toBe(3);
});

test('seats for ended rooms are forgotten quietly', async ({ openDevice, request }) => {
  // a room that never existed, and one its host has left
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const missing = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  const closed = await createRoomViaApi(request, 'Ted', 'classic');
  const closer = await openDevice('/');
  await closer.evaluate(
    ({ id, key }) =>
      new Promise((resolve) => {
        const socket = new WebSocket(`ws://${location.host}/api/rooms/${id}/ws?key=${key}`);
        socket.addEventListener('open', () => socket.send(JSON.stringify({ t: 'leave' })));
        socket.addEventListener('close', resolve);
      }),
    closed,
  );
  const seats = {
    [missing]: { key: 'a'.repeat(32), seat: 0, opponent: 'Ann', savedAt: 2 },
    [closed.id]: { key: closed.key, seat: 0, opponent: 'Bea', savedAt: 1 },
  };
  const back = await openDevice('/', { prepare: seedSeats(seats) });
  await expect.poll(() => savedRoomIds(back)).toEqual([]);
  await expect(back.locator('#rejoin-dlg')).toBeHidden();
});

test('turning down the offer to rejoin keeps the seat, and it’s offered again next time', async ({ openDevice }) => {
  const host = await openDevice('/');
  await inviteFriend(host, 'Ted');
  const roomId = await host.evaluate(() => online.roomId);
  const context = host.context();
  await host.close();
  const back = await openDevice('/', { context });
  await expect(back.locator('#rejoin-text')).toHaveText('Rejoin your game with your friend?');
  await back.locator('#rejoin-no').click();
  await expect(back.locator('#rejoin-dlg')).toBeHidden();
  expect(await savedRoomIds(back)).toEqual([roomId]);
  await back.close();
  const again = await openDevice('/', { context });
  await expect(again.locator('#rejoin-dlg')).toBeVisible();
});

test('the seat offered back is the one saved most recently', async ({ openDevice, request }) => {
  const older = await createRoomViaApi(request, 'Ted', 'classic'),
    newer = await createRoomViaApi(request, 'Ted', 'classic');
  // the newer seat comes first in the saved object, as an all-digit room id would
  const seats = {
    [newer.id]: { key: newer.key, seat: 0, opponent: 'Newer friend', savedAt: 2000 },
    [older.id]: { key: older.key, seat: 0, opponent: 'Older friend', savedAt: 1000 },
  };
  const back = await openDevice('/', { prepare: seedSeats(seats) });
  await expect(back.locator('#rejoin-text')).toHaveText('Rejoin your game with Newer friend?');
});
