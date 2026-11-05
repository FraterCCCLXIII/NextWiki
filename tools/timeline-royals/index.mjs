// Royal houses, monarchs and succession for the NextWiki timeline. Years are HISTORICAL (negative = BCE, no year 0).
// HOUSES:   { id, name, alternateNames?, realm, civilization, region, start, end?, approx, capital?, lat?, lon?, parentHouse?, summary, wikidata?, confidence, sources }
// MONARCHS: { id, name, regnalName?, title, realm, house, birth?, death?, reignStart, reignEnd?, approx, accession?, endOfReign?,
//             father?, mother?, spouses?, fatherName?, motherName?, spouseNames?, legendary, summary, wikidata?, confidence, sources }
// LINKS:    { from, to, type } with type in parent_of | spouse_of | sibling_of | succeeded_by | preceded_by | member_of_house | branch_of | usurped | regent_for
// Sources: hand-written shards in this folder (royals-*.mjs, curated layer) plus Wikidata-derived shards (royals-wd-*.mjs, produced by build/build.mjs).
import * as egypt from "./royals-egypt-mesopotamia.mjs";
import * as china from "./royals-east-asia-china.mjs";
import * as jkv from "./royals-east-asia-japan-korea-vietnam.mjs";
import * as south from "./royals-south-asia.mjs";
import * as mideast from "./royals-middle-east-islamic.mjs";
import * as rome from "./royals-rome-byzantium-hellenistic.mjs";
import * as americas from "./royals-americas-oceania.mjs";
import * as africa from "./royals-africa.mjs";
import * as seca from "./royals-southeast-central-asia.mjs";
import * as europeCur from "./royals-europe-curated.mjs";
import * as wdEuropeEarly from "./royals-wd-europe-to-1500.mjs";
import * as wdEuropeLate from "./royals-wd-europe-from-1500.mjs";
import * as wdMeAfEarly from "./royals-wd-middle-east-africa-to-1500.mjs";
import * as wdMeAfLate from "./royals-wd-middle-east-africa-from-1500.mjs";
import * as wdAsiaEarly from "./royals-wd-asia-americas-oceania-to-1500.mjs";
import * as wdAsiaLate from "./royals-wd-asia-americas-oceania-from-1500.mjs";
import { WIKIDATA_OF_CURATED } from "./royals-wd-curated-ids.mjs";

export const GROUP = "Royal houses";
export const SHARDS = { egypt, china, jkv, south, mideast, rome, americas, africa, seca, europeCur, wdEuropeEarly, wdEuropeLate, wdMeAfEarly, wdMeAfLate, wdAsiaEarly, wdAsiaLate };

const resolveRef = (s, prefix) => s[0] === "@" ? s.slice(1) : s[0] === "~" ? s : prefix + "-" + s;
const houses = [], monarchs = [], links = [];
for (const [shard, m] of Object.entries(SHARDS)) {
  for (const h of m.houses) houses.push({ ...h, _shard: shard });
  for (const x of m.monarchs) monarchs.push({ ...x, _shard: shard });
  for (const l of m.links) links.push(l);
}
// resolve curated relative references (_f, _m, _sp) to ids / names
for (const m of monarchs) {
  if (m._f || m._m || m._sp) {
    const p = m._prefix;
    if (m._f) { const r = resolveRef(m._f, p); if (r[0] === "~") m.fatherName = r.slice(1); else m.father = r; }
    if (m._m) { const r = resolveRef(m._m, p); if (r[0] === "~") m.motherName = r.slice(1); else m.mother = r; }
    for (const s of m._sp || []) { const r = resolveRef(s, p); if (r[0] === "~") (m.spouseNames ||= []).push(r.slice(1)); else (m.spouses ||= []).push(r); }
  }
  delete m._f; delete m._m; delete m._sp; delete m._prefix;
  if (!m.wikidata && WIKIDATA_OF_CURATED[m.id]) m.wikidata = WIKIDATA_OF_CURATED[m.id];
}
export const SHARD_OF = {};
for (const x of [...houses, ...monarchs]) { SHARD_OF[x.id] = x._shard; delete x._shard; }
const pk = (a, b) => a < b ? a + "|" + b : b + "|" + a;
const seen = new Set();
const out = [];
const add = (l) => { const k = (l.type === "spouse_of" || l.type === "sibling_of") ? l.type + pk(l.from, l.to) : l.type + "|" + l.from + "|" + l.to; if (seen.has(k) || l.from === l.to) return; seen.add(k); out.push(l); };
for (const l of links) add(l);
for (const m of monarchs) {
  if (m.father) add({ from: m.father, to: m.id, type: "parent_of" });
  if (m.mother) add({ from: m.mother, to: m.id, type: "parent_of" });
  for (const s of m.spouses || []) add({ from: m.id, to: s, type: "spouse_of" });
  if (m.house) add({ from: m.id, to: m.house, type: "member_of_house" });
}
for (const h of houses) if (h.parentHouse) add({ from: h.id, to: h.parentHouse, type: "branch_of" });
export const HOUSES = houses;
export const MONARCHS = monarchs;
export const LINKS = out;
