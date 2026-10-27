/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Hand-drawn toolbar icons: ink lines with the same wobble filter as the board.
// Any element with data-icon="name" is filled with that icon when the page loads.

const ICONS = {
  play: `<path d="M7 4.6 C7 3.9 7.7 3.6 8.3 4 L19.2 11.2 C19.8 11.6 19.8 12.4 19.2 12.8 L8.3 20 C7.7 20.4 7 20.1 7 19.4 Z" style="${paint('bone', 1)};stroke:var(--ink);stroke-width:1.6;stroke-linejoin:round"/>`,
  book: `<path d="M12 6.5 C9 4.8 5.5 4.8 2.8 5.8 V19 C5.5 18 9 18 12 19.6 C15 18 18.5 18 21.2 19 V5.8 C18.5 4.8 15 4.8 12 6.5 Z" style="${paint('bone', 1)}"/>
    <path d="M12 6.5 C9 4.8 5.5 4.8 2.8 5.8 V19 C5.5 18 9 18 12 19.6 C15 18 18.5 18 21.2 19 V5.8 C18.5 4.8 15 4.8 12 6.5 Z M12 6.5 V19.6 M5.2 9 C7 8.5 8.6 8.6 10 9.2 M5.2 12 C7 11.5 8.6 11.6 10 12.2 M14 9.2 C15.4 8.6 17 8.5 18.8 9" style="${ink}"/>
    <path d="M15.5 12 V21 L16.8 19.8 L18.1 21 V12" style="${paint('vermilion', .9)};stroke:var(--ink);stroke-width:1"/>`,
  swords: `<path d="M4.5 3.5 L15.5 14.5 M19.5 3.5 L8.5 14.5" style="${ink};stroke-width:1.9"/><path d="M4.5 3.5 L6.8 4 M4.5 3.5 L5 5.8 M19.5 3.5 L17.2 4 M19.5 3.5 L19 5.8" style="${ink}"/>
    <path d="M12.8 17.3 L17.8 12.3 M6.2 12.3 L11.2 17.3" style="${ink};stroke-width:2"/>
    <path d="M15.6 15.6 L19 19 M8.4 15.6 L5 19" style="fill:none;stroke:var(--vermilion);stroke-width:2.6;stroke-linecap:round"/>
    <circle cx="19.8" cy="19.8" r="1.5" style="${paint('ochre', 1)};stroke:var(--ink);stroke-width:1"/><circle cx="4.2" cy="19.8" r="1.5" style="${paint('ochre', 1)};stroke:var(--ink);stroke-width:1"/>`,
  route: `<path d="M4.5 19.5 C4 14 9.5 15.5 11.5 11.5 C13 8.5 10 6 13.5 4.8 C15.5 4.1 17.5 5 18.5 6.2" style="fill:none;stroke:var(--ink);stroke-width:1.8;stroke-linecap:round;stroke-dasharray:.1 3.2"/>
    <path d="M15.8 3.6 L19.2 6.6 L15 7.6" style="${ink};stroke-width:1.6"/><circle cx="4.5" cy="19.5" r="2.2" style="${paint('vermilion', .9)};stroke:var(--ink);stroke-width:1"/>`,
  owl: `<path d="M6 7.5 L5 3.5 L8.6 5.8 M18 7.5 L19 3.5 L15.4 5.8" style="${ink}"/>
    <path d="M12 5.2 C17.5 5.2 19.5 9.5 19 14 C18.5 18.5 15.5 21 12 21 C8.5 21 5.5 18.5 5 14 C4.5 9.5 6.5 5.2 12 5.2 Z" style="${paint('ochre', .9)}"/>
    <path d="M12 5.2 C17.5 5.2 19.5 9.5 19 14 C18.5 18.5 15.5 21 12 21 C8.5 21 5.5 18.5 5 14 C4.5 9.5 6.5 5.2 12 5.2 Z" style="${ink}"/>
    <circle cx="9" cy="10.5" r="2.6" style="${paint('bone', 1)};stroke:var(--ink);stroke-width:1.1"/><circle cx="15" cy="10.5" r="2.6" style="${paint('bone', 1)};stroke:var(--ink);stroke-width:1.1"/>
    <circle cx="9" cy="10.7" r="1" style="fill:var(--ink)"/><circle cx="15" cy="10.7" r="1" style="fill:var(--ink)"/>
    <path d="M11 13.3 L12 15 L13 13.3 Z" style="${paint('vermilion', 1)};stroke:var(--ink);stroke-width:.8"/><path d="M9 17 C10.5 18 13.5 18 15 17" style="${ink}"/>`,
  key: `<circle cx="7" cy="12" r="4.2" style="${paint('ochre', .9)};stroke:var(--ink);stroke-width:1.4"/><circle cx="7" cy="12" r="1.6" style="${paint('bone', 1)};stroke:var(--ink);stroke-width:1"/>
    <path d="M11.2 12 H21 M17.5 12 V15.5 M20.5 12 V14.5" style="${ink};stroke-width:1.8"/>`,
  music: `<path d="M8.5 17.5 V6.5 L19.5 4.2 V15.5 M8.5 9.5 L19.5 7.2" style="${ink};stroke-width:1.7"/>
    <ellipse cx="6.4" cy="17.6" rx="2.6" ry="2" transform="rotate(-20 6.4 17.6)" style="${paint('vermilion', .95)};stroke:var(--ink);stroke-width:1.2"/>
    <ellipse cx="17.4" cy="15.6" rx="2.6" ry="2" transform="rotate(-20 17.4 15.6)" style="${paint('vermilion', .95)};stroke:var(--ink);stroke-width:1.2"/>`,
  musicOff: `<path d="M8.5 17.5 V6.5 L19.5 4.2 V15.5 M8.5 9.5 L19.5 7.2" style="${ink};stroke-width:1.7"/>
    <ellipse cx="6.4" cy="17.6" rx="2.6" ry="2" transform="rotate(-20 6.4 17.6)" style="${paint('paper-deep', .95)};stroke:var(--ink);stroke-width:1.2"/>
    <ellipse cx="17.4" cy="15.6" rx="2.6" ry="2" transform="rotate(-20 17.4 15.6)" style="${paint('paper-deep', .95)};stroke:var(--ink);stroke-width:1.2"/>
    <path d="M3.5 3.5 L20.5 20.5" style="fill:none;stroke:var(--vermilion);stroke-width:2.2;stroke-linecap:round"/>`,
  tally: `<path d="M4.5 5.5 V18.5 M8.5 5 V19 M12.5 5.5 V18.5 M16.5 5 V19" style="${ink};stroke-width:1.9"/><path d="M2.5 15.5 L19.5 7.5" style="fill:none;stroke:var(--vermilion);stroke-width:2.2;stroke-linecap:round"/><path d="M20.5 19 V13" style="${ink};stroke-width:1.9"/>`,
  bell: `<path d="M5.5 16.5 C6 11 7.5 6.5 12 6.5 C16.5 6.5 18 11 18.5 16.5 Z" style="${paint('ochre', .95)}"/>
    <path d="M5.5 16.5 C6 11 7.5 6.5 12 6.5 C16.5 6.5 18 11 18.5 16.5 Z M4 16.5 H20 M12 6.5 V4.2 M10.3 18.6 A1.8 1.8 0 0 0 13.7 18.6" style="${ink}"/>
    <path d="M20.5 8.5 C21.6 9.8 21.6 12 20.5 13.3 M2.5 13.3 C1.4 12 1.4 9.8 2.5 8.5" style="${ink}"/>`,
  bellOff: `<path d="M5.5 16.5 C6 11 7.5 6.5 12 6.5 C16.5 6.5 18 11 18.5 16.5 Z" style="${paint('paper-deep', .9)}"/>
    <path d="M5.5 16.5 C6 11 7.5 6.5 12 6.5 C16.5 6.5 18 11 18.5 16.5 Z M4 16.5 H20 M12 6.5 V4.2 M10.3 18.6 A1.8 1.8 0 0 0 13.7 18.6" style="${ink}"/>
    <path d="M3.5 3.5 L20.5 20.5" style="fill:none;stroke:var(--vermilion);stroke-width:2.2;stroke-linecap:round"/>`,
};
const iconSVG = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><g filter="url(#ink)">${ICONS[name]}</g></svg>`;
document.querySelectorAll('[data-icon]').forEach(slot => { slot.innerHTML = iconSVG(slot.dataset.icon); });
