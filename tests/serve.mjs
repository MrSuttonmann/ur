/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// A tiny static file server for the end-to-end tests: serves the repository root as the site.
// Usage: node tests/serve.mjs [port]   (or set PORT)

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PORT = 4173;
const PORT = Number(process.argv[2] || process.env.PORT || DEFAULT_PORT);
const INDEX_PAGE = 'index.html';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const FALLBACK_TYPE = 'application/octet-stream';

// the file a request names, or null if it points outside the site
function fileFor(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const file = path.join(ROOT, pathname.endsWith('/') ? pathname + INDEX_PAGE : pathname);
  return file.startsWith(ROOT + path.sep) ? file : null;
}

function sendStatus(response, status) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(String(status));
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return sendStatus(response, 405);
  let file;
  try {
    file = fileFor(request.url);
  } catch {
    return sendStatus(response, 400); // a malformed escape in the path
  }
  if (!file) return sendStatus(response, 403);
  const info = await stat(file).catch(() => null);
  if (!info || !info.isFile()) return sendStatus(response, 404);
  response.writeHead(200, {
    'Content-Type': CONTENT_TYPES[path.extname(file).toLowerCase()] || FALLBACK_TYPE,
    'Content-Length': info.size,
    'Cache-Control': 'no-store', // the tests always want the files as they are on disk
  });
  if (request.method === 'HEAD') return response.end();
  createReadStream(file).pipe(response);
});

server.listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}/`));
