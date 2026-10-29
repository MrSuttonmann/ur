/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The trays: a captured counter flies home on top of everything, as one element, and the turn changing hands
// neither moves tray counters nor traps them in a layer of their own.

import { test, expect, openGame } from './helpers.mjs';

const TRAY_PREFS = { autoMove: false };
const SAMPLE_MS = 4000; // long enough for the captured counter's whole flight home
const FLIGHT_MS = 2500; // after this the Moon may move the same counter again, which rebuilds it
const OFF_TURN_OPACITY = '0.6';

// The Sun (you) is about to knock a Moon counter off a shared square: Sun on 5, Moon on 7, a roll of 2.
function setUpCapture() {
  game.positions[MOON] = game.positions[MOON].map((square, counter) => (counter === 0 ? 7 : 0));
  game.positions[SUN] = game.positions[SUN].map((square, counter) => (counter === 0 ? 5 : 0));
  game.turn = SUN;
  game.phase = 'move';
  game.roll = 2;
  game.dice = [1, 1, 0, 0];
  render();
  scrollTo(0, document.getElementById('tray1').getBoundingClientRect().top + scrollY - 30);
}

// Makes the capture, then on every frame: notes each new element drawn for the captured counter, and while it
// glides, whether it is the topmost thing at its own centre.
function captureAndWatch({ sampleMs }) {
  return new Promise((resolve) => {
    const capture = legalMoves(game.positions, SUN, 2).find((move) => move.captures >= 0);
    if (!capture) return resolve(null);
    makeMove(capture);
    const started = performance.now();
    const elements = new Set(),
      newElementTimes = [],
      samples = [];
    const watch = () => {
      const t = Math.round(performance.now() - started);
      const el = document.querySelector(`[data-pid="${MOON}-0"]`);
      if (el && !elements.has(el)) {
        elements.add(el);
        newElementTimes.push(t);
      }
      if (el && el.classList.contains('gliding')) {
        const box = el.getBoundingClientRect();
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const coverer = top && top.closest('[data-pid]');
        samples.push({
          t,
          onTop: Boolean(top) && el.contains(top),
          top: coverer ? coverer.dataset.pid : top?.className,
        });
      }
      if (t < sampleMs) requestAnimationFrame(watch);
      else resolve({ newElementTimes, samples });
    };
    watch();
  });
}

test('a captured counter flies home on top, as one element', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 1100 });
  await openGame(page, { prefs: TRAY_PREFS });
  await page.locator('#newgame').click();
  await page.evaluate(setUpCapture);
  // setting up glides the counters to their squares; the flight to watch is the capture's own
  await page.waitForFunction(() => !document.querySelector('.gliding, .hopping'));
  const flight = await page.evaluate(captureAndWatch, { sampleMs: SAMPLE_MS });
  expect(flight, 'the Sun has a capturing move').not.toBeNull();

  // the first time is the counter as it stood when the move began
  const rebuiltInFlight = flight.newElementTimes.slice(1).filter((t) => t < FLIGHT_MS);
  expect(rebuiltInFlight, 'one element all the way home, through every redraw').toEqual([]);

  const covered = flight.samples.filter((sample) => !sample.onTop);
  expect(flight.samples.length, 'the counter was seen gliding').toBeGreaterThan(0);
  expect(covered, 'on top for its whole flight').toEqual([]);
});

test('the turn changing hands moves no tray counters, and a faded tray traps none in a layer', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 1100 });
  await openGame(page, { prefs: TRAY_PREFS });
  await page.locator('#newgame').click();
  const handover = await page.evaluate(() => {
    clearTimeout(pendingStep); // the computer must not take a turn of its own in the middle of this
    game.positions[MOON] = game.positions[MOON].map(() => 0);
    game.positions[SUN] = game.positions[SUN].map(() => 0);
    game.turn = SUN;
    game.phase = 'roll';
    game.roll = null;
    render();
    const trayCounterPlaces = () =>
      [...document.querySelectorAll('.pool [data-pid]')]
        .map((el) => {
          const box = el.getBoundingClientRect();
          return box.left + ',' + box.top;
        })
        .join(' ');
    const before = trayCounterPlaces();
    game.turn = MOON;
    render();
    const after = trayCounterPlaces();
    // anything between a tray counter and the game that would hold it in a layer of its own
    const piece = document.querySelector('#tray0 .pool .piece'),
      trappers = [];
    for (let node = piece.parentElement; node && node.id !== 'game'; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.opacity !== '1' || style.filter !== 'none' || style.transform !== 'none') trappers.push(node.className);
    }
    return { before, after, trappers };
  });
  expect(handover.before.length, 'there are tray counters to compare').toBeGreaterThan(0);
  expect(handover.after, 'turn change moves no tray counters').toBe(handover.before);
  await expect(page.locator('#tray0')).toHaveClass(/\boff-turn\b/);
  expect(handover.trappers, 'faded tray traps no counters in a layer').toEqual([]);
  // the fade is on each counter instead
  await expect(page.locator('#tray0 .pool .piece').first()).toHaveCSS('opacity', OFF_TURN_OPACITY);
});
