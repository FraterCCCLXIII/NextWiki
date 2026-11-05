import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { kosmoDatasets } from "../../schema/index.js";
import { resolveKosmoFile, type Db } from "./domains.js";

/** Oracle model data and claims files are plain scripts, not entity-shaped. */
const ORACLE_DATA = /-(data|claims)\.js$/;

const CONTENT_TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

/**
 * Stores whole data files so the original HTML pages can be served them from the
 * database at their old URLs. Keys are paths relative to public/kosmo/static.
 * Re-running overwrites the body, so edit the row (not the file) once it is live.
 */
export async function importDatasets(db: Db): Promise<void> {
  const oracleDir = path.dirname(resolveKosmoFile("static/oracle/index.html"));
  const oracleFiles = (await readdir(oracleDir)).filter((f) => ORACLE_DATA.test(f));

  const keys = [
    "university-exams.json",
    "small-bodies.json",
    "effects.json",
    "constellations.json",
    "landing-data.json",
    ...oracleFiles.map((f) => `oracle/${f}`),
  ];

  for (const key of keys) {
    const body = await readFile(resolveKosmoFile(`static/${key}`), "utf8");
    const contentType = CONTENT_TYPES[path.extname(key)] ?? "text/plain; charset=utf-8";
    await db
      .insert(kosmoDatasets)
      .values({ key, contentType, body })
      .onConflictDoUpdate({
        target: kosmoDatasets.key,
        set: { contentType, body, updatedAt: new Date() },
      });
  }
  console.log(`  -> Stored ${keys.length} data files as datasets.`);
}
