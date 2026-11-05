import {
  addClaim,
  ensurePage,
  ensureTaxon,
  slugify,
  upsertEntity,
  upsertSource,
} from "./util.js";
import { loadKosmoModule, type Db, type UserId } from "./domains.js";
import { instant, interval, precisionForYear } from "./time.js";

type Event = [label: string, year: number, lat: number, lon: number];
type Folder = {
  name: string;
  from: number;
  to: number;
  where: [number, number];
  children: Folder[];
  events: Event[];
};

/**
 * Imports the history taxonomy: each era/period/region folder becomes a period entity,
 * a taxon in scheme 'history' and a wiki page; events become kind 'event' entities.
 */
export async function importHistory(db: Db, userId: UserId): Promise<void> {
  const { HISTORY } = await loadKosmoModule<{ HISTORY: Folder[] }>(
    "static/history-taxonomy.js",
  );
  const sourceId = await upsertSource(db, {
    key: "kosmo-history",
    title: "Kosmographica history taxonomy",
  });

  for (const [index, folder] of HISTORY.entries()) {
    await walkPeriod(db, userId, sourceId, folder, [], undefined, undefined, index);
  }
}

/** Typed interval for a folder; precision follows the coarsest bound given. */
function periodTime(from: number, to: number) {
  const time = interval(from, to, Math.max(precisionForYear(from), precisionForYear(to)));
  return {
    timeStart: time.start,
    timeEnd: time.end,
    timePrecisionYears: time.precisionYears,
    timeKind: time.kind,
  };
}

async function walkPeriod(
  db: Db,
  userId: UserId,
  sourceId: number,
  folder: Folder,
  parentSegs: string[],
  parentEntityId: number | undefined,
  parentTaxonId: number | undefined,
  order: number,
): Promise<void> {
  const segs = [...parentSegs, slugify(folder.name)];
  const pathSlug = segs.join("/");
  const slug = `period:${pathSlug}`;

  const entityId = await upsertEntity(db, {
    slug,
    kind: "period",
    name: folder.name,
    data: {
      path: pathSlug,
      from: folder.from,
      to: folder.to,
      where: folder.where,
      order,
    },
    sourceId,
    // A period is a span on the shared time axis, not just a tree node.
    ...periodTime(folder.from, folder.to),
  });

  const taxonId = await ensureTaxon(db, {
    scheme: "history",
    slug: pathSlug,
    name: folder.name,
    parentId: parentTaxonId,
    sortOrder: order,
  });

  if (parentEntityId) {
    await addClaim(db, {
      subjectId: entityId,
      predicate: "part_of",
      objectId: parentEntityId,
      sourceId,
    });
  }

  for (const [eventIndex, [label, year, lat, lon]] of folder.events.entries()) {
    const eventId = await upsertEntity(db, {
      slug: `event:${slugify(label)}`,
      kind: "event",
      name: label,
      data: {
        year,
        place: [lat, lon],
        period: slug,
        order: eventIndex,
      },
      sourceId,
      // One point on the same axis: a battle and a geological stage sort together.
      timeStart: instant(year, precisionForYear(year)).start,
      timeEnd: null,
      timePrecisionYears: precisionForYear(year),
      timeKind: "instant",
    });
    await addClaim(db, {
      subjectId: eventId,
      predicate: "part_of",
      objectId: entityId,
      sourceId,
    });
  }

  await ensurePage(db, {
    path: `/kosmo/history/${pathSlug}`,
    title: folder.name,
    markdown: [
      `# ${folder.name}`,
      "",
      `{{kosmo:infobox:${slug}}}`,
      "",
      `{{kosmo:children:${slug}}}`,
      "",
    ].join("\n"),
    userId,
    tags: ["kosmo", "history"],
    entityId,
  });

  for (const [childIndex, child] of folder.children.entries()) {
    await walkPeriod(db, userId, sourceId, child, segs, entityId, taxonId, childIndex);
  }
}
