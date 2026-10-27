/*
  The Royal Game of Ur: offline support.
  Copyright (C) 2026 MrSuttonmann. Licensed under the GNU AGPL-3.0 or later; see LICENSE.

  The page is fetched fresh whenever there is a connection, so updates arrive straight away,
  and served from the cache when there isn't. Icons and fonts come from the cache and refresh
  in the background. Music is too big to download up front, so each track is saved the first
  time it plays and then served from the cache, including the byte ranges audio players ask for.
*/
const CACHE = 'ur-v1';
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
