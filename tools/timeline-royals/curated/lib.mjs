// Compact authoring helpers for the hand-written royals layer. Years are HISTORICAL (negative = BCE, no year 0).
// H(id, name, realm, civilization, region, start, end, summary, opts)  -> HOUSES row
// R(prefix, realm, houseId, title, rows, defaults)                  -> MONARCHS rows (+ succession links in order)
//   row = [slug, name, reignStart, reignEnd|null, opts?]
//   opts: t title, rn regnalName, h house override, b birth, d death, f father (slug|"~Name"), m mother (slug|"~Name"),
//         sp spouses [slug|"~Name"], sib siblings [slug], acc i|e|u|c|r|a|? , en d|a|p|c|?, leg true, c conf h|m|l,
//         ap approx(true default for BCE or leg), w wikidata, s summary, after (explicit predecessor slug|null for none),
//         rg regent_for (slug), us usurped (slug), alt alternate names
export const REGIONS = new Set(["Western Europe", "Eastern Europe", "Mediterranean", "Middle East", "Anatolia", "Central Asia", "South Asia", "East Asia", "Southeast Asia", "Oceania", "Sub-Saharan Africa", "North Africa", "North America", "Mesoamerica", "South America"]);
export const WE = "Western Europe", EE = "Eastern Europe", MED = "Mediterranean", ME = "Middle East", AN = "Anatolia", CA = "Central Asia", SA = "South Asia", EA = "East Asia", SEA = "Southeast Asia", OC = "Oceania", SSA = "Sub-Saharan Africa", NAF = "North Africa", NAM = "North America", MES = "Mesoamerica", SAM = "South America";
const ACC = { i: "inheritance", e: "election", u: "usurpation", c: "conquest", r: "regency", a: "appointment", "?": "unknown" };
const END = { d: "death", a: "abdication", p: "deposition", c: "conquest", "?": "unknown" };
const CONF = { h: "high", m: "medium", l: "low" };
export function makeShard(shard) {
  const houses = [], monarchs = [], links = [], lastBy = {};
  const H = (id, name, realm, civilization, region, start, end, summary, o = {}) => {
    houses.push(clean({ id, name, alternateNames: o.alt, realm, civilization, region: o.region || region, start, end: end ?? undefined, approx: o.ap ?? (start < 0 || undefined), capital: o.cap, lat: o.ll?.[0], lon: o.ll?.[1], parentHouse: o.parent, summary, wikidata: o.w, confidence: CONF[o.c || "m"], sources: o.src || ["Wikipedia", "Britannica"] }));
    if (o.parent) links.push({ from: id, to: o.parent, type: "branch_of" });
  };
  const R = (prefix, realm, house, title, rows, def = {}) => {
    let prev = lastBy[prefix] || null;
    for (const [slug, name, rs, re, o = {}] of rows) {
      const id = prefix + "-" + slug;
      const res = (x) => x == null ? undefined : x;
      const leg = o.leg ?? def.leg ?? false;
      const conf = CONF[o.c || def.c || (leg ? "l" : (rs != null && rs < -500 ? "m" : "h"))];
      const ap = o.ap ?? def.ap ?? (leg || (rs != null && rs < -700) || undefined);
      const m = { id, name, regnalName: o.rn, title: o.t || title, realm, house: o.h || house, birth: o.b, death: o.d, reignStart: rs, reignEnd: res(re), approx: ap, accession: ACC[o.acc || def.acc], endOfReign: END[o.en], _f: o.f, _m: o.m, _sp: o.sp, _prefix: prefix, legendary: leg, summary: o.s || autoSummary(name, o.t || title, realm, rs, re), wikidata: o.w, confidence: conf, sources: o.src || def.src || ["Wikipedia", "Britannica"], alternateNames: o.alt };
      monarchs.push(clean(m));
      const pred = o.after !== undefined ? (o.after && resolveSlug(o.after, prefix)) : prev;
      if (pred) { const pid = pred; links.push({ from: pid, to: id, type: "succeeded_by" }); }
      if (o.us) links.push({ from: id, to: resolveSlug(o.us, prefix), type: "usurped" });
      if (o.rg) links.push({ from: id, to: resolveSlug(o.rg, prefix), type: "regent_for" });
      for (const s of o.sib || []) links.push({ from: id, to: resolveSlug(s, prefix), type: "sibling_of" });
      if (!o.nolink) prev = id;
    }
    lastBy[prefix] = prev;
  };
  const resolveSlug = (s, prefix) => s[0] === "@" ? s.slice(1) : s[0] === "~" ? s : prefix + "-" + s;
  return { H, R, houses, monarchs, links, shard };
}
function autoSummary(name, title, realm, rs, re) {
  const y = (v) => v == null ? "" : v < 0 ? `${-v} BCE` : `${v} CE`;
  return `${cap(title)} of ${realm}${rs != null ? `, reigning ${y(rs)}${re != null ? `–${y(re)}` : ""}` : ""}.`;
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);
function clean(o) { for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === null) delete o[k]; return o; }
//  cross-shard refs: '@fullId'; name-only relatives: '~Name'
