/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Builds the site for deployment into dist/. The page's stylesheets are joined into one, and its scripts into
// another, in the order the page loads them, so a visitor downloads two files instead of dozens; both are
// minified, along with the page and the service worker, which are pointed at the two joined files.
//
// The scripts are plain shared-scope scripts, not modules: joined in order they share one scope just as they
// did as separate files, and minifying keeps their top-level names, which the other scripts use.

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { minify as minifyHtml } from 'html-minifier-terser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'dist');

// what the site serves, copied as it is
const COPIED_AS_IS = ['icons', 'music', 'fonts', 'og-image.jpg', 'manifest.webmanifest', '_headers', 'LICENSE'];
const PAGE = 'index.html';
const SERVICE_WORKER = 'sw.js';
// the joined files sit in the folders their parts came from, so the stylesheets' relative font paths still work
const JOINED_STYLES = 'css/app.css';
const JOINED_SCRIPTS = 'js/app.js';

const STYLESHEET_TAG = /^[ \t]*<link rel="stylesheet" href="(css\/[\w-]+\.css)" \/>\r?\n/gm;
const SCRIPT_TAG = /^[ \t]*<script src="(js\/[\w-]+\.js)"><\/script>\r?\n/gm;
const SERVICE_WORKER_CODE_LIST = /const CODE = \[[^\]]*\];/;
const LICENCE_BANNER =
  '/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */';

// browsers the game supports; esbuild leaves alone anything these can already run
const BROWSER_TARGETS = ['chrome100', 'firefox100', 'safari15'];

const HTML_OPTIONS = {
  collapseWhitespace: true,
  conservativeCollapse: true, // keep one space between inline words and elements
  removeComments: true,
  minifyCSS: true,
  minifyJS: true,
};

const readSource = (relativePath) => readFile(path.join(ROOT, relativePath), 'utf8');
const writeOutput = async (relativePath, contents) => {
  await mkdir(path.dirname(path.join(OUTPUT, relativePath)), { recursive: true });
  await writeFile(path.join(OUTPUT, relativePath), contents);
};
const minify = async (source, loader) =>
  (await transform(source, { loader, minify: true, target: BROWSER_TARGETS, banner: LICENCE_BANNER })).code;

// the files the page's tags name, in the order they appear
const filesNamedBy = (page, tag) => [...page.matchAll(tag)].map(([, file]) => file);

async function joinAndMinify(files, loader, outputPath) {
  const sources = await Promise.all(files.map(readSource));
  // a newline and semicolon between scripts, so no file's last statement runs into the next file's first
  const joined = sources.join(loader === 'js' ? '\n;\n' : '\n');
  await writeOutput(outputPath, await minify(joined, loader));
}

// the page with each group of tags replaced by one tag, where the group's first tag stood
function pointPageAtJoinedFiles(page) {
  const replaceGroup = (html, tag, replacement) => {
    let first = true;
    return html.replace(tag, (line) => {
      if (!first) return '';
      first = false;
      return line.match(/^[ \t]*/)[0] + replacement + '\n';
    });
  };
  const withStyles = replaceGroup(page, STYLESHEET_TAG, `<link rel="stylesheet" href="${JOINED_STYLES}" />`);
  const withScripts = replaceGroup(withStyles, SCRIPT_TAG, `<script src="${JOINED_SCRIPTS}"></script>`);
  // the script is fetched from the head, alongside the styles, though it runs at the end of the page
  return withScripts.replace('</head>', `  <link rel="preload" href="${JOINED_SCRIPTS}" as="script" />\n  </head>`);
}

await rm(OUTPUT, { recursive: true, force: true });
await mkdir(OUTPUT);
await Promise.all(COPIED_AS_IS.map((name) => cp(path.join(ROOT, name), path.join(OUTPUT, name), { recursive: true })));

const page = await readSource(PAGE);
const styles = filesNamedBy(page, STYLESHEET_TAG);
const scripts = filesNamedBy(page, SCRIPT_TAG);
await joinAndMinify(styles, 'css', JOINED_STYLES);
await joinAndMinify(scripts, 'js', JOINED_SCRIPTS);
await writeOutput(PAGE, await minifyHtml(pointPageAtJoinedFiles(page), HTML_OPTIONS));

const serviceWorker = await readSource(SERVICE_WORKER);
if (!SERVICE_WORKER_CODE_LIST.test(serviceWorker))
  throw new Error(`${SERVICE_WORKER} has no CODE list to point at the joined files`);
const joinedCodeList = `const CODE = ['${JOINED_STYLES}', '${JOINED_SCRIPTS}'];`;
await writeOutput(SERVICE_WORKER, await minify(serviceWorker.replace(SERVICE_WORKER_CODE_LIST, joinedCodeList), 'js'));

console.log(
  `Built dist/: ${styles.length} stylesheets joined into ${JOINED_STYLES}, ${scripts.length} scripts into ${JOINED_SCRIPTS}, minified with the page and service worker.`,
);
