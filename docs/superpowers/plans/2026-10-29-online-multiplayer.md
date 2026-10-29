# Online Play With a Friend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A third mode, Online, where a host invites one friend by link or QR code and the two play on their own
devices, with a Cloudflare Durable Object holding the one true copy of the game.

**Architecture:** The site moves from Pages to one Cloudflare Worker that serves `dist/` as static assets and
routes `/api/*` to a `Room` Durable Object (SQLite-backed, WebSocket hibernation). All game logic in the room
lives in a pure module, `worker/room-logic.mjs`, built on the page's own `js/rules.js` plus a new shared
`js/turns.js`, both wrapped into an ES module by a small generator. Browsers send intents and receive the room's
full state with a sequence number and the event that produced it; they animate events in order and never work
out the game themselves.

**Tech Stack:** Plain shared-scope browser scripts (no modules), Cloudflare Workers + Durable Objects via
`wrangler` 4.x, Node's test runner for unit tests, Playwright for browser tests, `qrcode-generator` 1.4.4
vendored.

**Spec:** `docs/superpowers/specs/2026-10-29-online-multiplayer-design.md`

## Global Constraints

- Every source file starts with the licence line:
  `/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */` (vendored
  files keep their own licence header instead).
- Page scripts stay plain, non-module, shared-scope scripts listed in `index.html` in load order; new ones are
  `js/[\w-]+.js` so `scripts/build.mjs` joins them, and are added to `sw.js`'s `CODE` list.
- Dependencies are pinned to exact versions (`npm install --save-exact`).
- Comments and copy match the existing voice: British spelling, plain words, curly apostrophes (’) in UI text.
- Commit messages follow the repo's style: a plain sentence subject, a prose body, **no** Co-Authored-By
  trailer and no `feat:` prefixes.
- `npm run check` passes at the end of every task.
- Host is always Sun (`SUN = 0`), friend always Moon (`MOON = 1`); first player chosen at random.
- Names: trimmed, inner whitespace collapsed, control characters removed, at most **20** characters, never empty;
  always inserted as text, never HTML.
- Room ids: 6 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ`. Links look like `https://<host>/#g=K7QXM2`.
- Seat keys: 32 hex characters from `crypto.getRandomValues`.
- Room expiry: **24 hours** idle in the lobby, **7 days** idle once a game has started.
- Online games: no Advice, Undo, danger shading or guided game; no "game will be lost" `beforeunload` warning.
- Computer-only honours never awarded online: `first-win`, `squire`, `knight`, `own-counsel`, `king`, `hunter`,
  `garden`. `traveller` counts wins against the computer only. Online wins and losses count towards streaks.

## Review Focus

1. **Events arriving while an animation is still playing** (the opponent lands on a rose and rolls again at
   once, or both a move and a roll arrive in one burst): both screens must end in the identical position. Pinned
   in Task 6 by `opponent's rose turn plays out in order on both screens`.
2. **Double presses and races:** a double-click on a counter sends two moves; both players press Rematch at the
   same instant. The second move is rejected quietly with no visible error, and exactly one new game starts.
   Pinned in Task 3 (`second move of a double-click is rejected`, `simultaneous rematch starts one game`) and
   Task 6.
3. **Unusual names:** `<b>Ann</b>`, emoji, 200 characters, only spaces. Shown as literal text, cut to 20, and an
   empty name is refused with a message. Pinned in Task 2 (`cleanName`) and Task 5 (`a name with markup shows as
text`).
4. **The same browser opening its own game twice** (the host taps their own invite link, or has two tabs open):
   it reconnects as its own seat, never as a joiner. The newer tab takes over and the older one says so. Pinned
   in Task 4 (`a second socket for a seat replaces the first`) and Task 5.
5. **Opening an invite link for a room that has expired or ended:** the visitor is told the game has ended and
   offered their own game, with no errors and no broken board. Pinned in Task 5 (`an ended room's link says so`).

---

## File map

| File                                                                                                                                               | Responsibility                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `js/turns.js` (new, shared)                                                                                                                        | Per-game stats and ledger wording for a move, with explicit `rules`; page + room |
| `scripts/shared-module.mjs` (new)                                                                                                                  | Wraps `js/rules.js` + `js/turns.js` into `worker/generated/shared.mjs` (ignored) |
| `worker/room-logic.mjs` (new)                                                                                                                      | Pure room state machine: seats, lobby, turns, clock, rematch, leave, public view |
| `worker/room.mjs` (new)                                                                                                                            | `Room` Durable Object: storage, sockets, broadcast, alarm expiry                 |
| `worker/index.mjs` (new)                                                                                                                           | Worker entry: `/api/*` routing to rooms, everything else to static assets        |
| `wrangler.jsonc` (new)                                                                                                                             | Worker, assets, Durable Object binding and migration, `e2e` environment          |
| `js/qrcode.js` (new, vendored)                                                                                                                     | `qrcode-generator` 1.4.4, MIT                                                    |
| `js/online.js` (new)                                                                                                                               | Seat storage, HTTP API calls, socket with reconnect, event queue, adopting state |
| `js/lobby.js` (new)                                                                                                                                | Online mode controls, invite / join / room-note / rejoin dialogs, leave confirm  |
| `css/lobby.css` (new)                                                                                                                              | Styles for the above                                                             |
| `js/game.js`, `js/board.js`, `js/stats.js`, `js/honours.js`, `js/newgame.js`, `js/controls.js`, `js/main.js`, `js/keyboard.js`                     | Online hooks                                                                     |
| `css/board.css` (and wherever trays and portraits are placed)                                                                                      | The turned board for the Moon player                                             |
| `index.html`, `sw.js`, `eslint.config.mjs`, `jsconfig.json`, `.prettierignore`, `.gitignore`, `package.json`, `playwright.config.mjs`, `README.md` | Wiring                                                                           |
| `tests/unit/turns.test.mjs`, `tests/unit/room-logic.test.mjs` (new)                                                                                | Unit tests                                                                       |
| `tests/e2e/online-helpers.mjs`, `tests/e2e/online.spec.mjs` (new)                                                                                  | Two-browser tests against `wrangler dev`                                         |

---

### Task 1: Shared turn record and the shared module

Move the per-move stats and ledger wording out of page globals so the room can use exactly the same code.

**Files:**

- Create: `js/turns.js`, `scripts/shared-module.mjs`, `tests/unit/turns.test.mjs`
- Modify: `js/stats.js:5-55` (remove `createSideStats`, `createGameStats`, `squaresToGo`, `recordMove`),
  `js/game.js:287-311` (`describeMove`, `applyMoveToGame` call the new signatures), `index.html` (load
  `js/turns.js` straight after `js/rules.js`), `sw.js` (`CODE` list), `package.json`, `.gitignore`,
  `.prettierignore`, `eslint.config.mjs`

**Interfaces:**

- Produces (page globals and module exports):
  - `createSideStats() -> SideStats`, `createGameStats() -> GameStats` (same shapes as today)
  - `squaresToGo(positions, side, rules) -> number`
  - `recordMove(stats, positionsAfter, side, move, landsOnRose, rules) -> void` (mutates `stats`; same
    arithmetic as today's `recordMove`, with `game.stats`/`game.positions`/`currentRules` replaced by parameters)
  - `describeMove(side, move, landsOnRose, again, rules) -> string` (today's wording, unchanged)
  - `worker/generated/shared.mjs` exporting: `SUN, MOON, SIDES, SIDE_NAME, IN_TRAY, MAX_ROLL, VARIANTS,
opponentOf, legalMoves, applyMove, rollsAgain, allHome, isRose, createGameStats, recordMove, describeMove`
  - npm script `build:shared` = `node scripts/shared-module.mjs`; `build` runs it before `scripts/build.mjs`;
    `test:unit` runs it before `node --test`.
- Note for every later task: `js/rules.js` defaults `rules = currentRules`, a page global. Server code always
  passes `rules` explicitly.

- [ ] **Step 1: Write the failing tests** in `tests/unit/turns.test.mjs`, importing from
      `../../worker/generated/shared.mjs`:
  - `recordMove counts a capture for the mover and a loss for the victim`: classic rules, Sun moves a counter
    from 5 to 7 capturing Moon counter 2 → `bySide[SUN].captures === 1`, `bySide[MOON].lost === 1`,
    `bySide[SUN].moves === 1`, `bySide[SUN].squaresTravelled === 2`.
  - `recordMove extends the rose chain`: two rose landings in a row → `roseChain === 2`,
    `longestRoseChain === 2`.
  - `describeMove words an entry with a capture`: `describeMove(SUN, {counter:0, from:0, to:4, captures:-1}, true,
true, VARIANTS.classic) === 'entered a piece to 4, landed on a rose and rolls again'`, and a home move reads
    `'brought a piece home'`.
- [ ] **Step 2: Run** `npm run test:unit`. Expected: FAIL (`scripts/shared-module.mjs` / the module missing).
- [ ] **Step 3: Implement** `js/turns.js`, then `scripts/shared-module.mjs`: read the two scripts in order, join
      them with `'\n;\n'` as the build does, append `export { …names above… };`, prefix a "generated, do not edit"
      line, write `worker/generated/shared.mjs`. Repoint `js/stats.js` and `js/game.js` to the new signatures
      (`recordMove(game.stats, game.positions, side, move, landsOnRose, currentRules)`). Add `worker/generated/`
      to `.gitignore`, `.prettierignore` and ESLint's `ignores`.
- [ ] **Step 4: Run** `npm run check`. Expected: all unit and browser tests pass, unchanged ones included.
- [ ] **Step 5: Commit** — subject `Share a move's stats and ledger wording between the page and the server`.

---

### Task 2: Room logic, the lobby

**Files:**

- Create: `worker/room-logic.mjs`, `tests/unit/room-logic.test.mjs`
- Modify: `eslint.config.mjs` (a block for `worker/**/*.mjs`: module, `globals.worker` plus
  `WebSocketPair: 'readonly'`)

**Interfaces:**

- Consumes: `worker/generated/shared.mjs` (Task 1).
- Produces (all pure; `now` is ms since epoch):
  - `ROOM_ID_ALPHABET`, `ROOM_ID_LENGTH = 6`, `NAME_MAX = 20`, `LOBBY_IDLE_MS = 24 * 3600_000`,
    `GAME_IDLE_MS = 7 * 24 * 3600_000`
  - `isRoomId(text) -> boolean`
  - `cleanName(raw) -> string | null` (null when nothing is left)
  - `createRoom(id, hostName, variant, hostKey, now) -> Room` (throws on a bad name or unknown variant)
  - `joinRoom(room, name, key, now) -> { room } | { error: 'full' | 'closed' | 'name' }`
  - `seatForKey(room, key) -> 0 | 1 | null`
  - `inviteInfo(room) -> { host: string, variant: string, status: 'open' | 'full' | 'closed' }`
  - `expiresAt(room) -> number` (`touched + LOBBY_IDLE_MS` in the lobby, else `touched + GAME_IDLE_MS`)
  - `Room` shape: `{ id, variant, seats: [{name, key} | null, {name, key} | null], phase: 'lobby' | 'roll' |
'move' | 'over' | 'closed', gameNo, positions, turn, roll, dice, winner, endedBy: null | 'win' |
'forfeit', log: string[], stats, rematch: [bool, bool], connected: [bool, bool], clockFrom: number | null,
seq, touched }`
  - `publicState(room, seat) -> RoomView`: everything except seat keys and `clockFrom`, plus
    `you: seat`, `names: [string, string | null]`, `gameId: \`${id}-${gameNo}\``.

- [ ] **Step 1: Write the failing tests** in `tests/unit/room-logic.test.mjs`:
  - `cleanName`: `'  Ann   Lee '` → `'Ann Lee'`; `'\u0007Bob'` → `'Bob'`; 200 × `'a'` → 20 × `'a'`; `'   '` →
    `null`; `'<b>Ann</b>'` → `'<b>Ann</b>'` (kept as text; escaping is the page's job).
  - `isRoomId`: `'K7QXM2'` true; `'k7qxm2'`, `'K7QXM'`, `'K7QXM0'` (no 0), `'../x'` false.
  - `createRoom` puts the host in seat 0, phase `'lobby'`, seq 0; unknown variant throws.
  - `joinRoom` fills seat 1; a second join returns `{ error: 'full' }`; a join on a `'closed'` room returns
    `{ error: 'closed' }`; a blank name returns `{ error: 'name' }`.
  - `seatForKey` returns 0/1 for the right keys and `null` for an unknown key.
  - `inviteInfo` is `'open'` → `'full'` after joining → `'closed'` after closing.
  - `publicState never includes a seat key` (`JSON.stringify` contains neither key).
  - `expiresAt` is 24 h after the last touch in the lobby and 7 days after once started.
- [ ] **Step 2: Run** `npm run test:unit`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** those functions in `worker/room-logic.mjs`. `cleanName` strips `\p{Cc}` and `\p{Cf}`,
      collapses `\s+`, trims, and slices by code points (`[...text].slice(0, NAME_MAX)`), so emoji aren't split.
- [ ] **Step 4: Run** `npm run test:unit`. Expected: PASS.
- [ ] **Step 5: Commit** — `Add the online room's lobby: names, seats and invites`.

---

### Task 3: Room logic, play

**Files:**

- Modify: `worker/room-logic.mjs`, `tests/unit/room-logic.test.mjs`

**Interfaces:**

- Produces:
  - `applyIntent(room, seat, intent, now, rng, { testHooks = false } = {}) -> { room, event } | { error }`
    - Intents: `{t:'start'}` (host only, in `'lobby'`), `{t:'roll'}`,
      `{t:'move', counter}`, `{t:'rematch'}`, `{t:'leave'}`, and, only with `testHooks`,
      `{t:'test-set', positions, turn}`.
    - Errors: `'not-your-turn'`, `'wrong-phase'`, `'illegal'`, `'paused'`, `'not-host'`, `'not-ready'`.
    - Events: `{kind:'start', first}`, `{kind:'roll', side, dice, roll, passed}`,
      `{kind:'move', side, move, landsOnRose, again, finished}`, `{kind:'rematch-offer', seat}`,
      `{kind:'left', seat, forfeit}`.
  - `setConnected(room, seat, connected, now) -> { room, event: {kind:'presence'} }`
  - Every successful call increments `room.seq` by exactly 1 and sets `room.touched = now`.
- `rng` is `() => number` in [0, 1); dice are 4 throws of `rng() < 0.5 ? 1 : 0`, first player
  `rng() < 0.5 ? SUN : MOON`.

Behaviour the tests pin (from the spec and today's `js/game.js`):

- `start`: host only, both seats filled, phase `'lobby'`; new positions for the variant, stats from
  `createGameStats()`, `gameNo += 1`, log `["<Name> goes first."]`, phase `'roll'`.
- `roll`: only the side to move, only in `'roll'`, and only while **both** `connected` → otherwise `'paused'`.
  Records `rolls` and `rollCounts`. With no legal move: increments `passes`, logs
  `"<Name> rolled N: no move"`, turn passes, phase `'roll'`, event `passed: true`. Otherwise phase `'move'`.
- `move`: the `counter` must match one of `legalMoves(positions, turn, roll, rules)`; applies it, calls
  `recordMove`, logs `"<Name> rolled N: " + describeMove(…)`. Finishing sets `winner`, `endedBy: 'win'`, phase
  `'over'`. Otherwise `rollsAgain` keeps the turn, else the turn passes and `roseChain` resets, as `endTurn` does.
- Clock: while phase is `'roll'` or `'move'` and both are connected, time accrues to `stats.playMs` and to
  `bySide[turn].msOnTurn`. `clockFrom` is settled on every call (`setConnected` included) before the state
  changes.
- `rematch`: only in `'over'` with `endedBy: 'win'`. Sets `rematch[seat]`. The first emits `rematch-offer`; when
  both are set, a new game starts as `start` does, with the same seats and variant and a fresh random first
  player.
- `leave`: during `'roll'`/`'move'` → `winner` is the other seat, `endedBy: 'forfeit'`, log
  `"<Name> left the game."`, then phase `'closed'`, event `forfeit: true`. In `'lobby'` or `'over'` → phase
  `'closed'`, `forfeit: false`. Any intent on a closed room → `'wrong-phase'`.

- [ ] **Step 1: Write the failing tests** (seeded `rng` as in `tests/unit/rules.test.mjs`; a helper starts a
      two-seat room with both connected):
  - `only the host can start, and only with two players`
  - `rolling is refused while either player is disconnected` (`{ error: 'paused' }`; after reconnecting, it works)
  - `rolling out of turn is refused`, `moving before rolling is refused`
  - `an illegal counter is refused`
  - `second move of a double-click is rejected` (the same `move` intent twice → the second returns `'wrong-phase'`
    or `'not-your-turn'`, and the state is unchanged)
  - `a roll with no move passes the turn and logs it`
  - `landing on a rose keeps the turn`
  - `bringing the last counter home wins` (set positions with `test-set` under `testHooks`, then roll and move)
  - `test-set is refused without testHooks`
  - `the clock only runs with both players connected` (1 s connected, 5 s with Moon away, 1 s back → `playMs`
    is 2000)
  - `simultaneous rematch starts one game` (both seats send `rematch` → exactly one `start`, `gameNo` +1, a third
    `rematch` from either seat → `'wrong-phase'`)
  - `leaving mid-game forfeits to the other player`
  - `leaving between games closes the room without a winner change`
  - `seq rises by one on every accepted intent and not on a refused one`
- [ ] **Step 2: Run** `npm run test:unit`. Expected: FAIL.
- [ ] **Step 3: Implement** `applyIntent` and `setConnected` in `worker/room-logic.mjs`.
- [ ] **Step 4: Run** `npm run test:unit`. Expected: PASS.
- [ ] **Step 5: Commit** — `Play online games in the room: turns, the clock, rematches and forfeits`.

---

### Task 4: The Worker, the Durable Object and the move from Pages

**Files:**

- Create: `worker/index.mjs`, `worker/room.mjs`, `wrangler.jsonc`, `tests/e2e/online-helpers.mjs`,
  `tests/e2e/online-api.spec.mjs`
- Modify: `package.json` (`wrangler` devDependency, exact 4.x; scripts `dev` = `npm run build && wrangler dev`),
  `playwright.config.mjs`, `.github/workflows/ci.yml` (only if `wrangler dev` needs an env var to stay
  non-interactive, such as `WRANGLER_SEND_METRICS=false`)

**Interfaces:**

- Consumes: `room-logic.mjs` (Tasks 2–3).
- `wrangler.jsonc`: `name: "ur"`, `main: "worker/index.mjs"`, `compatibility_date` = the day of the task,
  `assets: { directory: "./dist", binding: "ASSETS", run_worker_first: ["/api/*"] }`,
  `durable_objects.bindings: [{ name: "ROOMS", class_name: "Room" }]`,
  `migrations: [{ tag: "v1", new_sqlite_classes: ["Room"] }]`, and `env.e2e` repeating the Durable Object
  binding (bindings aren't inherited) with `vars: { TEST_HOOKS: "1" }`.
- HTTP API (JSON bodies, `Cache-Control: no-store`):
  - `POST /api/rooms` `{name, variant}` → `201 {id, key, seat: 0}` · `400 {error: 'name' | 'variant'}`. The
    Worker picks the id. The room's `/create` returns 409 if the id is taken, and the Worker retries with a new id
    (up to 5 tries).
  - `GET /api/rooms/:id` → `200 inviteInfo` · `404 {error: 'missing'}` (bad id, never created, or expired).
  - `POST /api/rooms/:id/join` `{name}` → `200 {key, seat: 1}` · `409 {error: 'full'}` ·
    `410 {error: 'closed'}` · `400 {error: 'name'}` · `404`.
  - `GET /api/rooms/:id/ws?key=…` with `Upgrade: websocket` → `101` · `403 {error: 'seat'}` · `404`.
  - Anything else under `/api/` → `404`. Everything outside `/api/` → `env.ASSETS.fetch(request)`.
- Socket protocol:
  - Browser → room: the intents from Task 3, as JSON.
  - Room → browser: `{type: 'state', seq, event, state}`, where `event` is null on connecting, and
    `{type: 'error', code}` sent only to the sender.
  - Close code `4000` (`'replaced'`): another tab took this seat. `4001` (`'closed'`): the room has ended.
- `Room` Durable Object: `extends DurableObject` from `cloudflare:workers`; loads `room` from
  `ctx.storage.get('room')` in `blockConcurrencyWhile`; `ctx.acceptWebSocket(ws, [String(seat)])` with
  `serializeAttachment({seat})`. A new socket for a seat closes older ones with 4000. On connect and on close,
  `setConnected` runs from the count of open sockets for that seat. It broadcasts each seat its own
  `publicState`, persists after every change, and sets the alarm to `expiresAt(room)` after every change. The
  alarm deletes all storage if the room has expired, so the room reads as `404 missing` afterwards; otherwise it
  re-arms. RNG and keys use `crypto.getRandomValues`.
- `tests/e2e/online-helpers.mjs` exports `ONLINE_URL = 'http://localhost:8787'`,
  `createRoomViaApi(request, name, variant)`, `joinViaApi(request, id, name)`, and (in Task 5)
  `hostAndJoin(browser, {hostName, friendName, variant})` returning `{host, friend, roomId}` pages.
- `playwright.config.mjs`: `webServer` becomes an array: the existing static server plus
  `{ command: 'npm run build && npx wrangler dev --env e2e --port 8787', url: 'http://localhost:8787',
reuseExistingServer: !CI, timeout: 120_000 }`.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/online-api.spec.mjs` (Playwright `request` fixture,
      `baseURL: ONLINE_URL`):
  - `creating a room returns an id and a key`, matching `/^[23456789A-HJKMNP-Z]{6}$/` and `/^[0-9a-f]{32}$/`
  - `invite info names the host and variant and never the key`
  - `the second join is told the game is full` (`409`, `{error: 'full'}`)
  - `a blank name is refused` (`400`, `{error: 'name'}`)
  - `an unknown room is missing` (`404`)
  - `a socket without the right key is refused` (`403`)
  - `a second socket for a seat replaces the first` (open two sockets with the host key from Node's global
    `WebSocket`; the first gets close code `4000`)
  - `the site itself is still served` (`GET /` → 200, HTML containing `Royal Game of Ur`)
- [ ] **Step 2: Run** `npx playwright test online-api`. Expected: FAIL (no Worker yet).
- [ ] **Step 3: Implement** `wrangler.jsonc`, `worker/index.mjs` and `worker/room.mjs` to the interfaces above.
- [ ] **Step 4: Run** `npx playwright test online-api`, then `npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** — `Serve the site from a Worker with a Durable Object for online rooms`.

---

### Task 5: Inviting and joining in the page

**Files:**

- Create: `js/qrcode.js` (vendored, copied from `npm pack qrcode-generator@1.4.4`, `qrcode.js` only, MIT header
  kept), `js/online.js`, `js/lobby.js`, `css/lobby.css`, `tests/e2e/online.spec.mjs`
- Modify: `index.html` (mode radio, name field, four dialogs, script and stylesheet tags), `sw.js` (`CODE` list;
  skip `/api/`; cache `ur-v12`), `js/newgame.js`, `js/controls.js`, `js/board.js` (`renderSetupControls`,
  `renderStatus`), `js/game.js` (`createGameState`, `playerName`), `js/main.js`, `js/prefs.js` (`name: ''`),
  `eslint.config.mjs`, `jsconfig.json` and `.prettierignore` (leave out `js/qrcode.js`)

**Interfaces:**

- Consumes: the HTTP API and socket protocol (Task 4).
- Markup ids (`index.html`):
  - `#mode-online` (value `online`, label "Online") in the existing `.seg`
  - `#name-field` > `#player-name` (`maxlength="20"`, `autocomplete="nickname"`), shown only in Online mode
  - `#invite-dlg`: `#invite-qr`, `#invite-link`, `#invite-copy`, `#invite-share` (hidden without
    `navigator.share`), `#seat0`, `#seat1`, `#invite-start`, `#invite-cancel`
  - `#join-dlg`: `#join-host`, `#join-rules`, `#join-name`, `#join-go`, `#join-wait` (the waiting view),
    `#join-error`
  - `#room-note-dlg`: `#room-note-text`, `#room-note-own` ("Start your own game")
  - `#rejoin-dlg`: `#rejoin-text`, `#rejoin-yes`, `#rejoin-no`
- `js/online.js` produces:
  - `const online = { roomId: null, seat: null, socket: null, seq: 0, queue: [], busy: false, view: null }`
  - `savedSeats() -> {[roomId]: {key, seat, opponent}}` and `saveSeat(roomId, entry)`, `forgetSeat(roomId)`
    (`localStorage` `'ur-seats-v1'`)
  - `roomApi(method, path, body?) -> Promise<{status, data}>`
  - `inviteLink(roomId) -> string` (`location.origin + '/#g=' + roomId`)
  - `connectRoom(roomId) -> void`: opens `/api/rooms/:id/ws?key=…` (`wss:` on `https:` pages, `ws:` otherwise), reconnects after 1, 2, 4, 8, then
    every 15 s, and immediately when the page becomes visible. It does not reconnect after close code 4000 or 4001.
  - `sendIntent(intent) -> void`
  - `onRoomState(handler)`: lobby and game code subscribe here to `{type: 'state', seq, event, state}` and
    `{type: 'error', code}`.
- `js/lobby.js` produces: `startInviting()`, `openInvite(roomId)`, `showJoin(roomId)`,
  `showRoomNote(kind: 'full' | 'ended')`, `offerRejoin()`.
- `game.mode` gains `'online'`, with `game.names = [string, string | null]` from the room; `playerName(side)`
  returns `game.names[side]` in online games.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/online.spec.mjs` (two browser contexts against
      `ONLINE_URL`; `hostAndJoin` in `online-helpers.mjs` drives the UI):
  - `host invites, friend joins, host starts`: the host chooses Online, types "Ted", presses Invite a friend.
    `#invite-link` holds a `#g=` link and `#invite-qr` contains an SVG. The friend opens the link, sees
    "Ted has invited you", types "Ann" and joins. The host's `#seat1` reads "Ann" and `#invite-start` is enabled;
    pressing it puts both pages in `game.mode === 'online'`, phase `'roll'`.
  - `a third visitor is told the game is full` (a third context opens the link → `#room-note-text` contains
    "already has two players")
  - `an ended room's link says so` (the host presses Cancel invite; the friend's tab, and a fresh visit, show
    "has ended")
  - `the host opening their own link rejoins as host` (in the host's context, a new page at the link opens
    the invite panel as host, not `#join-dlg`)
  - `a name with markup shows as text` (friend name `<b>Ann</b>` → `#seat1`'s `textContent` is `<b>Ann</b>` and it
    has no `b` element)
  - `an invite link skips the welcome` (a `newPlayer` context opening the link never shows the splash)
  - `the last name is remembered` (a second invite in the same context finds `#player-name` already filled)
- [ ] **Step 2: Run** `npx playwright test online.spec`. Expected: FAIL.
- [ ] **Step 3: Implement.** In Online mode, `#newgame` reads "Invite a friend" and calls `startInviting()`.
      `main.js` checks `location.hash` for `g=` before `showSetupBoard()`/`offerGuidedGame()`. With a saved seat
      for that room it calls `openInvite` (host) or connects straight away. Otherwise it fetches the invite info
      and calls `showJoin` or `showRoomNote`. The QR code is drawn with `qrcode(0, 'M')`, `createSvgTag`, in
      `--ink` on `--bone`. The `sw.js` fetch handler returns early, before any `respondWith`, for paths starting
      `/api/`. Names are always set with `textContent`, or escaped where HTML strings are built.
- [ ] **Step 4: Run** `npx playwright test online.spec`, then `npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** — `Invite a friend to an online game by link or QR code`.

---

### Task 6: Playing an online game in step

**Files:**

- Modify: `js/online.js` (queue and adopting state), `js/game.js`, `js/board.js` (`renderRollOrAdvise`,
  `statusText`, `turnTag`, `renderTray`), `js/controls.js`, `js/keyboard.js`, `js/newgame.js`
  (`hasProgressToLose` false online), `js/advice.js` / `js/danger.js` / `js/undo.js` (off online, if their guards
  don't already cover it), `tests/e2e/online.spec.mjs`

**Interfaces:**

- Consumes: `online`, `sendIntent`, `onRoomState` (Task 5), and the `Room` view (Task 2).
- Produces in `js/online.js`:
  - `adoptRoomState(view) -> void`: sets `currentRules = VARIANTS[view.variant]` and maps the view onto `game`
    (`positions`, `turn`, `phase` (`'lobby'` → `'setup'`, `'closed'` → `'over'`), `roll`, `dice`, `winner`,
    `log`, `stats`, `names`, `gameId`), saves the opponent's name into this room's saved seat (for the rejoin
    offer), then `render()`.
  - `playRoomMessage(msg, done) -> void`: if `msg.seq !== online.seq + 1`, or there's no event, or the page is
    hidden, it adopts the state at once with no animation. Otherwise it animates the event:
    - `roll`: the dice tumble and land on `event.dice`. When `passed`, the pass note shows for `DELAY.pass`.
    - `move`: `animateHops(side, move, …)`, then the landing effects and `reactToMove`.

    Then it adopts `msg.state`. Messages run strictly one at a time from `online.queue`.

  - `isOnline() -> boolean`, `mySide() -> side` (`online.seat` online, else `HUMAN_SIDE`), and
    `canAct(side) -> boolean` (not the computer and, online, `side === online.seat`). These go in `js/game.js`
    so the existing scripts can use them.
- In online games, `rollDice()` and `makeMove(move)` only `sendIntent` (rolling and moving, respectively) and
  mark the phase `'rolling'`/`'animating'` locally so a second press does nothing. They never call `throwDice`,
  `recordMove` or `writeToLedger`; stats and the ledger come from the room. `continueGame()` only schedules the
  auto-move for your own single forced move. The presence note "‹Name› has lost connection…" shows in the
  status hint while `!view.connected[other]`.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/online.spec.mjs`:
  - `both screens agree after several turns`: play 12 turns, where whoever's turn it is presses Roll and then
    clicks the first movable counter. After each turn, wait until both pages' `game.positions`, `game.turn` and
    `game.log` are deep-equal.
  - `you can't roll on your friend's turn` (`#roll` disabled, and R does nothing)
  - `opponent's rose turn plays out in order on both screens` (`test-set` sent through the page's own socket with `sendTestIntent(page, intent)` from
    `online-helpers.mjs` (`page.evaluate` calling `sendIntent`) to put a Sun counter one short of a rose; Sun rolls and moves, then rolls and moves again at once. Both pages
    end deep-equal, and the friend's ledger shows both moves in order.)
  - `double-clicking a counter makes one move` (a double click → `game.log` grows by one line, no error note)
  - `reloading mid-game puts you back where you were` (the friend reloads → same positions, turn and log)
  - `the host sees the friend drop out, and the game waits` (the friend's page closes → the host's status says
    "Ann has lost connection" and `#roll` is disabled. The friend reopens the link → play resumes.)
  - `advice, undo and danger shading are not offered online`
- [ ] **Step 2: Run** `npx playwright test online.spec`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** to the interfaces above.
- [ ] **Step 4: Run** `npx playwright test online.spec`, then `npm run check`. Expected: PASS, with the
      existing single-device tests unchanged.
- [ ] **Step 5: Commit** — `Play online games in step on both devices`.

---

### Task 7: The board turned for the friend

**Files:**

- Modify: `js/board.js` (a `view-moon` class on `#game`, set in `render()` from `mySide()`), `css/board.css`
  and the stylesheet that places trays and portraits, `js/board.js` `drawRouteDiagram`/arrows if they use
  absolute rows, `tests/e2e/online.spec.mjs`

**Interfaces:**

- Consumes: `mySide()` (Task 6), `mirrorRow` in `js/rules.js`.
- Produces: `#game.view-moon` when the player is Moon in an online game. The rows of the board are mirrored top
  to bottom (not rotated: columns stay put, so the Moon player's route runs right to left along the bottom as
  Sun's does). `#tray1` and `#portrait1` move below the board, and `#tray0` and `#portrait0` move above it.

- [ ] **Step 1: Write the failing tests:**
  - `the friend sees their own pieces at the bottom`: on the friend's page, `#tray1`'s top is greater than
    `#board`'s bottom, and the cell for `routeCell(MOON, 1)` sits below the cell for `routeCell(MOON, 5)` (the
    shared row).
  - `the host's board is unchanged` (`#tray0` below `#board`, as in a computer game)
  - `move arrows point from the right counter to the right square on the turned board` (on the friend's turn, the
    preview arrow's end lies inside the landing cell's box)
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** with CSS grid placement keyed off `.view-moon` (explicit `grid-row` per board row,
      swapped tray and portrait areas). The route overlay and arrows are measured from the DOM, so check they
      follow.
- [ ] **Step 4: Run** `npm run check`. Expected: PASS. Then compare screenshots of both seats at 390 px and
      1280 px by eye.
- [ ] **Step 5: Commit** — `Turn the board for the friend so their pieces sit at the bottom`.

---

### Task 8: The end of an online game: records, honours, rematch and leaving

**Files:**

- Modify: `js/stats.js` (`recordGame`, lifetime `online: { w: 0, l: 0 }`, Stats window line), `js/honours.js`
  (`honourCheckFor`, the `first-win` test, `variantsWon`), `js/game.js` (`finishGame` online path, `tally`
  gains `onlineWon`, `onlineLost`), `js/board.js` (`renderTally`, roll button "Rematch" / "Accept rematch",
  `statusText` for `'over'` online and forfeits), `js/online.js`, `js/lobby.js`, `js/newgame.js`
  (`confirmAbandonGame` text when online), `js/card.js` (names on the result card), `tests/e2e/online.spec.mjs`

**Interfaces:**

- Consumes: the `Room` view, including `endedBy`, `rematch`, `gameId` and `stats` (Tasks 2–3).
- Produces:
  - `recordOnlineGame(view) -> boolean`: records it at most once per `view.gameId`, tracked in `localStorage`
    `'ur-online-recorded-v1'` (the last 50 ids), and returns whether it recorded. It sets
    `game.stats = view.stats`, calls `recordGame(view.winner)` (online path: `lifetime.online.w`/`.l` from
    `mySide()`, streak as for computer games), then `awardHonours`, `saveTally`.
  - `honourCheckFor(winner)` uses `mySide()` and the opponent: `won = (vsComputer || online) && winner ===
mySide()`, `vsComputer = mode === 'ai'`, `level = vsComputer ? game.level : null`. `first-win` tests
    `g.won && g.vsComputer`. A win is added to `variantsWon` only when `check.won && check.vsComputer`.
  - The confirm dialog online reads: title "Leave this game?", text "Leaving now counts as a loss.", buttons
    "Keep playing" / "Leave and forfeit". The leaver records its loss locally from its current state with the
    same game id (so it's never counted twice), then sends `{t: 'leave'}`.
  - Status online when over: "‹Name› triumphs!" or "Victory is yours!", and on a forfeit
    "‹Name› has left the game." with your win.
- [ ] **Step 1: Write the failing tests:**
  - `a finished game is recorded once on each side` (`test-set` near the end, Sun wins. On both pages
    `lifetime.games` +1. The host gets `lifetime.online.w` +1 and the friend `lifetime.online.l` +1. After the
    friend reloads, the numbers are unchanged.)
  - `both players record the same time played` (`lifetime.ms` is equal on both pages)
  - `computer-only honours aren't earned online, Good Company is` (a fresh winner gains `company` and not
    `first-win`)
  - `rematch starts a new game for both` (the winner presses Rematch. The loser's status says
    "Ted wants a rematch" and their button reads "Accept rematch". After accepting, both pages are in phase
    `'roll'` with a new `gameId`.)
  - `leaving mid-game forfeits` (the friend switches mode and confirms. The host sees "Ann has left the game." and
    records a win, the friend records a loss, and the link then shows "has ended".)
  - `leaving after a game records nothing more` (counts unchanged after leaving at the end banner)
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** to the interfaces above.
- [ ] **Step 4: Run** `npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** — `Record online games, offer rematches and count leaving as a loss`.

---

### Task 9: Coming back without the link, and the docs

**Files:**

- Modify: `js/main.js`, `js/lobby.js` (`offerRejoin`), `README.md`, `tests/e2e/online.spec.mjs`

**Interfaces:**

- Consumes: `savedSeats()`, `roomApi` (Task 5).
- Behaviour: at start-up with no `#g=`, for each saved seat (newest first) `GET /api/rooms/:id`. Seats for rooms
  that return `404` or `closed` are forgotten. For the first live one, `#rejoin-dlg` reads
  "Rejoin your game with ‹opponent›?". Yes connects to it, and No leaves the seat saved (asked again next time).
  This happens instead of the guided-game offer.
- [ ] **Step 1: Write the failing tests:**
  - `opening the site without the link offers to rejoin` (the friend's context visits `/` mid-game →
    `#rejoin-dlg` names "Ted"; Yes → the board as it stands)
  - `seats for ended rooms are forgotten quietly` (after a forfeit, visiting `/` shows no rejoin offer and
    `'ur-seats-v1'` no longer holds the room)
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, then update `README.md`: the feature list (Online), "Run locally" (`npm run dev` →
      `wrangler dev` at `http://localhost:8787`, needed for online play; the static server still works for
      everything else), the project layout table (new files and `worker/`), and replace "Deploy to Cloudflare
      Pages" with "Deploy to Cloudflare Workers": connect the repo with Workers Builds, build command
      `npm run build`, deploy command `npx wrangler deploy`, then move `ur.littleberrylodge.co.uk` from the Pages
      project to the Worker and retire the Pages project.
- [ ] **Step 4: Run** `npm run check` and `npm run lighthouse`. Expected: everything passes and Lighthouse
      performance stays at or above 0.9.
- [ ] **Step 5: Commit** — `Offer to rejoin an online game, and document online play and the Worker`.
