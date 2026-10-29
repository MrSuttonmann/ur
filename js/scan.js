/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Scanning a friend's invite QR code with the camera, for Join with a code. A browser with a QR reader of its own
// (BarcodeDetector) uses it; the rest, iPhones among them, use jsQR, which is fetched the first time someone scans.

const JSQR_SCRIPT = 'vendor/jsqr.js';
const SCAN_EVERY_MS = 150; // often enough to feel instant, seldom enough to spare a phone's battery
const SCAN_WIDTH = 480; // frames are read at most this wide: plenty for a QR code held up to the camera

let scanning = null; // while the camera is on: { stream, video, timer, stopped }

const canScan = () => Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

let jsQRLoading = null;
function loadJsQR() {
  jsQRLoading ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = JSQR_SCRIPT;
    script.onload = () => resolve(/** @type {any} */ (window).jsQR);
    script.onerror = () => {
      jsQRLoading = null; // a later scan tries again
      reject(new Error('jsQR did not load'));
    };
    document.head.appendChild(script);
  });
  return jsQRLoading;
}

// a function reading the text of the QR code in the video's current frame, or null if there isn't one
async function qrReader() {
  const Detector = /** @type {any} */ (window).BarcodeDetector;
  if (Detector && (await Detector.getSupportedFormats()).includes('qr_code')) {
    const detector = new Detector({ formats: ['qr_code'] });
    return async (video) => {
      const [found] = await detector.detect(video);
      return found ? found.rawValue : null;
    };
  }
  const jsQR = await loadJsQR();
  const canvas = document.createElement('canvas'),
    context = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const scale = Math.min(1, SCAN_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    if (!canvas.width || !canvas.height) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const found = jsQR(pixels, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
    return found ? found.data : null;
  };
}

// Show the rear camera in `viewfinder` and pass the text of every QR code it sees to onText, until stopScanning().
// Rejects if the camera can't start: refused, missing, or the reader couldn't load.
// The video element exists only while scanning: browsers that gather a page's media (Brave's Playlist) would
// otherwise offer it, as they would the music, which is kept out of the page for the same reason.
async function startScanning(viewfinder, onText) {
  stopScanning();
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true; // an iPhone would otherwise play it full screen
  viewfinder.replaceChildren(video);
  const session = { stream: null, video, timer: 0, stopped: false };
  scanning = session;
  const read = await qrReader();
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  if (session.stopped) {
    stream.getTracks().forEach((track) => track.stop()); // stopped while the camera was starting
    return;
  }
  session.stream = stream;
  video.srcObject = stream;
  await video.play();
  const look = async () => {
    let text = null;
    try {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) text = await read(video);
    } catch (e) {} // a frame that can't be read is skipped
    if (session.stopped) return;
    if (text) onText(text);
    if (!session.stopped) session.timer = setTimeout(look, SCAN_EVERY_MS);
  };
  look();
}

function stopScanning() {
  if (!scanning) return;
  scanning.stopped = true;
  clearTimeout(scanning.timer);
  if (scanning.stream) scanning.stream.getTracks().forEach((track) => track.stop());
  scanning.video.remove();
  scanning = null;
}
