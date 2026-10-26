# The Royal Game of Ur

The 4,600-year-old Mesopotamian race game, on a hand-painted watercolour board.

- **Vs computer:** three strengths (Squire, Knight, King). The computer looks ahead over every possible dice roll.
- **Two players:** pass-and-play on one device.
- Rules as reconstructed by Irving Finkel of the British Museum.
- Animated counters and dice, with sound effects made in the browser (no audio files).

## Run locally

It's a single static file with no build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Deploy to Cloudflare Pages

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repository.
2. Build settings: framework preset **None**, build command empty, build output directory `/`.
3. Save and deploy. Every push to the production branch redeploys.
