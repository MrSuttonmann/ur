/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// ESLint's recommended checks. Prettier owns the layout, so ESLint's formatting rules are switched off.
//
// The game's scripts are plain, non-module scripts that share one scope: a name declared at the top of one
// file is used by the others. ESLint checks each file alone, so the top-level names of every script are
// gathered here and given to it as globals.

import { readdirSync, readFileSync } from 'node:fs';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import * as espree from 'espree';
import globals from 'globals';

const SCRIPT_FOLDER = 'js';
const PARSER_OPTIONS = { ecmaVersion: 'latest', sourceType: 'script' };

// the names a top-level statement declares, including each one in `const a = 1, b = 2`
function declaredNames(statement) {
  if (statement.type === 'VariableDeclaration') return statement.declarations.map((declarator) => declarator.id.name);
  if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') return [statement.id.name];
  return [];
}

function sharedScriptNames() {
  const names = {};
  for (const file of readdirSync(SCRIPT_FOLDER).filter((name) => name.endsWith('.js'))) {
    const program = espree.parse(readFileSync(`${SCRIPT_FOLDER}/${file}`, 'utf8'), PARSER_OPTIONS);
    for (const name of program.body.flatMap(declaredNames)) names[name] = 'writable';
  }
  return names;
}

export default [
  { ignores: ['dist/', 'node_modules/', '.remember/'] },
  js.configs.recommended,
  {
    rules: {
      // an empty catch is how the game shrugs off storage or audio a browser has blocked
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: [`${SCRIPT_FOLDER}/**/*.js`],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, ...sharedScriptNames() },
    },
    rules: {
      // a top-level name may be used only by a later script, so only names inside functions must be used
      'no-unused-vars': ['error', { vars: 'local', caughtErrors: 'none' }],
      // the scripts declare their shared names once; a global of the same name is that declaration
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
  {
    files: ['sw.js'],
    languageOptions: { sourceType: 'script', globals: globals.serviceworker },
  },
  {
    files: ['*.mjs', 'scripts/**/*.mjs', 'tests/**/*.mjs'],
    languageOptions: { sourceType: 'module', globals: globals.node },
  },
  {
    // the browser tests hand functions to the page, where the browser's and the game's names are in scope
    files: ['tests/e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...sharedScriptNames() } },
  },
  prettier,
];
