/*
  The Royal Game of Ur: offline support.
  Copyright (C) 2026 MrSuttonmann. Licensed under the GNU AGPL-3.0 or later; see LICENSE.

  The page, its scripts and its styles are fetched fresh whenever there is a connection, so an
  update never mixes a new page with old scripts, and they're served from the cache when there
  isn't one. "Fresh" means checked with the server every time: the browser's own cache may hold
  scripts for hours, and a new page running old scripts breaks the game. Icons and fonts come from the cache and refresh in the background. Music is too big
  to download up front, so each track is saved the first time it plays and then served from the
  cache, including the byte ranges audio players ask for.
*/
const CACHE = 'ur-v7';
const CODE = ['css/base.css', 'css/header.css', 'css/controls.css', 'css/variants.css', 'css/dialogs.css', 'css/board.css', 'css/pieces.css', 'css/dock.css', 'css/ledger.css', 'css/rules.css', 'css/footer.css', 'css/guide.css', 'css/stats.css', 'css/drawings.css', 'css/portraits.css', 'css/banner.css', 'js/rules.js', 'js/sound.js', 'js/game.js', 'js/stats.js', 'js/board.js', 'js/speech.js', 'js/portraits.js', 'js/banner.js', 'js/prefs.js', 'js/backdrop.js', 'js/icons.js', 'js/bubbles.js', 'js/advice.js', 'js/guide.js', 'js/newgame.js', 'js/options.js', 'js/variants.js', 'js/controls.js', 'js/modals.js', 'js/keyboard.js', 'js/install.js', 'js/music.js', 'js/main.js'];
const SHELL = ['./', 'manifest.webmanifest', ...CODE,
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

// the offline copy is fetched straight from the server, never from the browser's cache, so it's all one version
const fromServer = path => new Request(path, { cache: 'reload' });
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(fromServer))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') e.respondWith(page(req));
  else if (url.origin === location.origin && /\.(js|css)$/.test(url.pathname)) e.respondWith(fresh(req));
  else if (url.origin === location.origin && url.pathname.endsWith('.mp3')) e.respondWith(music(req, url.pathname));
  else if (url.origin === location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(cached(req));
});

// the page: network first, cache as the fallback
async function page(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put('./', res.clone());
    return res;
  } catch (err) {
    return (await cache.match('./')) || Response.error();
  }
}

// scripts and styles: network first (checked with the server, not the browser's cache), cache as the fallback
async function fresh(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req, { ignoreSearch: true })) || Response.error();
  }
}

// everything else: answer from the cache, refresh it in the background
async function cached(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const refresh = fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  }).catch(() => hit || Response.error());
  return hit || refresh;
}

// music: saved whole on first play, then served from the cache in the ranges the player requests
async function music(req, path) {
  const cache = await caches.open(CACHE);
  const whole = await cache.match(path);
  if (!whole) {
    fetch(path).then(res => { if (res.status === 200) return cache.put(path, res); }).catch(() => {});
    return fetch(req);
  }
  const range = req.headers.get('range');
  if (!range) return whole;
  const buf = await whole.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
