#!/usr/bin/env node
/* Builds the reusable logo loader from the chosen logos: one lazy JSON per logo plus a single runtime script.
   Change PICKS to change which logos loading screens use, then run:  node tools/build-logo-loader.mjs */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "kosmographica-logos");
const out = join(root, "apps/web/public/logo-loader");

/* Logo id + version, using the labels on kosmographica-logos/sheet.html.
   C = traced from original, D = traced and cleaned, B = redrawn with font outlines, Star = its own clean rebuild. */
const PICKS = [
  ["10", "D"], // 1D
  ["50", "C"], // 6C
  ["34", "D"], // 10D
  ["12", "C"], // 11C
  ["49", "B"], // 13B
  ["Star", "clean"], // 15
  ["28", "D"], // 20D
  ["36", "C"], // 21C
  ["D10", "C"], // 23C
  ["33", "C"], // 24C
  ["18", "D"], // 27D
  ["C03", "D"], // 31D
  ["30", "C"], // 32C
  ["57", "B"], // 35B
  ["31", "C"], // 36C
  ["C05", "C"], // 38C
  ["16", "D"], // 39D
  ["D02", "C"], // 44C
  ["D05", "D"], // 47D
  ["15", "C"], // 48C
  ["38", "D"], // 50D
  ["62", "D"], // 54D
  ["42", "D"], // 60D
];

const tracedFrom = (file) => {
  const m = readFileSync(join(srcDir, file), "utf8").match(/const TRACED=(\{.*\})/);
  if (!m) throw new Error(`TRACED not found in ${file}`);
  return JSON.parse(m[1]);
};
const v1 = tracedFrom("traced-v1.html");
const v2 = tracedFrom("traced-v2-clean.html");
const FONTS = new Function(`${readFileSync(join(srcDir, "kosmo-glyphs.js"), "utf8")}\nreturn FONTS;`)();

/* ---------- redrawn (B) logos rebuilt as paths, so they share the loader's tone handling and one-way reveals ---------- */
const RB = ["#ff1f2d", "#ff8a00", "#ffd21a", "#22b800", "#00b5ff", "#3b2bff", "#9b30f0"];
const ARITY = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, T: 2, S: 4 };
function placeGlyph(d, s, tx, ty) {
  const xs = [], ys = [];
  const path = d.replace(/([MLHVQCTSZ])([^MLHVQCTSZ]*)/g, (_, cmd, args) => {
    if (cmd === "Z") return "Z";
    const nums = (args.match(/-?\d*\.?\d+/g) || []).map(Number);
    if (nums.length % ARITY[cmd]) throw new Error(`bad ${cmd} args`);
    const placed = nums.map((v, i) => {
      const isY = cmd === "V" || (cmd !== "H" && i % 2 === 1);
      const value = isY ? v * s + ty : v * s + tx;
      (isY ? ys : xs).push(value);
      return +value.toFixed(2);
    });
    return cmd + placed.join(" ");
  });
  return { d: path, b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => +v.toFixed(1)) };
}
function wordComps(text, key, size, spacing, centreX, baseline) {
  const F = FONTS[key], s = size / 1000;
  const chars = [...text];
  let width = 0;
  chars.forEach((ch, i) => { width += F.g[ch][0] * s + (i ? (F.k[chars[i - 1] + ch] || 0) * s : 0) + (i < chars.length - 1 ? spacing * size : 0); });
  let x = centreX - width / 2;
  return chars.map((ch, i) => {
    if (i) x += (F.k[chars[i - 1] + ch] || 0) * s;
    const g = placeGlyph(F.g[ch][1], s, x, baseline);
    x += F.g[ch][0] * s + spacing * size;
    const w = g.b[2] - g.b[0], h = g.b[3] - g.b[1];
    return { f: "#0d0d10", k: "ink", d: g.d, b: g.b, t: +Math.min(w, h).toFixed(1), a: Math.round(w * h), h: 0, nz: 1 };
  });
}
function finish(id, comps) {
  const bs = comps.map((c) => c.b);
  const bb = [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))];
  return { id, w: Math.ceil(bb[2] + 20), h: Math.ceil(bb[3] + 20), bb, paper: "#fdf7ee", mesh: null, knock: [], comps };
}
function redrawn49() {
  const cx = 200, cy = 140;
  const arcs = RB.map((f, i) => {
    const r = 128 - i * 18, o = r + 9, n = r - 9;
    return { f, k: "col", d: `M${cx - o} ${cy}A${o} ${o} 0 0 1 ${cx + o} ${cy}H${cx + n}A${n} ${n} 0 0 0 ${cx - n} ${cy}Z`, b: [cx - o, cy - o, cx + o, cy], t: 18, a: Math.round((Math.PI * (o * o - n * n)) / 2), h: 0 };
  });
  return finish("49", [...arcs, ...wordComps("Kosmographica", "corm500", 60, -0.01, cx, 200)]);
}
function redrawn57() {
  const cx = 260, word = wordComps("Kosmographica", "outfit700", 68, -0.02, cx, 70);
  const size = 15, gap = 24, span = 7 * size + 6 * gap, y = 104;
  const dots = RB.map((f, i) => {
    const x = cx - span / 2 + i * (size + gap);
    return { f, k: "col", d: `M${x} ${y}H${x + size}V${y + size}H${x}Z`, b: [x, y, x + size, y + size], t: size, a: size * size, h: 0 };
  });
  return finish("57", [...word, ...dots]);
}

/* Logo 38's cleaned bands picked up the wrong colours (no blue or violet). These are sampled from its source image. */
const COLOURS_38 = ["#ed2a3d", "#fe8807", "#fdd105", "#66cb1c", "#03c0e3", "#0868f3", "#a922d5"];
function fixed38(L) {
  const bands = L.comps.filter((c) => c.k === "col");
  if (bands.length !== COLOURS_38.length) throw new Error(`logo 38 has ${bands.length} bands`);
  const order = [...bands].sort((a, b) => a.b[0] + a.b[2] - b.b[0] - b.b[2]);
  return { ...L, comps: L.comps.map((c) => (c.k === "col" ? { ...c, f: COLOURS_38[order.indexOf(c)] } : c)) };
}

/* Second cleanup pass (kosmographica-logos/refine-shapes.py): cleaner coloured shapes, same lettering. */
const refined = JSON.parse(readFileSync(join(srcDir, "refs/.refined.json"), "utf8"));
/* Logo 10 kept two stray specks at the K's join. They read as white flecks on dark. */
const withoutSpecks10 = (L) => ({ ...L, comps: L.comps.filter((c) => !(c.k === "ink" && c.b[0] < 150 && c.b[2] - c.b[0] < 15)) });
/* Logos that need a stronger CRT glow than the default. */
const CRT_STRENGTH = { 38: 1.5 };

function logoFor(id, version) {
  if (refined[id]) return refined[id];
  if (id === "10") return withoutSpecks10(v2[id]);
  if (version === "clean") return JSON.parse(readFileSync(join(srcDir, "refs/.star-clean.json"), "utf8"));
  if (version === "B") return id === "49" ? redrawn49() : redrawn57();
  if (version === "C") return v1[id];
  return id === "38" ? fixed38(v2[id]) : v2[id];
}

// Reveal 64 overlays letters in the ink colour, so that has to follow the tone like every other ink shape.
const reveals = readFileSync(join(srcDir, "clean-reveals.js"), "utf8").replaceAll("'#0d0d10'", "'var(--kl-ink)'");
const sound = readFileSync(join(root, "tools/logo-sound.js"), "utf8");
const backdrop = readFileSync(join(root, "tools/logo-backdrop.js"), "utf8");
const runtime = readFileSync(join(root, "tools/logo-loader-runtime.js"), "utf8");

mkdirSync(join(out, "audio"), { recursive: true });
for (const f of readdirSync(join(srcDir, "audio"))) if (/\.(mp3|m4a)$/.test(f)) copyFileSync(join(srcDir, "audio", f), join(out, "audio", f));

rmSync(join(out, "logos"), { recursive: true, force: true });
mkdirSync(join(out, "logos"), { recursive: true });

let total = 0;
for (const [id, version] of PICKS) {
  const L = { ...logoFor(id, version), ...(CRT_STRENGTH[id] ? { crt: CRT_STRENGTH[id] } : {}) };
  if (!L.comps) throw new Error(`no data for ${id} ${version}`);
  const json = JSON.stringify(L);
  total += json.length;
  writeFileSync(join(out, "logos", `${id}.json`), json);
}
writeFileSync(join(out, "manifest.json"), JSON.stringify({ ids: PICKS.map(([id]) => id) }));
writeFileSync(
  join(out, "logo-loader.js"),
  `/* Generated by tools/build-logo-loader.mjs. Do not edit. */\n(function(){\nconst TRACED={};\n${reveals}\n${sound}\n${backdrop}\n${runtime}\n})();\n`
);
console.log(`${PICKS.length} logos, ${Math.round(total / 1024)} KB of logo data (only one is fetched per screen)`);
