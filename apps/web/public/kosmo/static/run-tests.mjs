// One command for every headless check in the Kosmographica static tree.
//   node static/run-tests.mjs            (or: npm run test:kosmo from apps/web)
//
// Discovers static/*.test.mjs and static/flight/*.test.mjs, runs each in its own child
// process, prints one PASS/FAIL line per file (duration and the last line of output), then
// runs the non-test vehicle data check (data/vehicles/validate.mjs, which must exit 0).
// Exits 1 if anything fails, 0 otherwise.

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CONCURRENCY = 4;

function discover() {
  const files = [];
  const scan = dir => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) if (name.endsWith(".test.mjs")) files.push(join(dir, name));
  };
  scan(here);
  scan(join(here, "flight"));
  return files;
}

// Each job: { label, file, args }. Non-test checks are listed after the tests.
const jobs = [
  ...discover().map(file => ({ label: relative(here, file), file, args: [] })),
  { label: "data/vehicles/validate.mjs (check)", file: join(here, "..", "data", "vehicles", "validate.mjs"), args: [] },
];

function runJob(job) {
  return new Promise(resolve => {
    const t0 = process.hrtime.bigint();
    const child = spawn(process.execPath, [job.file, ...job.args], { cwd: dirname(job.file) });
    let out = "";
    child.stdout.on("data", d => (out += d));
    child.stderr.on("data", d => (out += d));
    child.on("error", e => (out += String(e)));
    child.on("close", code => {
      const seconds = Number(process.hrtime.bigint() - t0) / 1e9;
      const lines = out.split(/\r?\n/).map(s => s.trimEnd()).filter(Boolean);
      resolve({ ...job, code: code ?? 1, seconds, last: lines.at(-1) ?? "(no output)", out });
    });
  });
}

async function main() {
  const results = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await runJob(jobs[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

  const width = Math.max(...results.map(r => r.label.length));
  let failed = 0;
  for (const r of results) {
    const ok = r.code === 0;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${r.label.padEnd(width)}  ${r.seconds.toFixed(1).padStart(6)} s  ${r.last}`);
  }
  const failedOut = results.filter(r => r.code !== 0);
  for (const r of failedOut) {
    console.log(`\n----- output of ${r.label} (exit ${r.code}) -----\n${r.out.trimEnd()}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);
  process.exit(failed ? 1 : 0);
}

main();
