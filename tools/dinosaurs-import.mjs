// Imports every Dinosauria taxon from the Paleobiology Database (https://paleobiodb.org, data service 1.2)
// and writes the two files the Dinosaurs page reads:
//   apps/web/public/kosmo/static/dinosaurs/dinosaurs.json         clades, families, genera (full metadata)
//   apps/web/public/kosmo/static/dinosaurs/dinosaur-species.json  species (lean; ecology is inherited from the genus)
//
//   node tools/dinosaurs-import.mjs [--refresh]
//
// Responses are cached in tools/.cache/pbdb/ so reruns are offline; --refresh re-downloads.
// Data © the Paleobiology Database contributors, CC BY 4.0. Keep the attribution in `meta.source`.
//
// Hand-written fields (description, images, notes) live in dinosaurs-overrides.json next to the output and are merged in
// on every run, so re-importing never loses curation. Shape: { "<pbdb taxon_no>": { "desc": "...", "img": "...", ... } }.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outDir = path.join(root, "apps/web/public/kosmo/static/dinosaurs");
const cacheDir = path.join(root, "tools/.cache/pbdb");
const refresh = process.argv.includes("--refresh");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

const API = "https://paleobiodb.org/data1.2/taxa/list.json";
const SHOW = "attr,app,size,class,common,parent,ecospace,type,img,ref";

async function pull(key, params) {
  const file = path.join(cacheDir, `${key}.json`);
  if (!refresh && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")).records;
  const qs = new URLSearchParams({ base_name: "Dinosauria", vocab: "pbdb", limit: "all", show: SHOW, ...params });
  const res = await fetch(`${API}?${qs}`, { headers: { "User-Agent": "NextWiki-Kosmographica/1.0 (dinosaur library import)" } });
  if (!res.ok) throw new Error(`PBDB ${key}: HTTP ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(file, text);
  return JSON.parse(text).records;
}

const num = (v) => (v == null || v === "" ? undefined : Number(v));
const str = (v) => (v == null || v === "" ? undefined : String(v).trim());
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

/** PBDB `flags`: I = invalid (synonym / nomen dubium...), F = form taxon (trace, egg), B = base of the query. */
function core(r, rank) {
  const flags = r.flags ?? "";
  return {
    id: num(r.orig_no),
    n: r.taxon_name,
    r: rank,
    a: str(r.taxon_attr),
    p: num(r.parent_no),
    cn: str(r.common_name),
    // an invalid name points at the name it is now filed under
    inv: flags.includes("I") ? str(r.difference) ?? "invalid" : undefined,
    acc: r.accepted_no && r.accepted_no !== r.orig_no ? num(r.accepted_no) : undefined,
    form: flags.includes("F") ? 1 : undefined,
    oc: num(r.n_occs),
    // Ma: oldest possible first appearance .. youngest possible last appearance
    ma: num(r.firstapp_max_ma) != null ? [num(r.firstapp_max_ma), num(r.lastapp_min_ma) ?? 0] : undefined,
    from: str(r.early_interval),
    to: str(r.late_interval),
    ref: str(r.primary_reference),
  };
}

function full(r, rank) {
  return strip({
    ...core(r, rank),
    fam: str(r.family),
    sz: num(r.taxon_size),
    env: str(r.taxon_environment),
    mot: str(r.motility),
    hab: str(r.life_habit),
    diet: str(r.diet),
    repro: str(r.reproduction),
    body: str(r.preservation),
    vis: str(r.vision),
    tsp: str(r.type_specimen),
    tpart: str(r.type_body_part),
    img: str(r.image_no) ? `php:${r.image_no}` : undefined,
  });
}

const lean = (r) => strip({ ...core(r, "species"), sz: undefined });

console.log("Downloading from PBDB (cached after the first run)...");
const [higher, genera, subgenera, species] = [
  await pull("above_genus", { rank: "above_genus" }),
  await pull("genus", { rank: "genus" }),
  await pull("subgenus", { rank: "subgenus" }),
  await pull("species", { rank: "species", show: "attr,app,parent,ref" }),
];

// a higher taxon's own rank is `accepted_rank` when the record is its own accepted name
const rankOf = (r) => (r.accepted_no === r.orig_no ? r.accepted_rank : "synonym");

// Type taxon of each genus: PBDB gives the type species' number; resolve it to a name.
const speciesName = new Map(species.map((s) => [String(s.orig_no), s.taxon_name]));
const typeName = (r) => (r.type_taxon ? speciesName.get(String(r.type_taxon)) ?? undefined : undefined);

const taxa = [];
for (const r of higher) taxa.push(full(r, rankOf(r)));
for (const r of genera) taxa.push({ ...full(r, "genus"), typ: typeName(r) });
for (const r of subgenera) taxa.push(full(r, "subgenus"));

// merge hand-written curation (descriptions, images, notes) by PBDB id
const ovFile = path.join(outDir, "dinosaurs-overrides.json");
const overrides = fs.existsSync(ovFile) ? JSON.parse(fs.readFileSync(ovFile, "utf8")) : {};
let merged = 0;
for (const t of taxa) if (overrides[t.id]) (Object.assign(t, overrides[t.id]), merged++);
if (!fs.existsSync(ovFile)) fs.writeFileSync(ovFile, "{}\n");

const meta = {
  source: "Paleobiology Database (paleobiodb.org), CC BY 4.0",
  retrieved: new Date().toISOString().slice(0, 10),
  counts: {
    clades_families_etc: higher.length,
    genera: genera.length,
    subgenera: subgenera.length,
    species: species.length,
  },
};

fs.writeFileSync(path.join(outDir, "dinosaurs.json"), JSON.stringify({ meta, taxa }));
fs.writeFileSync(path.join(outDir, "dinosaur-species.json"), JSON.stringify(species.map(lean)));
console.log(meta.counts, `\nmerged ${merged} curated overrides`);
console.log("wrote", path.relative(root, outDir));
