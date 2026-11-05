import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locates this folder (ids.json, concepts.json, content/) at run time.
 *
 * Do not write `new URL("./ids.json", import.meta.url)` here or anywhere reachable from
 * the package entry: the web app bundles @repo/db, and webpack turns that pattern into an
 * asset import that fails to resolve, which takes every page down with it.
 */
export function universityDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const rel = path.join("packages", "db", "src", "seeds", "kosmo", "university");
  const cwd = process.cwd();
  const candidates = [
    here,
    path.join(cwd, rel),
    path.join(cwd, "..", rel),
    path.join(cwd, "..", "..", rel),
    path.join(cwd, "src", "seeds", "kosmo", "university"),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "concepts.json"))) return dir;
  }
  throw new Error(`university curriculum folder not found (cwd: ${cwd})`);
}
