/**
 * Assigns stable ids to any curriculum node that lacks one and writes ids.json.
 *
 *   pnpm --filter @repo/db db:university:ids          assign and write
 *   pnpm --filter @repo/db db:university:ids --check  write nothing; exit 1 if ids are missing
 *
 * Run it after editing university-tree.js, and commit ids.json with the tree.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { universityDir } from "./paths.js";
import { loadKosmoModule } from "../domains.js";
import {
  emptyRegistry,
  findPrerequisiteCycle,
  syncRegistry,
  validateTree,
  type Registry,
  type TreeStage,
} from "./registry.js";

const idsFile = () => path.join(universityDir(), "ids.json");

export async function readRegistry(): Promise<Registry> {
  try {
    return JSON.parse(await readFile(idsFile(), "utf8")) as Registry;
  } catch {
    return emptyRegistry();
  }
}

async function main() {
  const check = process.argv.includes("--check");
  const { TREE } = await loadKosmoModule<{ TREE: TreeStage[] }>("static/university-tree.js");

  const problems = validateTree(TREE);
  const cycle = findPrerequisiteCycle(TREE);
  if (cycle) problems.push(`prerequisite cycle: ${cycle.join(" -> ")}`);
  if (problems.length) {
    console.error(`The tree has ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const { registry, added, orphaned } = syncRegistry(TREE, await readRegistry());
  console.log(`${Object.keys(registry.ids).length} ids; ${added.length} new; ${orphaned.length} orphaned.`);
  if (orphaned.length) {
    console.warn("Orphaned keys (renamed or removed in the tree). If renamed, edit the key in ids.json:");
    for (const k of orphaned.slice(0, 20)) console.warn(`  ${k}`);
  }
  if (check) {
    if (added.length) {
      console.error("ids.json is out of date. Run db:university:ids and commit the result.");
      process.exit(1);
    }
    return;
  }
  if (added.length) {
    // Keys are written in id order so diffs stay append-only.
    const sorted = Object.fromEntries(
      Object.entries(registry.ids).sort(([, a], [, b]) => a.localeCompare(b)),
    );
    await writeFile(idsFile(), JSON.stringify({ ...registry, ids: sorted }, null, 1) + "\n");
    console.log("Wrote ids.json");
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
