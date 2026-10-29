# Online play with a friend: design

Date: 2026-10-29

## Why

The game has two modes today: against the computer, and two players passing one device. People want to play a
friend on their own devices, either on the sofa side by side or far apart over an evening. The site is already on
Cloudflare, so Durable Objects are the natural place to keep a shared game.

## What it is

A third mode, **Online**. The host enters their name, picks a variant and presses **Invite a friend**. They get a
link and a QR code to share. The friend opens the link on their own device, enters their name and joins. Only
the host can start the game. The two then play a normal game of Ur, each on their own screen, with each player's
own pieces along the bottom of the board.

## Goals

- A host can create a game, share it by link or QR code, and start it once one friend has joined.
- **Exactly one other person can join.** After that the game belongs to those two devices; nobody else can take a
  seat, including while one player is disconnected.
- **The devices never fall out of step.** This is what would make the feature a failure even if everything else
  worked. Both screens always show the same game.
- Either player can close the tab, lose signal or lock their phone, then reopen the link on the same device and
  carry on from where the game stands.
- When a game ends, either player can offer a **rematch** in the same room.
- Online games count towards each player's own lifetime stats, and honours that are not about the computer can be
  earned in them.

## Non-goals

- Accounts, sign-in, friend lists, matchmaking with strangers, lobbies of open games.
- Chat or emotes.
- Spectators, or more than two players.
- Taking a seat back from a different device or browser. Rejoining works only from the device and browser that
  joined.
- Playing online while offline. Online play needs a connection; the rest of the site still works offline.
- Advice, Undo, danger shading and the guided game in online games.

## Anti-goals

- **The two devices disagreeing about the game,** whether over a move, a roll, whose turn it is, or who won.
- A stranger with the link taking over a seat.
- Online work breaking or slowing the existing single-device game, its offline support or its Lighthouse score.

## The flow (as agreed with a mockup)

**Host**

1. The mode switch gains a third choice, **Online**, beside "Vs computer" and "Two players". In Online mode the
   Opponent picker is hidden. A **Your name** field appears, and the Variant picker works as usual.
2. **Invite a friend** creates the room and opens an invite panel with the QR code, the link, **Copy link**,
   **Share…** (the device's own share sheet, where `navigator.share` exists), and two seats: the host's name (Sun)
   and "Waiting for a friend…" (Moon). **Start game** is disabled.
3. When the friend joins, their name fills the Moon seat and **Start game** becomes active.

**Friend**

1. Opening the link shows "‹Host› has invited you to play the Royal Game of Ur", the rules in play, a **Your name**
   field and **Join**.
2. After joining they see both seats and "Waiting for ‹Host› to start the game…".
   They can **Leave** from there, which frees their seat: the host's panel goes back to "Waiting for a
   friend…" and the link still works for someone else (a host leaving the lobby still closes the room).
3. When the host starts, both devices go to the board.

**A full room.** Anyone else who opens the link sees "This game already has two players" and a way to start their
own game. The same happens if the link is for a room that no longer exists.

## During play

- The host is always **Sun** and the friend is always **Moon**. Who moves first is chosen at random, as now.
- **The board is turned for the friend:** on the Moon player's device, Moon's row and tray are drawn at the
  bottom and Sun's at the top, as if sitting across the table. Routes, arrows, the route overlay and danger
  geometry follow.
- Names replace "Sun" and "Moon" in the portraits, ledger, notes, banner and result card. Your own side may read
  "You" wherever the computer game says "You".
- You can only roll and move on your own turn. On the other player's turn your Roll button and pieces are
  inactive, and their roll and move play out on your screen with the usual animation, sounds and speech.
- Auto-move of a single forced move (the existing preference) still applies, but only to your own turn.
- Advice, Undo and danger shading are not offered.
- The "you'll lose this game" warning when closing the tab does not appear for online games.
- **Disconnects.** If a player's connection drops, the other sees "‹Name› has lost connection…" and **the whole
  game pauses**: the room accepts no rolls or moves from either seat until both are connected again (_my call_; it
  means nobody can miss the end of a game). Anything already under way when the connection drops (a roll or a
  move the room has accepted) still completes. There is no time limit on a turn. Reopening the link (or the
  connection coming back) puts the player back into the game as it stands.
- **Leaving mid-game counts as a loss** (decided). Starting something else during an online game in progress
  (switching mode, New game, making a new invite) first asks "Leave and forfeit this game?", reusing the existing
  confirm dialog. Leaving sends an explicit leave message, distinct from a socket closing. The leaver records a
  loss and the other player a win, both in stats and streaks. The other player sees "‹Name› has left the game"
  with their win, and the room closes: the link then shows that the game has ended. Closing the tab is a
  disconnect, not leaving. Leaving between games (after the end banner, before a rematch) also closes the room,
  but records nothing.
  A leave the room doesn't hear (the connection down, say) is kept and said again whenever the page might reach
  the room (loading, coming back online, being looked at again); the seat is only forgotten once the room confirms.
  The leave names the game it was meant for (none, in the lobby): one that arrives after another game has begun
  ends the room as a leave between games would, with no forfeit.
- **Coming back without the link** (_my call_). When the site starts and this browser holds a seat key for a room
  that is still live, it offers "Rejoin your game with ‹Name›" in place of the usual start. Separate browser
  storage (for example an installed iPhone app and Safari) counts as a different device, under the non-goals.

## After a game

- Both players see the usual end banner, honours note and result card.
- The "Play again" action becomes **Rematch**. Whoever presses it first, the other sees "‹Name› wants a rematch"
  with **Accept**. Once accepted, a new game starts in the same room with the same seats and variant, and the
  first player is chosen at random again.
- Either player can leave by starting something else (for example switching mode), which tells the other player
  that their opponent has left and closes the room (see Leaving, above).

## Records

- Each player's browser records the finished online game in its own lifetime stats (games, rolls, moves,
  captures and so on, as now).
- The win tally gains an **online** count of wins and losses, kept separate from "you vs computer" and "Sun vs Moon".
- **Honours:** the honour tests look at the game from the player's own side (Sun for the host, Moon for the
  friend). Honours that are about the computer cannot be earned online: First Victory, Squire Bested, Knight
  Unhorsed, Own Counsel, The King Dethroned, Hunter and Garden Path. Honours about how you played can be earned:
  Untouchable, Clean Sweep, By a Whisker, Against the Odds and Swift. Good Company ("Finish a two-player game")
  is earned by finishing an online game.
- **The game clock** (`playMs`, which feeds Swift, quickest game and time played) is measured by the room, as time
  in play with both players connected, so both players record the same figure (_my call_). The room keeps each
  game's stats and sends them with the finished game, so both browsers record identical numbers. Each browser
  records a finished game exactly once, tracked by game id, including when it learns the result only on
  reconnecting.
- _My call:_ online wins and losses also count towards winning streaks (On a Roll, Unstoppable), alongside
  computer games. Well Travelled stays as it is now, counting wins against the computer only.

## How it's built (decided)

- **The server is the single source of truth.** One Durable Object per room holds the whole game: seats, phase,
  positions, turn, dice, log and the game's stats. Devices send intents (join, start, roll, move a counter,
  offer or accept a rematch) and the room replies by broadcasting the new state. A device never applies a move
  or rolls dice itself in an online game.
- **The server rolls the dice and checks every move** against the legal moves, and rejects anything out of turn or
  illegal. This prevents both cheating and drift.
- **One copy of the rules.** The room uses the same `js/rules.js` as the page (routes, variants, `legalMoves`,
  `applyMove`, `rollsAgain`, `allHome`), not a re-implementation.
- **Every state the room sends carries a sequence number.** A device that sees a gap, or reconnects, asks for (or is
  sent) the full current state and redraws from it. On a fresh connection the room always sends the full state.
- **Animation is driven by events.** With each state the room says what just happened (who rolled what, or which
  counter moved where and what it captured), so the other player's screen can animate the move from the previous
  state to the new one. If a device is behind or has just reconnected, it jumps straight to the new state with
  no animation.
- **Connections use WebSockets** to the Durable Object, using the hibernation API so idle rooms cost nothing.
- **Seat keys.** Creating a room gives the host a secret seat key; joining gives the friend one. Each is stored
  in that browser's `localStorage` under the room's id. Every connection presents its key, and the room only lets
  a connection act for the seat whose key it presents. With both seats taken, any connection without a valid key
  is told the room is full.
- **Room ids** are short, random and hard to guess, and go in the link (for example
  `https://ur.littleberrylodge.co.uk/#g=K7QXM2`). The id alone lets you view the invite, not play.
- **Names** are trimmed to a short limit and shown as text, never as HTML. The last name used is remembered in
  the browser to fill in next time.

- **Hosting: one Cloudflare Worker serving both the site and the rooms** (decided), using Workers static assets for
  `dist/` and a SQLite-backed Durable Object class for rooms. It deploys from Git with **Workers Builds**, as Pages
  does now, so CI keeps only reporting and needs no deploy secrets. `_headers` carries over, since Workers static
  assets support it. The plan stops once the Worker is live on its `workers.dev` address; the owner then moves
  `ur.littleberrylodge.co.uk` from the Pages project to the Worker in the dashboard and retires the Pages project.

## How it's built (my calls, open to change)

- **Room lifetime:** a room that never started expires after 24 hours. A room in play, or between games, expires
  after 7 days without activity, cleaned up with a Durable Object alarm.
- **The QR code** is generated in the browser by a small, pinned QR library vendored into the repo (no runtime
  CDN), drawn in the game's ink colour.
- **The service worker** must not cache or intercept the room API or WebSocket requests. Its cache version is
  bumped.
- **The friend's first visit:** opening an invite link skips the first-visit splash and guided-game offer.

## Left to the builder

- Code layout for the Worker and Durable Object, and how `js/rules.js` (a plain shared-scope script) is made
  available to the Worker without forking it: for example a build step that wraps it as a module, or a small
  export footer.
- The exact message format and state shape over the socket.
- Styling of the invite panel, join screen and waiting/disconnected notes, in keeping with the existing dialogs
  and the museum-plaque look.
- How the board flip is implemented in `js/board.js`.
- Tests: unit tests for the room logic (joining, seat keys, full rooms, turn order, illegal moves, rematch,
  sequence numbers), and Playwright tests driving two browser contexts through a whole online game against a
  local `wrangler dev`, including a reload mid-game and a third visitor getting "full".
- README updates for the new mode, local development (`wrangler dev`) and deployment.

## Deployment needs from the owner

- A Cloudflare account with Durable Objects available (the free plan supports SQLite-backed Durable Objects).
- Connecting the repo to the new Worker with Workers Builds (build command `npm run build`).
- Moving `ur.littleberrylodge.co.uk` from the Pages project to the Worker once it's live, then retiring the Pages
  project.
