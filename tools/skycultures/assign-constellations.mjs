#!/usr/bin/env node
// Builds skycultures/boundaries.json from d3-celestial's constellations.bounds.json
// (IAU/Delporte 1930 boundaries, J2000, BSD-3, Olaf Frohn), then assigns an IAU
// constellation abbreviation to every row of catalog/objects.json that has ra_deg/dec_deg.
// Usage: node tools/skycultures/assign-constellations.mjs [path/to/bounds.json]
// Catalog coordinates are J2000, same as the boundaries, so no precession is applied.
// Edges are interpolated linearly in (RA, Dec): meridians and parallels, as in Delporte.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const S = path.join(root, "apps/web/public/kosmo/static");
const URL_SRC = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.bounds.json";
const STEP = 1.0; // max degrees between densified vertices
const r3 = (x) => Math.round(x * 1000) / 1000;
const norm = (a) => ((a % 360) + 360) % 360;

const src = process.argv[2]
  ? JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
  : await (await fetch(URL_SRC)).json();

const known = new Set(JSON.parse(fs.readFileSync(path.join(S, "constellations.json"), "utf8")).constellations.map((c) => c.abbr));

const boundaries = {};
for (const f of src.features) {
  const abbr = f.id;
  if (!known.has(abbr)) throw new Error("unknown abbr " + abbr);
  const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of rings) {
    const ring = poly[0].map(([ra, dec]) => [norm(ra), dec]);
    if (ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring.pop();
    const out = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      let dra = b[0] - a[0];
      if (dra > 180) dra -= 360; else if (dra < -180) dra += 360;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(dra), Math.abs(b[1] - a[1])) / STEP));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        out.push([r3(norm(a[0] + dra * t)), r3(a[1] + (b[1] - a[1]) * t)]);
      }
    }
    (boundaries[abbr] ||= []).push(out);
  }
}
const missing = [...known].filter((a) => !boundaries[a]);
if (missing.length) throw new Error("missing: " + missing);

fs.writeFileSync(path.join(S, "skycultures/boundaries.json"), JSON.stringify({
  source: "d3-celestial data/constellations.bounds.json (Olaf Frohn, github.com/ofrohn/d3-celestial), derived from the IAU/Delporte 1930 boundaries (CDS VizieR VI/49). Edges run along meridians/parallels: interpolate linearly in (RA, Dec). Densified to <= 1 degree steps.",
  license: "BSD-3-Clause (d3-celestial); boundary data originates from public CDS VI/49",
  epoch: "J2000",
  boundaries,
}));

// ---- lookup (same algorithm as skycultures/constellation-lookup.js) ----
// constellation-lookup.js is a plain browser script (may sit under a "type":"module" package), so eval it.
const mod = { exports: {} };
new Function("module", fs.readFileSync(path.join(S, "skycultures/constellation-lookup.js"), "utf8"))(mod);
const { makeLookup } = mod.exports;
const find = makeLookup(JSON.parse(fs.readFileSync(path.join(S, "skycultures/boundaries.json"), "utf8")).boundaries);

// ---- assign ----
// objects.json is Python-style JSON (indent 1, "57900000000.0", "3.3e+23"), so re-serialising would
// rewrite numbers. Edit the text instead: insert one line after each non-null "dec_deg" line.
const files = [path.join(S, "catalog/objects.json"), path.join(root, "apps/web/public/kosmo/data/catalog/objects.json")];
const sidecar = {}, counts = {}, failed = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const rows = JSON.parse(text);
  const byIndex = rows.map((r) => {
    if (typeof r.ra_deg !== "number" || typeof r.dec_deg !== "number") return null;
    const c = find(r.ra_deg, r.dec_deg);
    if (!c) { failed.push(r.id); return null; }
    if (file === files[0]) { sidecar[r.id] = c; counts[c] = (counts[c] || 0) + 1; }
    return c;
  });
  let idx = -1;
  const out = [];
  for (const line of text.split("\n")) {
    if (line.startsWith(' {') ) idx++;
    out.push(line);
    if (line.startsWith('  "dec_deg": ') && byIndex[idx]) out.push(`  "constellation": "${byIndex[idx]}",`);
  }
  const joined = out.join("\n");
  if (JSON.parse(joined).filter((r) => r.constellation).length !== byIndex.filter(Boolean).length) throw new Error("insert mismatch");
  fs.writeFileSync(file, joined);
}
fs.writeFileSync(path.join(S, "catalog/object-constellations.json"), JSON.stringify(sidecar));
console.log("assigned", Object.keys(sidecar).length, "failed", failed.length, failed.slice(0, 20));
console.log(JSON.stringify(Object.fromEntries(Object.entries(counts).sort())));
