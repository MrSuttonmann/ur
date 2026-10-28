/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// The Rules, Strategy, Options and Stats windows, and the odds tables inside them.

// reading windows: open at the top, close by button, backdrop click or Esc, then return focus to the opener
function wireReadingWindow(dialogId, openId, closeId) {
  const dialog = $(dialogId);
  $(openId).addEventListener('click', () => {
    dialog.showModal();
    dialog.querySelector('.stats-inner').scrollTop = 0;
    $(closeId).focus();
  });
  $(closeId).addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  }); // a click on the backdrop
  dialog.addEventListener('close', () => $(openId).focus());
}
wireReadingWindow('rules-dlg', 'open-rules', 'close-rules');
wireReadingWindow('tactics-dlg', 'open-tactics', 'close-tactics');
wireReadingWindow('options-dlg', 'open-options', 'close-options');

// odds bars: the chance of each roll (in the rules), and of being hit from each distance (in the strategy)
const MOST_LIKELY_ROLL = 2;
const oddsBar = (chance) =>
  `<span class="bar" style="width:${(chance / ROLL_CHANCE[MOST_LIKELY_ROLL]) * 100}%"></span>`;
$('odds').innerHTML = ROLL_CHANCE.map(
  (chance, roll) => `<span class="n">${roll}</span>${oddsBar(chance)}<span class="p">${chance * 16} in 16</span>`,
).join('');
$('danger-odds').innerHTML = ROLL_CHANCE.slice(1)
  .map((chance, i) => {
    const gap = i + 1;
    return `<span class="n">${gap}</span>${oddsBar(chance)}<span class="p">${+(chance * 100).toFixed(2)}% · enemy ${gap} behind</span>`;
  })
  .join('');

// the Stats window, with one tooltip shared by every chart mark
const statsWindow = $('stats');
$('open-stats').addEventListener('click', () => {
  statsTab = 'game';
  resetAsk = false;
  drawStats();
  statsWindow.showModal();
  $('close-stats').focus();
});
$('close-stats').addEventListener('click', () => statsWindow.close());
statsWindow.addEventListener('click', (e) => {
  if (e.target === statsWindow) statsWindow.close();
}); // a click on the backdrop
statsWindow.addEventListener('close', () => {
  $('tip').hidden = true;
  $('open-stats').focus();
});
document.querySelectorAll('.stats-tabs button').forEach((tab) =>
  tab.addEventListener('click', () => {
    statsTab = tab.dataset.tab;
    resetAsk = false;
    drawStats();
  }),
);
statsWindow.addEventListener('pointermove', (e) => {
  const mark = e.target.closest('[data-tip]'),
    tip = $('tip');
  if (!mark) {
    tip.hidden = true;
    return;
  }
  tip.textContent = mark.dataset.tip;
  tip.hidden = false;
  const width = tip.offsetWidth;
  tip.style.left = Math.min(Math.max(8, e.clientX - width / 2), innerWidth - width - 8) + 'px';
  tip.style.top = e.clientY - tip.offsetHeight - 12 + 'px';
});
statsWindow.addEventListener('pointerleave', () => {
  $('tip').hidden = true;
});
