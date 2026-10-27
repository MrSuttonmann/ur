/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// ---------- sound: synthesised with Web Audio, no files ----------
let actx = null, master = null, noise = null, muted = false;
try { muted = localStorage.getItem('ur-muted') === '1'; } catch (e) {}
function audio() {
  if (muted) return null;
  try {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.gain.value = .7; master.connect(actx.destination);
      noise = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { return null; }
  return actx;
}
// browsers only allow sound after the player interacts, so wake the audio on any tap or key
addEventListener('pointerdown', audio);
addEventListener('keydown', audio);

function tap(c, t, freq, gain, dur, q = 5) {
  const src = c.createBufferSource(); src.buffer = noise;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t, Math.random() * .5); src.stop(t + dur + .02);
}
function tone(c, t, type, f0, f1, gain, dur) {
  const o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .012);
  g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
}
function sfxDice() {
  const c = audio(); if (!c) return;
  const t0 = c.currentTime;
  // bone dice rattling in the hand, then four landing on wood
  for (let i = 0; i < 10; i++) tap(c, t0 + i * .042 + Math.random() * .025, 1800 + Math.random() * 2400, .18 + Math.random() * .15, .035, 8);
  for (let i = 0; i < 4; i++) {
    const t = t0 + .44 + i * .04 + Math.random() * .025;
    tap(c, t, 700 + Math.random() * 600, .5, .09, 4);
    tone(c, t, 'sine', 320 + Math.random() * 80, 240, .12, .08);
  }
}
// a wooden "tok" as a counter lands on each square; pitch climbs a step each hop
function sfxHop(delay, step, last) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + delay, f = 420 * Math.pow(2, step / 12 * 2);
  tone(c, t, 'sine', f * 1.5, f, last ? .32 : .2, last ? .14 : .09);
  tap(c, t, 1400 + step * 120, last ? .3 : .18, .04, 6);
}
// plucked string, roughly lute-like
function pluck(c, t, f, gain, dur) {
  tone(c, t, 'triangle', f, f * .998, gain, dur);
  tone(c, t, 'sine', f * 2, f * 2, gain * .35, dur * .6);
}
// brass: two detuned saws through a lowpass that opens on the attack
function brass(c, t, f, dur, gain) {
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
  lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(f * 6, t + .05);
  lp.frequency.exponentialRampToValueAtTime(f * 3, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .03);
  g.gain.setValueAtTime(gain * .8, t + Math.max(.04, dur - .08)); g.gain.exponentialRampToValueAtTime(.001, t + dur + .06);
  lp.connect(g).connect(master);
  for (const d of [-6, 6]) {
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
    o.connect(lp); o.start(t); o.stop(t + dur + .1);
  }
}
function sfxHome() {
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => pluck(c, t + i * .07, f, .22, .35));
  tone(c, t + .3, 'sine', 2093, 2090, .12, .9);  // bell
  tone(c, t + .3, 'sine', 3136, 3130, .05, .6);
}
// rose: a whoosh of petals and a sparkle of high pentatonic chimes
function sfxRose() {
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  tap(c, t, 3000, .14, .45, .7);
  [1175, 1319, 1568, 1760, 2093, 2349, 2637].forEach((f, i) => {
    const at = t + .03 + i * .045 + Math.random() * .015;
    tone(c, at, 'sine', f, f, .09, .5);
    tone(c, at, 'sine', f * 3, f * 3, .015, .25);
  });
  tone(c, t + .34, 'sine', 3136, 3132, .06, 1);
}
function sfxFanfare(delay = 0) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + delay;
  const G4 = 392, C5 = 523, E5 = 659, G5 = 784, C6 = 1047;
  const notes = [[0, G4, .13], [.16, G4, .13], [.32, G4, .13], [.48, C5, .5], [1.02, E5, .16], [1.2, G5, .16]];
  for (const [at, f, d] of notes) brass(c, t + at, f, d, .16);
  for (const f of [C5, E5, G5, C6]) brass(c, t + 1.4, f, 1.1, .1);  // final chord
  tap(c, t + 1.4, 180, .5, .4, 1.5);                                   // drum hit under the chord
  tone(c, t + 1.4, 'sine', 110, 60, .5, .45);
}
function sfxCapture() {
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  tone(c, t, 'sine', 200, 50, .8, .28);             // hollow thump
  tap(c, t, 2600, .55, .05, 3);                      // crack
  tap(c, t + .008, 650, .5, .12, 2);
  tone(c, t + .14, 'triangle', 560, 230, .16, .42);  // comic falling "wah"
  tone(c, t + .14, 'triangle', 566, 232, .08, .42);
}
