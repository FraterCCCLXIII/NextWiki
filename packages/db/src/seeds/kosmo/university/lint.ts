/**
 * The quality gate, run by hand and in CI.
 *
 *   pnpm --filter @repo/db db:university:lint            check everything
 *   pnpm --filter @repo/db db:university:lint KU-L00194  check one lesson by id
 *
 * Exits 1 on any error. Warnings are printed for the reviewer but do not fail the run.
 * Also prints the coverage table: stub / drafted / reviewed lessons per stage.
 */
import { loadCurriculum } from "./content.js";

async function main() {
  const only = process.argv.slice(2).filter((a) => /^KU-L\d{5}$/.test(a));
  const cur = await loadCurriculum();
  let errors = 0;

  for (const f of cur.fatal) {
    console.error(`FATAL ${f}`);
    errors++;
  }
  for (const [id, l] of cur.lessons) {
    if (only.length && !only.includes(id)) continue;
    const bad = l.issues.filter((i) => i.level === "error");
    const warn = l.issues.filter((i) => i.level === "warning");
    if (!bad.length && !warn.length) {
      console.log(`ok     ${id}  ${l.doc.status}  ${l.path}`);
      continue;
    }
    console.log(`${bad.length ? "FAIL" : "warn"}   ${id}  ${l.doc.status}  ${l.path}`);
    for (const i of l.issues) console.log(`         ${i.level}: ${i.message}`);
    errors += bad.length;
  }

  if (!only.length && cur.stages.length) {
    console.log("\nCoverage (lessons)");
    console.log("stage".padEnd(14) + "total".padStart(7) + "stub".padStart(7) + "drafted".padStart(9) + "reviewed".padStart(10));
    const sum = { total: 0, stub: 0, drafted: 0, reviewed: 0 };
    for (const s of cur.stages) {
      const c = { total: 0, stub: 0, drafted: 0, reviewed: 0 };
      for (const p of s.programmes)
        for (const m of p.modules)
          for (const l of m.lessons) {
            c.total++;
            const f = cur.lessons.get(l.id);
            if (f && f.issues.every((i) => i.level !== "error")) c[f.doc.status]++;
            else c.stub++;
          }
      for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += c[k];
      console.log(s.key.padEnd(14) + String(c.total).padStart(7) + String(c.stub).padStart(7) + String(c.drafted).padStart(9) + String(c.reviewed).padStart(10));
    }
    console.log("all".padEnd(14) + String(sum.total).padStart(7) + String(sum.stub).padStart(7) + String(sum.drafted).padStart(9) + String(sum.reviewed).padStart(10));
  }
  if (errors) {
    console.error(`\n${errors} error(s).`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
