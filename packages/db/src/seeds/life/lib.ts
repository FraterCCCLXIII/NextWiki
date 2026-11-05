import { sql } from "drizzle-orm";
import { db } from "../../index.js";

export type Db = typeof db;

export const RANKS = ["kingdom", "phylum", "class", "order", "family", "genus", "species"] as const;
export type StoredRank = (typeof RANKS)[number];

export interface UpsertInput {
  gbifKey?: number | null;
  rank: string;
  parentId: number | null;
  scientificName: string;
  canonicalName: string;
  status?: "accepted" | "synonym";
  commonName?: string | null;
  summary?: string | null;
  extinct?: boolean | null;
  source: string;
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Idempotent writer. Identity is gbifKey when present, else (rank, canonicalName, parentId).
 * Keeps the whole taxon table's identity indexes in memory, which is fine up to a few million rows.
 */
export class TaxonWriter {
  private byGbif = new Map<number, number>();
  private byIdentity = new Map<string, number>();
  private slugs = new Set<string>();
  private pathOf = new Map<number, string>(); // id -> path of that row (ancestors only)
  inserted = 0;
  updated = 0;

  constructor(private readonly d: Db) {}

  async load() {
    const rows = (await this.d.execute(
      sql`select id, gbif_key, rank, canonical_name, parent_id, slug, path from taxa`
    )) as unknown as { rows?: Row[] } | Row[];
    const list: Row[] = Array.isArray(rows) ? rows : (rows.rows ?? []);
    for (const r of list) {
      if (r.gbif_key != null) this.byGbif.set(r.gbif_key, r.id);
      this.byIdentity.set(idKey(r.rank, r.canonical_name, r.parent_id), r.id);
      this.slugs.add(r.slug);
      this.pathOf.set(r.id, r.path);
    }
  }

  idForGbif(key: number) {
    return this.byGbif.get(key);
  }

  private uniqueSlug(canonical: string, rank: string): string {
    const base = slugify(canonical) || "taxon";
    for (const cand of [base, `${base}-${rank}`]) if (!this.slugs.has(cand)) return cand;
    for (let i = 2; ; i++) if (!this.slugs.has(`${base}-${rank}-${i}`)) return `${base}-${rank}-${i}`;
  }

  async upsert(t: UpsertInput): Promise<number> {
    const ik = idKey(t.rank, t.canonicalName, t.parentId);
    let id = (t.gbifKey != null ? this.byGbif.get(t.gbifKey) : undefined) ?? this.byIdentity.get(ik);
    const path = t.parentId == null ? "" : `${this.pathOf.get(t.parentId) ?? ""}${t.parentId}/`;
    if (id == null) {
      const slug = this.uniqueSlug(t.canonicalName, t.rank);
      const res = (await this.d.execute(sql`
        insert into taxa (gbif_key, rank, parent_id, path, scientific_name, canonical_name, slug, status, common_name, summary, extinct, source)
        values (${t.gbifKey ?? null}, ${t.rank}, ${t.parentId}, ${path}, ${t.scientificName}, ${t.canonicalName}, ${slug},
                ${t.status ?? "accepted"}, ${t.commonName ?? null}, ${t.summary ?? null}, ${t.extinct ?? null}, ${t.source})
        returning id`)) as unknown as { rows?: { id: number }[] } | { id: number }[];
      id = (Array.isArray(res) ? res : (res.rows ?? []))[0]!.id;
      this.slugs.add(slug);
      this.inserted++;
    } else {
      // never clobber enrichment (summary/image) with null; fill gaps and refresh structure
      await this.d.execute(sql`
        update taxa set
          gbif_key = coalesce(gbif_key, ${t.gbifKey ?? null}),
          rank = ${t.rank}, parent_id = ${t.parentId}, path = ${path},
          scientific_name = ${t.scientificName}, canonical_name = ${t.canonicalName},
          status = ${t.status ?? "accepted"},
          common_name = coalesce(${t.commonName ?? null}, common_name),
          summary = coalesce(summary, ${t.summary ?? null}),
          extinct = coalesce(${t.extinct ?? null}, extinct),
          updated_at = now()
        where id = ${id}`);
      this.updated++;
    }
    if (t.gbifKey != null) this.byGbif.set(t.gbifKey, id);
    this.byIdentity.set(ik, id);
    this.pathOf.set(id, path);
    return id;
  }

  /** Full-text identity rows: vernacular name + gbif external id. */
  async upsertAux(id: number, t: { gbifKey?: number | null; commonName?: string | null; source: string }) {
    if (t.commonName)
      await this.d.execute(sql`insert into taxon_names (taxon_id, name, lang, source) values (${id}, ${t.commonName}, 'en', ${t.source}) on conflict do nothing`);
    if (t.gbifKey != null)
      await this.d.execute(sql`insert into taxon_external_ids (taxon_id, system, external_id) values (${id}, 'gbif', ${String(t.gbifKey)}) on conflict (taxon_id, system) do nothing`);
  }
}

interface Row {
  id: number;
  gbif_key: number | null;
  rank: string;
  canonical_name: string;
  parent_id: number | null;
  slug: string;
  path: string;
}
const idKey = (rank: string, name: string, parent: number | null) => `${rank}|${name}|${parent ?? ""}`;

/** Recomputes child_count (accepted direct children) and species_count (accepted species strictly below). */
export async function recomputeCounts(d: Db) {
  await d.execute(sql`
    update taxa t set child_count = coalesce(c.n, 0)
    from taxa t2 left join (select parent_id, count(*)::int n from taxa where status = 'accepted' and parent_id is not null group by parent_id) c on c.parent_id = t2.id
    where t.id = t2.id`);
  await d.execute(sql`
    update taxa t set species_count = coalesce(c.n, 0)
    from taxa t2 left join (
      select a::int as id, count(*)::int n
      from taxa s, unnest(string_to_array(trim(trailing '/' from s.path), '/')) as a
      where s.rank = 'species' and s.status = 'accepted' and s.path <> ''
      group by a) c on c.id = t2.id
    where t.id = t2.id`);
}
