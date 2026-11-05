import { and, eq } from "drizzle-orm";
import { kosmoEntities, kosmoEntityExternalIds, kosmoLessons } from "../../schema/index.js";
import {
  addClaim,
  addExternalId,
  ensurePage,
  ensureTaxon,
  slugify,
  upsertEntity,
  upsertSource,
} from "./util.js";
import type { KosmoLessonStatus } from "../../schema/kosmo.js";
import type { Db, UserId } from "./domains.js";
import { loadCurriculum } from "./university/content.js";
import { LICENSES } from "./university/licenses.js";
import type { Ledger, SourceMap } from "./university/sources.js";

/** The open resources for a module, resolved against the ledger so the page needs no other file. */
function openSourcesFor(kuId: string, ledger: Ledger, map: SourceMap) {
  return (map.modules[kuId] ?? []).flatMap((e) => {
    const s = ledger.sources[e.source];
    if (!s) return [];
    return [
      {
        sourceId: s.id,
        title: s.title,
        publisher: s.publisher,
        url: e.url ?? s.url,
        locator: e.locator,
        fit: e.fit,
        mode: e.mode,
        license: s.license,
        licenseName: LICENSES[s.license]?.name ?? s.license,
        licenseUrl: s.licenseUrl,
        attribution: s.attribution,
        ...(e.note ? { note: e.note } : {}),
      },
    ];
  });
}

/** Finds a Kosmopedia object entity: by slug object:<pedia>, then by slugified id, then by name. */
async function findObjectId(db: Db, pedia: string): Promise<number | undefined> {
  const slugs = [`object:${pedia}`, `object:${slugify(pedia)}`];
  for (const slug of slugs) {
    const rows = await db
      .select({ id: kosmoEntities.id })
      .from(kosmoEntities)
      .where(eq(kosmoEntities.slug, slug))
      .limit(1);
    if (rows[0]) return rows[0].id;
  }
  const byName = await db
    .select({ id: kosmoEntities.id })
    .from(kosmoEntities)
    .where(eq(kosmoEntities.name, pedia))
    .limit(1);
  return byName[0]?.id;
}

type NodeInput = {
  /** Stable curriculum id: KU-S01, KU-P001, KU-M0001, KU-L00001. */
  kuId: string;
  slug: string;
  /** Slug the same node had before ids existed. Adopted so claims and pages stay attached. */
  legacySlug?: string;
  kind: "stage" | "programme" | "module" | "lesson";
  name: string;
  summary?: string | null;
  data: Record<string, unknown>;
  sourceId: number;
};

/**
 * Upserts a curriculum node by its stable id. Order of lookup: the `ku` external id (so a
 * renamed node keeps its entity), then the slug it had before ids existed, then a new row.
 */
async function upsertNode(db: Db, input: NodeInput): Promise<number> {
  const ext = kosmoEntityExternalIds;
  const [byExt] = await db
    .select({ id: ext.entityId })
    .from(ext)
    .where(and(eq(ext.scheme, "ku"), eq(ext.value, input.kuId)))
    .limit(1);

  let id = byExt?.id;
  if (id === undefined && input.legacySlug) {
    const [legacy] = await db
      .select({ id: kosmoEntities.id })
      .from(kosmoEntities)
      .where(eq(kosmoEntities.slug, input.legacySlug))
      .limit(1);
    id = legacy?.id;
  }

  const values = {
    slug: input.slug,
    kind: input.kind,
    name: input.name,
    summary: input.summary ?? null,
    data: { ...input.data, kuId: input.kuId },
    sourceId: input.sourceId,
  };
  if (id !== undefined) {
    await db.update(kosmoEntities).set(values).where(eq(kosmoEntities.id, id));
  } else {
    id = await upsertEntity(db, values);
  }
  await addExternalId(db, { entityId: id, scheme: "ku", value: input.kuId, sourceId: input.sourceId });
  return id;
}

/**
 * Imports the Kosmographica University curriculum.
 *
 * Every stage, programme, module and lesson is keyed by its stable id from
 * university/ids.json, so renaming or reordering the tree never splits or loses a node.
 * Module prerequisites are written as `depends_on` claims between module ids. Concepts
 * (university/concepts.json) are entities that lessons `teach` and that depend on each
 * other. Every lesson gets a kosmo_lessons row: `stub` until a Markdown file in
 * university/content defines it, then `drafted` or `reviewed` as that file says.
 */
export async function importUniversity(db: Db, userId: UserId): Promise<void> {
  const cur = await loadCurriculum();
  if (cur.fatal.length) {
    throw new Error(`University curriculum is not loadable:\n  ${cur.fatal.join("\n  ")}`);
  }
  const sourceId = await upsertSource(db, {
    key: "kosmo-university",
    title: "Kosmographica University curriculum",
  });

  // Concepts first, so lessons can point at them.
  const conceptIds = new Map<string, number>();
  for (const [slug, c] of Object.entries(cur.concepts)) {
    const id = await upsertEntity(db, {
      slug: `concept:${slug}`,
      kind: "concept",
      name: c.name,
      summary: c.summary,
      data: { wikidata: c.wikidata, qidVerified: c.qidVerified === true },
      sourceId,
    });
    conceptIds.set(slug, id);
    if (c.wikidata) await addExternalId(db, { entityId: id, scheme: "wikidata", value: c.wikidata, sourceId });
  }
  for (const [slug, c] of Object.entries(cur.concepts)) {
    for (const req of c.requires) {
      await addClaim(db, {
        subjectId: conceptIds.get(slug)!,
        predicate: "depends_on",
        objectId: conceptIds.get(req)!,
        sourceId,
      });
    }
  }

  const moduleEntity = new Map<string, number>(); // ku id -> entity id
  const pendingReqs: { moduleId: number; requires: string[] }[] = [];
  const counts = { stub: 0, drafted: 0, reviewed: 0, rejected: 0 };

  for (const stage of cur.stages) {
    const stageSlug = `stage:${slugify(stage.key)}`;
    const stageEntityId = await upsertNode(db, {
      kuId: stage.id,
      slug: stageSlug,
      kind: "stage",
      name: stage.name,
      summary: stage.blurb,
      data: { id: stage.key, ages: stage.ages, color: stage.color, order: stage.order },
      sourceId,
    });
    const stageTaxonId = await ensureTaxon(db, {
      scheme: "curriculum",
      slug: stage.key,
      name: stage.name,
      sortOrder: stage.order,
    });

    for (const prog of stage.programmes) {
      const progPath = `${stage.key}/${slugify(prog.name)}`;
      await ensureTaxon(db, {
        scheme: "curriculum",
        slug: progPath,
        name: prog.name,
        parentId: stageTaxonId,
        sortOrder: prog.order,
      });
      // Programmes are entities too (for the stable id and the route), but carry no claims:
      // the stage's "children" listing stays modules, as it always was.
      await upsertNode(db, {
        kuId: prog.id,
        slug: `programme:${prog.id.toLowerCase()}`,
        kind: "programme",
        name: prog.name,
        data: { stage: stage.key, stageKuId: stage.id, path: progPath, order: prog.order },
        sourceId,
      });

      for (const mod of prog.modules) {
        const moduleSlug = `module:${slugify(mod.name)}`;
        const moduleId = await upsertNode(db, {
          kuId: mod.id,
          slug: moduleSlug,
          kind: "module",
          name: mod.name,
          data: {
            stage: stage.key,
            stageKuId: stage.id,
            programme: progPath,
            programmeKuId: prog.id,
            programmeName: prog.name,
            order: mod.order,
            openSources: openSourcesFor(mod.id, cur.ledger, cur.sourceMap),
          },
          sourceId,
        });
        moduleEntity.set(mod.id, moduleId);
        pendingReqs.push({ moduleId, requires: mod.requires });
        await addClaim(db, { subjectId: moduleId, predicate: "part_of", objectId: stageEntityId, sourceId });

        for (const lesson of mod.lessons) {
          const lessonId = await upsertNode(db, {
            kuId: lesson.id,
            slug: `lesson:${lesson.id.toLowerCase()}`,
            legacySlug: `lesson:${moduleSlug}:${lesson.order}`,
            kind: "lesson",
            name: lesson.title,
            data: {
              module: moduleSlug,
              moduleKuId: mod.id,
              stage: stage.key,
              order: lesson.order,
              go: lesson.go,
              sim: lesson.sim,
              pedia: lesson.pedia,
            },
            sourceId,
          });
          await addClaim(db, { subjectId: lessonId, predicate: "part_of", objectId: moduleId, sourceId });

          if (lesson.pedia) {
            const objectId = await findObjectId(db, lesson.pedia);
            if (objectId) {
              await addClaim(db, { subjectId: lessonId, predicate: "teaches", objectId, sourceId });
            }
          }

          // The teaching content and its review state.
          const file = cur.lessons.get(lesson.id);
          const usable = file && file.issues.every((i) => i.level !== "error") ? file : undefined;
          if (file && !usable) {
            counts.rejected++;
            console.warn(`  kosmo university: ${file.path} fails the quality gate; kept as a stub`);
          }
          const doc = usable?.doc;
          const status: KosmoLessonStatus = doc ? doc.status : "stub";
          counts[status]++;
          const row = {
            kuId: lesson.id,
            entityId: lessonId,
            status,
            kind: doc?.kind ?? null,
            minutes: doc?.minutes ?? null,
            sections: doc ? { ...doc.sections } : null,
            checks: doc?.checks ?? null,
            sources: doc?.sources ?? [],
            license: doc?.license ?? null,
            original: doc?.original ? 1 : 0,
            authorName: doc?.author?.name ?? null,
            authorKind: doc?.author?.kind ?? null,
            reviewerName: doc?.reviewer?.name ?? null,
            reviewerKind: doc?.reviewer?.kind ?? null,
            reviewedAt: doc?.reviewedAt ? new Date(doc.reviewedAt) : null,
            contentPath: usable?.path ?? null,
            updatedAt: new Date(),
          };
          await db
            .insert(kosmoLessons)
            .values(row)
            .onConflictDoUpdate({ target: kosmoLessons.kuId, set: row });

          for (const slug of doc?.concepts ?? []) {
            const conceptId = conceptIds.get(slug);
            if (conceptId) {
              await addClaim(db, { subjectId: lessonId, predicate: "teaches", objectId: conceptId, sourceId });
            }
          }
        }

        const modulePath = `/kosmo/learn/${stage.key}/${slugify(mod.name)}`;
        await ensurePage(db, {
          path: modulePath,
          title: mod.name,
          markdown: [
            `# ${mod.name}`,
            "",
            `{{kosmo:infobox:${moduleSlug}}}`,
            "",
            "## Lessons",
            "",
            `{{kosmo:children:${moduleSlug}}}`,
            "",
            "## Builds on",
            "",
            `{{kosmo:links:${moduleSlug}}}`,
            "",
          ].join("\n"),
          userId,
          tags: ["kosmo", "learn", stage.key],
          entityId: moduleId,
        });
      }
    }

    await ensurePage(db, {
      path: `/kosmo/learn/${stage.key}`,
      title: stage.name,
      markdown: [
        `# ${stage.name}`,
        "",
        ...(stage.blurb ? [stage.blurb, ""] : []),
        `{{kosmo:infobox:${stageSlug}}}`,
        "",
        `{{kosmo:children:${stageSlug}}}`,
        "",
      ].join("\n"),
      userId,
      tags: ["kosmo", "learn"],
      entityId: stageEntityId,
    });
  }

  // Second pass: prerequisites are module ids, resolved once every module exists.
  const byKu = moduleEntity;
  for (const { moduleId, requires } of pendingReqs) {
    for (const kuId of requires) {
      const reqId = byKu.get(kuId);
      if (!reqId || reqId === moduleId) continue;
      await addClaim(db, { subjectId: moduleId, predicate: "depends_on", objectId: reqId, sourceId });
    }
  }
  console.log(
    `  -> university: ${counts.stub} stub, ${counts.drafted} drafted, ${counts.reviewed} reviewed` +
      (counts.rejected ? `, ${counts.rejected} rejected by the gate` : ""),
  );
}
