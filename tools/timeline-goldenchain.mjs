// Parses the "Golden Chain" page of the panentheon site (panentheon/docs/lineage.md) into timeline rows.
// Used by tools/build-timeline-data.mjs and the db seed (sources/golden-chain.ts). Years are ASTRONOMICAL.
export const GROUP = "Golden Chain";
export const FILE = "panentheon/docs/lineage.md";

const MONTHS = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i;
const astro = (y, era) => (era === "BCE" ? 1 - y : y);
const strip = (s) => s.replace(/\*\*|\*/g, "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

/** "(c. 184–c. 253 CE)", "(5th - 4th Century BCE)", "(15 May 1758 – 1 November 1835)", "(1925-)" -> { start, end?, approx } or null */
export function parseDates(raw) {
  let s = strip(raw).replace(/[–—−]/g, "-");
  const approx = /\bc\.|century|mytholog|traditionally|\?/i.test(s) || undefined;
  s = s.replace(/traditionally dated to|mythological( figure)?,?|\br\.\s*/gi, " ").replace(/\bc\.\s*/gi, "").trim();
  const cent = s.match(/(\d+)(?:st|nd|rd|th)\s*(?:-\s*(\d+)(?:st|nd|rd|th))?\s*century\s*(BCE|CE)?/i);
  if (cent) {
    const era = (cent[3] ?? "CE").toUpperCase();
    const c1 = Number(cent[1]), c2 = Number(cent[2] ?? cent[1]);
    if (era === "BCE") return { start: 1 - Math.max(c1, c2) * 100, end: 1 - (Math.min(c1, c2) - 1) * 100 - 1 + 1, approx: true };
    return { start: (Math.min(c1, c2) - 1) * 100 + 1, end: Math.max(c1, c2) * 100, approx: true };
  }
  if (MONTHS.test(s)) {
    const ys = [...s.matchAll(/\b(\d{3,4})\b/g)].map((m) => Number(m[1]));
    if (ys.length >= 2) return { start: ys[0], end: ys[1], approx };
    if (ys.length === 1) return { start: ys[0], approx };
  }
  const rng = s.match(/(\d{1,4})\s*(BCE|CE)?\s*-\s*(\d{1,4})\s*(BCE|CE)?/i);
  if (rng) {
    let ea = rng[2]?.toUpperCase(), eb = rng[4]?.toUpperCase();
    if (!ea && !eb) ea = eb = "CE";
    else if (!ea) ea = eb;
    else if (!eb) eb = ea;
    const a = astro(Number(rng[1]), ea), b = astro(Number(rng[3]), eb);
    return { start: Math.min(a, b), end: Math.max(a, b), approx };
  }
  const open = s.match(/(\d{3,4})\s*-\s*$/);
  if (open) return { start: Number(open[1]), approx };
  const died = s.match(/d\.\s*(\d{1,4})\s*(BCE|CE)?/i);
  if (died) return { start: astro(Number(died[1]), (died[2] ?? "CE").toUpperCase()), approx: true, diedOnly: true };
  const one = s.match(/(\d{1,4})\s*(BCE|CE)?/i);
  if (one && /BCE|CE/i.test(s)) return { start: astro(Number(one[1]), (one[2] ?? "CE").toUpperCase()), approx };
  return null;
}

/** Returns { rows, skipped }. Row: { key, name, section, start, end?, approx?, desc, mythological, raw } */
export function parseGoldenChain(text) {
  const lines = text.split("\n");
  const rows = [], skipped = [];
  const seen = new Set();
  let section = "";
  let cur = null;
  const flush = () => {
    if (!cur) return;
    const desc = strip(cur.body.join(" ")).replace(/\s*---\s*$/, "");
    const d = parseDates(cur.raw);
    if (!d) skipped.push({ name: cur.name, reason: `undated: "${cur.raw}"` });
    else {
      const key = `${cur.name.toLowerCase()}|${d.start}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push({ key: cur.name, name: cur.name, section, start: d.start, end: d.end, approx: d.approx, diedOnly: d.diedOnly, desc, mythological: /mytholog/i.test(cur.raw), raw: cur.raw });
      }
    }
    cur = null;
  };
  for (const line of lines) {
    const sec = line.match(/^###\s+(.*)$/);
    if (sec) { flush(); section = strip(sec[1]).replace(/\)$/, "").replace(/\s*\(.*$/, "").trim() || strip(sec[1]); continue; }
    const fig = line.match(/^####\s+(.*)$/);
    if (fig) {
      flush();
      const h = strip(fig[1]);
      const m = h.match(/^(.*)\(([^()]*)\)\s*$/);
      cur = m ? { name: m[1].trim(), raw: m[2], body: [] } : { name: h, raw: "", body: [] };
      continue;
    }
    if (cur && line.trim() !== "---" && !line.startsWith("#")) cur.body.push(line.trim());
  }
  flush();
  return { rows, skipped };
}
