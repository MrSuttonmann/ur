/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// ---------- background music ----------
// browsers only allow audio after the player interacts, so it fades in on the first click or key press
const bgm = $('bgm');
let fadeTimer = null, musicStarted = false, replayTimer = null;
// the two tracks alternate, starting from a random one
const PLAYLIST = [
  { src: 'music/village-consort.mp3', title: 'Village Consort' },
  { src: 'music/folk-round.mp3', title: 'Folk Round' },
];
let track = Math.floor(Math.random() * PLAYLIST.length);
const loadTrack = () => { bgm.src = PLAYLIST[track].src; drawNowPlaying(); };
function drawNowPlaying() {
  $('now-playing').textContent = prefs.music ? `Now playing: “${PLAYLIST[track].title}” by Kevin MacLeod` : '';
}
// only one open copy of the game plays music: whichever tab starts it tells the others to fade out
const tabId = Math.random().toString(36).slice(2);
let musicChannel = null;
try { musicChannel = new BroadcastChannel('ur-music'); } catch (e) {}
if (musicChannel) musicChannel.onmessage = e => {
  if (e.data && e.data.type === 'playing' && e.data.tab !== tabId) { clearTimeout(replayTimer); if (!bgm.paused) fadeTo(0, 400, () => bgm.pause()); }
};
function fadeTo(target, ms, done) {
  clearInterval(fadeTimer);
  const from = bgm.volume, steps = Math.max(1, Math.round(ms / 50));
  let i = 0;
  fadeTimer = setInterval(() => {
    i++;
    bgm.volume = Math.min(1, Math.max(0, from + (target - from) * i / steps));
    if (i >= steps) { clearInterval(fadeTimer); if (done) done(); }
  }, 50);
}
function startMusic() {
  if (!prefs.music || document.hidden) return;
  if (!bgm.paused) { fadeTo(prefs.musicVol / 100, 400); return; }
  bgm.volume = 0;
  const played = bgm.play();
  if (played) played.then(() => {
    musicStarted = true;
    if (musicChannel) musicChannel.postMessage({ type: 'playing', tab: tabId });
    fadeTo(prefs.musicVol / 100, 1500);
  }).catch(() => {});
}
function stopMusic() { clearTimeout(replayTimer); fadeTo(0, 500, () => bgm.pause()); }
// each piece has a proper ending, so let it finish, rest for two seconds, then fade in the other track
bgm.addEventListener('ended', () => {
  clearTimeout(replayTimer);
  replayTimer = setTimeout(() => { track = (track + 1) % PLAYLIST.length; loadTrack(); startMusic(); }, 2000);
});
const kickMusic = e => { if (!musicStarted && !(e.target.closest && e.target.closest('#music'))) startMusic(); };
addEventListener('pointerdown', kickMusic);
addEventListener('keydown', kickMusic);
// pause while the tab is hidden, pick up again on return
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearInterval(fadeTimer); clearTimeout(replayTimer); bgm.pause(); }
  else if (musicStarted) startMusic();
});
// two windows can both be visible, so returning focus to one also takes the music back
addEventListener('focus', () => { if (musicStarted && bgm.paused) startMusic(); });
function drawMusic() {
  const b = $('music');
  b.querySelector('[data-icon]').innerHTML = iconSVG(prefs.music ? 'music' : 'musicOff');
  b.querySelector('.lbl').textContent = prefs.music ? 'Music' : 'No music';
  b.setAttribute('aria-pressed', String(prefs.music));
  b.setAttribute('aria-label', prefs.music ? 'Music on, turn off' : 'Music off, turn on');
}
$('music').addEventListener('click', () => {
  prefs.music = !prefs.music; savePrefs();
  if (prefs.music) startMusic(); else stopMusic();
  drawMusic();
  drawNowPlaying();
});
loadTrack();
$('opt-vol').value = prefs.musicVol;
$('opt-vol').addEventListener('input', e => {
  prefs.musicVol = +e.target.value; savePrefs();
  clearInterval(fadeTimer);
  if (!bgm.paused) bgm.volume = prefs.musicVol / 100;
});
drawMusic();
