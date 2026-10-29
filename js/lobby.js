/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// Getting two people into an online game: the host's invite panel (link, QR code, seats, Start game), the friend's
// join screen and waiting view, the notes for a full or ended room, and the offer to rejoin. Names always go in
// as text, never as HTML.

const CONNECTION_TROUBLE = 'Couldn’t reach the game just now. Check your connection and try again.';

// the name typed last time fills in both name fields
$('player-name').value = prefs.name;
function rememberName(name) {
  prefs.name = name;
  savePrefs();
  $('player-name').value = name;
}
const typedName = (input) => input.value.replace(/\s+/g, ' ').trim();

// the seats' counters, drawn once
document.querySelectorAll('.seat-counter').forEach((slot) => {
  const side = Number(slot.dataset.side);
  slot.innerHTML = counterSVG(side, side);
});

// ---------- the host: inviting ----------
function showNameProblem(text) {
  const input = $('player-name');
  input.setCustomValidity(text);
  input.reportValidity();
}
$('player-name').addEventListener('input', () => $('player-name').setCustomValidity(''));
$('player-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('newgame').click();
});

let creatingRoom = false;
async function startInviting() {
  const name = typedName($('player-name'));
  if (!name) {
    showNameProblem('Please enter your name, so your friend knows who’s inviting them.');
    return;
  }
  if (creatingRoom) return;
  creatingRoom = true;
  rememberName(name);
  leaveOnlineGame(); // inviting someone new leaves the last online game's room
  const { status, data } = await roomApi('POST', '/api/rooms', { name, variant: prefs.variant });
  creatingRoom = false;
  if (status === 400 && data && data.error === 'name') showNameProblem('Please enter your name.');
  else if (status !== 201) showNameProblem(CONNECTION_TROUBLE);
  else {
    saveSeat(data.id, { key: data.key, seat: SUN, opponent: null });
    openInvite(data.id);
  }
}

// the invite panel for a room this browser hosts, listening to the room, whose state fills in the seats
function openInvite(roomId) {
  showInvitePanel(roomId);
  connectRoom(roomId);
}
function showInvitePanel(roomId) {
  const link = inviteLink(roomId);
  setLinkRoom(roomId); // a reload comes back here
  // the code is what matters, so it's shown large; Copy and Share give the whole link
  $('invite-link').dataset.link = link;
  $('invite-code').textContent = roomId;
  $('invite-host').textContent = new URL(link).host;
  const code = qrcode(0, 'M');
  code.addData(link);
  code.make();
  $('invite-qr').innerHTML = code.createSvgTag({ cellSize: 1, margin: 4, scalable: true });
  $('invite-share').hidden = !navigator.share;
  drawSeats('seat', [null, null]);
  $('invite-start').disabled = true;
  if (!$('invite-dlg').open) $('invite-dlg').showModal();
  $('invite-copy').focus();
}

// a seat shows its player's name, or that it's waiting for one
function drawSeats(prefix, names) {
  names.forEach((name, side) => {
    const seat = $(prefix + side);
    seat.textContent = name || (side === SUN ? '' : 'Waiting for a friend…');
    seat.classList.toggle('waiting', !name);
  });
}

$('invite-copy').addEventListener('click', async () => {
  const button = $('invite-copy'),
    label = button.querySelector('.lbl');
  const link = $('invite-link').dataset.link;
  let copied = false;
  try {
    await navigator.clipboard.writeText(link);
    copied = true;
  } catch (e) {
    copied = copyTheOldWay(link);
  }
  label.textContent = copied ? 'Copied' : 'Couldn’t copy';
  setTimeout(() => (label.textContent = 'Copy link'), 2000);
});
// for browsers that refuse the clipboard API: copy from a briefly selected, off-screen text box
function copyTheOldWay(text) {
  const box = document.createElement('textarea');
  box.value = text;
  box.readOnly = true;
  box.style.cssText = 'position:fixed;top:0;left:-9999px;font-size:16px';
  $('invite-dlg').appendChild(box); // inside the dialog, which is the only part of a modal page that can be selected
  box.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (e) {}
  box.remove();
  return copied;
}
$('invite-share').addEventListener('click', () => {
  navigator
    .share({
      title: 'The Royal Game of Ur',
      text: 'Come and play the Royal Game of Ur with me.',
      url: $('invite-link').dataset.link,
    })
    .catch(() => {}); // the player closed the share sheet
});
$('invite-start').addEventListener('click', () => sendIntent({ t: 'start' }));

// cancelling the invite ends the room: a friend waiting in it, or anyone opening the link later, is told so
function cancelInvite() {
  leaveRoom();
  setLinkRoom(null);
  $('invite-dlg').close();
  showSetupBoard();
}
$('invite-cancel').addEventListener('click', cancelInvite);
// Esc would leave the room open with no way back to it, so only the buttons close the panel
$('invite-dlg').addEventListener('cancel', (e) => e.preventDefault());

// ---------- the friend: joining ----------
let joining = null; // the room the join screen is for, and its host: {roomId, host}
function showJoin(roomId, info) {
  joining = { roomId, host: info.host };
  const rules = VARIANTS[info.variant] || VARIANTS.classic;
  $('join-host').textContent = `${info.host} has invited you to play the Royal Game of Ur`;
  $('join-rules').textContent = `${rules.name} rules: ${variantFacts(rules)}`;
  $('join-name').value = prefs.name;
  $('join-error').hidden = true;
  $('join-form').hidden = false;
  $('join-wait').hidden = true;
  if (!$('join-dlg').open) $('join-dlg').showModal();
  $('join-name').focus();
}
function showJoinError(text) {
  $('join-error').textContent = text;
  $('join-error').hidden = false;
  $('join-name').focus();
}
$('join-name').addEventListener('input', () => {
  $('join-error').hidden = true;
});

$('join-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = typedName($('join-name')),
    { roomId, host } = joining;
  if (!name) {
    showJoinError('Please enter your name.');
    return;
  }
  $('join-go').disabled = true;
  const { status, data } = await roomApi('POST', `/api/rooms/${roomId}/join`, { name });
  $('join-go').disabled = false;
  if (status === 200) {
    rememberName(name);
    saveSeat(roomId, { key: data.key, seat: MOON, opponent: host });
    connectRoom(roomId); // the room's state shows the waiting view
  } else if (status === 409) {
    $('join-dlg').close();
    showRoomNote('full');
  } else if (status === 410 || status === 404) {
    $('join-dlg').close();
    showRoomNote('ended');
  } else if (status === 400) showJoinError('Please enter your name.');
  else showJoinError(CONNECTION_TROUBLE);
});

// joined, and waiting for the host to start
function showJoinWaiting(view) {
  drawSeats('wait-seat', view.names);
  $('join-host').textContent = `${view.names[SUN]} has invited you to play the Royal Game of Ur`;
  $('join-wait-text').textContent = `Waiting for ${view.names[SUN]} to start the game…`;
  $('join-form').hidden = true;
  $('join-wait').hidden = false;
  if (!$('join-dlg').open) $('join-dlg').showModal();
}

// before joining, Esc (or Back) turns the invite down; once joined, the friend waits for the host, or leaves
$('join-dlg').addEventListener('cancel', (e) => {
  if (!$('join-wait').hidden) e.preventDefault();
  else setLinkRoom(null);
});
// leaving the waiting room gives up the seat, so the host can invite someone else on the same link
$('join-leave').addEventListener('click', () => {
  leaveRoom();
  setLinkRoom(null);
  $('join-dlg').close();
  showSetupBoard();
});

// ---------- following the room ----------
function closeLobbyWindows() {
  for (const id of ['invite-dlg', 'join-dlg']) if ($(id).open) $(id).close();
}

onRoomState((message) => {
  // the room closed the socket: another tab took this seat, or the room has ended (expired, say) without a
  // closing state to say so
  if (message.type === 'closed') {
    if (message.code === CLOSE_ENDED) forgetSeat(message.roomId);
    closeLobbyWindows();
    showRoomNote(message.code === CLOSE_REPLACED ? 'elsewhere' : 'ended');
    return;
  }
  if (message.type !== 'state') return;
  const view = message.state;
  if (view.phase === 'closed') {
    forgetSeat(online.roomId);
    closeLobbyWindows();
    if (view.winner === null) {
      disconnectRoom();
      showRoomNote('ended');
      return;
    }
    // the other player left during or after a game: the board shows its end at once (a forfeit as your win),
    // and the page lets go of the room
    try {
      online.queue.push(message);
      catchUpWithRoom();
    } finally {
      disconnectRoom();
      setLinkRoom(null);
      render(); // the variant can be changed again
    }
    return;
  }
  queueRoomMessage(message); // the board plays out the room's states in order
  if (view.phase !== 'lobby') closeLobbyWindows();
  else if (online.seat === SUN) {
    if (!$('invite-dlg').open) showInvitePanel(online.roomId);
    drawSeats('seat', view.names);
    $('invite-start').disabled = !view.names[MOON];
  } else showJoinWaiting(view);
});

// what the room says about itself, {host, variant, status}; a reply that isn't the room's (a captive portal's
// page, say) counts as not reaching it, status 0
async function roomInfo(roomId) {
  const { status, data } = await roomApi('GET', `/api/rooms/${roomId}`);
  return status === 200 && !(data && data.status) ? { status: 0, data: null } : { status, data };
}

// an invite link opened: the host's own room, a friend's seat coming back, or someone new to the room
async function followInvite(roomId) {
  const { status, data } = await roomInfo(roomId);
  const live = status === 200 && data.status !== 'closed';
  const seat = savedSeats()[roomId];
  if (seat && !live && status !== 0 && status < 500) forgetSeat(roomId);
  if (status === 0 || status >= 500) showRoomNote('offline');
  else if (!live || (seat && seat.leaving)) {
    showRoomNote('ended'); // a game this browser has left, though the room may not have heard yet
    retryLeaves();
  } else if (seat && seat.seat === SUN && data.status === 'open') openInvite(roomId);
  else if (seat)
    connectRoom(roomId); // the room's state shows the lobby or the game, whichever it's in
  else if (data.status === 'full') showRoomNote('full');
  else showJoin(roomId, data);
}

// ---------- joining with just the code, for someone already on the site ----------
$('join-code').addEventListener('click', () => {
  $('code-input').value = '';
  $('code-error').hidden = true;
  closeViewfinder();
  $('code-dlg').showModal();
  $('code-input').focus();
});
$('code-cancel').addEventListener('click', () => $('code-dlg').close());
$('code-dlg').addEventListener('close', closeViewfinder); // the camera is never left on behind a closed window
$('code-input').addEventListener('input', () => {
  $('code-error').hidden = true;
});
// a message under the code; the typing box takes the focus back unless the camera is in use, which would raise
// the phone's keyboard over the viewfinder
function showCodeError(text, { focus = true } = {}) {
  $('code-error').textContent = text;
  $('code-error').hidden = false;
  if (focus) $('code-input').focus();
}

// Scan QR code: the camera in a small viewfinder, and an invite's code is joined as if it had been typed
$('code-scan').addEventListener('click', async () => {
  $('code-error').hidden = true;
  $('code-scan').hidden = true;
  $('code-viewfinder').hidden = false;
  try {
    await startScanning($('code-viewfinder'), scanned);
  } catch (e) {
    closeViewfinder();
    showCodeError(cameraTrouble(e), { focus: false });
  }
});
function closeViewfinder() {
  stopScanning();
  $('code-viewfinder').hidden = true;
  $('code-scan').hidden = !canScan();
}
function scanned(text) {
  const code = codeInInvite(text);
  if (!code) {
    showCodeError('That QR code isn’t an invite.', { focus: false }); // and the camera keeps looking
    return;
  }
  closeViewfinder();
  $('code-input').value = code;
  $('code-form').requestSubmit();
}
// the code in an invite's QR code: its link (from this site or another copy of it), or just the code
function codeInInvite(text) {
  const inLink = /#g=(\w{6})$/.exec(text.trim());
  const code = (inLink ? inLink[1] : text.trim()).toUpperCase();
  return ROOM_CODE.test(code) ? code : null;
}
// why the camera didn't start, short enough for one line on a phone
function cameraTrouble(error) {
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'The camera wasn’t allowed.';
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'No camera was found.';
  return 'Couldn’t start the camera.';
}
// a code typed in any case, with spaces or a dash, is still the code
const typedCode = () => $('code-input').value.toUpperCase().replace(/[\s-]/g, '');
$('code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = typedCode();
  if (!ROOM_CODE.test(code)) {
    showCodeError('That isn’t a game code.');
    return;
  }
  $('code-go').disabled = true;
  const { status, data } = await roomInfo(code);
  $('code-go').disabled = false;
  if (status === 0 || status >= 500) showCodeError('Couldn’t reach the game. Try again.');
  else if (status !== 200 || data.status === 'closed') showCodeError('There’s no game with that code.');
  else {
    $('code-dlg').close();
    setLinkRoom(code); // as if they'd opened the link, so a reload comes back to the game
    followInvite(code);
  }
});

// ---------- notes: a full or ended room ----------
const ROOM_NOTES = {
  full: ['The game is full', 'This game already has two players. You’re welcome to start a game of your own.'],
  ended: ['The game has ended', 'This game has ended. You’re welcome to start a game of your own.'],
  elsewhere: ['Playing in another tab', 'This game is now open in another tab or window, so it has stopped here.'],
  offline: [
    'Can’t reach the game',
    'Couldn’t reach the game just now. Check your connection, then open the link again.',
  ],
};
function showRoomNote(kind) {
  const [title, text] = ROOM_NOTES[kind];
  $('room-note-title').textContent = title;
  $('room-note-text').textContent = text;
  if (!$('room-note-dlg').open) $('room-note-dlg').showModal();
  $('room-note-own').focus();
}
$('room-note-own').addEventListener('click', () => $('room-note-dlg').close());
// whichever way the note closes, the visitor is left on a fresh board, ready to invite someone of their own
$('room-note-dlg').addEventListener('close', () => {
  setLinkRoom(null);
  $('mode-online').checked = true;
  showSetupBoard();
  $('player-name').focus();
});

// ---------- rejoining a game this browser has a seat in ----------
let rejoinRoom = null;
// The newest saved seat whose room is still alive, as a room id, or null. Seats for rooms that are gone or closed
// are forgotten on the way; one that can't be checked (no connection, a failing room) is left saved, and skipped.
async function liveSeatRoom() {
  for (const roomId of seatsNewestFirst()) {
    // a seat may have gone while the last was checked (a leave confirmed, say), and one being left isn't offered
    const seat = savedSeats()[roomId];
    if (!seat || seat.leaving) continue;
    const { status, data } = await roomInfo(roomId);
    if (status === 200 && data.status !== 'closed') return roomId;
    if (status === 404 || (status === 200 && data.status === 'closed')) forgetSeat(roomId);
  }
  return null;
}
function offerRejoin(roomId) {
  const seat = savedSeats()[roomId];
  if (!seat) return;
  rejoinRoom = roomId;
  $('rejoin-text').textContent = `Rejoin your game with ${seat.opponent || 'your friend'}?`;
  $('rejoin-dlg').showModal();
  $('rejoin-yes').focus();
}
$('rejoin-yes').addEventListener('click', () => {
  $('rejoin-dlg').close();
  setLinkRoom(rejoinRoom);
  followInvite(rejoinRoom);
});
$('rejoin-no').addEventListener('click', () => $('rejoin-dlg').close());

// an invite link pasted into a tab already open is followed, between games and with no online room held
addEventListener('hashchange', () => {
  const roomId = roomInLink();
  if (roomId && !online.roomId && isBetweenGames()) {
    closeLobbyWindows();
    $('mode-online').checked = true;
    showSetupBoard();
    followInvite(roomId);
  }
});
