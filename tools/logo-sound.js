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
  /* Ambient set, from tools/make-ambient-sounds.py. Long, slow and beatless, so they crossfade instead of cutting. */
  16: { file: "ambient-entrance.m4a", name: "Entrance, stretched", word: NO_WORD, fade: 2 },
  17: { file: "ambient-chime.m4a", name: "Chime, stretched", word: NO_WORD, fade: 2 },
  18: { file: "ambient-felt.m4a", name: "Felt piano, stretched", word: NO_WORD, fade: 2 },
  19: { file: "ambient-swell.m4a", name: "Swell, stretched", word: NO_WORD, fade: 2 },
  20: { file: "ambient-arp.m4a", name: "Arp, stretched", word: NO_WORD, fade: 2 },
  21: { file: "ambient-digital.m4a", name: "Digital chime, stretched", word: NO_WORD, fade: 2 },
  22: { file: "ambient-deep-space.m4a", name: "Deep Space", word: NO_WORD, fade: 2 },
  23: { file: "ambient-nebula.m4a", name: "Nebula", word: NO_WORD, fade: 2 },
  24: { file: "ambient-glass.m4a", name: "Glass", word: NO_WORD, fade: 2 },
  25: { file: "ambient-dark-pad.m4a", name: "Dark Pad", word: NO_WORD, fade: 2 },
  26: { file: "ambient-orbit.m4a", name: "Orbit", word: NO_WORD, fade: 2 },
  27: { file: "ambient-horizon.m4a", name: "Horizon", word: NO_WORD, fade: 2 },
};
/* Only the ambient set is in rotation. Clips 1 to 15 were too upbeat; they stay defined here but nothing plays them. */
const MUSIC_SOUNDS = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
const KOSMO_SOUNDS = MUSIC_SOUNDS;
const JINGLE_FADE = 0.3;

function createJinglePlayer(base) {
  let master = null, volume = 1, analyser = null, bins = null;
  /* sound passes through an analyser before the volume control, so the visuals respond the same at any volume */
  const masterOf = (c) => {
    if (!master) {
      analyser = c.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.82; analyser.minDecibels = -85; analyser.maxDecibels = -20;
      bins = new Uint8Array(analyser.frequencyBinCount);
      master = c.createGain(); master.gain.value = volume;
      analyser.connect(master); master.connect(c.destination);
    }
    return analyser;
  };
  /* how much sound is playing right now, 0 to 1: overall, low end (under about 260 Hz) and high end (about 2 to 10 kHz) */
  const levels = () => {
    if (!analyser) return { all: 0, low: 0, high: 0 };
    analyser.getByteFrequencyData(bins);
    const avg = (a, b) => { let t = 0; for (let i = a; i < b; i++) t += bins[i]; return t / (b - a) / 255; };
    const low = avg(1, 6), mid = avg(6, 46), high = avg(46, 230);
    return { all: Math.max(low, mid, high), low, high };
  };
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
    const fade = JINGLES[playing.n].fade || JINGLE_FADE;
    const fadeAt = pos + fade + 0.02 <= a || pos >= b ? now : playing.at + b;
    const g = playing.gain.gain;
    g.setValueAtTime(1, fadeAt);
    g.linearRampToValueAtTime(0, fadeAt + fade);
    playing.src.stop(fadeAt + fade + 0.02);
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
    src.connect(gain).connect(masterOf(c));
    const at = c.currentTime + wait + 0.01;
    src.start(at);
    const me = { n, src, gain, at, len: buffer.duration, owner };
    cur = me;
    src.onended = () => { if (cur === me) cur = null; };
    return true;
  };
  /* Only for the visitor switching sound off: that is their call, so it stops right away. */
  const setVolume = (v) => { volume = v; if (master) master.gain.value = v; };
  const mute = () => {
    if (!cur) return;
    const now = ctx.currentTime;
    cur.gain.gain.setTargetAtTime(0, now, 0.02);
    cur.src.stop(now + 0.1);
    cur = null;
  };
  return { levels, setVolume, load, play, release, mute, unlock: () => { const c = getCtx(); if (c) c.resume().catch(() => {}); }, info: () => (cur && ctx ? { n: cur.n, pos: ctx.currentTime - cur.at } : null) };
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
