/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Installing the game as an app, and the service worker that lets it work offline.

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

let installOffer = null;   // the browser's install prompt, kept for our own button
const isInstalledApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isAppleMobile = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function drawInstallSection() {
  const text = $('install-text');
  $('install-btn').hidden = !installOffer;
  if (isInstalledApp()) text.textContent = 'You’re playing the installed app. It works offline too.';
  else if (installOffer) text.textContent = 'Install the game to play it from your home screen or desktop, even with no connection.';
  else if (isAppleMobile()) text.innerHTML = 'To install on iPhone or iPad, open this page in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.';
  else text.textContent = 'Install the game to play it from your home screen or desktop, even with no connection. If your browser offers it, use its Install or Add to Home Screen option.';
}
// Chrome, Edge and Android offer installing
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installOffer = e; drawInstallSection(); });
addEventListener('appinstalled', () => {
  installOffer = null;
  drawInstallSection();
  $('install-text').textContent = 'Installed. Look for The Royal Game of Ur on your home screen or in your apps.';
});
$('install-btn').addEventListener('click', async () => {
  if (!installOffer) return;
  installOffer.prompt();
  await installOffer.userChoice;
  installOffer = null;
  drawInstallSection();
});
drawInstallSection();
