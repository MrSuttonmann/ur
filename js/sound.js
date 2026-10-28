/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Sound effects, synthesised with Web Audio (no audio files).

let audioContext = null,
  masterVolume = null,
  whiteNoise = null;
let muted = false;
try {
  muted = localStorage.getItem('ur-muted') === '1';
} catch (e) {}

// The game's sound and music are ambient, as a game's should be: they play alongside the player's own music,
// follow the silent switch, and don't make iPhones show the page as now playing media (Safari 17 and later).
if (navigator.audioSession) navigator.audioSession.type = 'ambient';

const MASTER_VOLUME = 0.7;
const SILENT = 0.0001,
  NEARLY_SILENT = 0.001; // exponential ramps can't reach zero
const ATTACK_SECONDS = 0.012,
  TAIL_SECONDS = 0.02;

// the audio context, created on first use; null when muted or unavailable
function readyAudio() {
  if (muted) return null;
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      masterVolume = audioContext.createGain();
      masterVolume.gain.value = MASTER_VOLUME;
      masterVolume.connect(audioContext.destination);
      whiteNoise = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate); // one second
      const samples = whiteNoise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch (e) {
    return null;
  }
  return audioContext;
}
// Browsers only allow sound after the player interacts, so wake the audio on any tap or key. iPads count a
// finished tap (touchend or click), not a finger landing (pointerdown): sound started then is refused.
const USER_ACTIVATION_EVENTS = ['touchend', 'click', 'keydown'];
USER_ACTIVATION_EVENTS.forEach((type) => addEventListener(type, () => readyAudio(), { capture: true, passive: true }));

// ---------- building blocks ----------
// a short burst of filtered noise: clicks, cracks, rattles, whooshes (higher sharpness = narrower band)
function noiseBurst({ at, centreHz, volume, seconds, sharpness = 5 }) {
  const source = audioContext.createBufferSource();
  source.buffer = whiteNoise;
  const band = audioContext.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = centreHz;
  band.Q.value = sharpness;
  const envelope = audioContext.createGain();
  envelope.gain.setValueAtTime(volume, at);
  envelope.gain.exponentialRampToValueAtTime(NEARLY_SILENT, at + seconds);
  source.connect(band).connect(envelope).connect(masterVolume);
  source.start(at, Math.random() * 0.5);
  source.stop(at + seconds + TAIL_SECONDS);
}
// a tone that glides from one pitch to another and fades out
function tone({ at, wave = 'sine', fromHz, toHz = fromHz, volume, seconds }) {
  const oscillator = audioContext.createOscillator();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(fromHz, at);
  oscillator.frequency.exponentialRampToValueAtTime(toHz, at + seconds);
  const envelope = audioContext.createGain();
  envelope.gain.setValueAtTime(SILENT, at);
  envelope.gain.exponentialRampToValueAtTime(volume, at + ATTACK_SECONDS);
  envelope.gain.exponentialRampToValueAtTime(NEARLY_SILENT, at + seconds);
  oscillator.connect(envelope).connect(masterVolume);
  oscillator.start(at);
  oscillator.stop(at + seconds + TAIL_SECONDS);
}
// a plucked string, roughly lute-like: the note plus a quieter octave
function pluck({ at, hz, volume, seconds }) {
  tone({ at, wave: 'triangle', fromHz: hz, toHz: hz * 0.998, volume, seconds });
  tone({ at, fromHz: hz * 2, volume: volume * 0.35, seconds: seconds * 0.6 });
}
// a brass note: two slightly detuned saws through a filter that opens on the attack
const BRASS_DETUNE_CENTS = [-6, 6];
function brass({ at, hz, seconds, volume }) {
  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(500, at);
  filter.frequency.exponentialRampToValueAtTime(hz * 6, at + 0.05);
  filter.frequency.exponentialRampToValueAtTime(hz * 3, at + seconds);
  const envelope = audioContext.createGain();
  envelope.gain.setValueAtTime(SILENT, at);
  envelope.gain.exponentialRampToValueAtTime(volume, at + 0.03);
  envelope.gain.setValueAtTime(volume * 0.8, at + Math.max(0.04, seconds - 0.08));
  envelope.gain.exponentialRampToValueAtTime(NEARLY_SILENT, at + seconds + 0.06);
  filter.connect(envelope).connect(masterVolume);
  for (const cents of BRASS_DETUNE_CENTS) {
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = hz;
    oscillator.detune.value = cents;
    oscillator.connect(filter);
    oscillator.start(at);
    oscillator.stop(at + seconds + 0.1);
  }
}
const vary = (base, range) => base + Math.random() * range; // a little randomness so repeats don't sound mechanical

// note frequencies (Hz)
const NOTE = { G4: 392, C5: 523, E5: 659, G5: 784, C6: 1047, C7: 2093, G7: 3136 };
const PENTATONIC_CHIMES = [1175, 1319, 1568, 1760, 2093, 2349, 2637]; // D6 E6 G6 A6 C7 D7 E7

// ---------- the effects ----------
// bone dice rattling in the hand, then four landing on wood
function sfxDice() {
  if (!readyAudio()) return;
  const now = audioContext.currentTime;
  for (let i = 0; i < 10; i++)
    noiseBurst({
      at: vary(now + i * 0.042, 0.025),
      centreHz: vary(1800, 2400),
      volume: vary(0.18, 0.15),
      seconds: 0.035,
      sharpness: 8,
    });
  for (let die = 0; die < DICE_COUNT; die++) {
    const lands = vary(now + 0.44 + die * 0.04, 0.025);
    noiseBurst({ at: lands, centreHz: vary(700, 600), volume: 0.5, seconds: 0.09, sharpness: 4 });
    tone({ at: lands, fromHz: vary(320, 80), toHz: 240, volume: 0.12, seconds: 0.08 });
  }
}
// a wooden "tok" as a counter lands on each square; the pitch climbs a whole tone each hop
function sfxHop(delaySeconds, hop, isLastHop) {
  if (!readyAudio()) return;
  const at = audioContext.currentTime + delaySeconds,
    hz = 420 * Math.pow(2, (hop * 2) / 12);
  tone({ at, fromHz: hz * 1.5, toHz: hz, volume: isLastHop ? 0.32 : 0.2, seconds: isLastHop ? 0.14 : 0.09 });
  noiseBurst({ at, centreHz: 1400 + hop * 120, volume: isLastHop ? 0.3 : 0.18, seconds: 0.04, sharpness: 6 });
}
// a counter brought home: a rising lute run and a bell
function sfxHome() {
  if (!readyAudio()) return;
  const now = audioContext.currentTime;
  [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((hz, i) =>
    pluck({ at: now + i * 0.07, hz, volume: 0.22, seconds: 0.35 }),
  );
  tone({ at: now + 0.3, fromHz: NOTE.C7, toHz: 2090, volume: 0.12, seconds: 0.9 });
  tone({ at: now + 0.3, fromHz: NOTE.G7, toHz: 3130, volume: 0.05, seconds: 0.6 });
}
// a rose: a whoosh of petals and a sparkle of high chimes
function sfxRose() {
  if (!readyAudio()) return;
  const now = audioContext.currentTime;
  noiseBurst({ at: now, centreHz: 3000, volume: 0.14, seconds: 0.45, sharpness: 0.7 });
  PENTATONIC_CHIMES.forEach((hz, i) => {
    const at = vary(now + 0.03 + i * 0.045, 0.015);
    tone({ at, fromHz: hz, volume: 0.09, seconds: 0.5 });
    tone({ at, fromHz: hz * 3, volume: 0.015, seconds: 0.25 });
  });
  tone({ at: now + 0.34, fromHz: NOTE.G7, toHz: 3132, volume: 0.06, seconds: 1 });
}
// victory: three trumpet calls, a rising run, then a held chord over a drum
function sfxFanfare(delaySeconds = 0) {
  if (!readyAudio()) return;
  const start = audioContext.currentTime + delaySeconds,
    chordAt = start + 1.4;
  const calls = [
    [0, NOTE.G4, 0.13],
    [0.16, NOTE.G4, 0.13],
    [0.32, NOTE.G4, 0.13],
    [0.48, NOTE.C5, 0.5],
    [1.02, NOTE.E5, 0.16],
    [1.2, NOTE.G5, 0.16],
  ];
  for (const [offset, hz, seconds] of calls) brass({ at: start + offset, hz, seconds, volume: 0.16 });
  for (const hz of [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6]) brass({ at: chordAt, hz, seconds: 1.1, volume: 0.1 });
  noiseBurst({ at: chordAt, centreHz: 180, volume: 0.5, seconds: 0.4, sharpness: 1.5 });
  tone({ at: chordAt, fromHz: 110, toHz: 60, volume: 0.5, seconds: 0.45 });
}
// defeat: a sad trombone, four notes sliding down a semitone at a time, the last one wobbling away
const LAMENT_NOTES = [392, 370, 349, 330]; // G4 F#4 F4 E4
function sfxLament(delaySeconds = 0) {
  if (!readyAudio()) return;
  const start = audioContext.currentTime + delaySeconds;
  LAMENT_NOTES.forEach((hz, i) => {
    const last = i === LAMENT_NOTES.length - 1;
    brass({ at: start + i * 0.42, hz, seconds: last ? 1.1 : 0.34, volume: 0.14 });
  });
  const wobbleAt = start + 3 * 0.42 + 0.2;
  tone({ at: wobbleAt, wave: 'triangle', fromHz: 330, toHz: 300, volume: 0.05, seconds: 0.9 });
}
// a capture: a hollow thump, a crack, and a comic falling "wah"
function sfxCapture() {
  if (!readyAudio()) return;
  const now = audioContext.currentTime;
  tone({ at: now, fromHz: 200, toHz: 50, volume: 0.8, seconds: 0.28 });
  noiseBurst({ at: now, centreHz: 2600, volume: 0.55, seconds: 0.05, sharpness: 3 });
  noiseBurst({ at: now + 0.008, centreHz: 650, volume: 0.5, seconds: 0.12, sharpness: 2 });
  tone({ at: now + 0.14, wave: 'triangle', fromHz: 560, toHz: 230, volume: 0.16, seconds: 0.42 });
  tone({ at: now + 0.14, wave: 'triangle', fromHz: 566, toHz: 232, volume: 0.08, seconds: 0.42 });
}
