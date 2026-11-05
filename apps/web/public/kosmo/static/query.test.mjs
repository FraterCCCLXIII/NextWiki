import assert from "node:assert";
import { compileQuery, runQuery, EXAMPLE_QUERIES } from "./query.js";

const X = [0, 10, 20, 30], Y = [0, 0, 0, 0], Z = [0, 0, 0, 100];
const F = { settled: (i) => i % 2 === 0, gen: (i) => i, score: (i) => i / 10, tSettled: (i) => i * 50, name: (i) => "s" + i,
  synthetic: () => true, catalog: () => false, distSol: (i) => X[i], r: (i) => X[i], x: (i) => X[i], y: (i) => Y[i], z: (i) => Z[i],
  halo: () => false, alive: () => true, type: () => "star" };
const env = { fields: F, points: { sol: { x: 0, y: 0, z: 0 }, origin: { x: 100, y: 0, z: 0 } }, positions: { x: X, y: Y, z: Z } };
const run = (q) => { const c = compileQuery(q, env); assert.ok(c.ok, q + " -> " + c.error); return Array.from(runQuery(c, 4)); };

assert.deepStrictEqual(run("settled"), [1, 0, 1, 0]);
assert.deepStrictEqual(run("settled || gen == 1 && !settled"), [1, 1, 1, 0]); // && binds tighter than ||
assert.deepStrictEqual(run("gen + 1 * 2 > 3"), [0, 0, 1, 1]);
assert.deepStrictEqual(run("sphere(sol, 15)"), [1, 1, 0, 0]);
assert.deepStrictEqual(run("shell(sol, 5, 25)"), [0, 1, 1, 0]);
assert.deepStrictEqual(run('slab("z", -1, 1)'), [1, 1, 1, 0]);
assert.deepStrictEqual(run("cone(sol, origin, 10)"), [1, 1, 1, 0]);
assert.deepStrictEqual(run('name == "s2"'), [0, 0, 1, 0]);
assert.deepStrictEqual(run("1e1 == 10 && 2k == 2000"), [1, 1, 1, 1]);

let bad = compileQuery("settled && bogus", env);
assert.ok(!bad.ok && bad.pos === 11, JSON.stringify(bad));
for (const q of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
  const c = compileQuery(q, env); assert.ok(!c.ok && /unknown field/.test(c.error), q);
}
assert.ok(!compileQuery("settled &&", env).ok);
assert.ok(!compileQuery("(settled", env).ok);
assert.ok(!compileQuery("sphere(sol)", env).ok);
assert.ok(!compileQuery("eval(1)", env).ok);
for (const e of EXAMPLE_QUERIES) assert.ok(compileQuery(e.q, env).ok, e.q);
console.log("query ok");
