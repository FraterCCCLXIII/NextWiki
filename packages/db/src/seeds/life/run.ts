import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../../index.js";
import { RANKS, TaxonWriter, recomputeCounts } from "./lib.js";

/**
 *   pnpm db:seed:life                          bundled sample (~150 taxa), no network
 *   pnpm db:seed:life --gbif                   GBIF backbone tree (resumable), all kingdoms down to species
 *   pnpm db:seed:life --gbif --root=212 --max-rank=genus      one subtree, stop at genus
 *   pnpm db:seed:life --gbif --max-nodes=5000  safety cap on nodes visited this run
 *   pnpm db:seed:life --gbif --fresh           ignore the checkpoint
 *   pnpm db:seed:life --enrich [--enrich-limit=200]   Wikipedia summary + thumbnail (license/credit recorded)
 * Flags combine; e.g. `--gbif --enrich`. Without --gbif the sample is loaded.
 */
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];

const here = path.dirname(new URL(import.meta.url).pathname);
const UA = "NextWikiLifeSeeder/1.0 (https://github.com/FraterCCCLXIII; educational species database)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- sample
interface SampleEntry { l: string; c?: string; s?: string; x?: boolean; k?: number }
const RANK_ABBR: Record<string, string> = { k: "kingdom", p: "phylum", c: "class", o: "order", f: "family", g: "genus", s: "species" };

async function seedSample(w: TaxonWriter) {
  const entries = JSON.parse(fs.readFileSync(path.join(here, "sample.json"), "utf8")) as SampleEntry[];
  const meta = new Map<string, SampleEntry>();
  const nodes = new Map<string, { rank: string; name: string; parent: string | null }>();
  for (const e of entries) {
    const segs = e.l.split("/");
    segs.forEach((seg, i) => {
      const key = segs.slice(0, i + 1).join("/");
      const [abbr, ...rest] = seg.split(":");
      nodes.set(key, { rank: RANK_ABBR[abbr!]!, name: rest.join(":"), parent: i ? segs.slice(0, i).join("/") : null });
    });
    meta.set(e.l, e);
  }
  const ids = new Map<string, number>();
  const ordered = [...nodes.entries()].sort((a, b) => a[0].split("/").length - b[0].split("/").length);
  for (const [key, n] of ordered) {
    const m = meta.get(key);
    const gbifKey = m?.k ?? null;
    const id = await w.upsert({
      gbifKey, rank: n.rank, parentId: n.parent ? ids.get(n.parent)! : null,
      scientificName: n.name, canonicalName: n.name, commonName: m?.c ?? null, summary: m?.s ?? null,
      extinct: m?.x ?? null, source: "sample",
    });
    ids.set(key, id);
    await w.upsertAux(id, { gbifKey, commonName: m?.c, source: "sample" });
  }
  console.log(`sample: ${nodes.size} taxa (${w.inserted} inserted, ${w.updated} updated)`);
}

// ---------------------------------------------------------------- GBIF
const GBIF = "https://api.gbif.org/v1";
const GBIF_ROOTS = [1, 2, 3, 4, 5, 6, 7, 8];
const RANK_ORDER = RANKS as readonly string[];

async function getJson<T>(url: string, tries = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) throw Object.assign(new Error("404"), { notFound: true });
      if (i >= tries || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
    } catch (e) {
      if ((e as { notFound?: boolean }).notFound || i >= tries) throw e;
    }
    await sleep(1000 * 2 ** i);
  }
}

interface GbifName {
  key: number; rank: string; canonicalName?: string; scientificName: string;
  taxonomicStatus?: string; extinct?: boolean; vernacularName?: string; numDescendants?: number;
  kingdomKey?: number; phylumKey?: number; classKey?: number; orderKey?: number; familyKey?: number; genusKey?: number;
}

async function seedGbif(w: TaxonWriter) {
  const roots = opt("root") ? opt("root")!.split(",").map(Number) : GBIF_ROOTS;
  const maxRank = (opt("max-rank") ?? "species").toLowerCase();
  if (!RANK_ORDER.includes(maxRank)) throw new Error(`--max-rank must be one of ${RANK_ORDER.join("|")}`);
  const delay = Number(opt("delay-ms") ?? 120);
  const maxNodes = Number(opt("max-nodes") ?? Infinity);
  const ckptFile = path.resolve(here, "../../../node_modules/.cache/life-gbif-checkpoint.json");
  const done = new Set<number>();
  if (!flag("fresh") && fs.existsSync(ckptFile)) {
    for (const k of (JSON.parse(fs.readFileSync(ckptFile, "utf8")) as { done: number[] }).done) done.add(k);
    console.log(`gbif: resuming, ${done.size} nodes already expanded (use --fresh to restart)`);
  }
  const saveCkpt = () => {
    fs.mkdirSync(path.dirname(ckptFile), { recursive: true });
    fs.writeFileSync(ckptFile, JSON.stringify({ done: [...done] }));
  };
  const stored = (rank: string) => {
    const r = rank.toLowerCase();
    return RANK_ORDER.includes(r) && RANK_ORDER.indexOf(r) <= RANK_ORDER.indexOf(maxRank) ? r : null;
  };
  const toInput = (n: GbifName, parentId: number | null, rank: string) => ({
    gbifKey: n.key, rank, parentId,
    scientificName: n.scientificName, canonicalName: n.canonicalName ?? n.scientificName,
    extinct: n.extinct ?? null, commonName: n.vernacularName ?? null, source: "gbif",
  });

  let visited = 0;
  type Frame = { key: number; dbId: number };
  const stack: Frame[] = [];

  for (const rootKey of roots) {
    const root = await getJson<GbifName>(`${GBIF}/species/${rootKey}`);
    // ancestors of a non-kingdom root, so the subtree hangs in the right place
    let parentId: number | null = null;
    for (const [f, rank] of [["kingdomKey", "kingdom"], ["phylumKey", "phylum"], ["classKey", "class"], ["orderKey", "order"], ["familyKey", "family"], ["genusKey", "genus"]] as const) {
      const ak = root[f];
      if (!ak || ak === root.key || rank === root.rank.toLowerCase()) continue;
      if (RANK_ORDER.indexOf(rank) >= RANK_ORDER.indexOf(root.rank.toLowerCase())) continue;
      const a = await getJson<GbifName>(`${GBIF}/species/${ak}`);
      parentId = await w.upsert(toInput(a, parentId, rank));
      await w.upsertAux(parentId, { gbifKey: a.key, source: "gbif" });
      await sleep(delay);
    }
    const rr = stored(root.rank);
    if (!rr) throw new Error(`root ${rootKey} has rank ${root.rank}, which is not stored`);
    const id = await w.upsert(toInput(root, parentId, rr));
    await w.upsertAux(id, { gbifKey: root.key, source: "gbif" });
    stack.push({ key: root.key, dbId: id });
  }

  // iterative DFS; unstored intermediate ranks (subfamily, tribe...) are walked through but not written
  type Item = { key: number; dbId: number; rank: string };
  const work: Item[] = stack.map((s) => ({ ...s, rank: "" }));
  while (work.length) {
    const cur = work.pop()!;
    if (visited >= maxNodes) { console.log(`gbif: hit --max-nodes=${maxNodes}, stopping (re-run to resume)`); break; }
    const curRank = cur.rank || ((await getJson<GbifName>(`${GBIF}/species/${cur.key}`)).rank.toLowerCase());
    if (stored(curRank) === maxRank) continue;
    if (done.has(cur.key)) {
      // already expanded in an earlier run: continue from its stored children
      const kids = (await db.execute(sql`select gbif_key, id, rank from taxa where parent_id = ${cur.dbId} and gbif_key is not null`)) as unknown as { rows?: { gbif_key: number; id: number; rank: string }[] } | { gbif_key: number; id: number; rank: string }[];
      for (const k of Array.isArray(kids) ? kids : (kids.rows ?? [])) work.push({ key: k.gbif_key, dbId: k.id, rank: k.rank });
      continue;
    }
    for (let offset = 0; ; ) {
      const page = await getJson<{ results: GbifName[]; endOfRecords: boolean }>(`${GBIF}/species/${cur.key}/children?limit=1000&offset=${offset}`);
      await sleep(delay);
      for (const n of page.results) {
        if ((n.taxonomicStatus ?? "ACCEPTED").toUpperCase() !== "ACCEPTED") continue;
        const r = stored(n.rank);
        if (r) {
          const id = await w.upsert(toInput(n, cur.dbId, r));
          await w.upsertAux(id, { gbifKey: n.key, source: "gbif" });
          visited++;
          work.push({ key: n.key, dbId: id, rank: r });
        } else if (!/^(subspecies|variety|form|strain|infra)/i.test(n.rank) && n.rank.toLowerCase() !== "species") {
          // intermediate (subfamily, tribe, superfamily...): hoist its children onto the current parent
          work.push({ key: n.key, dbId: cur.dbId, rank: n.rank.toLowerCase() });
        }
      }
      offset += page.results.length;
      if (page.endOfRecords || page.results.length === 0) break;
    }
    done.add(cur.key);
    if (done.size % 25 === 0) { saveCkpt(); console.log(`gbif: ${visited} nodes this run, ${w.inserted} inserted`); }
  }
  saveCkpt();
  console.log(`gbif: ${w.inserted} inserted, ${w.updated} updated`);
}

// ---------------------------------------------------------------- Wikipedia enrichment
interface WikiSummary {
  extract?: string; wikibase_item?: string; type?: string;
  thumbnail?: { source: string }; originalimage?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

function fileNameFromUrl(src: string): string | null {
  const m = src.split("?")[0]!.match(/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/(?:commons|en)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/);
  return m ? decodeURIComponent(m[1]!) : null;
}
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function enrich() {
  const limit = Number(opt("enrich-limit") ?? 200);
  const delay = Number(opt("delay-ms") ?? 200);
  const res = (await db.execute(sql`
    select id, canonical_name, common_name, summary, image_url from taxa
    where status = 'accepted' and (summary is null or image_url is null) and source <> 'wikipedia-miss'
    order by species_count desc, id limit ${limit}`)) as unknown as { rows?: Record<string, unknown>[] } | Record<string, unknown>[];
  const rows = (Array.isArray(res) ? res : (res.rows ?? [])) as { id: number; canonical_name: string; common_name: string | null; summary: string | null; image_url: string | null }[];
  let ok = 0, miss = 0;
  for (const r of rows) {
    let sum: WikiSummary | null = null;
    for (const title of [r.canonical_name, r.common_name].filter(Boolean) as string[]) {
      try {
        const s = await getJson<WikiSummary>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`, 2);
        if (s.type === "standard" && s.extract) { sum = s; break; }
      } catch { /* try next title */ }
      await sleep(delay);
    }
    if (!sum) { miss++; continue; }
    const img = sum.originalimage?.source ?? sum.thumbnail?.source ?? null;
    const thumb = (sum.thumbnail?.source ?? img)?.split("?")[0] ?? null;
    let license: string | null = null, credit: string | null = null;
    const fname = img ? fileNameFromUrl(img) : null;
    if (fname) {
      try {
        const q = await getJson<{ query?: { pages?: Record<string, { imageinfo?: { extmetadata?: Record<string, { value: string }> }[] }> } }>(
          `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent("File:" + fname)}`, 2);
        const md = Object.values(q.query?.pages ?? {})[0]?.imageinfo?.[0]?.extmetadata;
        license = md?.LicenseShortName?.value ?? null;
        credit = md?.Artist?.value ? stripHtml(md.Artist.value) : null;
      } catch { /* leave null: image is still shown only if license known */ }
      await sleep(delay);
    }
    const page = sum.content_urls?.desktop?.page ?? null;
    // only use an image whose license we could establish
    const useImg = thumb && license ? thumb : null;
    await db.execute(sql`
      update taxa set
        summary = coalesce(summary, ${sum.extract!.slice(0, 1200)}),
        image_url = coalesce(image_url, ${useImg}),
        image_license = case when image_url is null and ${useImg}::text is not null then ${license} else image_license end,
        image_credit = case when image_url is null and ${useImg}::text is not null then ${credit} else image_credit end,
        updated_at = now()
      where id = ${r.id}`);
    if (useImg)
      await db.execute(sql`insert into taxon_media (taxon_id, url, kind, license, credit, source_url) values (${r.id}, ${useImg}, 'image', ${license}, ${credit}, ${page}) on conflict (taxon_id, url) do nothing`);
    if (sum.wikibase_item)
      await db.execute(sql`insert into taxon_external_ids (taxon_id, system, external_id) values (${r.id}, 'wikidata', ${sum.wikibase_item}) on conflict (taxon_id, system) do nothing`);
    ok++;
    await sleep(delay);
  }
  console.log(`enrich: ${ok} enriched, ${miss} without a Wikipedia article (of ${rows.length}). Summaries are CC BY-SA from Wikipedia.`);
}

// ---------------------------------------------------------------- main
const w = new TaxonWriter(db);
await w.load();
if (flag("gbif")) await seedGbif(w);
else if (!flag("enrich")) await seedSample(w);
await recomputeCounts(db);
if (flag("enrich")) await enrich();

const counts = (await db.execute(sql`select (select count(*) from taxa) taxa, (select count(*) from taxon_names) names, (select count(*) from taxon_media) media, (select count(*) from taxon_external_ids) ext`)) as unknown as { rows?: unknown[] } | unknown[];
console.log("rows:", (Array.isArray(counts) ? counts : (counts.rows ?? []))[0]);
process.exit(0);
