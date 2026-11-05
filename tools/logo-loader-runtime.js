/* ---------- Logo loader runtime (appended after the reveal code by tools/build-logo-loader.mjs) ----------
   Plays ONE randomly chosen logo reveal per loading screen and holds on its final frame.
   Usage anywhere:
     React:  <LogoLoader /> from ~/components/ui/LogoLoader
     Static: <script src="/logo-loader/logo-loader.js"></script> + <div data-kosmo-logo-loader style="width:400px;height:260px"></div>
   ------------------------------------------------------------------------------------------------------- */
const BASE = (document.currentScript && document.currentScript.src || "/logo-loader/logo-loader.js").replace(/[^/]*$/, "");
const KEYS = { crt: "kosmo-logo-crt", bag: "kosmo-logo-bag" };
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
  s.textContent = `.kl-root{display:flex;align-items:center;justify-content:center;width:100%;height:100%;pointer-events:none}
.kl-root .logo{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
.kl-root svg{display:block;overflow:visible;width:100%;height:100%}
.kl-root svg *{transform-box:fill-box;transform-origin:50% 50%}`;
  document.head.appendChild(s);
}

/* Slight CRT look: a touch of softness plus a coloured bloom, sized to the logo. */
function addCrtFilter(svg, fid, tone) {
  const vb = svg.viewBox.baseVal, m = vb.width * 0.08;
  const f = svgEl("filter", { id: fid, filterUnits: "userSpaceOnUse", x: vb.x - m, y: vb.y - m, width: vb.width + 2 * m, height: vb.height + 2 * m, "color-interpolation-filters": "sRGB" });
  const a = tone === "dark" ? 0.5 : 0.3;
  f.appendChild(svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: vb.width * 0.0012, result: "soft" }));
  f.appendChild(svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: vb.width * 0.012, result: "wide" }));
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
  inst = {
    id: null,
    crt: o.crt,
    setCrt(on) { inst.crt = on; applyCrt(on === undefined ? crtDefault() : on); },
    destroy() {
      dead = true;
      clearTimeout(timer);
      mine.forEach((a) => a.cancel());
      root.remove();
      live.delete(inst);
    },
  };
  live.add(inst);

  const start = async () => {
    const ids = (await loadManifest()).ids;
    const id = o.id && ids.includes(String(o.id)) ? String(o.id) : nextId(ids);
    const L = await loadLogo(id);
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
    addCrtFilter(svg, fid, tone);
    applyCrt(inst.crt === undefined ? crtDefault() : inst.crt);
    inst.id = id;
    const fn = (TR[id] || DEFAULT_REVEAL)[2];
    anims = [];
    fn(node, comps(node, id));
    mine = anims;
    anims = [];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) mine.forEach((a) => a.finish());
    if (o.onReady) o.onReady(id);
  };
  timer = setTimeout(() => start().catch((e) => console.warn("logo loader:", e)), o.delay || 0);
  return inst;
}

function setCrt(on) {
  set(KEYS.crt, on ? "1" : "0");
  live.forEach((i) => { if (i.crt === undefined) i.setCrt(undefined); });
}

window.KosmoLogoLoader = { mount, setCrt, getCrt: crtDefault, ids: () => loadManifest().then((m) => m.ids) };

const auto = () => document.querySelectorAll("[data-kosmo-logo-loader]").forEach((el) => {
  if (el.dataset.klMounted) return;
  el.dataset.klMounted = "1";
  mount(el, { id: el.dataset.logo, tone: el.dataset.tone, crt: el.dataset.crt === undefined ? undefined : el.dataset.crt !== "off" });
});
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto);
else auto();
