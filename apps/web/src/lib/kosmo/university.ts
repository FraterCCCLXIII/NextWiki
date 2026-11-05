import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db, kosmoClaims, kosmoEntities, kosmoLessons } from "@repo/db";
import type { KosmoLessonStatus } from "@repo/db";

/**
 * Read-side queries for the University: stages, programmes, modules and lessons, each
 * addressed by its stable curriculum id (KU-S01, KU-P001, KU-M0001, KU-L00001) rather than
 * by name. Server-only.
 */

export type Coverage = { total: number; stub: number; drafted: number; reviewed: number };
const emptyCoverage = (): Coverage => ({ total: 0, stub: 0, drafted: 0, reviewed: 0 });

export function reviewedShare(c: Coverage): number {
  return c.total === 0 ? 0 : c.reviewed / c.total;
}

function dataOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/**
 * A JSON field of the entity's data. The key is inlined, not bound: Postgres will not accept
 * a bound parameter in SELECT as the same expression as one in GROUP BY. Callers pass
 * literal field names only, never user input.
 */
const dataText = (key: "stage" | "moduleKuId") =>
  sql<string | null>`${kosmoEntities.data}->>${sql.raw(`'${key}'`)}`;
const orderOf = sql<number>`coalesce((${kosmoEntities.data}->>'order')::int, 0)`;

/** Lesson counts by status, grouped by a field of the lesson entity's data ("stage", "moduleKuId"). */
async function coverageBy(field: "stage" | "moduleKuId", only?: { stage?: string; moduleKuId?: string }) {
  const group = dataText(field);
  const filters = [];
  if (only?.stage) filters.push(sql`${kosmoEntities.data}->>'stage' = ${only.stage}`);
  if (only?.moduleKuId) filters.push(sql`${kosmoEntities.data}->>'moduleKuId' = ${only.moduleKuId}`);
  const rows = await db
    .select({ key: group, status: kosmoLessons.status, n: count() })
    .from(kosmoLessons)
    .innerJoin(kosmoEntities, eq(kosmoEntities.id, kosmoLessons.entityId))
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(group, kosmoLessons.status);
  const out = new Map<string, Coverage>();
  for (const r of rows) {
    if (!r.key) continue;
    const c = out.get(r.key) ?? emptyCoverage();
    c[r.status as KosmoLessonStatus] += r.n;
    c.total += r.n;
    out.set(r.key, c);
  }
  return out;
}

export type StageSummary = {
  kuId: string;
  key: string;
  name: string;
  ages: string | null;
  color: string | null;
  blurb: string | null;
  programmes: number;
  modules: number;
  coverage: Coverage;
};

export async function getStages(): Promise<{ stages: StageSummary[]; overall: Coverage }> {
  const rows = await db
    .select({ name: kosmoEntities.name, summary: kosmoEntities.summary, data: kosmoEntities.data })
    .from(kosmoEntities)
    .where(eq(kosmoEntities.kind, "stage"))
    .orderBy(asc(orderOf));
  const byStage = await coverageBy("stage");

  const counts = await db
    .select({ stage: dataText("stage"), kind: kosmoEntities.kind, n: count() })
    .from(kosmoEntities)
    .where(inArray(kosmoEntities.kind, ["programme", "module"]))
    .groupBy(dataText("stage"), kosmoEntities.kind);

  const overall = emptyCoverage();
  const stages = rows.map((r) => {
    const d = dataOf(r.data);
    const key = str(d.id) ?? "";
    const coverage = byStage.get(key) ?? emptyCoverage();
    for (const k of Object.keys(overall) as (keyof Coverage)[]) overall[k] += coverage[k];
    return {
      kuId: str(d.kuId) ?? "",
      key,
      name: r.name,
      ages: str(d.ages) ?? null,
      color: str(d.color) ?? null,
      blurb: r.summary,
      programmes: counts.find((c) => c.stage === key && c.kind === "programme")?.n ?? 0,
      modules: counts.find((c) => c.stage === key && c.kind === "module")?.n ?? 0,
      coverage,
    };
  });
  return { stages, overall };
}

export type ModuleSummary = { kuId: string; name: string; lessons: number; coverage: Coverage };
export type ProgrammeSummary = { kuId: string; name: string; modules: ModuleSummary[]; coverage: Coverage };

export async function getStage(
  key: string,
): Promise<{ stage: StageSummary; programmes: ProgrammeSummary[] } | null> {
  const { stages } = await getStages();
  const stage = stages.find((s) => s.key === key);
  if (!stage) return null;

  const [progRows, modRows, covByModule] = await Promise.all([
    db
      .select({ name: kosmoEntities.name, data: kosmoEntities.data })
      .from(kosmoEntities)
      .where(and(eq(kosmoEntities.kind, "programme"), sql`${kosmoEntities.data}->>'stage' = ${key}`))
      .orderBy(asc(orderOf)),
    db
      .select({ name: kosmoEntities.name, data: kosmoEntities.data })
      .from(kosmoEntities)
      .where(and(eq(kosmoEntities.kind, "module"), sql`${kosmoEntities.data}->>'stage' = ${key}`))
      .orderBy(asc(orderOf)),
    coverageBy("moduleKuId", { stage: key }),
  ]);

  const programmes: ProgrammeSummary[] = progRows.map((p) => ({
    kuId: str(dataOf(p.data).kuId) ?? "",
    name: p.name,
    modules: [],
    coverage: emptyCoverage(),
  }));
  const byProg = new Map(programmes.map((p) => [p.kuId, p]));
  for (const m of modRows) {
    const d = dataOf(m.data);
    const kuId = str(d.kuId) ?? "";
    const coverage = covByModule.get(kuId) ?? emptyCoverage();
    const prog = byProg.get(str(d.programmeKuId) ?? "");
    if (!prog) continue;
    prog.modules.push({ kuId, name: m.name, lessons: coverage.total, coverage });
    for (const k of Object.keys(coverage) as (keyof Coverage)[]) prog.coverage[k] += coverage[k];
  }
  return { stage, programmes };
}

export type LessonRow = {
  kuId: string;
  title: string;
  order: number;
  status: KosmoLessonStatus;
  kind: string | null;
  minutes: number | null;
  /** Kosmographica destination or Kosmopedia object the original outline linked to. */
  go: string | null;
  pedia: string | null;
};
/** An open or Creative Commons resource that fills (part of) a module. Set by the University seed. */
export type OpenSource = {
  sourceId: string;
  title: string;
  publisher: string;
  url: string;
  locator: string;
  fit: "full" | "partial";
  mode: "link" | "adapt" | "ingest";
  license: string;
  licenseName: string;
  licenseUrl: string;
  attribution: string;
  note?: string;
};
export type ModuleLink = { kuId: string; name: string; stage: string };

async function findByKuId(kind: "module" | "lesson", kuId: string) {
  const [row] = await db
    .select()
    .from(kosmoEntities)
    .where(and(eq(kosmoEntities.kind, kind), sql`${kosmoEntities.data}->>'kuId' = ${kuId}`))
    .limit(1);
  return row ?? null;
}

export async function getModule(kuId: string) {
  const mod = await findByKuId("module", kuId);
  if (!mod) return null;
  const d = dataOf(mod.data);

  const lessonRows = await db
    .select({
      entity: kosmoEntities,
      status: kosmoLessons.status,
      kind: kosmoLessons.kind,
      minutes: kosmoLessons.minutes,
    })
    .from(kosmoEntities)
    .innerJoin(kosmoLessons, eq(kosmoLessons.entityId, kosmoEntities.id))
    .where(and(eq(kosmoEntities.kind, "lesson"), sql`${kosmoEntities.data}->>'moduleKuId' = ${kuId}`))
    .orderBy(asc(orderOf));

  const lessons: LessonRow[] = lessonRows.map((r) => {
    const ld = dataOf(r.entity.data);
    return {
      kuId: str(ld.kuId) ?? "",
      title: r.entity.name,
      order: Number(ld.order ?? 0),
      status: r.status,
      kind: r.kind,
      minutes: r.minutes,
      go: str(ld.go) ?? null,
      pedia: str(ld.pedia) ?? null,
    };
  });

  const linkOf = (e: typeof kosmoEntities.$inferSelect): ModuleLink => ({
    kuId: str(dataOf(e.data).kuId) ?? "",
    name: e.name,
    stage: str(dataOf(e.data).stage) ?? "",
  });
  const requires = await db
    .select({ e: kosmoEntities })
    .from(kosmoClaims)
    .innerJoin(kosmoEntities, eq(kosmoEntities.id, kosmoClaims.objectId))
    .where(
      and(
        eq(kosmoClaims.subjectId, mod.id),
        eq(kosmoClaims.predicate, "depends_on"),
        eq(kosmoEntities.kind, "module"),
      ),
    );
  const requiredBy = await db
    .select({ e: kosmoEntities })
    .from(kosmoClaims)
    .innerJoin(kosmoEntities, eq(kosmoEntities.id, kosmoClaims.subjectId))
    .where(
      and(
        eq(kosmoClaims.objectId, mod.id),
        eq(kosmoClaims.predicate, "depends_on"),
        eq(kosmoEntities.kind, "module"),
      ),
    );

  const coverage = emptyCoverage();
  for (const l of lessons) {
    coverage[l.status] += 1;
    coverage.total += 1;
  }
  return {
    kuId,
    name: mod.name,
    stage: str(d.stage) ?? "",
    programme: str(d.programmeName) ?? "",
    lessons,
    coverage,
    requires: requires.map((r) => linkOf(r.e)),
    requiredBy: requiredBy.map((r) => linkOf(r.e)),
    openSources: (Array.isArray(d.openSources) ? d.openSources : []) as OpenSource[],
  };
}

export type SpiralEntry = { kuId: string; title: string; stage: string; moduleKuId: string; status: KosmoLessonStatus };

export async function getLesson(kuId: string) {
  const lesson = await findByKuId("lesson", kuId);
  if (!lesson) return null;
  const [row] = await db.select().from(kosmoLessons).where(eq(kosmoLessons.entityId, lesson.id)).limit(1);
  if (!row) return null;
  const d = dataOf(lesson.data);

  // Concepts this lesson teaches, and every other lesson teaching the same ones (the spiral).
  const concepts = await db
    .select({ id: kosmoEntities.id, name: kosmoEntities.name, slug: kosmoEntities.slug })
    .from(kosmoClaims)
    .innerJoin(kosmoEntities, eq(kosmoEntities.id, kosmoClaims.objectId))
    .where(
      and(
        eq(kosmoClaims.subjectId, lesson.id),
        eq(kosmoClaims.predicate, "teaches"),
        eq(kosmoEntities.kind, "concept"),
      ),
    );
  const spiral: SpiralEntry[] = [];
  if (concepts.length) {
    const rows = await db
      .selectDistinct({ e: kosmoEntities, status: kosmoLessons.status })
      .from(kosmoClaims)
      .innerJoin(kosmoEntities, eq(kosmoEntities.id, kosmoClaims.subjectId))
      .innerJoin(kosmoLessons, eq(kosmoLessons.entityId, kosmoEntities.id))
      .where(
        and(
          eq(kosmoClaims.predicate, "teaches"),
          inArray(
            kosmoClaims.objectId,
            concepts.map((c) => c.id),
          ),
        ),
      );
    for (const r of rows) {
      const rd = dataOf(r.e.data);
      if (str(rd.kuId) === kuId) continue;
      spiral.push({
        kuId: str(rd.kuId) ?? "",
        title: r.e.name,
        stage: str(rd.stage) ?? "",
        moduleKuId: str(rd.moduleKuId) ?? "",
        status: r.status,
      });
    }
  }

  const moduleKuId = str(d.moduleKuId) ?? "";
  const mod = moduleKuId ? await getModule(moduleKuId) : null;
  const idx = mod ? mod.lessons.findIndex((l) => l.kuId === kuId) : -1;
  return {
    kuId,
    title: lesson.name,
    stage: str(d.stage) ?? "",
    go: str(d.go) ?? null,
    pedia: str(d.pedia) ?? null,
    row,
    module: mod,
    prev: mod && idx > 0 ? mod.lessons[idx - 1]! : null,
    next: mod && idx >= 0 ? (mod.lessons[idx + 1] ?? null) : null,
    concepts: concepts.map((c) => c.name),
    spiral,
  };
}
