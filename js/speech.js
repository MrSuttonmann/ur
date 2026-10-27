/* The Royal Game of Ur. Copyright (C) 2026 MrSuttonmann. GNU AGPL-3.0 or later; see LICENSE. */

// What the players say: each character's lines for each moment of the game, the face they pull,
// and the speech bubble that shows it. The portraits themselves are drawn in portraits.js.

// The moments a character reacts to:
//   start      a new game begins
//   rose       landing on a rose (another roll)
//   safeRose   landing on a safe rose that isn't the centre (Masters' and Murray's routes have them)
//   centre     landing on the safe centre rose
//   capture    taking an opposing counter
//   captured   losing a counter to a capture
//   pass       no move this turn
//   bigRoll    rolling the highest score, a 4
//   home       bringing a counter home
//   lastOne    bringing a counter home with just one left to go
//   worried    the opponent is down to their last counter
//   waiting    the person playing is taking their time (only the computer's characters say this)
//   win, lose  the end of the game
const LINES = {
  hero: {
    start: ['Let’s play!', 'Ready when you are.', 'Right. Let’s see what the dice say.', 'Good luck. You’ll need it!',
      'Four thousand years old and still a good game.', 'I’ve got a feeling about this one.', 'May the roses be with me.'],
    rose: ['Again!', 'A rose for me!', 'Roll again? Don’t mind if I do.', 'Lovely rosette.', 'Two turns for the price of one!',
      'The roses like me today.', 'And again!'],
    safeRose: ['Safe on the rose, and rolling again.', 'They can’t touch me here.', 'A safe rose. Very nice.', 'Sitting pretty.'],
    capture: ['Gotcha!', 'Back you go!', 'Sorry, not sorry.', 'That one’s mine!', 'Off the board with you!',
      'Should’ve stayed in your tray.', 'Right where I wanted you.'],
    captured: ['Oh, come on!', 'Not that one!', 'I’d only just got it going…', 'Rude!', 'Back to the start. Again.',
      'I’ll remember that.', 'Hmph.'],
    pass: ['Rats.', 'Nothing at all…', 'The dice hate me.', 'A whole lot of nothing.', 'Well, that was useless.', 'Pass. Sigh.'],
    bigRoll: ['A four!', 'Full speed ahead!', 'Now that’s a roll.', 'All four tips up!'],
    home: ['One safely home!', 'Made it!', 'Home and dry.', 'That’s one less to worry about.', 'Off the board and safe.',
      'One down!'],
    lastOne: ['Just one more to go!', 'Last one. Come on…', 'Nearly there!', 'One left. Don’t blow it now.'],
    worried: ['Uh-oh. They’re nearly home.', 'I need to catch up, fast.', 'Not yet! Not yet!', 'Come on, dice. Help me out.'],
    centre: ['Safe and sound.', 'The middle rose is mine.', 'Nobody can touch me here.', 'Best seat on the board.',
      'I’ll just sit here a while.'],
    win: ['Victory!', 'Ha! I win!', 'Yes! Every last one home!', 'Champion of Ur!', 'Too easy. (It wasn’t.)', 'Get in!'],
    lose: ['Next time…', 'Well played.', 'Close one.', 'Best of three?', 'The dice were against me.', 'Rematch!'],
  },
  squire: {
    start: ['A real match! I’ll do my best, I promise!', 'Be gentle with me?', 'Sir Knight says I’m getting better!',
      'Ooh, I love this game!', 'I’ve been practising. A bit.', 'Do you want to go first? Oh, it’s decided. Right.',
      'Okay, okay, I’m ready. I think.'],
    rose: ['A flower! Do I get another go?', 'Ooh, a lucky rose!', 'Another turn! Yes!', 'The pretty square!',
      'I love the roses.', 'Again, again!'],
    safeRose: ['A safe rose! I read about these!', 'Nobody can get me here, right? Right?', 'Ooh, safe and another go!'],
    capture: ['Sorry! Sorry! Rules are rules!', 'I got one! Did you see?', 'Oh! I didn’t mean to! …Well, I did.',
      'Was that allowed? It was? Brilliant!', 'Sir Knight would be proud!', 'Sorry about that one.'],
    captured: ['Hey! That was my favourite one.', 'Oh no, back to the start…', 'Aww.', 'I didn’t see that coming.',
      'That’s not fair! …It is fair. But still.', 'My poor little counter!'],
    pass: ['Nothing? Not even one?', 'The dice don’t like me.', 'Did I throw them wrong?', 'Oh. Your go, I suppose.',
      'Maybe if I blow on them next time.'],
    bigRoll: ['Four! Is four good? Four is good!', 'Whoa, all of them!', 'Look how far I can go!'],
    home: ['Made it home!', 'One safe!', 'Phew! That one made it.', 'Home! Home! Home!', 'Did you see that one get home?'],
    lastOne: ['Only one left! Is this really happening?', 'Just one more! Don’t panic, don’t panic…', 'I might actually win!'],
    worried: ['You’re nearly finished! Wait for me!', 'Oh no, oh no, oh no.', 'Can you slow down a bit?'],
    centre: ['The middle rose! Nobody can touch me here.', 'I’m in the middle! Safest place, Sir Knight says.',
      'I’m staying right here.'],
    win: ['I won? I WON! Wait till I tell Sir Knight!', 'Really? Me? Yes!', 'Can I keep the counters?',
      'Best. Day. Ever.'],
    lose: ['Well played! Can we go again?', 'I’ll get you next time!', 'You’re really good at this.',
      'I learnt something, though!', 'Sir Knight will want to hear how you did that.'],
    waiting: ['Take your time!', 'Hmm, tricky one?', 'I like thinking too.', 'Shall I hum something?'],
  },
  knight: {
    start: ['Let us play with honour.', 'En garde, good friend.', 'May the better player prevail.', 'To the board!',
      'I have trained for this.', 'Let the dice decide our fate.', 'A noble contest awaits.'],
    rose: ['The rose favours the bold!', 'Onward, once more!', 'Fortune rides with me.', 'Another charge!',
      'The rosette grants me another throw.', 'Again, my steed!'],
    safeRose: ['A rose and a rampart both.', 'I hold this ground.', 'Safe behind the walls, and riding again.'],
    capture: ['Yield!', 'A fair strike, fairly made.', 'Have at thee!', 'Back to the barracks with you.',
      'Forgive me. It was a clean hit.', 'The field is mine.', 'Your counter fought bravely.'],
    captured: ['A worthy blow. I shall return.', 'Bested, but not beaten!', 'A clever stroke.', 'I fall back, for now.',
      'Well struck, I must admit.', 'I shall avenge that one.'],
    pass: ['Patience is a knight’s virtue.', 'No matter. I hold my ground.', 'A knight waits for his moment.',
      'Even the bravest must rest.', 'The dice test my patience.'],
    bigRoll: ['A full charge!', 'Four! Forward, at the gallop!', 'Now we ride.'],
    home: ['Another safe within the walls.', 'Home, with honour.', 'One returns from the field.', 'Safely through the gates.',
      'Well ridden.'],
    lastOne: ['One last rider remains.', 'The final charge begins.', 'One more, and the day is won.'],
    worried: ['You are nearly through. I must make haste.', 'Hold, the battle is not yet lost!', 'To arms! The end draws near.'],
    centre: ['I hold the keep!', 'The centre is ours to defend.', 'From here, I command the field.'],
    win: ['Victory, with honour!', 'A hard-won field.', 'Well fought. The day is mine.', 'For the realm!'],
    lose: ['Well fought. You have my respect.', 'I yield. You played nobly.', 'A fine victory, fairly won.',
      'I shall train harder.', 'You would make a fine knight.'],
    waiting: ['Consider your move with care.', 'A wise player does not rush.', 'Take the time you need.',
      'The board will wait.'],
  },
  king: {
    start: ['You may begin. We shall allow it.', 'Kneel. …After the game.', 'We have played this since Ur was a village.',
      'Try not to bore us.', 'We are the finest player in all Sumer.', 'The royal board is set. Be grateful.',
      'Do try to keep up.'],
    rose: ['Naturally. The roses know their king.', 'Again! As is our right.', 'The rose bows to us.',
      'Of course we roll again.', 'Royal privilege.', 'We expected nothing less.'],
    safeRose: ['A royal residence, and another throw.', 'Our summer palace.', 'Untouchable. As ever.'],
    capture: ['Off with its head!', 'Back to the peasantry with you.', 'Banished!', 'Know your place.',
      'You were in our way.', 'To the dungeons!', 'How amusing.'],
    captured: ['How DARE you.', 'Guards! …Guards?', 'That is treason.', 'We shall have you exiled.',
      'This will be remembered.', 'Unthinkable!'],
    pass: ['The dice are clearly broken.', 'We meant to do that.', 'We choose not to move. Royally.',
      'Fetch new dice.', 'Who carved these dice? Have them flogged.', 'A tactical pause.'],
    bigRoll: ['A four. Obviously.', 'The dice know their master.', 'As decreed.'],
    home: ['Another loyal subject returns.', 'Home to the palace.', 'Welcome back to court.', 'Another for the treasury.',
      'As it should be.'],
    lastOne: ['One more, and we shall accept your surrender.', 'Prepare the victory feast.', 'The crown is all but ours.'],
    worried: ['This is most irregular.', 'We demand a recount.', 'Somebody stop them!', 'We did not authorise this.'],
    centre: ['We shall sit upon our throne.', 'The throne room. Ours.', 'All shall bow to the centre.'],
    win: ['As was always destined.', 'Of course. Bow.', 'Write this on a tablet for posterity.',
      'Did you ever doubt it?', 'Kneel.'],
    lose: ['We shall be speaking to the royal dice-maker.', 'This game is declared a draw.', 'We let you win.',
      'This never happened.', 'Best of seven. By royal decree.', 'Strike this from the records.'],
    waiting: ['We are waiting.', 'Today, if you please.', 'The court grows old.', 'Shall we send for a scribe to help you?',
      'We have kingdoms to run, you know.'],
  },
  stargazer: {
    start: ['The moon is rising.', 'The stars are watching.', 'The heavens are in position.', 'A fine night for a game.',
      'I read the omens this morning.', 'Let the moon light my way.'],
    rose: ['The heavens smile on me.', 'Written in the stars!', 'A lucky constellation.', 'The moon turns again.',
      'The stars align!'],
    safeRose: ['A safe harbour among the stars.', 'Under the moon’s protection.', 'A sheltered star, and another throw.'],
    capture: ['Eclipsed!', 'The night swallows you.', 'Your star has set.', 'Back into darkness.',
      'The moon takes what it wants.'],
    captured: ['A cloud across my moon…', 'The stars did not foresee that.', 'A falling star.', 'My moon wanes.',
      'An ill omen.'],
    pass: ['The moon waits.', 'Even stars must rest.', 'A starless night.', 'The heavens are quiet.'],
    bigRoll: ['A full moon!', 'Four, like the quarters of the moon.', 'A bright night!'],
    home: ['Safe beneath the moon.', 'Home among the stars.', 'Another star in its place.', 'Safely through the night.'],
    lastOne: ['One star left to set.', 'The last light of the night.', 'Dawn is coming for you.'],
    worried: ['The sun is rising too fast.', 'Dawn approaches…', 'I see trouble in the stars.'],
    centre: ['A quiet orbit, safe from harm.', 'The centre of the heavens.', 'The pole star holds still.'],
    win: ['The moon prevails!', 'The night belongs to me.', 'The stars foretold it.'],
    lose: ['The sun has its day.', 'Even the moon must set.', 'The heavens favoured you tonight.', 'Until the next new moon.'],
  },
};
LINES.heroLocal = LINES.hero;

// the face each moment brings, with a few characters reacting their own way
const EVENT_FACE = { start: 'smile', rose: 'happy', safeRose: 'smug', centre: 'smug', capture: 'smug', captured: 'angry',
  pass: 'sad', bigRoll: 'happy', home: 'happy', lastOne: 'happy', worried: 'surprised', waiting: 'neutral', win: 'happy', lose: 'sad' };
const FACE_OVERRIDE = {
  squire: { captured: 'sad', worried: 'sad' },
  knight: { pass: 'neutral', captured: 'surprised', worried: 'neutral' },
  king: { pass: 'angry', lose: 'angry', worried: 'angry', waiting: 'angry' },
};

const FACE_MS = 3200, BUBBLE_MS = 3300;   // how long a reaction shows
const mood = SIDES.map(() => ({ face: null, until: 0 }));   // a reaction's face, shown until the time given
let speechTimers = [];                            // reactions waiting to happen
const bubbleTimers = SIDES.map(() => null);        // each side's "hide the bubble" timer; a new line replaces it
// a character doesn't say the same line twice running
const lastLine = SIDES.map(() => null);
function pickLine(side, lines) {
  const fresh = lines.length > 1 ? lines.filter(line => line !== lastLine[side]) : lines;
  return lastLine[side] = fresh[Math.floor(Math.random() * fresh.length)];
}

function clearSpeech() {
  speechTimers.forEach(clearTimeout); speechTimers = [];
  bubbleTimers.forEach(clearTimeout);
  clearTimeout(waitingTimer);
  document.querySelectorAll('.portrait').forEach(portrait => portrait.classList.remove('speaking'));
  mood.forEach(reaction => { reaction.face = null; reaction.until = 0; });
  document.querySelectorAll('.speech').forEach(bubble => { bubble.hidden = true; });
}
// a reaction: a face for a few seconds and, usually, a line in a speech bubble
function speak(side, event, delay = 0, chance = 1) {
  if (Math.random() > chance) return;
  const thisGame = gameId;
  speechTimers.push(setTimeout(() => {
    if (thisGame !== gameId) return;
    const who = characterFor(side), lines = LINES[who][event];
    if (!lines) return;   // not every character has a line for every moment
    mood[side] = { face: (FACE_OVERRIDE[who] || {})[event] || EVENT_FACE[event], until: Date.now() + FACE_MS };
    const bubble = $('speech' + side), portrait = $('portrait' + side);
    bubble.textContent = pickLine(side, lines);
    bubble.hidden = false;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    portrait.classList.add('speaking');   // on phones, this slides the character in from the edge
    drawPortraits();
    clearTimeout(bubbleTimers[side]);     // an earlier line's timer mustn't hide this one early
    bubbleTimers[side] = setTimeout(() => {
      if (thisGame !== gameId) return;
      bubble.hidden = true;
      portrait.classList.remove('speaking');
      drawPortraits();
    }, BUBBLE_MS);
  }, delay));
}

// the computer's character remarks when the person playing it takes a long time over a move
const WAITING_REMARK_MS = 25000;
let waitingTimer = null;
function remarkIfSlow() {
  clearTimeout(waitingTimer);
  if (game.mode !== 'ai' || game.phase !== 'move' || isComputer(game.turn)) return;
  const thisGame = gameId;
  waitingTimer = setTimeout(() => {
    if (thisGame === gameId && game.phase === 'move' && !isComputer(game.turn)) speak(COMPUTER_SIDE, 'waiting');
  }, WAITING_REMARK_MS);
}
