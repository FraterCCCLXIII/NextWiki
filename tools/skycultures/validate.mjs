#!/usr/bin/env node
// Validate sky culture files against tools/skycultures/SPEC.md.
// Usage: node tools/skycultures/validate.mjs <culture.json> [more.json ...]
// Exit code 1 if any file has errors. Warnings do not fail.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve, basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const STATIC = resolve(here, "../../apps/web/public/kosmo/static");
const cj = JSON.parse(readFileSync(join(STATIC, "constellations.json"), "utf8"));
const STARS = cj.stars;
const IAU = new Set(cj.constellations.map((c) => c.abbr));
const KINDS = new Set(["constellation", "asterism", "mansion", "dark-cloud", "zodiac"]);
const STATUS = new Set(["obsolete", "superseded", "variant"]);
const HEX = /^#[0-9a-fA-F]{6}$/;

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node validate.mjs <culture.json> [...]");
  process.exit(2);
}

// Colours already used by other cultures in the same directory (uniqueness check).
function otherColors(path) {
  const dir = dirname(resolve(path));
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json") || f === "index.json" || f === "boundaries.json") continue;
    if (resolve(dir, f) === resolve(path)) continue;
    try {
      const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
      if (j && j.id && j.color) out.set(String(j.color).toLowerCase(), j.id);
    } catch {}
  }
  return out;
}

const num = (x) => typeof x === "number" && Number.isFinite(x);
let failed = false;

for (const file of files) {
  const errs = [];
  const warns = [];
  let c;
  try {
    c = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`${file}: JSON parse failed: ${e.message}`);
    failed = true;
    continue;
  }
  for (const k of ["id", "name", "region", "era", "color", "description", "license"])
    if (typeof c[k] !== "string" || !c[k].trim()) errs.push(`top-level "${k}" missing or not a string`);
  if (!Array.isArray(c.source) || !c.source.length || c.source.some((s) => typeof s !== "string"))
    errs.push(`top-level "source" must be a non-empty string array`);
  if (c.id && basename(file, ".json") !== c.id) warns.push(`file name "${basename(file)}" differs from id "${c.id}"`);
  if (typeof c.color === "string") {
    if (!HEX.test(c.color)) errs.push(`color "${c.color}" is not a #rrggbb hex`);
    else {
      const o = otherColors(file).get(c.color.toLowerCase());
      if (o) errs.push(`color ${c.color} is already used by culture "${o}"`);
    }
  }
  if (!Array.isArray(c.figures) || !c.figures.length) errs.push(`"figures" must be a non-empty array`);

  const ids = new Set();
  let nLines = 0, nStarRefs = 0, nExtra = 0;
  for (const [n, f] of (c.figures || []).entries()) {
    const at = `figure[${n}] ${f && f.id ? `"${f.id}"` : ""}`;
    const e = (m) => errs.push(`${at}: ${m}`);
    const w = (m) => warns.push(`${at}: ${m}`);
    if (!f || typeof f !== "object") { errs.push(`${at}: not an object`); continue; }
    if (typeof f.id !== "string" || !f.id) e("missing id");
    else if (ids.has(f.id)) e("duplicate id");
    else ids.add(f.id);
    if (typeof f.name !== "string" || !f.name) e("missing name");
    if (!KINDS.has(f.kind)) e(`kind "${f.kind}" not one of ${[...KINDS].join("|")}`);
    const hasLines = Array.isArray(f.lines) && f.lines.length > 0;
    const hasPoly = Array.isArray(f.polygon) && f.polygon.length > 0;
    if (!hasLines && !hasPoly) e("needs lines or polygon");
    if (f.kind === "dark-cloud" && hasLines) e("dark-cloud figures must not have lines");
    if (f.kind === "dark-cloud" && !hasPoly) e("dark-cloud figures need a polygon");

    const extra = f.extraStars ?? {};
    if (typeof extra !== "object" || Array.isArray(extra)) e("extraStars must be an object");
    else
      for (const [id, s] of Object.entries(extra)) {
        nExtra++;
        if (!Array.isArray(s) || s.length !== 6) { e(`extraStars.${id} must be [ra,dec,dist,mag,name,spectral]`); continue; }
        const [ra, dec, d, mag, nm, sp] = s;
        if (!num(ra) || ra < 0 || ra >= 360) e(`extraStars.${id} bad ra ${ra}`);
        if (!num(dec) || dec < -90 || dec > 90) e(`extraStars.${id} bad dec ${dec}`);
        if (!(d === null || (num(d) && d > 0))) e(`extraStars.${id} bad dist ${d}`);
        if (!num(mag)) e(`extraStars.${id} bad mag`);
        if (typeof nm !== "string") e(`extraStars.${id} name not a string`);
        if (typeof sp !== "string") e(`extraStars.${id} spectral not a string`);
        if (STARS[id]) w(`extraStars.${id} already exists in constellations.json`);
      }

    const used = new Set();
    if (f.lines !== undefined) {
      if (!Array.isArray(f.lines)) e("lines must be an array of polylines");
      else
        for (const [li, pl] of f.lines.entries()) {
          if (!Array.isArray(pl) || pl.length < 2) { e(`lines[${li}] must be a polyline of >= 2 star ids`); continue; }
          nLines++;
          for (const sid of pl) {
            nStarRefs++;
            if (typeof sid !== "string") { e(`lines[${li}] has a non-string id`); continue; }
            used.add(sid);
            if (!STARS[sid] && !(extra && extra[sid])) e(`lines[${li}] star ${sid} not in constellations.json or extraStars`);
          }
        }
    }
    for (const id of Object.keys(extra)) if (!used.has(id)) w(`extraStars.${id} is never used in lines`);

    if (f.polygon !== undefined) {
      if (!Array.isArray(f.polygon) || f.polygon.length < 3) e("polygon needs >= 3 [ra,dec] points");
      else
        for (const p of f.polygon)
          if (!Array.isArray(p) || p.length !== 2 || !num(p[0]) || !num(p[1]) || p[1] < -90 || p[1] > 90 || p[0] < 0 || p[0] > 360)
            e(`bad polygon point ${JSON.stringify(p)}`);
    }
    if (f.iau !== undefined) {
      if (!Array.isArray(f.iau)) e("iau must be an array");
      else for (const a of f.iau) if (!IAU.has(a)) e(`iau "${a}" is not an IAU abbreviation`);
    }
    if (f.status !== undefined && !STATUS.has(f.status)) e(`status "${f.status}" not one of ${[...STATUS].join("|")}`);
    if (f.story !== undefined && (typeof f.story !== "string" || !f.story.trim())) e("story must be a non-empty string");
    if (typeof f.story === "string" && f.story.length > 900) w(`story is long (${f.story.length} chars)`);
    if (f.era !== undefined && typeof f.era !== "string") e("era must be a string");
  }

  const tag = errs.length ? "FAIL" : "OK";
  console.log(
    `${tag} ${file}: id=${c.id} figures=${(c.figures || []).length} polylines=${nLines} starRefs=${nStarRefs} extraStars=${nExtra} errors=${errs.length} warnings=${warns.length}`,
  );
  for (const m of errs) console.log("  error:", m);
  for (const m of warns.slice(0, 20)) console.log("  warn:", m);
  if (warns.length > 20) console.log(`  ... ${warns.length - 20} more warnings`);
  if (errs.length) failed = true;
}
process.exit(failed ? 1 : 0);
