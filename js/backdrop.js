/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The background: a slow animation behind the page, painted in the game's watercolour colours on a canvas.
// The player chooses a style in Options, or none. It pauses while the tab is hidden, and holds still
// (one quiet frame) for players who prefer reduced motion.

const backdropCanvas = $('backdrop'), backdropContext = backdropCanvas.getContext('2d');
const colourCache = {};
const cssColour = name => colourCache[name] ||= getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const between = (low, high) => low + Math.random() * (high - low);
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const FULL_TURN = Math.PI * 2;
const MAX_FRAME_SECONDS = .05;   // after a stall, carry on rather than jumping everything forward
const OFF_SCREEN = 40;           // how far past an edge something drifts before it comes back round

// Each style says how many things float, how to make one (`fresh` ones start just off screen; the first
// ones start anywhere), how it moves each frame, and how to draw it.
const BACKDROP_STYLES = {
  petals: {
    name: 'Drifting petals',
    count: 26,
    make: fresh => ({ x: between(0, innerWidth), y: fresh ? -OFF_SCREEN / 2 : between(0, innerHeight),
      fall: between(14, 30), drift: between(-6, 10), sway: between(12, 30), swaySpeed: between(.3, .7),
      size: between(5, 9), spin: between(-1.2, 1.2), tumble: between(1, 2.4), phase: between(0, FULL_TURN),
      colour: pickOne(['--vermilion', '--rose', '--rose', '--ochre']), alpha: between(.35, .6) }),
    move(petal, seconds, time) {
      petal.y += petal.fall * seconds;
      petal.x += (petal.drift + Math.cos(time * petal.swaySpeed + petal.phase) * petal.sway) * seconds;
      return petal.y < innerHeight + OFF_SCREEN;
    },
    draw(context, petal, time) {
      context.translate(petal.x, petal.y);
      context.rotate(petal.phase + time * petal.spin);
      context.scale(Math.abs(Math.cos(time * petal.tumble + petal.phase)) * .8 + .2, 1);   // tumbling over as it falls
      context.globalAlpha = petal.alpha;
      context.fillStyle = cssColour(petal.colour);
      context.beginPath();
      context.moveTo(0, -petal.size);
      context.bezierCurveTo(petal.size, -petal.size * .6, petal.size * .7, petal.size * .8, 0, petal.size);
      context.bezierCurveTo(-petal.size * .7, petal.size * .8, -petal.size, -petal.size * .6, 0, -petal.size);
      context.fill();
    },
  },
  motes: {
    name: 'Golden motes',
    count: 46,
    make: (fresh, index) => index < 5
      // the first few are great soft washes of colour drifting slowly about; the rest are specks of gold rising
      ? { wash: true, x: between(0, innerWidth), y: between(0, innerHeight), radius: between(180, 320),
          vx: between(-6, 6), vy: between(-4, 4), colour: pickOne(['--ochre', '--sage', '--rose', '--woad']) }
      : { x: between(0, innerWidth), y: fresh ? innerHeight + OFF_SCREEN / 2 : between(0, innerHeight),
          rise: between(6, 16), sway: between(4, 12), size: between(1.2, 2.8), twinkle: between(.8, 2), phase: between(0, FULL_TURN) },
    move(thing, seconds, time) {
      if (thing.wash) {
        thing.x += thing.vx * seconds; thing.y += thing.vy * seconds;
        if (thing.x < -thing.radius || thing.x > innerWidth + thing.radius) thing.vx *= -1;
        if (thing.y < -thing.radius || thing.y > innerHeight + thing.radius) thing.vy *= -1;
        return true;
      }
      thing.y -= thing.rise * seconds;
      thing.x += Math.sin(time * .5 + thing.phase) * thing.sway * seconds;
      return thing.y > -OFF_SCREEN;
    },
    draw(context, thing, time) {
      if (thing.wash) {
        const glow = context.createRadialGradient(thing.x, thing.y, 0, thing.x, thing.y, thing.radius);
        glow.addColorStop(0, cssColour(thing.colour)); glow.addColorStop(1, 'transparent');
        context.globalAlpha = .13;
        context.fillStyle = glow;
        context.fillRect(thing.x - thing.radius, thing.y - thing.radius, thing.radius * 2, thing.radius * 2);
        return;
      }
      context.globalAlpha = .35 + .4 * (Math.sin(time * thing.twinkle + thing.phase) + 1) / 2;
      context.fillStyle = cssColour('--sunfire');
      context.shadowColor = cssColour('--sunfire'); context.shadowBlur = thing.size * 4;
      context.beginPath(); context.arc(thing.x, thing.y, thing.size, 0, FULL_TURN); context.fill();
    },
  },
  sky: {
    name: 'Sun and moon',
    count: 40,
    make: (fresh, index) => index < 6
      // a few suns and moons sailing slowly across; the rest are stars that twinkle where they are
      ? { glyph: index % 2 ? 'moon' : 'sun', x: fresh ? -OFF_SCREEN : between(0, innerWidth), y: between(40, innerHeight - 40),
          sail: between(6, 14), bob: between(6, 14), size: between(12, 20), phase: between(0, FULL_TURN) }
      : { glyph: 'star', x: between(0, innerWidth), y: between(0, innerHeight), size: between(2.5, 5),
          twinkle: between(.6, 1.6), phase: between(0, FULL_TURN) },
    move(thing, seconds) {
      if (thing.glyph === 'star') return true;
      thing.x += thing.sail * seconds;
      return thing.x < innerWidth + OFF_SCREEN;
    },
    draw(context, thing, time) {
      if (thing.glyph === 'star') {
        context.globalAlpha = .25 + .45 * (Math.sin(time * thing.twinkle + thing.phase) + 1) / 2;
        context.fillStyle = cssColour('--ochre');
        context.translate(thing.x, thing.y);
        context.beginPath();   // a four-pointed sparkle
        for (let point = 0; point < 4; point++) {
          context.rotate(FULL_TURN / 4);
          context.lineTo(0, -thing.size); context.lineTo(thing.size * .22, -thing.size * .22);
        }
        context.fill();
        return;
      }
      context.translate(thing.x, thing.y + Math.sin(time * .4 + thing.phase) * thing.bob);
      context.globalAlpha = .32;
      context.lineWidth = 1.5; context.strokeStyle = cssColour('--ink');
      if (thing.glyph === 'sun') {
        context.fillStyle = cssColour('--sunfire');
        context.rotate(time * .1);
        for (let ray = 0; ray < 8; ray++) {
          context.rotate(FULL_TURN / 8);
          context.beginPath(); context.moveTo(0, -thing.size * .8); context.lineTo(0, -thing.size * 1.25); context.stroke();
        }
        context.beginPath(); context.arc(0, 0, thing.size * .65, 0, FULL_TURN); context.fill(); context.stroke();
      } else {
        // a crescent: the outer circle, less a circle of the same size shifted to the right
        const radius = thing.size * .8, shift = radius * .55, overlap = Math.acos(shift / 2 / radius);
        context.fillStyle = cssColour('--c-moon');
        context.beginPath();
        context.arc(0, 0, radius, overlap, FULL_TURN - overlap);
        context.arc(shift, 0, radius, -(Math.PI - overlap), Math.PI - overlap, true);
        context.closePath(); context.fill(); context.stroke();
      }
    },
  },
  none: { name: 'None', count: 0 },
};

if (!BACKDROP_STYLES[prefs.backdrop]) prefs.backdrop = DEFAULT_BACKDROP;   // a style saved before it was retired

let backdropThings = [], backdropFrame = null, backdropLastTime = 0;
const backdropStyle = () => BACKDROP_STYLES[prefs.backdrop];

function sizeBackdrop() {
  const scale = devicePixelRatio || 1;
  backdropCanvas.width = innerWidth * scale; backdropCanvas.height = innerHeight * scale;
  backdropContext.setTransform(scale, 0, 0, scale, 0, 0);
}
function paintBackdrop(time) {
  const style = backdropStyle();
  backdropContext.clearRect(0, 0, innerWidth, innerHeight);
  for (const thing of backdropThings) {
    backdropContext.save();
    style.draw(backdropContext, thing, time);
    backdropContext.restore();
  }
}
function animateBackdrop(now) {
  const time = now / 1000, seconds = Math.min(time - backdropLastTime, MAX_FRAME_SECONDS), style = backdropStyle();
  backdropLastTime = time;
  backdropThings = backdropThings.map((thing, index) => style.move(thing, seconds, time) ? thing : style.make(true, index));
  paintBackdrop(time);
  backdropFrame = requestAnimationFrame(animateBackdrop);
}
// start the chosen style afresh (also after changing it in Options)
function startBackdrop() {
  cancelAnimationFrame(backdropFrame); backdropFrame = null;
  const style = backdropStyle();
  backdropThings = Array.from({ length: style.count }, (_, index) => style.make(false, index));
  backdropCanvas.hidden = !style.count;
  if (!style.count) return;
  sizeBackdrop();
  if (prefersReducedMotion || document.hidden) { paintBackdrop(0); return; }
  backdropLastTime = performance.now() / 1000;
  backdropFrame = requestAnimationFrame(animateBackdrop);
}
addEventListener('resize', () => { if (backdropStyle().count) { sizeBackdrop(); paintBackdrop(backdropLastTime); } });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(backdropFrame); backdropFrame = null; }
  else if (!backdropFrame) startBackdrop();
});
startBackdrop();
