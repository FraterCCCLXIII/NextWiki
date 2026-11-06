/* Jingle playback shared by the loader and the logo sheet.
   Rule: the music may be faded or dropped, but the spoken "Kosmographica" is never cut or faded.
   `word` is the protected stretch of each file in seconds, including a small margin. */
const NO_WORD = [Infinity, Infinity];
const JINGLES = {
  1: { file: "jingle-1.mp3", name: "Kosmographica jingle 1", word: [2.15, 3.6] }, // music builds, then the word
  2: { file: "jingle-2.mp3", name: "Kosmographica jingle 2", word: [0, 1.25] }, // the word first, then a synth swell
  3: { file: "sound-1.mp3", name: "Jingle 1 music only", word: NO_WORD },
  4: { file: "sound-2.mp3", name: "Jingle 2 swell only", word: NO_WORD },
  5: { file: "boot-screen-chime.mp3", name: "Boot Screen Chime", word: NO_WORD },
  6: { file: "boot-screen-logo.mp3", name: "Boot Screen Logo", word: NO_WORD },
  7: { file: "bright-major-sting.mp3", name: "Bright Major Sting", word: NO_WORD },
  8: { file: "bright-startup.mp3", name: "Bright Startup", word: NO_WORD },
  9: { file: "console-startup.mp3", name: "Console Startup", word: NO_WORD },
  10: { file: "digital-chime.mp3", name: "Digital Chime", word: NO_WORD },
  11: { file: "magical-entrance.mp3", name: "Magical Entrance", word: NO_WORD },
  12: { file: "soft-major-arp.mp3", name: "Soft Major Arp", word: NO_WORD },
  13: { file: "system-ready.mp3", name: "System Ready", word: NO_WORD },
  14: { file: "warm-corporate-jingle.mp3", name: "Warm Corporate Jingle", word: NO_WORD },
  15: { file: "warm-felted-piano.mp3", name: "Warm Felted Piano", word: NO_WORD },
};
/* Every sound with no voice in it, so it suits any brand. */
const MUSIC_SOUNDS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const KOSMO_SOUNDS = [1, 2, 3, 4, ...MUSIC_SOUNDS];
const JINGLE_FADE = 0.3;

function createJinglePlayer(base) {
  let ctx = null, cur = null;
  const buffers = {};
  const getCtx = () => {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) ctx = new C();
    }
    return ctx;
  };
  const load = (n) => {
    if (!buffers[n]) {
      const c = getCtx();
      buffers[n] = c
        ? fetch(base + JINGLES[n].file).then((r) => r.arrayBuffer()).then((a) => c.decodeAudioData(a))
        : Promise.reject(new Error("no Web Audio"));
    }
    return buffers[n];
  };
  /* Ends the current jingle without touching the word. Returns the seconds until it's out of the way. */
  const release = (owner) => {
    if (!cur || (owner && cur.owner !== owner)) return 0;
    const now = ctx.currentTime, pos = now - cur.at, [a, b] = JINGLES[cur.n].word, playing = cur;
    cur = null;
    if (pos < 0) { playing.src.stop(); return 0; }
    if (pos >= playing.len) return 0;
    // before the word, with room for a whole fade: fade now. Otherwise the word finishes first.
    const fadeAt = pos + JINGLE_FADE + 0.02 <= a || pos >= b ? now : playing.at + b;
    const g = playing.gain.gain;
    g.setValueAtTime(1, fadeAt);
    g.linearRampToValueAtTime(0, fadeAt + JINGLE_FADE);
    playing.src.stop(fadeAt + JINGLE_FADE + 0.02);
    return fadeAt - now;
  };
  /* Browsers block sound until the visitor has interacted with the page. If blocked, this stays silent rather than playing late. */
  const play = async (n, owner) => {
    const c = getCtx();
    if (!c) return false;
    if (c.state !== "running") {
      await Promise.race([c.resume().catch(() => {}), new Promise((r) => setTimeout(r, 120))]);
      if (c.state !== "running") return false;
    }
    const buffer = await load(n);
    const wait = release();
    const src = c.createBufferSource(), gain = c.createGain();
    src.buffer = buffer;
    src.connect(gain).connect(c.destination);
    const at = c.currentTime + wait + 0.01;
    src.start(at);
    const me = { n, src, gain, at, len: buffer.duration, owner };
    cur = me;
    src.onended = () => { if (cur === me) cur = null; };
    return true;
  };
  /* Only for the visitor switching sound off: that is their call, so it stops right away. */
  const mute = () => {
    if (!cur) return;
    const now = ctx.currentTime;
    cur.gain.gain.setTargetAtTime(0, now, 0.02);
    cur.src.stop(now + 0.1);
    cur = null;
  };
  return { load, play, release, mute, unlock: () => { const c = getCtx(); if (c) c.resume().catch(() => {}); }, info: () => (cur && ctx ? { n: cur.n, pos: ctx.currentTime - cur.at } : null) };
}

/* Shuffled turns: every sound plays once, in random order, before any repeats. */
function createSoundShuffle(key, ids) {
  return () => {
    let bag = [];
    try { bag = JSON.parse(localStorage.getItem(key) || "[]").filter((x) => ids.includes(x)); } catch { bag = []; }
    if (!bag.length) {
      bag = [...ids];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    const id = bag.pop();
    try { localStorage.setItem(key, JSON.stringify(bag)); } catch { /* still plays, just without memory */ }
    return id;
  };
}
