# The Royal Game of Ur

The 4,600-year-old Mesopotamian race game, on a hand-painted watercolour board. Play it at [ur.littleberrylodge.co.uk](https://ur.littleberrylodge.co.uk/).

- **Vs computer:** three strengths (Squire, Knight, King). The computer looks ahead over every possible dice roll. **Advise me** shows what the King would play, and why: unlimited against the Squire, five times a game against the Knight.
- **Two players:** pass-and-play on one device.
- **Rules:** Irving Finkel's reconstruction from the British Museum tablet, plus two house variants (Quick and Raiders) in Options.
- **Guided first game:** new players get tips as each rule first comes up; it can be replayed from Options.
- Animated counters and dice, sound effects made in the browser, and background music.
- **Keyboard play:** R or Space to roll, number keys or arrows and Enter to move, A for advice.
- **Installable and offline:** install it from the browser or Options, and it keeps working with no connection.
- Stats for the current game and all time, saved in the browser.

## Run locally

It's a static site with no build step. You can open `index.html` directly, but offline support and installing only work when the folder is served over HTTP:

```sh
python3 -m http.server 8000
```

## Project layout

| Path | What it holds |
|---|---|
| `index.html` | The page markup, dialogs and SVG definitions |
| `css/style.css` | All styles |
| `js/rules.js` | The board, the rules, rule variants and the computer opponent (no page code) |
| `js/sound.js` | Synthesised sound effects |
| `js/game.js` | Game state, the turn sequence, and making moves |
| `js/stats.js` | Stats recording and the Stats window |
| `js/board.js` | Drawing the board, counters, dice and move arrows; `render()` |
| `js/portraits.js` | Player portraits, expressions and speech |
| `js/prefs.js` | Saved preferences |
| `js/icons.js` | Hand-drawn toolbar icons |
| `js/bubbles.js` | Pinning a note beside something (guide tips, advice) |
| `js/advice.js` | Advise me |
| `js/guide.js` | The guided first game |
| `js/newgame.js` | Starting games, the set-up board, confirming before a game is lost |
| `js/options.js` | The Options window and which rules are in play |
| `js/controls.js` | Roll, Sound, Route, and the mode and opponent choices |
| `js/modals.js` | The Rules, Strategy, Options and Stats windows |
| `js/keyboard.js` | Keyboard play |
| `js/install.js` | Installing the app and offline support |
| `js/music.js` | Background music |
| `js/main.js` | Start-up |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and installing |

The scripts are plain, non-module scripts loaded in that order and share one scope, so a file can use anything from the files before it.

## Deploy to Cloudflare Pages

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repository.
2. Build settings: framework preset **None**, build command empty, build output directory `/`.
3. Save and deploy. Every push to the production branch redeploys.

## Licence

Copyright © 2026 MrSuttonmann.

The game is free software: you can redistribute it and/or modify it under the terms of the [GNU Affero General Public License](LICENSE), version 3 or (at your option) any later version. If you run a modified version as a website, the licence requires you to offer its source code to the people who use it.

The music is not covered by this licence; see Credits.

## Credits

Music: "Village Consort" and "Folk Round" by Kevin MacLeod ([incompetech.com](https://incompetech.com)), licensed under [Creative Commons: By Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
