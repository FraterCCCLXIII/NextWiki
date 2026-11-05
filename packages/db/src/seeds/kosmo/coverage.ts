// What the knowledge base has and what it is missing. The article gate is
// `kosmo_entities.page_id is null`: an entity may exist from an import long
// before anybody writes a paragraph about it, and this is the queue that says
// which ones are waiting.
import { count, isNull, sql } from "drizzle-orm";
import * as schema from "../../schema/index.js";
import type { Db } from "./util.js";

export interface CoverageRow {
  kind: string;
  type: string | null;
  total: number;
  withArticle: number;
  stubs: number;
}

export interface ClaimHealth {
  predicate: string;
  claims: number;
  withoutSource: number;
}

export interface KosmoHealth {
  entities: number;
  claims: number;
  sources: number;
  sourcesWithoutLicence: number;
  unusedSources: number;
  entitiesWithoutType: number;
  entitiesWithoutSource: number;
  externalIds: Record<string, number>;
  methods: Record<string, number>;
  worstPredicates: ClaimHealth[];
  coverage: CoverageRow[];
}

export async function kosmoCoverage(db: Db): Promise<CoverageRow[]> {
  const rows = await db
    .select({
      kind: schema.kosmoEntities.kind,
      type: schema.kosmoEntities.type,
      total: count(),
      withArticle: sql<number>`count(${schema.kosmoEntities.pageId})`.mapWith(
        Number
      ),
    })
    .from(schema.kosmoEntities)
    .groupBy(schema.kosmoEntities.kind, schema.kosmoEntities.type)
    .orderBy(schema.kosmoEntities.kind);

  return rows.map((r) => ({
    kind: r.kind,
    type: r.type,
    total: Number(r.total),
    withArticle: Number(r.withArticle),
    stubs: Number(r.total) - Number(r.withArticle),
  }));
}

export async function kosmoHealth(db: Db): Promise<KosmoHealth> {
  const [
    entityCount,
    claimCount,
    sourceCount,
    unlicensed,
    untyped,
    unsourcedEntities,
    externalIds,
    methods,
    unsourcedClaims,
    coverage,
    unused,
  ] = await Promise.all([
    db.select({ n: count() }).from(schema.kosmoEntities),
    db.select({ n: count() }).from(schema.kosmoClaims),
    db.select({ n: count() }).from(schema.kosmoSources),
    db
      .select({ n: count() })
      .from(schema.kosmoSources)
      .where(isNull(schema.kosmoSources.license)),
    db
      .select({ n: count() })
      .from(schema.kosmoEntities)
      .where(isNull(schema.kosmoEntities.type)),
    db
      .select({ n: count() })
      .from(schema.kosmoEntities)
      .where(isNull(schema.kosmoEntities.sourceId)),
    db
      .select({
        scheme: schema.kosmoEntityExternalIds.scheme,
        n: count(),
      })
      .from(schema.kosmoEntityExternalIds)
      .groupBy(schema.kosmoEntityExternalIds.scheme),
    db
      .select({
        method: schema.kosmoClaims.method,
        n: count(),
      })
      .from(schema.kosmoClaims)
      .groupBy(schema.kosmoClaims.method),
    db
      .select({
        predicate: schema.kosmoClaims.predicate,
        claims: count(),
        withoutSource: sql<number>`count(*) filter (where ${schema.kosmoClaims.sourceId} is null)`.mapWith(
          Number
        ),
      })
      .from(schema.kosmoClaims)
      .groupBy(schema.kosmoClaims.predicate)
      .orderBy(sql`count(*) filter (where ${schema.kosmoClaims.sourceId} is null) desc`)
      .limit(10),
    kosmoCoverage(db),
    db
      .select({ n: count() })
      .from(schema.kosmoSources)
      .where(
        sql`not exists (select 1 from ${schema.kosmoClaims} c where c.source_id = ${schema.kosmoSources.id})
            and not exists (select 1 from ${schema.kosmoEntities} e where e.source_id = ${schema.kosmoSources.id})
            and not exists (select 1 from ${schema.kosmoEntityExternalIds} x where x.source_id = ${schema.kosmoSources.id})`
      ),
  ]);

  const n = (rows: { n: unknown }[]) => Number(rows[0]?.n ?? 0);
  const record = (
    rows: { n: unknown; scheme?: string | null; method?: string | null }[],
  ) => {
    const out: Record<string, number> = {};
    for (const row of rows) {
      const key = row.scheme ?? row.method;
      if (key == null) continue;
      out[key] = Number(row.n);
    }
    return out;
  };

  return {
    entities: n(entityCount),
    claims: n(claimCount),
    sources: n(sourceCount),
    sourcesWithoutLicence: n(unlicensed),
    unusedSources: Number(unused[0]?.n ?? 0),
    entitiesWithoutType: n(untyped),
    entitiesWithoutSource: n(unsourcedEntities),
    externalIds: record(externalIds),
    methods: record(methods),
    worstPredicates: unsourcedClaims.map((r) => ({
      predicate: r.predicate,
      claims: Number(r.claims),
      withoutSource: Number(r.withoutSource),
    })),
    coverage,
  };
}

export function formatHealth(health: KosmoHealth): string {
  const lines: string[] = [];
  lines.push(
    `entities ${health.entities} · claims ${health.claims} · sources ${health.sources} · external ids ${
      Object.values(health.externalIds).reduce((a, b) => a + b, 0)
    }`,
  );
  lines.push(
    `sources without a licence: ${health.sourcesWithoutLicence} · unused sources (left by an older import): ${health.unusedSources}`,
  );
  lines.push(
    `entities without a type: ${health.entitiesWithoutType} · entities without a primary source: ${health.entitiesWithoutSource}`,
  );
  lines.push(
    `external ids: ${Object.entries(health.externalIds)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}`,
  );
  lines.push(
    `claim methods: ${Object.entries(health.methods)
      .map(([k, v]) => `${k ?? "unset"} ${v}`)
      .join(", ")}`,
  );

  lines.push("", "articles vs stubs (page_id is the article gate):");
  for (const row of health.coverage) {
    const label = row.type ?? "—";
    lines.push(
      `  ${row.kind.padEnd(12)} ${label.padEnd(20)} ${String(row.withArticle).padStart(7)} articles ${String(row.stubs).padStart(7)} stubs ${String(row.total).padStart(7)} total`,
    );
  }

  const unsourced = health.worstPredicates.filter((p) => p.withoutSource > 0);
  if (unsourced.length > 0) {
    lines.push("", "claims with no source, by predicate:");
    for (const p of unsourced) {
      lines.push(
        `  ${p.predicate.padEnd(20)} ${String(p.withoutSource).padStart(7)} / ${p.claims}`,
      );
    }
  }
  return lines.join("\n");
}
