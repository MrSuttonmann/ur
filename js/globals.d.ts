/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// What the type checker doesn't know about the browsers the game runs in, and the one property the game adds
// to its own elements. Only the type checker reads this file; it isn't served.

interface Window {
  /** Safari before 14.1 */
  webkitAudioContext?: typeof AudioContext;
}

interface Navigator {
  /** Safari 16.4 and later: how the page's sound mixes with other apps */
  audioSession?: { type: string };
  /** Safari on iOS: true when opened from the home screen */
  standalone?: boolean;
}

// the game's selectors pick out page elements (or SVG ones, which share what the game uses: dataset, hidden,
// focus), so a selector's result is typed as an HTML element rather than the bare Element
interface ParentNode {
  querySelector<E extends HTMLElement = HTMLElement>(selectors: string): E | null;
  querySelectorAll<E extends HTMLElement = HTMLElement>(selectors: string): NodeListOf<E>;
}

interface Element {
  /** a counter's running glide across the board, cancelled before another starts */
  glide?: Animation;
}
