/**
 * Reads the lesson Markdown files and the concept list from disk, and joins them to the
 * curriculum ledger. Shared by lint.ts (checks) and university.ts (the seed).
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { loadKosmoModule } from "../domains.js";
import {
  checkLesson,
  parseLesson,
  type Issue,
  type LessonDoc,
} from "./lesson.js";
import {
  findPrerequisiteCycle,
  resolveTree,
  syncRegistry,
  validateTree,
  type Registry,
  type ResolvedStage,
  type TreeStage,
} from "./registry.js";
import { universityDir } from "./paths.js";
import { readRegistry } from "./sync-ids.js";

const contentDir = () => join(universityDir(), "content");

export type Concept = {
  name: string;
  summary: string;
  wikidata?: string;
  qidVerified?: boolean;
  requires: string[];
};

export async function readConcepts(): Promise<Record<string, Concept>> {
  const raw = JSON.parse(await readFile(join(universityDir(), "concepts.json"), "utf8")) as {
    concepts: Record<string, Concept>;
  };
  return raw.concepts;
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith(".md") && !e.name.startsWith("_")) yield p;
  }
}

export type LoadedLesson = {
  doc: LessonDoc;
  /** Path relative to the content folder. */
  path: string;
  issues: Issue[];
};

export type Curriculum = {
  stages: ResolvedStage[];
  registry: Registry;
  concepts: Record<string, Concept>;
  /** By stable lesson id. */
  lessons: Map<string, LoadedLesson>;
  /** Problems in the tree, the ledger or the files that make the load unsafe. */
  fatal: string[];
};

/** Loads the tree, the ledger, the concepts and every lesson file, and runs the gate on each. */
export async function loadCurriculum(): Promise<Curriculum> {
  const { TREE } = await loadKosmoModule<{ TREE: TreeStage[] }>("static/university-tree.js");
  const fatal = validateTree(TREE);
  const cycle = findPrerequisiteCycle(TREE);
  if (cycle) fatal.push(`prerequisite cycle: ${cycle.join(" -> ")}`);

  const { registry, added } = syncRegistry(TREE, await readRegistry());
  if (added.length) fatal.push(`${added.length} tree nodes have no stable id; run db:university:ids`);
  const stages = added.length ? [] : resolveTree(TREE, registry);

  const stageOfLesson = new Map<string, string>();
  for (const s of stages)
    for (const p of s.programmes)
      for (const m of p.modules) for (const l of m.lessons) stageOfLesson.set(l.id, s.key);

  const concepts = await readConcepts();
  const known = new Set(Object.keys(concepts));
  for (const [slug, c] of Object.entries(concepts)) {
    for (const r of c.requires) if (!known.has(r)) fatal.push(`concept "${slug}" requires unknown "${r}"`);
  }

  const lessons = new Map<string, LoadedLesson>();
  for await (const file of walk(contentDir())) {
    const path = relative(contentDir(), file);
    const { doc, issues } = parseLesson(await readFile(file, "utf8"));
    if (!doc) {
      fatal.push(`${path}: ${issues.map((i) => i.message).join("; ")}`);
      continue;
    }
    if (!stageOfLesson.has(doc.id) && stages.length) {
      fatal.push(`${path}: ${doc.id} is not a lesson in the curriculum tree`);
      continue;
    }
    if (lessons.has(doc.id)) {
      fatal.push(`${path}: ${doc.id} is also defined in ${lessons.get(doc.id)!.path}`);
      continue;
    }
    const all = [...issues, ...checkLesson(doc, { stageKey: stageOfLesson.get(doc.id), knownConcepts: known })];
    lessons.set(doc.id, { doc, path, issues: all });
  }
  return { stages, registry, concepts, lessons, fatal };
}
