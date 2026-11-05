import { sql } from "drizzle-orm";
import { db } from "@repo/db";
import type { EdgeCat, TLEdge, TLItem, TLKind } from "~/lib/timeline/types";

/**
 * Time-window reads for the Timeline. Entities are kosmo_entities of kind event/period with a time_start;
 * years are astronomical. Server-only.
 */
type Row = Record<string, unknown>;
const rowsOf = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] }).rows ?? []));

export interface TimelineWindowQuery {
  from: number;
  to: number;
  limit: number;
  datasets?: string[];
  q?: string;
}

export interface TimelineWindow {
  items: TLItem[];
  edges: TLEdge[];
  /** how many entities overlap the window before thinning */
  matched: number;
  total: number;
}

const BASE = sql`
  e.kind in ('event','period') and e.time_start is not null
`;

/** significance used to thin the window: stored rank, else a default from the kind and how much of the window it spans */
const weight = (span: ReturnType<typeof sql>) => sql`
  coalesce((e.data->>'rank')::float,
    case when e.kind = 'period' then 0.45 else 0.3 end + least(0.4, ${span})
  )`;

const kindOf = (type: string | null, kind: string, hasEnd: boolean): TLKind => {
  if (type === "figure") return "figure";
  if (type === "deity") return "deity";
  if (type === "tradition") return "tradition";
  return kind === "period" || hasEnd ? "period" : "event";
};

export async function queryTimelineWindow(q: TimelineWindowQuery): Promise<TimelineWindow> {
  const win = Math.max(q.to - q.from, 1);
  const filters = [sql`${BASE}`, sql`e.time_start <= ${q.to}`, sql`coalesce(e.time_end, e.time_start) >= ${q.from}`];
  if (q.datasets?.length) filters.push(sql`coalesce(e.data->>'dataset', 'kosmo-history') in (${sql.join(q.datasets.map((d) => sql`${d}`), sql`, `)})`);
  if (q.q) filters.push(sql`(e.name ilike ${"%" + q.q.replace(/[\\%_]/g, "\\$&") + "%"} or coalesce(e.summary,'') ilike ${"%" + q.q.replace(/[\\%_]/g, "\\$&") + "%"})`);
  const where = sql.join(filters, sql` and `);
  const span = sql`(coalesce(e.time_end, e.time_start) - e.time_start) / ${win}`;

  const [{ count: matchedRaw } = { count: 0 }] = rowsOf(await db.execute(sql`select count(*)::int as count from kosmo_entities e where ${where}`)) as { count: number }[];
  const rows = rowsOf(
    await db.execute(sql`
      select e.id, e.slug, e.kind, e.type, e.name, left(e.summary, 220) as summary, e.time_start as s, e.time_end as e,
             e.data, p.path as page_path,
             case when e.slug like 'period:%' then initcap(replace(split_part(split_part(e.slug, ':', 2), '/', 1), '-', ' ')) else 'Landmark events' end as slug_lane
      from kosmo_entities e
      left join wiki_pages p on p.id = e.page_id
      where ${where}
      order by ${weight(span)} desc, e.time_start asc
      limit ${q.limit}`)
  );

  const items: TLItem[] = rows.map((r) => {
    const data = (r.data ?? {}) as Record<string, unknown>;
    const end = r.e == null ? undefined : Number(r.e);
    const it: TLItem = {
      id: String(r.slug),
      k: kindOf((r.type as string) ?? null, String(r.kind), end != null),
      n: String(r.name),
      s: Number(r.s),
      lane: String(data.lane ?? (r.slug_lane || (r.type as string)) ?? "History"),
      grp: String(data.datasetLabel ?? "Kosmographica history"),
    };
    if (end != null) it.e = end;
    if (r.summary) it.d = String(r.summary);
    if (data.confidence) it.g = String(data.confidence);
    if (data.approx) it.approx = true;
    if (data.region) it.reg = String(data.region);
    if (r.type) it.type = String(r.type);
    if (Array.isArray(data.sources)) it.src = (data.sources as unknown[]).map(String).slice(0, 2);
    if (r.page_path) it.page = `/${String(r.page_path)}`;
    return it;
  });

  let edges: TLEdge[] = [];
  if (items.length) {
    const ids = rows.map((r) => Number(r.id));
    const slugById = new Map(rows.map((r) => [Number(r.id), String(r.slug)]));
    const rel = rowsOf(
      await db.execute(sql`
        select c.subject_id as a, c.object_id as b, c.predicate, c.qualifiers
        from kosmo_claims c
        where c.predicate like 'timeline:%' and c.subject_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
          and c.object_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
        limit 8000`)
    );
    edges = rel.flatMap((r) => {
      const a = slugById.get(Number(r.a)), b = slugById.get(Number(r.b));
      if (!a || !b) return [];
      const qual = (r.qualifiers ?? {}) as { cat?: EdgeCat; weight?: number };
      return [{ a, b, t: String(r.predicate).replace(/^timeline:/, ""), cat: qual.cat ?? "other", ...(qual.weight != null ? { w: qual.weight } : {}) }];
    });
  }
  const [{ count: total } = { count: 0 }] = rowsOf(await db.execute(sql`select count(*)::int as count from kosmo_entities e where ${BASE}`)) as { count: number }[];
  return { items, edges, matched: Number(matchedRaw), total: Number(total) };
}

export async function timelineDatasets(): Promise<{ id: string; label: string; count: number }[]> {
  const rows = rowsOf(
    await db.execute(sql`
      select coalesce(e.data->>'dataset','kosmo-history') as id,
             coalesce(e.data->>'datasetLabel','Kosmographica history') as label, count(*)::int as count
      from kosmo_entities e where ${BASE} group by 1, 2 order by 3 desc`)
  );
  return rows.map((r) => ({ id: String(r.id), label: String(r.label), count: Number(r.count) }));
}

/** Entities that point at a wiki page, for "on the timeline" strips. */
export async function timelineForPage(pageId: number, limit = 30): Promise<TLItem[]> {
  const rows = rowsOf(
    await db.execute(sql`
      select e.slug, e.kind, e.type, e.name, e.time_start as s, e.time_end as e, e.data
      from kosmo_entities e where ${BASE} and e.page_id = ${pageId} order by e.time_start limit ${limit}`)
  );
  return rows.map((r) => {
    const data = (r.data ?? {}) as Record<string, unknown>;
    const end = r.e == null ? undefined : Number(r.e);
    return { id: String(r.slug), k: kindOf((r.type as string) ?? null, String(r.kind), end != null), n: String(r.name), s: Number(r.s), ...(end != null ? { e: end } : {}), lane: String(data.lane ?? "History"), grp: String(data.datasetLabel ?? "Kosmographica history") };
  });
}

/** An entity plus the most significant items around it in time, for the wiki "on the timeline" strip. */
export async function timelineAround(slug: string): Promise<{ item: TLItem; from: number; to: number; items: TLItem[] } | null> {
  const [row] = rowsOf(
    await db.execute(sql`select e.slug, e.kind, e.type, e.name, e.time_start as s, e.time_end as e, e.data from kosmo_entities e where e.slug = ${slug} and e.time_start is not null limit 1`)
  );
  if (!row) return null;
  const s = Number(row.s);
  const end = row.e == null ? s : Number(row.e);
  const pad = Math.max(end - s, 60) * 1.2;
  const from = s - pad, to = end + pad;
  const win = await queryTimelineWindow({ from, to, limit: 14 });
  const data = (row.data ?? {}) as Record<string, unknown>;
  const item: TLItem = { id: String(row.slug), k: kindOf((row.type as string) ?? null, String(row.kind), row.e != null), n: String(row.name), s, ...(row.e != null ? { e: end } : {}), lane: String(data.lane ?? "History"), grp: String(data.datasetLabel ?? "Kosmographica history") };
  return { item, from, to, items: win.items.filter((i) => i.id !== item.id).slice(0, 12) };
}
