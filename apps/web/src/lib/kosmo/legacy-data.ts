import { and, asc, eq } from "drizzle-orm";
import {
  db,
  kosmoDatasets,
  kosmoClaims,
  kosmoEntities,
  kosmoTaxa,
} from "@repo/db";

/**
 * Rebuilds the data files the original Kosmographica HTML pages load, from the
 * database, in exactly the shape those pages expect. Served by
 * /api/kosmo/data/[...file] and reached through rewrites at the old URLs.
 */

type Json = Record<string, unknown>;
const asJson = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
const byOrder = (a: Json, b: Json) => Number(a.order ?? 0) - Number(b.order ?? 0);

/** catalog/objects.json: the raw catalogue records, in import order. */
export async function catalogObjectsJson(): Promise<string | null> {
  const rows = await db
    .select({ data: kosmoEntities.data })
    .from(kosmoEntities)
    .where(eq(kosmoEntities.kind, "object"))
    .orderBy(asc(kosmoEntities.id));
  if (rows.length === 0) return null;
  return JSON.stringify(rows.map((r) => r.data));
}

/** university-tree.js: `export const TREE` of stages > programmes > modules > lessons. */
export async function universityTreeModule(): Promise<string | null> {
  const [entities, taxa, depends] = await Promise.all([
    db
      .select({
        id: kosmoEntities.id,
        slug: kosmoEntities.slug,
        kind: kosmoEntities.kind,
        name: kosmoEntities.name,
        summary: kosmoEntities.summary,
        data: kosmoEntities.data,
      })
      .from(kosmoEntities)
      .where(
        // stage, module and lesson entities of the curriculum
        and(
          eq(kosmoEntities.sourceId, (await curriculumSourceId()) ?? -1),
        ),
      )
      .orderBy(asc(kosmoEntities.id)),
    db
      .select()
      .from(kosmoTaxa)
      .where(eq(kosmoTaxa.scheme, "curriculum"))
      .orderBy(asc(kosmoTaxa.sortOrder), asc(kosmoTaxa.id)),
    db
      .select({
        subjectId: kosmoClaims.subjectId,
        objectId: kosmoClaims.objectId,
      })
      .from(kosmoClaims)
      .where(eq(kosmoClaims.predicate, "depends_on")),
  ]);
  const stages = entities.filter((e) => e.kind === "stage");
  if (stages.length === 0) return null;

  const modules = entities.filter((e) => e.kind === "module");
  const lessons = entities.filter((e) => e.kind === "lesson");
  const nameById = new Map(modules.map((m) => [m.id, m.name]));
  const reqs = new Map<number, string[]>();
  for (const d of depends) {
    const name = d.objectId == null ? undefined : nameById.get(d.objectId);
    if (!name || !nameById.has(d.subjectId)) continue;
    reqs.set(d.subjectId, [...(reqs.get(d.subjectId) ?? []), name]);
  }
  const lessonsByModule = new Map<string, typeof lessons>();
  for (const l of lessons) {
    const key = String(asJson(l.data).module);
    lessonsByModule.set(key, [...(lessonsByModule.get(key) ?? []), l]);
  }

  const tree = stages
    .sort((a, b) => byOrder(asJson(a.data), asJson(b.data)))
    .map((stage) => {
      const sd = asJson(stage.data);
      const stageKey = taxa.find((t) => t.parentId == null && t.name === stage.name);
      const programmes = taxa
        .filter((t) => t.parentId != null && t.parentId === stageKey?.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      return {
        id: sd.id,
        name: stage.name,
        ages: sd.ages,
        color: sd.color,
        blurb: stage.summary ?? undefined,
        programs: programmes.map((prog) => ({
          name: prog.name,
          modules: modules
            .filter((m) => asJson(m.data).programme === prog.slug)
            .sort((a, b) => byOrder(asJson(a.data), asJson(b.data)))
            .map((m) => ({
              name: m.name,
              req: reqs.get(m.id) ?? [],
              lessons: (lessonsByModule.get(m.slug) ?? [])
                .sort((a, b) => byOrder(asJson(a.data), asJson(b.data)))
                .map((l) => {
                  const { go, sim, pedia } = asJson(l.data);
                  if (go === undefined && sim === undefined && pedia === undefined) {
                    return l.name;
                  }
                  return { t: l.name, go, sim, pedia };
                }),
            })),
        })),
      };
    });
  return `export const TREE = ${JSON.stringify(tree)};\n`;
}

async function curriculumSourceId(): Promise<number | null> {
  const { kosmoSources } = await import("@repo/db");
  const rows = await db
    .select({ id: kosmoSources.id })
    .from(kosmoSources)
    .where(eq(kosmoSources.key, "kosmo-university"))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** history-taxonomy.js: `export const HISTORY` of era > period > region folders with events. */
export async function historyModule(): Promise<string | null> {
  const rows = await db
    .select({
      kind: kosmoEntities.kind,
      name: kosmoEntities.name,
      data: kosmoEntities.data,
    })
    .from(kosmoEntities)
    .where(
      // periods are folders, events hang off them by period slug
      and(eq(kosmoEntities.sourceId, (await historySourceId()) ?? -1)),
    )
    .orderBy(asc(kosmoEntities.id));
  const periods = rows.filter((r) => r.kind === "period");
  if (periods.length === 0) return null;

  type Folder = {
    name: string;
    from: unknown;
    to: unknown;
    where: unknown;
    children: Folder[];
    events: [string, unknown, unknown, unknown][];
    order: number;
  };
  const byPath = new Map<string, Folder>();
  for (const p of periods) {
    const d = asJson(p.data);
    byPath.set(String(d.path), {
      name: p.name,
      from: d.from,
      to: d.to,
      where: d.where,
      children: [],
      events: [],
      order: Number(d.order ?? 0),
    });
  }
  const events = rows
    .filter((r) => r.kind === "event")
    .sort((a, b) => byOrder(asJson(a.data), asJson(b.data)));
  for (const e of events) {
    const d = asJson(e.data);
    const folder = byPath.get(String(d.period).replace(/^period:/, ""));
    const place = Array.isArray(d.place) ? d.place : [undefined, undefined];
    folder?.events.push([e.name, d.year, place[0], place[1]]);
  }
  const roots: Folder[] = [];
  for (const [path, folder] of byPath) {
    const parent = byPath.get(path.split("/").slice(0, -1).join("/"));
    (parent ? parent.children : roots).push(folder);
  }
  const strip = (f: Folder): unknown => ({
    name: f.name,
    from: f.from,
    to: f.to,
    where: f.where,
    children: f.children.sort((a, b) => a.order - b.order).map(strip),
    events: f.events,
  });
  const history = roots.sort((a, b) => a.order - b.order).map(strip);
  return `export const HISTORY = ${JSON.stringify(history)};\n`;
}

async function historySourceId(): Promise<number | null> {
  const { kosmoSources } = await import("@repo/db");
  const rows = await db
    .select({ id: kosmoSources.id })
    .from(kosmoSources)
    .where(eq(kosmoSources.key, "kosmo-history"))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Any whole data file stored in kosmo_datasets (Oracle data, exams). */
export async function datasetFile(
  key: string
): Promise<{ body: string; contentType: string } | null> {
  const rows = await db
    .select({ body: kosmoDatasets.body, contentType: kosmoDatasets.contentType })
    .from(kosmoDatasets)
    .where(eq(kosmoDatasets.key, key))
    .limit(1);
  return rows[0] ?? null;
}
