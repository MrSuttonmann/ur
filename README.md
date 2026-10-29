# The Royal Game of Ur

The 4,600-year-old Mesopotamian race game, on a hand-painted watercolour board. Play it at [ur.littleberrylodge.co.uk](https://ur.littleberrylodge.co.uk/).

- **Vs computer:** three strengths (Squire, Knight, King). The computer looks ahead over every possible dice roll. **Advise me** shows what the King would play, and why: unlimited against the Squire, five times a game against the Knight. Against the Squire the board also shades each square by the chance he can land there next turn, and **Undo** takes back your last move until you roll again.
- **Two players:** pass-and-play on one device.
- **Online:** invite a friend with a link or QR code and play in step on both devices. Games are recorded in Stats, offered again if you come back without the link, and leaving one counts as a loss. It needs the Worker (see Run locally).
- **Rules:** Irving Finkel's reconstruction from the British Museum tablet, the longer routes of James Masters (16 squares) and H. J. R. Murray (27), the doubling-back route drawn on Wikipedia, and two house variants (Quick and Raiders), chosen with Variant before a game.
- **Guided first game:** new players get tips as each rule first comes up; it can be replayed from Options.
- Animated counters and dice, sound effects made in the browser, and background music.
- **Keyboard play:** R or Space to roll, number keys or arrows and Enter to move, A for advice, U to undo (against the Squire).
- **Installable and offline:** install it from the browser or Options, and it keeps working with no connection.
- Stats for the current game and all time, saved in the browser.

## Run locally

Run `npm install` once, then:

```sh
npm run dev
```

This builds the site and runs `wrangler dev`, which serves the game and its online-play Worker at `http://localhost:8787`. Online play needs it.

Everything else is a static site, so it also runs straight from the source. You can open `index.html` directly, but offline support and installing only work when the folder is served over HTTP:

```sh
python3 -m http.server 8000
```

## Checking and building

Run `npm install` once (and `npx playwright install chromium` for the browser tests), then:

| Command                | What it does                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format`       | Tidies every file with Prettier                                                                                                               |
| `npm run format:check` | Lists any file Prettier would change                                                                                                          |
| `npm run lint`         | Checks the scripts with ESLint, the styles with Stylelint and the page with html-validate                                                     |
| `npm run typecheck`    | Type-checks the scripts with TypeScript, from their JSDoc (nothing is compiled)                                                               |
| `npm test`             | Runs the unit tests of the rules, then the browser tests with Playwright (set `SITE_ROOT=dist` to play the built site, as CI does)            |
| `npm run dev`          | Builds, then runs the game and the online-play Worker locally with `wrangler dev`, at `http://localhost:8787`                                 |
| `npm run check`        | All of the above, as CI runs them                                                                                                             |
| `npm run build`        | Builds the site into `dist/`: the stylesheets joined into one file and the scripts into another, in the page's order, and everything minified |
| `npm run lighthouse`   | Builds, then audits `dist/` with Lighthouse; reports go in `.lighthouseci/`                                                                   |

The online browser tests run a Worker of their own at `http://localhost:8788`, with its rooms kept apart in `.wrangler/e2e-state`, so a running `npm run dev` is never mistaken for it.

Committing runs Prettier, ESLint, Stylelint and html-validate on the staged files. GitHub Actions runs the checks, the tests and Lighthouse on every push and pull request, and Dependabot proposes updates to the tools.

## Project layout

| Path                                      | What it holds                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `index.html`                              | The page markup, dialogs and SVG definitions                                                    |
| `css/*.css`                               | Styles, one file per part of the page (`base.css` holds the colours, fonts and page)            |
| `js/rules.js`                             | The board, the rules, rule variants and the computer opponent (no page code)                    |
| `js/sound.js`                             | Synthesised sound effects                                                                       |
| `js/turns.js`                             | The rules of a turn, shared by the page and the Worker (no page code)                           |
| `js/game.js`                              | Game state, the turn sequence, and making moves                                                 |
| `js/stats.js`                             | Stats recording and the Stats window                                                            |
| `js/honours.js`                           | Honours (achievements): what earns them, and the Honours tab                                    |
| `js/board.js`                             | Drawing the board, counters, dice and move arrows; `render()`                                   |
| `js/speech.js`                            | What the characters say, and their speech bubbles                                               |
| `js/portraits.js`                         | Player portraits and expressions                                                                |
| `js/banner.js`                            | The win or lose banner at the end of a game                                                     |
| `js/card.js`                              | The result card: a shareable picture of a finished game                                         |
| `js/prefs.js`                             | Saved preferences                                                                               |
| `js/backdrop.js`                          | The animated background behind the page                                                         |
| `js/icons.js`                             | Hand-drawn toolbar icons                                                                        |
| `js/bubbles.js`                           | Pinning a note beside something (guide tips, advice)                                            |
| `js/advice.js`                            | Advise me                                                                                       |
| `js/danger.js`                            | Danger shading against the Squire                                                               |
| `js/undo.js`                              | Undo against the Squire                                                                         |
| `js/guide.js`                             | The guided first game                                                                           |
| `js/newgame.js`                           | Starting games, the set-up board, confirming before a game is lost                              |
| `js/options.js`                           | The Options window                                                                              |
| `js/variants.js`                          | The variant picker and which rules are in play                                                  |
| `js/controls.js`                          | Roll, Sound, Route, and the mode and opponent choices                                           |
| `js/modals.js`                            | The Rules, Strategy, Options and Stats windows                                                  |
| `js/keyboard.js`                          | Keyboard play                                                                                   |
| `js/install.js`                           | Installing the app and offline support                                                          |
| `js/online.js`                            | Online play in the page: saved seats, the room's API and socket, and playing its states         |
| `js/lobby.js`                             | Inviting, joining and rejoining an online game, and the notes for full or ended rooms           |
| `js/qrcode.js`                            | QR codes for invite links (vendored qrcode-generator, MIT)                                      |
| `js/music.js`                             | Background music                                                                                |
| `js/main.js`                              | Start-up                                                                                        |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and installing                                                                  |
| `css/lobby.css`                           | Styles for the invite, join and rejoin windows                                                  |
| `worker/`                                 | The Cloudflare Worker and its Durable Object that hold online rooms                             |
| `wrangler.jsonc`                          | The Worker's configuration                                                                      |
| `scripts/shared-module.mjs`               | Lets the Worker import the shared rules from the page's plain scripts                           |
| `css/fonts.css`, `fonts/`                 | The game's fonts, served with it (each under the SIL Open Font License; see `fonts/*-OFL.txt`)  |
| `scripts/build.mjs`                       | The deployment build                                                                            |
| `tests/unit/`                             | Unit tests of the rules and the computer opponent (Node's test runner)                          |
| `tests/e2e/`                              | Browser tests: whole games, honours, danger shading and undo, music, tray counters (Playwright) |

The scripts are plain, non-module scripts loaded in that order and share one scope, so a file can use anything from the files before it.

## Deploy to Cloudflare Workers

The Worker serves the site and runs online games.

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and connect this repository with Workers Builds.
2. Build command `npm run build`, deploy command `npx wrangler deploy`.
3. Move `ur.littleberrylodge.co.uk` from the Pages project to the Worker (**Settings → Domains & Routes**), then retire the Pages project.

Every push to the production branch redeploys.

## Licence

Copyright © 2026 MrSuttonmann.

The game is free software: you can redistribute it and/or modify it under the terms of the [GNU Affero General Public License](LICENSE), version 3 or (at your option) any later version. If you run a modified version as a website, the licence requires you to offer its source code to the people who use it.

The music is not covered by this licence; see Credits.

## Credits

Music: "Village Consort", "Folk Round" and "Lord of the Land" by Kevin MacLeod ([incompetech.com](https://incompetech.com)), licensed under [Creative Commons: By Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

Invite QR codes: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase, licensed under the MIT licence.
