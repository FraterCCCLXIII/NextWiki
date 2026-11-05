// Builds apps/web/public/timeline/timeline.json from the sibling research repos.
//   node tools/build-timeline-data.mjs [--root ~/Documents/github]
// Years are astronomical (year 0 = 1 BCE), like kosmo_entities.time_start, so 500 BCE is -499.
// Every item is {id,k,n,s,e?,lane,grp,...}; edges are {a,b,t,cat,w?}. Sources that are missing are skipped with a warning.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { GROUP as GAP_GROUP, ROWS as GAP_ROWS, EDGES as GAP_EDGES } from "./timeline-gapfill.mjs";
import { GROUP as EOG_GROUP, ROWS as EOG_ROWS, LINKS as EOG_LINKS } from "./timeline-eog-extra.mjs";
import { ASSIGNMENTS as LINEAGE_ASSIGNMENTS } from "./timeline-lineage-assignments.mjs";
import { CITATIONS } from "./timeline-citations.mjs";
import { ROWS as PE_ROWS, META as PE_META } from "./timeline-pantheon-extra.mjs";
import { LINKS as SRC_LINKS } from "./timeline-links.mjs";
import { bardiyaLane, regionFor } from "./timeline-normalize.mjs";
import { GROUP as ST_GROUP, ROWS as ST_ROWS } from "./timeline-stupas.mjs";
import { GROUP as GC_GROUP, FILE as GC_FILE, parseGoldenChain } from "./timeline-goldenchain.mjs";

const args = process.argv.slice(2);
const root = args.includes("--root") ? args[args.indexOf("--root") + 1] : path.join(os.homedir(), "Documents/github");
const out = path.resolve(new URL("../apps/web/public/timeline/timeline.json", import.meta.url).pathname);
const NOW = 2026;

const items = [];
const edges = [];
const seen = new Set();
const stats = {};
const warn = (m) => console.warn("  ! " + m);
const bump = (k, n = 1) => (stats[k] = (stats[k] ?? 0) + n);

/** historical year (negative = BCE, no year 0) -> astronomical year */
const astro = (y) => (y < 0 ? y + 1 : y);
const bce = (n) => 1 - n; // "500 BCE" -> -499
const clean = (s) => String(s ?? "").replace(/ /g, " ").replace(/\*\*|\*(?=\S)|(?<=\S)\*/g, "").replace(/\s+/g, " ").trim();
const num = (s) => Number(String(s).replace(/,/g, ""));
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

const dupKeys = new Set();
function add(it) {
  if (!Number.isFinite(it.s)) return false;
  // the same civilisation appears in several time-thread-web files: keep the first
  if (it.grp === "Civilisations") {
    const key = `${clean(it.n).toLowerCase()}|${it.s}|${it.e ?? ""}`;
    if (dupKeys.has(key)) return false;
    dupKeys.add(key);
  }
  if (Number.isFinite(it.e) && it.e < it.s) [it.s, it.e] = [it.e, it.s];
  if (Number.isFinite(it.e) && it.e === it.s) delete it.e;
  let id = it.id;
  for (let i = 2; seen.has(id); i++) id = `${it.id}~${i}`;
  it.id = id;
  seen.add(id);
  for (const k of Object.keys(it)) if (it[k] === undefined || it[k] === "" || it[k] === null) delete it[k];
  items.push(it);
  bump(it.grp);
  return true;
}

const slug = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

/** Parse a free-text date or range into astronomical years. `defEra` applies when no era is written. */
function parseRange(text, defEra = null) {
  const t = clean(text).replace(/[–—−]/g, "-");
  const era = (e) => (e ? (/^(BCE|BC)$/i.test(e) ? "BCE" : "CE") : null);
  const ord = t.match(/(\d+)(?:st|nd|rd|th)\s*(?:-\s*(\d+)(?:st|nd|rd|th))?\s*(?:centur(?:y|ies)|c\.)\s*(BCE|BC|CE|AD)?/i);
  if (ord) {
    const e = era(ord[3]) ?? defEra ?? "CE";
    const c1 = Number(ord[1]), c2 = Number(ord[2] ?? ord[1]);
    return e === "BCE" ? { s: bce(Math.max(c1, c2) * 100), e: bce((Math.min(c1, c2) - 1) * 100) } : { s: (Math.min(c1, c2) - 1) * 100 + 1, e: Math.max(c1, c2) * 100 };
  }
  const k = (v, unit) => (unit ? num(v) * (/^k$/i.test(unit) ? 1e3 : /^m$/i.test(unit) ? 1e6 : 1) : num(v));
  const rng = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\s*(BCE|BC|CE|AD)?\s*-\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\s*(BCE|BC|CE|AD)?/i);
  if (rng) {
    let a = k(rng[1], rng[2]), b = k(rng[4], rng[5]);
    let ea = era(rng[3]), eb = era(rng[6]);
    if (!ea && !eb) ea = eb = defEra === "auto" ? (a > b ? "BCE" : "CE") : (defEra ?? "CE");
    else if (!ea) ea = eb === "CE" && a > b ? "BCE" : eb;
    else if (!eb) eb = ea;
    const ya = ea === "BCE" ? bce(a) : a, yb = eb === "BCE" ? bce(b) : b;
    return { s: Math.min(ya, yb), e: Math.max(ya, yb) };
  }
  const open = t.match(/(\d[\d,]*)\s*(BCE|BC|CE|AD)?\s*(?:→|->|-\s*(?:present|now))/i);
  if (open) { const e = era(open[2]) ?? (defEra === "auto" ? "CE" : defEra); const v = num(open[1]); return { s: e === "BCE" ? bce(v) : v, e: e === "BCE" ? undefined : NOW }; }
  const one = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\s*(BCE|BC|CE|AD)/i) ?? (defEra && defEra !== "auto" ? t.match(/(\d[\d,]*(?:\.\d+)?)()()/) : null);
  if (one) {
    const e = era(one[3]) ?? defEra;
    const v = k(one[1], one[2]);
    return { s: e === "BCE" ? bce(v) : v };
  }
  return null;
}

// ---- 1. time-thread-web: cultures + timelines ------------------------------------------------------------------
function timeThread() {
  const base = path.join(root, "time-thread-web/public/data");
  if (!fs.existsSync(base)) return warn("time-thread-web not found");
  const cultures = JSON.parse(fs.readFileSync(path.join(base, "cultures.json"), "utf8")).cultures ?? [];
  for (const c of cultures) add({ id: "tt-culture-" + c.id, k: "period", n: c.name, s: astro(c.start), e: astro(c.end), lane: c.region, grp: "Civilisations", d: c.description, reg: c.region, color: c.color });
  const dir = path.join(base, "timelines");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json") && !/cosmogenesis|comprehensive/.test(x))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const tag = f.replace(/\.json$/, "");
    if (Array.isArray(j.rows)) {
      for (const row of j.rows) for (const ev of row.events ?? []) add({ id: `tt-${tag}-${ev.id}`, k: ev.visualType === "dot" ? "event" : "period", n: ev.name, s: astro(ev.start), e: ev.end != null ? astro(ev.end) : undefined, lane: row.name, grp: "Civilisations", d: ev.description, reg: ev.region, color: ev.color, approx: ev.fadeStart || ev.fadeEnd || undefined });
    } else if (Array.isArray(j.events)) {
      for (const ev of j.events) {
        const r = parseRange(ev.date ?? "", "CE");
        if (r) add({ id: `tt-${tag}-${ev.id}`, k: "event", n: ev.title ?? ev.name, s: r.s, e: r.e, lane: ev.region ?? j.name, grp: "Civilisations", d: ev.description, reg: ev.region });
        else bump("skipped:time-thread-date");
      }
    }
  }
}

// ---- 2. evolution-of-god master timeline -----------------------------------------------------------------------
function masterTimeline() {
  const file = path.join(root, "evolution-of-god/reference/master-timeline.md");
  if (!fs.existsSync(file)) return warn("master-timeline.md not found");
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let table = 0;
  const heads = ["Era", "Population & material context", "Concept of God", "Mediator", "Cosmos & afterlife"];
  const tableNames = { 1: "Evolution of God", 2: "Satan, demons and evil", 3: "The nondual current" };
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const m = L.match(/^#+\s*TABLE\s*(\d+)/i);
    if (m) { table = Number(m[1]); continue; }
    if (!table || !L.startsWith("|") || /^\|\s*-/.test(L) || /^\|\s*Era/i.test(L)) continue;
    const cells = L.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const eraCell = cells[0];
    const name = clean(eraCell.match(/\*\*(.+?)\*\*/)?.[1] ?? eraCell.split("(")[0]);
    const paren = eraCell.match(/\(([^)]*)\)/)?.[1] ?? eraCell;
    const r = eraCell.includes("(") ? parseRange(paren, "auto") : null;
    if (!r) { bump("skipped:master-timeline"); continue; }
    const grade = eraCell.match(/\[(IN SOURCE|EXTENSION|INTERPRETIVE)\]/i)?.[1]?.toLowerCase();
    const desc = cells.slice(1).map((c, j) => (clean(c) ? `${heads[j + 1] ?? "Note"}: ${clean(c)}` : "")).filter(Boolean).join("\n\n");
    add({ id: `eog-${table}-${slug(name)}`, k: "period", n: name, s: r.s, e: r.e, lane: tableNames[table] ?? "Evolution of God", grp: "Evolution of God", d: trunc(desc, 1800), grade, approx: /\bc\.|~/.test(paren) || undefined, src: ["evolution-of-god/reference/master-timeline.md"] });
  }
}

// ---- 3. Bardiya (Messiah / evolution-of-god) CSV ---------------------------------------------------------------
function csvRows(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
function bardiya() {
  const file = path.join(root, "Messiah/docs/appendices/achaemenid-bardiya-timeline.csv");
  if (!fs.existsSync(file)) return warn("Bardiya CSV not found");
  const [head, ...rows] = csvRows(fs.readFileSync(file, "utf8"));
  rows.forEach((r, i) => {
    const rg = parseRange(r[0] ?? "", "BCE");
    if (!rg) return bump("skipped:bardiya");
    const ev = clean(r[2]);
    add({ id: `bardiya-${i}`, k: rg.e != null && rg.e - rg.s > 60 ? "period" : "event", n: trunc(ev, 90), s: rg.s, e: rg.e, lane: clean(r[1]) || "Bardiya", grp: "Bardiya & Achaemenid", d: [ev, clean(r[3]) && "Significance: " + clean(r[3]), clean(r[4]) && "Key figures: " + clean(r[4]), clean(r[5]) && "Notes: " + clean(r[5])].filter(Boolean).join("\n\n"), approx: /^c\./i.test(r[0].trim()) || undefined, src: ["Messiah/docs/appendices/achaemenid-bardiya-timeline.csv"] });
  });
}

// ---- 4. Sacred-Lineage: figures, traditions, transmission edges ------------------------------------------------
function sacredLineage() {
  const db = path.join(root, "Sacred-Lineage/data/dev.db");
  if (!fs.existsSync(db)) return warn("Sacred-Lineage dev.db not found");
  const q = (sql) => JSON.parse(execFileSync("sqlite3", ["-json", db, sql], { maxBuffer: 1 << 28 }).toString() || "[]");
  const charts = q(`select m.id mid, c.name chart from master_lineages ml join masters m on m.id=ml.master_id join lineage_charts c on c.id=ml.lineage_id`);
  const chartOf = new Map();
  for (const c of charts) if (!chartOf.has(c.mid)) chartOf.set(c.mid, c.chart);
  const figs = q(`select id,name,overview,year_born,year_died,location,date_born,date_died,source_catalog from masters where year_born is not null`);
  const ids = new Set();
  for (const f of figs) {
    const died = f.year_died != null && f.year_died >= f.year_born ? f.year_died : undefined;
    const ok = add({ id: `sl-m${f.id}`, k: "figure", n: clean(f.name), s: astro(f.year_born), e: died != null ? astro(died) : undefined, lane: chartOf.get(f.id) ?? "Unassigned lineage", grp: "Lineages", d: trunc(clean(f.overview), 900), reg: clean(f.location), approx: (f.date_born && /c\.|ca\.|~|\?/.test(f.date_born)) || undefined, src: f.source_catalog ? [f.source_catalog] : undefined });
    if (ok) ids.add(f.id);
  }
  for (const t of q(`select id,name,description,region,year_founded,active_period_end from traditions where year_founded is not null`)) {
    add({ id: `sl-t${t.id}`, k: "tradition", n: clean(t.name), s: astro(t.year_founded), e: t.active_period_end != null ? astro(t.active_period_end) : undefined, lane: "Traditions", grp: "Lineages", d: trunc(clean(t.description), 600), reg: t.region });
  }
  const typeCat = (n = "") => (/influenc|debate|critic/i.test(n) ? "influence" : /transl|cofound/i.test(n) ? "parallel" : "transmission");
  const rels = q(`select r.parent_master_id a, r.child_master_id b, t.name tname, c.name chart from relationships r left join relationship_types t on t.id=r.relationship_type_id left join lineage_charts c on c.id=r.lineage_id`);
  for (const r of rels) if (ids.has(r.a) && ids.has(r.b)) { edges.push({ a: `sl-m${r.a}`, b: `sl-m${r.b}`, t: r.tname ?? "Transmission", cat: typeCat(r.tname) }); bump("edges:lineage"); }
}

// ---- 5. Interpretatio-Universalis: dated deities / figures + graph edges ---------------------------------------
const EDGE_CAT = {
  genealogical: ["parent_child", "sibling", "consort", "teacher_of", "mythic_pair"],
  linguistic: ["linguistic_cognate", "reconstructed_descent", "etymological"],
  parallel: ["functional_parallel", "mythic_parallel", "storm_god_parallel", "shared_myth_motif"],
  influence: ["cultural_influence", "syncretism", "syncretic_identification", "adapted_from", "iconographic_diffusion"],
  theological: ["manifestation_of", "emanation_of", "incarnation_of", "avatar_of", "wrathful_form_of"],
};
const catOf = (t) => Object.entries(EDGE_CAT).find(([, v]) => v.includes(t))?.[0] ?? "other";
function mythographica() {
  const base = path.join(root, "Interpretatio-Universalis");
  if (!fs.existsSync(base)) return warn("Interpretatio-Universalis not found");
  const files = fs.readdirSync(base).filter((f) => f.endsWith(".json") && f !== "expansion-manifest.json" && f !== "package.json" && f !== "package-lock.json");
  const dataDir = path.join(base, "data");
  if (fs.existsSync(dataDir)) for (const d of fs.readdirSync(dataDir)) { const p = path.join(dataDir, d); if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) if (f.endsWith(".json")) files.push(path.join("data", d, f)); }
  const nodes = new Map(), allEdges = [];
  for (const f of files) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(base, f), "utf8")); } catch { continue; }
    for (const n of j.nodes ?? []) if (n?.id && !nodes.has(n.id)) nodes.set(n.id, n);
    for (const e of j.edges ?? []) if (e?.source && e?.target) allEdges.push(e);
  }
  const kept = new Set();
  for (const n of nodes.values()) {
    if (typeof n.attestedFrom !== "number") continue;
    const to = typeof n.attestedTo === "number" ? n.attestedTo : n.attestedTo === "present" ? NOW : undefined;
    const ok = add({ id: `mg-${n.id}`, k: "deity", n: clean(n.name), s: astro(n.attestedFrom), e: to != null ? astro(to) : undefined, lane: n.tradition || "Unknown tradition", grp: "Pantheons", d: trunc(clean(n.description), 900), g: n.confidenceLevel, reg: n.region, type: n.type, src: Array.isArray(n.sources) ? n.sources.slice(0, 4).map(clean) : undefined });
    if (ok) kept.add(n.id);
  }
  const dup = new Set();
  for (const e of allEdges) {
    if (!kept.has(e.source) || !kept.has(e.target) || e.source === e.target) continue;
    const key = e.source + ">" + e.target + ":" + e.relationType;
    if (dup.has(key)) continue;
    dup.add(key);
    edges.push({ a: `mg-${e.source}`, b: `mg-${e.target}`, t: e.relationType, cat: catOf(e.relationType), w: typeof e.confidence === "number" ? e.confidence : undefined });
    bump("edges:pantheons");
  }
}

// ---- 6a. Golden Chain philosophers (panentheon/docs/lineage.md) ----------------------------------------------------
function goldenChain() {
  const file = path.join(root, GC_FILE);
  if (!fs.existsSync(file)) return warn("panentheon lineage.md not found");
  const { rows, skipped } = parseGoldenChain(fs.readFileSync(file, "utf8"));
  for (const r of rows) {
    add({ id: `gc-${slug(r.name)}-${r.start}`, k: "figure", n: r.name, s: r.start, e: r.end, lane: r.section, grp: GC_GROUP, d: trunc(r.desc, 900), approx: r.approx, type: r.mythological ? "mythological" : "philosopher", g: r.mythological ? "speculative" : undefined, src: [GC_FILE] });
  }
  for (const k of skipped) bump("skipped:golden-chain");
}

// ---- 6b. Buddhist and Jain stupas (tools/timeline-stupas.mjs) -------------------------------------------------
function stupas() {
  const have = new Set(items.filter((i) => i.grp !== ST_GROUP).map((i) => clean(i.n).toLowerCase()));
  for (const r of ST_ROWS) {
    if (have.has(clean(r.name).toLowerCase())) { bump("stupas:duplicate-skipped"); continue; }
    add({ id: `stupa-${slug(r.country ?? "")}-${slug(r.name)}`, k: r.end != null ? "period" : "event", n: r.name, s: astro(r.start), e: r.end != null ? astro(r.end) : undefined, lane: `${r.tradition} stupas: ${r.country ?? "Unknown"}`, grp: ST_GROUP, d: r.desc, reg: r.region ?? r.country, type: "stupa", g: r.confidence, approx: r.approx || undefined, lat: r.lat, lon: r.lon, img: r.image?.url, src: r.sources?.slice(0, 3) });
  }
}

// ---- 6. curated gap-fill (tools/timeline-gapfill.mjs) ----------------------------------------------------------
function gapFill() {
  const have = new Set(items.filter((i) => i.grp !== GAP_GROUP).map((i) => clean(i.n).toLowerCase()));
  for (const [n, s0, e0, lane, d0, approx] of GAP_ROWS) {
    if (have.has(clean(n).toLowerCase())) { bump("gapfill:duplicate-skipped"); continue; }
    const cit = CITATIONS[`${lane}|${n}`];
    const fix = cit?.checked === "corrected" ? cit.fix ?? {} : {};
    const s = fix.start ?? s0, e = "end" in fix ? fix.end : e0, d = fix.description ?? d0;
    add({ id: `gap-${slug(lane)}-${slug(n)}`, k: e != null ? "period" : "event", n, s: astro(s), e: e != null ? astro(e) : undefined, lane, grp: GAP_GROUP, d, approx: approx || undefined, g: cit?.checked === "unverified" ? "low" : undefined, src: cit?.sources?.length ? cit.sources : ["tools/timeline-gapfill.mjs"] });
  }
  const idOf = (n, lane) => `gap-${slug(lane)}-${slug(n)}`;
  for (const [na, la, nb, lb, t, cat] of GAP_EDGES) {
    if (seen.has(idOf(na, la)) && seen.has(idOf(nb, lb))) { edges.push({ a: idOf(na, la), b: idOf(nb, lb), t, cat }); bump("edges:gapfill"); }
  }
}

const PE_IDS = new Set(PE_ROWS.map(([n, , , lane]) => `pe-${slug(lane)}-${slug(n)}`));
/** Extra deities for thin Pantheons lanes (tools/timeline-pantheon-extra.mjs), filed in the same group and lanes. */
function pantheonExtra() {
  for (const [n, s, e, lane, d, approx] of PE_ROWS) {
    const m = PE_META[`${lane}|${n}`] ?? {};
    add({ id: `pe-${slug(lane)}-${slug(n)}`, k: "deity", n, s: astro(s), e: e != null ? astro(e) : undefined, lane, grp: "Pantheons", d: trunc([d, m.attestation && `Date basis: ${m.attestation}`].filter(Boolean).join("\n\n"), 900), approx: approx || undefined, type: m.role, src: m.sources?.length ? m.sources : ["tools/timeline-pantheon-extra.mjs"] });
  }
}

const EOG_IDS = new Set(EOG_ROWS.map((r) => r.id));
/** Finer-grained Evolution of God rows (tools/timeline-eog-extra.mjs), each tied to its era row. */
function eogExtra() {
  for (const r of EOG_ROWS) {
    add({ id: r.id, k: r.end != null ? "period" : "event", n: r.name, s: astro(r.start), e: r.end != null ? astro(r.end) : undefined, lane: r.lane, grp: EOG_GROUP, d: trunc(clean(r.description), 900), grade: r.grade, approx: r.approx || undefined, src: [r.source] });
  }
  const have = new Set(items.map((i) => i.id));
  for (const l of EOG_LINKS) if (have.has(l.from) && have.has(l.to)) { edges.push({ a: l.from, b: l.to, t: l.type, cat: "other" }); bump("edges:eog"); }
}

/** Sourced links for Civilisations, Bardiya and Evolution of God (tools/timeline-links.mjs); each needs both ends present. */
function sourcedLinks() {
  const have = new Set(items.map((i) => i.id));
  const dup = new Set(edges.map((e) => `${e.a}>${e.b}:${e.t}`));
  for (const l of SRC_LINKS) {
    const k = `${l.from}>${l.to}:${l.type}`;
    if (!have.has(l.from) || !have.has(l.to) || dup.has(k)) continue;
    dup.add(k);
    edges.push({ a: l.from, b: l.to, t: l.type, cat: l.cat });
    bump("edges:sourced-links");
  }
}

/** Fold Bardiya place/tribe lanes into a few lanes and give every item a region where one can be inferred. */
const LINEAGE_LANE = new Map(LINEAGE_ASSIGNMENTS.filter((a) => a.confidence !== "low").map((a) => [`sl-m${a.masterId}`, a.lane]));
function normalize() {
  for (const it of items) if (it.lane === "Unassigned lineage" && LINEAGE_LANE.has(it.id)) it.lane = LINEAGE_LANE.get(it.id);
  for (const it of items) {
    if (it.grp === "Bardiya & Achaemenid") {
      it.reg ??= it.lane;
      it.lane = bardiyaLane(it.lane);
    }
    const reg = regionFor(it.lane, it.reg);
    if (reg) it.reg = reg; else delete it.reg;
  }
}

// `--gapfill-only` re-applies just the curated rows to the existing timeline.json without touching the sibling repos.
if (args.includes("--gapfill-only")) {
  const cur = JSON.parse(fs.readFileSync(out, "utf8"));
  items.push(...cur.items.filter((i) => i.grp !== GAP_GROUP && i.grp !== GC_GROUP && i.grp !== ST_GROUP && !EOG_IDS.has(i.id) && !PE_IDS.has(i.id)));
  edges.push(...cur.edges);
  for (const i of items) seen.add(i.id);
  goldenChain();
  gapFill();
  stupas();
  eogExtra();
  pantheonExtra();
  normalize();
  sourcedLinks();
  items.sort((a, b) => a.s - b.s);
  fs.writeFileSync(out, JSON.stringify({ ...cur, built: new Date().toISOString().slice(0, 10), items, edges }));
  console.log(`Gap-fill applied: ${items.length} items total -> ${path.relative(process.cwd(), out)}`);
  process.exit(0);
}

console.log("Building timeline data from", root);
for (const [name, fn] of [["time-thread-web", timeThread], ["master timeline", masterTimeline], ["Bardiya", bardiya], ["Sacred-Lineage", sacredLineage], ["Interpretatio-Universalis", mythographica], ["Golden Chain", goldenChain], ["gap-fill", gapFill], ["stupas", stupas], ["Evolution of God extra", eogExtra], ["Pantheon extra", pantheonExtra]]) {
  try { fn(); } catch (e) { warn(`${name} failed: ${e.message}`); }
}

normalize();
sourcedLinks();
items.sort((a, b) => a.s - b.s);
const data = { version: 1, built: new Date().toISOString().slice(0, 10), epoch: "astronomical", items, edges };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data));
console.log(`Wrote ${items.length} items, ${edges.length} edges -> ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
console.log(stats);
