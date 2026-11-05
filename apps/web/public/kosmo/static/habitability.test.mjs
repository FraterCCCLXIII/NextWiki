import assert from "node:assert";
import { stellarSuitability, esi, galacticHabitability, scoreStar, hzScore } from "./habitability.js";

assert.ok(stellarSuitability({ spectral_type: "G2V" }).value > stellarSuitability({ spectral_type: "O5V" }).value);
assert.ok(stellarSuitability({ spectral_type: "G2V" }).value > stellarSuitability({ spectral_type: "M5V" }).value);
assert.strictEqual(stellarSuitability({}).provenance, "assumed");
const earth = { radius_m: 6.371e6, mass_kg: 5.972e24, temperature_K: 288 };
assert.ok(esi(earth).value > 0.99);
assert.ok(galacticHabitability(8000) > galacticHabitability(1000));
assert.ok(galacticHabitability(8000) > galacticHabitability(15000));
const sun = { spectral_type: "G2V", luminosity_W: 3.828e26 };
assert.strictEqual(hzScore({ semi_major_axis_m: 1.496e11 }, sun).value, 1);
const r = scoreStar(sun, { planets: [{ ...earth, semi_major_axis_m: 1.496e11 }], rPc: 8200, zPc: 20 });
assert.ok(r.score > 0.8 && r.factors.esi && r.provenance.stellar === "catalog");
assert.doesNotThrow(() => scoreStar({}));
console.log("habitability ok");
