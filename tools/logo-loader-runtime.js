/* ---------- Logo loader runtime (appended after the reveal code by tools/build-logo-loader.mjs) ----------
   Plays ONE randomly chosen logo reveal per loading screen and holds on its final frame.
   Usage anywhere:
     React:  <LogoLoader /> from ~/components/ui/LogoLoader
     Static: <script src="/logo-loader/logo-loader.js"></script> + <div data-kosmo-logo-loader style="width:400px;height:260px"></div>
   ------------------------------------------------------------------------------------------------------- */
const BASE = (document.currentScript && document.currentScript.src || "/logo-loader/logo-loader.js").replace(/[^/]*$/, "");
const KEYS = { crt: "kosmo-logo-crt", bag: "kosmo-logo-bag", sound: "kosmo-logo-sound" };
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window: fine without it */ } };

let manifest = null;
const loadManifest = () => manifest || (manifest = fetch(BASE + "manifest.json").then((r) => r.json()));
const cache = {};
const loadLogo = (id) => cache[id] || (cache[id] = fetch(BASE + "logos/" + encodeURIComponent(id) + ".json").then((r) => r.json()));

/* Shuffle bag: every logo gets a turn, in random order, before any repeats. */
function nextId(ids) {
  let bag = [];
  try { bag = JSON.parse(get(KEYS.bag) || "[]").filter((x) => ids.includes(x)); } catch { bag = []; }
  if (!bag.length) {
    bag = [...ids];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  const id = bag.pop();
  set(KEYS.bag, JSON.stringify(bag));
  return id;
}

const crtDefault = () => get(KEYS.crt) !== "0";
const soundDefault = () => get(KEYS.sound) !== "0";
const player = createJinglePlayer(BASE + "audio/");
const ICON_ON = '<path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M15 8.5a5 5 0 0 1 0 7M17.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
const ICON_OFF = '<path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M16 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

/* The colour actually behind the element, used for the tone and for knockouts such as letters cut out of a black box. */
function backdrop(el) {
  for (let n = el; n; n = n.parentElement) {
    const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
    if (m && (m[3] === undefined || +m[3] > 0.5)) return { rgb: [+m[0], +m[1], +m[2]] };
  }
  return null;
}
function resolveTone(el, tone) {
  const b = backdrop(el);
  const auto = b
    ? (0.2126 * b.rgb[0] + 0.7152 * b.rgb[1] + 0.0722 * b.rgb[2]) / 255 < 0.5
      ? "dark"
      : "light"
    : document.documentElement.classList.contains("dark") || matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  const t = tone === "dark" || tone === "light" ? tone : auto;
  const paper = b ? `rgb(${b.rgb.join(",")})` : t === "dark" ? "#0b0b0f" : "#fdf7ee";
  return { tone: t, paper };
}

function injectStyle() {
  if (document.getElementById("kosmo-logo-loader-css")) return;
  const s = document.createElement("style");
  s.id = "kosmo-logo-loader-css";
  s.textContent = `.kl-root{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:100%;pointer-events:none}
.kl-sound{position:absolute;right:0;bottom:0;z-index:1;width:32px;height:32px;padding:6px;border:0;border-radius:8px;background:transparent;color:var(--kl-ink,currentColor);opacity:.65;cursor:pointer;pointer-events:auto}
.kl-sound:hover,.kl-sound:focus-visible{opacity:1}
.kl-sound svg{width:100%;height:100%;fill:currentColor}
.kl-root .logo{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
.kl-root svg{display:block;overflow:visible;width:100%;height:100%}
.kl-root svg *{transform-box:fill-box;transform-origin:50% 50%}`;
  document.head.appendChild(s);
}

/* Slight CRT look: a touch of softness plus a coloured bloom, sized to the logo. */
function addCrtFilter(svg, fid, tone, strength = 1) {
  const vb = svg.viewBox.baseVal, m = vb.width * 0.08;
  const f = svgEl("filter", { id: fid, filterUnits: "userSpaceOnUse", x: vb.x - m, y: vb.y - m, width: vb.width + 2 * m, height: vb.height + 2 * m, "color-interpolation-filters": "sRGB" });
  const a = tone === "dark" ? 0.5 : 0.3;
  f.appendChild(svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: vb.width * 0.0012 * strength, result: "soft" }));
  f.appendChild(svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: vb.width * 0.012 * Math.sqrt(strength), result: "wide" }));
  f.appendChild(svgEl("feColorMatrix", { in: "wide", values: `1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${a} 0`, result: "bloom" }));
  const merge = svgEl("feMerge");
  merge.appendChild(svgEl("feMergeNode", { in: "bloom" }));
  merge.appendChild(svgEl("feMergeNode", { in: "soft" }));
  f.appendChild(merge);
  svg.querySelector("defs").appendChild(f);
}

const live = new Set();
let uid = 0;

function mount(el, opts) {
  const o = opts || {};
  injectStyle();
  const root = document.createElement("div");
  root.className = "kl-root";
  el.appendChild(root);
  let dead = false, mine = [], timer = 0, inst;
  const n = ++uid, fid = `klcrt${n}`;
  const applyCrt = (on) => {
    const g = root.querySelector("g.kl-fx");
    if (!g) return;
    if (on) g.setAttribute("filter", `url(#${fid})`);
    else g.removeAttribute("filter");
  };
  const soundOn = () => (inst.sound === undefined ? soundDefault() : inst.sound);
  const startJingle = () => { if (inst.jingle) player.play(inst.jingle, inst).catch((e) => console.warn("logo jingle:", e)); };
  inst = {
    id: null,
    jingle: 0,
    sound: o.sound,
    crt: o.crt,
    soundChanged(on) { if (!on) player.mute(); else if (inst.id) startJingle(); paintButton(); },
    setCrt(on) { inst.crt = on; applyCrt(on === undefined ? crtDefault() : on); },
    destroy() {
      dead = true;
      clearTimeout(timer);
      mine.forEach((a) => a.cancel());
      player.release(inst); // the jingle outlives the loader if it is mid-word
      root.remove();
      live.delete(inst);
    },
  };
  live.add(inst);

  const button = o.soundButton === false ? null : document.createElement("button");
  function paintButton() {
    if (!button) return;
    const on = soundOn();
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${on ? ICON_ON : ICON_OFF}</svg>`;
    button.setAttribute("aria-label", on ? "Turn loader sound off" : "Turn loader sound on");
    button.setAttribute("aria-pressed", String(on));
  }
  if (button) {
    button.type = "button";
    button.className = "kl-sound";
    button.addEventListener("click", () => { player.unlock(); setSound(!soundOn()); });
    paintButton();
    root.appendChild(button);
  }

  const start = async () => {
    const m = await loadManifest(), ids = m.ids;
    const id = o.id && ids.includes(String(o.id)) ? String(o.id) : nextId(ids);
    const L = await loadLogo(id);
    if (dead) return;
    inst.jingle = (m.jingles && m.jingles[id]) || 1;
    // give the jingle a moment to arrive so it starts with the reveal, but never hold the logo back for it
    if (soundOn()) await Promise.race([player.load(inst.jingle).catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
    if (dead) return;
    const { tone, paper } = resolveTone(el, o.tone);
    root.style.setProperty("--kl-ink", tone === "dark" ? "#ffffff" : "#0d0d10");
    root.style.setProperty("--kl-paper", paper);
    root.dataset.logo = id;
    root.dataset.tone = tone;
    TRACED[id] = { ...L, comps: L.comps.map((c) => (c.k === "ink" ? { ...c, f: "var(--kl-ink)" } : c.k === "pap" ? { ...c, f: "var(--kl-paper)" } : c)) };
    const node = mk(buildTraced(id, `L${n}`));
    root.appendChild(node);
    const svg = node.querySelector("svg");
    // font outlines have overlapping contours, which the traced shapes' even-odd rule would punch holes in
    svg.querySelectorAll("path.tc").forEach((p) => { if (L.comps[+p.dataset.i].nz) p.setAttribute("fill-rule", "nonzero"); });
    const fx = svgEl("g", { class: "kl-fx" });
    [...svg.children].forEach((ch) => { if (ch.tagName !== "defs") fx.appendChild(ch); });
    svg.appendChild(fx);
    addCrtFilter(svg, fid, tone, L.crt);
    applyCrt(inst.crt === undefined ? crtDefault() : inst.crt);
    inst.id = id;
    const fn = (TR[id] || DEFAULT_REVEAL)[2];
    anims = [];
    fn(node, comps(node, id));
    mine = anims;
    anims = [];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) mine.forEach((a) => a.finish());
    if (soundOn()) startJingle();
    if (o.onReady) o.onReady(id);
  };
  timer = setTimeout(() => start().catch((e) => console.warn("logo loader:", e)), o.delay || 0);
  return inst;
}

function setCrt(on) {
  set(KEYS.crt, on ? "1" : "0");
  live.forEach((i) => { if (i.crt === undefined) i.setCrt(undefined); });
}

function setSound(on) {
  set(KEYS.sound, on ? "1" : "0");
  live.forEach((i) => { if (i.sound === undefined || i.sound !== on) { i.sound = undefined; i.soundChanged(on); } });
}

window.KosmoLogoLoader = { mount, setCrt, getCrt: crtDefault, setSound, getSound: soundDefault, player, ids: () => loadManifest().then((m) => m.ids) };

const auto = () => document.querySelectorAll("[data-kosmo-logo-loader]").forEach((el) => {
  if (el.dataset.klMounted) return;
  el.dataset.klMounted = "1";
  mount(el, { id: el.dataset.logo, tone: el.dataset.tone, crt: el.dataset.crt === undefined ? undefined : el.dataset.crt !== "off", sound: el.dataset.sound === undefined ? undefined : el.dataset.sound !== "off" });
});
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto);
else auto();
