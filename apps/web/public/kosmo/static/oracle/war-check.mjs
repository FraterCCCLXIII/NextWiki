#!/usr/bin/env node
/*
 * war-check.mjs — headless harness for the war-forecast page.
 *
 *   node war-check.mjs        # run every check, exit 1 on failure
 *
 * The page runs the same calibrate() on load, so anything that fails here is
 * failing in the browser too. The difference is that this can be run in CI and
 * that it asserts properties of the simulation, not just the four analytical
 * identities.
 *
 * What it is looking for, in order of how much damage a failure would do:
 *
 *   1. the model's own arithmetic has to land inside Clauset's published 0.43
 *   2. the survival exponent has to be below 1, or the framing collapses
 *   3. probabilities of thresholds have to rise with the horizon
 *   4. no war may exceed the ceiling, which is what the ceiling means
 *   5. a settlement has to make quiet centuries likelier than no settlement
 *   6. the same seed has to produce the same future
 */

import fs from "node:fs";

/* eval, not vm: a vm context costs about 10x on this workload because V8 never
   tiers the hot loop up, and there is nothing here to isolate. */
globalThis.window = {};
for (const f of ["war-future-data.js", "war-model.js"]) {
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(f, "utf8"));
}

const M = window.WARMODEL, D = window.WARF_DATA;
if (!M || !D) { console.error("could not load model or data"); process.exit(1); }

let fails = 0;
const ok = (pass, label, detail) => {
  if (!pass) fails++;
  console.log(`${pass ? "ok " : "!! "} ${label}${detail ? "  — " + detail : ""}`);
};

/* ---------------------------------------------------- 1. analytical checks */
console.log("\n== calibration ==");
for (const c of M.calibrate()) {
  ok(c.status === "ok", c.label, c.value);
}

/* --------------------------------------------------- 2. structural checks */
console.log("\n== structure ==");
const beta = M.base.alpha - 1;
ok(beta < 1, "survival exponent below 1", `beta = ${beta.toFixed(2)}, so the mean war size is undefined`);
ok(M.tailWait(1e7) < M.tailWait(1e8), "waiting time rises with war size");
ok(M.tailWait(1e7) > 0, "waiting time is positive", `${M.tailWait(1e7).toFixed(0)} yr for a 10M-death war`);

/* the ceiling has to bind more slowly than any threshold below it */
ok(M.ceilingWait() > M.tailWait(1e9), "ceiling is rarer than a 1bn-death war",
  `${Math.round(M.ceilingWait())} yr against ${Math.round(M.tailWait(1e9))} yr`);

/* ------------------------------------------------------ 3. per-scenario */
console.log("\n== scenarios ==");
const sims = {};
for (const s of D.scenarios) {
  const p = {};
  for (const k in M.defaults) p[k] = M.defaults[k];
  for (const k in s.levers) p[k] = s.levers[k];
  p.paths = 220;
  const t0 = Date.now();
  const sim = M.simulate(p);
  sims[s.id] = sim;
  const cap = p.capFrac * D.population.plateau.value;

  console.log(
    `    ${s.label.padEnd(22)} ${String(Date.now() - t0).padStart(4)}ms  ` +
    `largest p50 ${(M.quant(sim.largestByHorizon.at(-1), 0.5) / 1e6).toFixed(0).padStart(5)}M  ` +
    `ceiling by 10000 ${(sim.pCeilingBy.at(-1) * 100).toFixed(0).padStart(3)}%  ` +
    `settled ${(sim.pSettledBy.at(-1) * 100).toFixed(0).padStart(3)}%  ` +
    `quiet century at 10000 ${(sim.warFree.at(-1) * 100).toFixed(0).padStart(3)}%`
  );

  /* probabilities never fall as the horizon extends */
  let mono = true;
  for (const series of sim.pAbove) {
    for (let i = 1; i < series.length; i++) if (series[i] < series[i - 1] - 1e-9) mono = false;
  }
  ok(mono, `${s.label}: threshold probabilities are monotone in the horizon`);

  let ceilOk = true;
  for (let i = 1; i < sim.pCeilingBy.length; i++) if (sim.pCeilingBy[i] < sim.pCeilingBy[i - 1] - 1e-9) ceilOk = false;
  ok(ceilOk && sim.pCeilingBy.at(-1) <= 1, `${s.label}: ceiling probability is monotone and bounded`,
    `${(sim.pCeilingBy.at(-1) * 100).toFixed(0)}% by ${sim.horizons.at(-1)}`);

  /* the ceiling is a fraction of the people alive *that year*, and population
     peaks above the plateau, so the largest permitted war is the peak ceiling */
  const worstCap = p.capFrac * D.population.peak.value;
  const worst = sim.largestByHorizon.at(-1).at(-1);
  ok(worst <= worstCap * 1.0001, `${s.label}: no war exceeds the ceiling`,
    `largest simulated ${(worst / 1e9).toFixed(2)}bn against a ${(worstCap / 1e9).toFixed(2)}bn ceiling at peak population`);
}

/* ------------------------------------------------ 4. the page's own claim */
console.log("\n== the claim ==");
const quiet = (id) => sims[id].warFree.at(-1);
ok(quiet("settlement") > quiet("stationary"),
  "a settlement buys quiet centuries that a trend cannot",
  `${(quiet("settlement") * 100).toFixed(0)}% against ${(quiet("stationary") * 100).toFixed(0)}%`);
ok(quiet("stationary") < 0.05, "without a settlement, no century is quiet at the base rate",
  `${(quiet("stationary") * 100).toFixed(1)}%`);

/* --------------------------------------------------------- 5. determinism */
const sig = (sim) => sim.centuryDeaths.p50.slice(0, 12).map(v => Math.round(v)).join(",");
const again = M.simulate(Object.assign({}, M.defaults, { paths: 220 }));
const ref = M.simulate(Object.assign({}, M.defaults, { paths: 220 }));
ok(sig(again) === sig(ref), "same seed, same future",
  "the model is reproducible, so a claim about it can be re-checked");

/* ------------------------------------------------------------- 6. the file */
if (!fs.existsSync("war-future.html")) { fails++; console.log("!! war-future.html is missing"); }

console.log(`\n${fails === 0 ? "all checks passed" : fails + " check(s) failed"}`);
process.exit(fails === 0 ? 0 : 1);
