import { eq } from "drizzle-orm";
import { kosmoEntities } from "../../schema";
import {
  addClaim,
  ensurePage,
  ensureTaxon,
  slugify,
  upsertEntity,
  upsertSource,
} from "./util";
import { loadKosmoModule, type Db, type UserId } from "./domains";

type LessonSpec = { t: string; go?: string; sim?: unknown; pedia?: string };
type Lesson = string | LessonSpec;
type Module = { name: string; req: string[]; lessons: Lesson[] };
type Programme = { name: string; modules: Module[] };
type Stage = {
  id: string;
  name: string;
  ages?: string;
  color?: string;
  blurb?: string;
  programs: Programme[];
};

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

/**
 * Imports the Kosmographica University curriculum: stages (entities + curriculum taxa),
 * programmes (curriculum taxa), modules, lessons, prerequisite claims and learn pages.
 */
export async function importUniversity(db: Db, userId: UserId): Promise<void> {
  const { TREE } = await loadKosmoModule<{ TREE: Stage[] }>(
    "static/university-tree.js",
  );
  const sourceId = await upsertSource(db, {
    key: "kosmo-university",
    title: "Kosmographica University curriculum",
  });

  const moduleIds = new Map<string, number>();
  const pendingReqs: { moduleId: number; req: string[] }[] = [];

  for (const [stageIndex, stage] of TREE.entries()) {
    const stageKey = slugify(stage.id);
    const stageSlug = `stage:${stageKey}`;
    const stageEntityId = await upsertEntity(db, {
      slug: stageSlug,
      kind: "stage",
      name: stage.name,
      summary: stage.blurb,
      data: { id: stage.id, ages: stage.ages, color: stage.color, order: stageIndex },
      sourceId,
    });
    const stageTaxonId = await ensureTaxon(db, {
      scheme: "curriculum",
      slug: stageKey,
      name: stage.name,
      sortOrder: stageIndex,
    });

    for (const [progIndex, prog] of stage.programs.entries()) {
      const progSlug = `${stageKey}/${slugify(prog.name)}`;
      await ensureTaxon(db, {
        scheme: "curriculum",
        slug: progSlug,
        name: prog.name,
        parentId: stageTaxonId,
        sortOrder: progIndex,
      });

      for (const [modIndex, mod] of prog.modules.entries()) {
        const moduleSlug = `module:${slugify(mod.name)}`;
        if (moduleIds.has(mod.name)) {
          console.warn(`  kosmo university: duplicate module name skipped: ${mod.name}`);
          continue;
        }

        const moduleId = await upsertEntity(db, {
          slug: moduleSlug,
          kind: "module",
          name: mod.name,
          data: { stage: stageKey, programme: progSlug, order: modIndex },
          sourceId,
        });
        moduleIds.set(mod.name, moduleId);
        pendingReqs.push({ moduleId, req: mod.req ?? [] });

        await addClaim(db, {
          subjectId: moduleId,
          predicate: "part_of",
          objectId: stageEntityId,
          sourceId,
        });

        for (const [lessonIndex, lesson] of mod.lessons.entries()) {
          const spec: LessonSpec = typeof lesson === "string" ? { t: lesson } : lesson;
          const lessonSlug = `lesson:${moduleSlug}:${lessonIndex}`;
          const lessonId = await upsertEntity(db, {
            slug: lessonSlug,
            kind: "lesson",
            name: spec.t,
            data: {
              module: moduleSlug,
              stage: stageKey,
              order: lessonIndex,
              go: spec.go,
              sim: spec.sim,
              pedia: spec.pedia,
            },
            sourceId,
          });
          await addClaim(db, {
            subjectId: lessonId,
            predicate: "part_of",
            objectId: moduleId,
            sourceId,
          });

          if (spec.pedia) {
            const objectId = await findObjectId(db, spec.pedia);
            if (objectId) {
              await addClaim(db, {
                subjectId: lessonId,
                predicate: "teaches",
                objectId,
                sourceId,
              });
            }
          }
        }

        const modulePath = `/kosmo/learn/${stageKey}/${slugify(mod.name)}`;
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
          tags: ["kosmo", "learn", stageKey],
          entityId: moduleId,
        });
      }
    }

    await ensurePage(db, {
      path: `/kosmo/learn/${stageKey}`,
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

  // Second pass: prerequisites resolve by module name, so all modules must exist first.
  for (const { moduleId, req } of pendingReqs) {
    for (const name of req) {
      const reqId = moduleIds.get(name);
      if (!reqId || reqId === moduleId) continue;
      await addClaim(db, {
        subjectId: moduleId,
        predicate: "depends_on",
        objectId: reqId,
        sourceId,
      });
    }
  }
}
