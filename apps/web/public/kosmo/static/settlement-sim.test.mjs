import assert from "node:assert";
import { generateGalaxy, createSim, TECH_PRESETS } from "./settlement-sim.js";

const g = generateGalaxy({ n: 5000, seed: 1 });
assert.strictEqual(g.count, 5001);
const base = { ...TECH_PRESETS["von-neumann"], settleableFraction: 0.5, seed: 1 };

let t0 = Date.now();
const a = createSim(g, base); a.run(300);
const secs = (Date.now() - t0) / 1000;
const sa = a.stats();
console.log("von-neumann", sa, `${secs}s`);
assert.ok(sa.settledCount > 100, "should spread");
assert.ok(secs < 8, "too slow: " + secs);

const b = createSim(g, base); b.run(300);
assert.deepStrictEqual(Array.from(a.settledAt.slice(0, 500)), Array.from(b.settledAt.slice(0, 500)), "deterministic");

// frontier grows
const c = createSim(g, base); let last = 0;
for (let k = 0; k < 5; k++) { c.run((k + 1) * 40); const f = c.stats().frontierRadiusPc; assert.ok(f >= last - 1e-6); last = f; }

// short-lived colonies never spread
const d = createSim(g, { ...base, lifetimeYr: 100, launchIntervalYr: 5000 }); d.run(200);
assert.strictEqual(d.stats().settledCount, 1);
// nothing settleable
const e = createSim(g, { ...base, settleableFraction: 0 }); e.run(100);
assert.strictEqual(e.stats().settledCount, 1);
// ships land after arrival
const f = createSim(g, base);
for (let k = 0; k < 50; k++) f.step();
for (let j = 0; j < g.count; j++) if (f.parent[j] >= 0) assert.ok(f.settledAt[j] >= f.settledAt[f.parent[j]]);
console.log("settlement-sim ok");
