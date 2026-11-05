import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "../../index.js";
import { importBundle, purgeDataset, validate } from "./import.js";
import type { TimelineSource } from "./types.js";

/**
 *   pnpm db:seed:timeline                    import every source in ./sources
 *   pnpm db:seed:timeline --check            load + validate + report, write nothing
 *   pnpm db:seed:timeline --only bardiya,csv-tables
 *   pnpm db:seed:timeline --root ~/Documents/github   where the research repos live
 */
const args = process.argv.slice(2);
const check = args.includes("--check");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1]!.split(",") : null;
const root = args.includes("--root") ? args[args.indexOf("--root") + 1]! : path.join(os.homedir(), "Documents/github");

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "sources");
const files = fs.readdirSync(dir).filter((f) => /\.(ts|js)$/.test(f) && !f.endsWith(".d.ts") && !f.startsWith("_") && !/-config\./.test(f)).sort();

let failed = 0;
for (const f of files) {
  const mod = (await import(pathToFileURL(path.join(dir, f)).href)) as { default?: TimelineSource };
  const source = mod.default;
  if (!source) { console.warn(`! ${f}: no default export, skipped`); continue; }
  if (only && !only.includes(source.id)) continue;
  try {
    const t0 = Date.now();
    const bundle = await source.load({ root });
    const report = validate(bundle);
    const reasons = new Map<string, number>();
    for (const p of report.problems) reasons.set(p.reason.replace(/\d+/g, "N"), (reasons.get(p.reason.replace(/\d+/g, "N")) ?? 0) + 1);
    console.log(`\n${source.id} — ${source.label}`);
    console.log(`  records ${report.valid.length}/${report.records}, relations ${bundle.relations?.length ?? 0}, years ${Number.isFinite(report.minYear) ? `${report.minYear}..${report.maxYear}` : "-"}, ${Date.now() - t0} ms`);
    if (reasons.size) console.log("  skipped:", Object.fromEntries([...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)));
    const datasets = new Set(report.valid.map((r) => r.dataset));
    if (!check) {
      for (const d of datasets) await purgeDataset(db, d);
      const res = await importBundle(db, source, bundle, report);
      console.log(`  wrote ${res.entities} entities, ${res.relations} relations`);
    }
  } catch (e) {
    failed++;
    console.error(`! ${source.id} failed:`, e instanceof Error ? e.message : e);
  }
}

if (!check) {
  // tie timeline entities to wiki articles with the same title (exact, case-insensitive); never overwrites an existing link
  const linked = await db.execute(sql`
    update kosmo_entities e set page_id = p.id
    from (select distinct on (lower(title)) id, lower(title) as t from wiki_pages order by lower(title), id) p
    where e.page_id is null and e.slug like 'tl-%' and lower(e.name) = p.t
    returning e.id`);
  const n = Array.isArray(linked) ? linked.length : ((linked as { rowCount?: number }).rowCount ?? 0);
  console.log(`\nLinked ${n} timeline entities to wiki pages by title.`);
}
process.exit(failed ? 1 : 0);
