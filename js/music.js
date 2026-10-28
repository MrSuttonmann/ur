/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Background music: three tracks taking turns, with the Music button and volume setting.
// Browsers only allow audio after the player interacts, so it fades in on the first click or key press.

// The player is kept out of the page: browsers that collect a page's audio and video (Brave's Playlist,
// "Add to playlist" on a long press) would otherwise take the game's background music for media to save.
const musicPlayer = new Audio();
musicPlayer.preload = 'none';
const PLAYLIST = [
  { src: 'music/village-consort.mp3', title: 'Village Consort' },
  { src: 'music/folk-round.mp3', title: 'Folk Round' },
  { src: 'music/lord-of-the-land.mp3', title: 'Lord of the Land' },
];
const FADE_MS = { in: 1500, out: 500, toNewVolume: 400, handOver: 400 };
const FADE_STEP_MS = 50;
const REST_BETWEEN_TRACKS_MS = 2000; // each piece has a proper ending, so pause before the next
const chosenVolume = () => prefs.musicVol / 100;

let fadeTimer = null,
  restTimer = null;
let musicStarted = false; // the browser has let it play at least once
let track = Math.floor(Math.random() * PLAYLIST.length); // start from a random track, then alternate

function loadTrack() {
  musicPlayer.src = PLAYLIST[track].src;
  drawNowPlaying();
}
function drawNowPlaying() {
  $('now-playing').textContent = prefs.music ? `Now playing: “${PLAYLIST[track].title}” by Kevin MacLeod` : '';
}

function fadeTo(volume, ms, done) {
  clearInterval(fadeTimer);
  const from = musicPlayer.volume,
    steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
  let step = 0;
  fadeTimer = setInterval(() => {
    step++;
    musicPlayer.volume = Math.min(1, Math.max(0, from + ((volume - from) * step) / steps));
    if (step >= steps) {
      clearInterval(fadeTimer);
      if (done) done();
    }
  }, FADE_STEP_MS);
}
function startMusic() {
  if (!prefs.music || document.hidden) return;
  if (!musicPlayer.paused) {
    fadeTo(chosenVolume(), FADE_MS.toNewVolume);
    return;
  }
  musicPlayer.volume = 0;
  const playing = musicPlayer.play();
  if (playing)
    playing
      .then(() => {
        musicStarted = true;
        announcePlaying();
        fadeTo(chosenVolume(), FADE_MS.in);
      })
      .catch(() => {});
}
function stopMusic() {
  clearTimeout(restTimer);
  fadeTo(0, FADE_MS.out, () => musicPlayer.pause());
}

// after a track ends, rest, then play the other one
musicPlayer.addEventListener('ended', () => {
  clearTimeout(restTimer);
  restTimer = setTimeout(() => {
    track = (track + 1) % PLAYLIST.length;
    loadTrack();
    startMusic();
  }, REST_BETWEEN_TRACKS_MS);
});

// only one open copy of the game plays music: whichever tab starts it tells the others to fade out
const thisTab = Math.random().toString(36).slice(2);
let otherTabs = null;
try {
  otherTabs = new BroadcastChannel('ur-music');
} catch (e) {}
function announcePlaying() {
  if (otherTabs) otherTabs.postMessage({ type: 'playing', tab: thisTab });
}
if (otherTabs)
  otherTabs.onmessage = (e) => {
    if (e.data && e.data.type === 'playing' && e.data.tab !== thisTab) {
      clearTimeout(restTimer);
      if (!musicPlayer.paused) fadeTo(0, FADE_MS.handOver, () => musicPlayer.pause());
    }
  };

// the first tap or key press anywhere (other than on the Music button itself) starts it
const startOnFirstInteraction = (e) => {
  if (!musicStarted && !(e.target.closest && e.target.closest('#music'))) startMusic();
};
USER_ACTIVATION_EVENTS.forEach((type) =>
  addEventListener(type, startOnFirstInteraction, { capture: true, passive: true }),
);
// pause while the tab is hidden, pick up again on return
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(fadeTimer);
    clearTimeout(restTimer);
    musicPlayer.pause();
  } else if (musicStarted) startMusic();
});
// two windows can both be visible, so returning focus to one also takes the music back
addEventListener('focus', () => {
  if (musicStarted && musicPlayer.paused) startMusic();
});

// the Music button and the volume slider in Options
function drawMusicButton() {
  const button = $('music');
  button.querySelector('[data-icon]').innerHTML = iconSVG(prefs.music ? 'music' : 'musicOff');
  button.querySelector('.lbl').textContent = prefs.music ? 'Music' : 'No music';
  button.setAttribute('aria-pressed', String(prefs.music));
  button.setAttribute('aria-label', prefs.music ? 'Music on, turn off' : 'Music off, turn on');
}
$('music').addEventListener('click', () => {
  prefs.music = !prefs.music;
  savePrefs();
  if (prefs.music) startMusic();
  else stopMusic();
  drawMusicButton();
  drawNowPlaying();
});
$('opt-vol').value = prefs.musicVol;
$('opt-vol').addEventListener('input', (e) => {
  prefs.musicVol = +e.target.value;
  savePrefs();
  clearInterval(fadeTimer);
  if (!musicPlayer.paused) musicPlayer.volume = chosenVolume();
});
loadTrack();
drawMusicButton();
