// Authoring helper for curated rows. R(id, name, type, start, end, region, civilizations, summary, opts)
// opts: parent, ll:[lat,lon], place, sides:[[a,...],[b,...]], out (outcome), theme, approx, conf, wp (Wikipedia title), alias:[names that Wikidata may use], src:[...]
export const WE="Western Europe",EE="Eastern Europe",MED="Mediterranean",ME="Middle East",AN="Anatolia",CA="Central Asia",SA="South Asia",EA="East Asia",SEA="Southeast Asia",OC="Oceania",SSA="Sub-Saharan Africa",NAF="North Africa",NAM="North America",MES="Mesoamerica",SAM="South America",GL="Global";
export function makeR(rows) {
  return function R(id, name, type, start, end, region, civilizations, summary, o = {}) {
    const row = { id, name, type, start, approx: !!o.approx, region, civilizations, summary, confidence: o.conf || (o.approx ? "medium" : "high") };
    if (end != null && end !== start) row.end = end;
    if (o.ll) { row.lat = o.ll[0]; row.lon = o.ll[1]; }
    if (o.place) row.place = o.place;
    if (o.parent) row.parent = o.parent;
    row.sides = (o.sides || []).map(s => ({ name: s[0], belligerents: s }));
    if (o.out) row.outcome = o.out;
    if (o.theme) row.theme = o.theme;
    if (o.alias) row.alias = o.alias;
    if (o.links) row.links = o.links; // [[type, otherId]] shorthand, 'from' is this row
    row.sources = o.src || ["https://en.wikipedia.org/wiki/" + encodeURIComponent((o.wp || name).replace(/ /g, "_"))];
    row.curated = true;
    rows.push(row); return row;
  };
}
