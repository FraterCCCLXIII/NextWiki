/* Jingle playback shared by the loader and the logo sheet.
   Rule: the music may be faded or dropped, but the spoken "Kosmographica" is never cut or faded.
   `word` is the protected stretch of each file in seconds, including a small margin. */
const JINGLES = {
  1: { file: "jingle-1.mp3", word: [2.15, 3.6] }, // music builds, then the word
  2: { file: "jingle-2.mp3", word: [0, 1.25] }, // the word first, then a synth swell
  3: { file: "sound-1.mp3", word: [Infinity, Infinity] }, // jingle 1's music only, faded out before the word
  4: { file: "sound-2.mp3", word: [Infinity, Infinity] }, // jingle 2's swell only, from after the word
};
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
