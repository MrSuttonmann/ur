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
