import assert from "node:assert/strict";
import test from "node:test";
import { isAdaptable, resolveLicense } from "./licenses.js";

test("no adapted sources gives our default", () => {
  assert.equal(resolveLicense([]).license, "CC-BY-4.0");
  assert.equal(resolveLicense(["CC0", "PD", "CC-BY-4.0"]).license, "CC-BY-4.0");
});

test("NonCommercial is adaptable only while the portal is non-commercial", () => {
  assert.equal(isAdaptable("CC-BY-NC-4.0", { nonCommercial: true }), true);
  assert.equal(isAdaptable("CC-BY-NC-4.0", { nonCommercial: false } as never), false);
  assert.match(resolveLicense(["CC-BY-NC-4.0"], { nonCommercial: false } as never).errors.join(), /not configured/);
});

test("ND, tos and unknown licences are never adaptable", () => {
  for (const id of ["CC-BY-ND-4.0", "CC-BY-NC-ND-4.0", "TOS", "nope"]) {
    assert.equal(resolveLicense([id]).license, null, id);
  }
});

test("NC wins over permissive licences", () => {
  assert.equal(resolveLicense(["CC-BY-4.0", "CC-BY-NC-4.0"]).license, "CC-BY-NC-4.0");
  assert.equal(resolveLicense(["PD", "CC-BY-NC-SA-4.0"]).license, "CC-BY-NC-SA-4.0");
});

test("ShareAlike carries through; BY-SA and BY-NC-SA cannot mix", () => {
  assert.equal(resolveLicense(["CC-BY-4.0", "CC-BY-SA-4.0"]).license, "CC-BY-SA-4.0");
  assert.equal(resolveLicense(["CC-BY-SA-3.0"]).license, "CC-BY-SA-3.0");
  const bad = resolveLicense(["CC-BY-SA-4.0", "CC-BY-NC-SA-4.0"]);
  assert.equal(bad.license, null);
  assert.match(bad.errors.join(), /incompatible/);
});

test("mixed ShareAlike versions resolve to 4.0 with a warning", () => {
  const r = resolveLicense(["CC-BY-SA-3.0", "CC-BY-SA-4.0"]);
  assert.equal(r.license, "CC-BY-SA-4.0");
  assert.equal(r.warnings.length, 1);
});
