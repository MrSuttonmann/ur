/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Builds the site for deployment: copies what the site serves into dist/, minifying the scripts, stylesheets
// and page on the way. The scripts are plain shared-scope scripts, not modules, so each is minified on its
// own and keeps its top-level names, which the other scripts use.

import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { minify as minifyHtml } from 'html-minifier-terser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'dist');

// what the site serves, copied as it is
const COPIED_AS_IS = ['icons', 'music', 'og-image.jpg', 'manifest.webmanifest', '_headers', 'LICENSE'];
const SCRIPT_FOLDER = 'js';
const STYLE_FOLDER = 'css';
const SERVICE_WORKER = 'sw.js';
const PAGE = 'index.html';

// browsers the game supports; esbuild leaves alone anything these can already run
const BROWSER_TARGETS = ['chrome100', 'firefox100', 'safari15'];

const HTML_OPTIONS = {
  collapseWhitespace: true,
  conservativeCollapse: true, // keep one space between inline words and elements
  removeComments: true,
  minifyCSS: true,
  minifyJS: true,
};

async function minifyFile(relativePath, loader) {
  const source = await readFile(path.join(ROOT, relativePath), 'utf8');
  const { code } = await transform(source, { loader, minify: true, target: BROWSER_TARGETS, legalComments: 'inline' });
  await writeFile(path.join(OUTPUT, relativePath), code);
}

async function minifyFolder(folder, extension, loader) {
  await mkdir(path.join(OUTPUT, folder), { recursive: true });
  const files = (await readdir(path.join(ROOT, folder))).filter((name) => name.endsWith(extension));
  await Promise.all(files.map((name) => minifyFile(path.join(folder, name), loader)));
  return files.length;
}

async function minifyPage() {
  const source = await readFile(path.join(ROOT, PAGE), 'utf8');
  await writeFile(path.join(OUTPUT, PAGE), await minifyHtml(source, HTML_OPTIONS));
}

await rm(OUTPUT, { recursive: true, force: true });
await mkdir(OUTPUT);
await Promise.all(COPIED_AS_IS.map((name) => cp(path.join(ROOT, name), path.join(OUTPUT, name), { recursive: true })));
const scripts = await minifyFolder(SCRIPT_FOLDER, '.js', 'js');
const styles = await minifyFolder(STYLE_FOLDER, '.css', 'css');
await minifyFile(SERVICE_WORKER, 'js');
await minifyPage();
console.log(`Built dist/: ${scripts} scripts, ${styles} stylesheets, the service worker and the page, minified.`);
