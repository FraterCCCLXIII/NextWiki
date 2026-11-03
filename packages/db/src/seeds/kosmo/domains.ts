import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  addClaim,
  ensurePage,
  ensureTaxon,
  slugify,
  upsertEntity,
  upsertSource,
} from "./util.js";

export type Db = Parameters<typeof upsertSource>[0];
export type UserId = Parameters<typeof ensurePage>[1]["userId"];

const WEB_KOSMO = path.join("apps", "web", "public", "kosmo");

/**
 * Resolves a file under apps/web/public/kosmo. Tries the cwd (repo root), then
 * parents (packages/db run from within the package), then the location of this module.
 */
export function resolveKosmoFile(rel: string): string {
  const cwd = process.cwd();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const roots = [
    cwd,
    path.resolve(cwd, ".."),
    path.resolve(cwd, "../.."),
    path.resolve(here, "../../../../.."),
  ];
  for (const root of roots) {
    const candidate = path.join(root, WEB_KOSMO, rel);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`kosmo source not found: ${rel} (cwd: ${cwd})`);
}

/** Loads a browser-style ES module from apps/web/public/kosmo via dynamic import. */
export async function loadKosmoModule<T>(rel: string): Promise<T> {
  const file = resolveKosmoFile(rel);
  return (await import(pathToFileURL(file).href)) as T;
}

/** Reads and parses a JSON file from apps/web/public/kosmo. */
export async function readKosmoJson<T>(rel: string): Promise<T> {
  return JSON.parse(await readFile(resolveKosmoFile(rel), "utf8")) as T;
}

export const DOMAIN_KEYS = ["math", "physics", "philosophy", "models"] as const;

type DomainNode = {
  name: string;
  what?: string;
  status?: string;
  link?: string;
  law?: string;
  who?: string;
  year?: number;
  tags?: string[];
  children?: DomainNode[];
};

type DomainFile = {
  domain: string;
  blurb?: string;
  columns?: string[];
  nodes: DomainNode[];
};

type WalkCtx = {
  db: Db;
  userId: UserId;
  domain: string;
  sourceId: number;
};

/**
 * Imports the domain trees (math, physics, philosophy, models) as taxa in one scheme per domain,
 * domain_node entities, parent claims and one wiki page per node.
 */
export async function importDomains(db: Db, userId: UserId): Promise<void> {
  for (const d of DOMAIN_KEYS) {
    const data = await readKosmoJson<DomainFile>(`data/domains/${d}.json`);
    const sourceId = await upsertSource(db, {
      key: `kosmo-domain-${d}`,
      title: data.domain,
    });

    const rootSlug = `domain:${d}`;
    const rootEntityId = await upsertEntity(db, {
      slug: rootSlug,
      kind: "domain_node",
      name: data.domain,
      summary: data.blurb,
      data: { domain: d, root: true, columns: data.columns },
      sourceId,
    });
    const rootTaxonId = await ensureTaxon(db, {
      scheme: d,
      slug: "_root",
      name: data.domain,
      sortOrder: 0,
    });
    await ensurePage(db, {
      path: `/kosmo/${d}`,
      title: data.domain,
      markdown: [
        `# ${data.domain}`,
        "",
        ...(data.blurb ? [data.blurb, ""] : []),
        `{{kosmo:infobox:${rootSlug}}}`,
        "",
        `{{kosmo:children:${rootSlug}}}`,
        "",
      ].join("\n"),
      userId,
      tags: [d, "kosmo"],
      entityId: rootEntityId,
    });

    const ctx: WalkCtx = { db, userId, domain: d, sourceId };
    await walkDomainNodes(ctx, data.nodes, [], rootEntityId, rootTaxonId, 0);
  }
}

async function walkDomainNodes(
  ctx: WalkCtx,
  nodes: DomainNode[],
  parentSegs: string[],
  parentEntityId: number,
  parentTaxonId: number,
  depth: number,
): Promise<void> {
  const { db, userId, domain, sourceId } = ctx;

  for (const [index, node] of nodes.entries()) {
    const segs = [...parentSegs, slugify(node.name)];
    const pathSlug = segs.join("/");
    const slug = `domain:${domain}:${pathSlug}`;

    const entityId = await upsertEntity(db, {
      slug,
      kind: "domain_node",
      name: node.name,
      summary: node.what,
      data: {
        domain,
        path: pathSlug,
        status: node.status,
        law: node.law,
        who: node.who,
        year: node.year,
        link: node.link,
        tags: node.tags,
      },
      sourceId,
    });

    const taxonId = await ensureTaxon(db, {
      scheme: domain,
      slug: pathSlug,
      name: node.name,
      parentId: parentTaxonId,
      sortOrder: index,
    });

    // Top-level areas and their direct subfields are subfield_of; deeper nodes are parts.
    await addClaim(db, {
      subjectId: entityId,
      predicate: depth <= 1 ? "subfield_of" : "part_of",
      objectId: parentEntityId,
      sourceId,
    });

    const lines = [`# ${node.name}`, ""];
    if (node.what) lines.push(node.what, "");
    lines.push(
      `{{kosmo:infobox:${slug}}}`,
      "",
      `{{kosmo:children:${slug}}}`,
      "",
      `{{kosmo:links:${slug}}}`,
      "",
    );
    await ensurePage(db, {
      path: `/kosmo/${domain}/${pathSlug}`,
      title: node.name,
      markdown: lines.join("\n"),
      userId,
      tags: [domain, "kosmo"],
      entityId,
    });

    if (node.children?.length) {
      await walkDomainNodes(ctx, node.children, segs, entityId, taxonId, depth + 1);
    }
  }
}
