import assert from "node:assert/strict";
import { test } from "node:test";
import { checkLesson, fleschKincaidGrade, parseLesson } from "./lesson.js";

const body = `## Explanation
Things fall down because the Earth pulls on them. We call that pull gravity. It pulls on you, on a ball and on the Moon.

## Worked example
Drop a ball from your hand. It speeds up as it falls and lands on the floor.

## Activity
Drop a feather and a book. Watch which lands first, then drop the feather and the book together.

## Summary
Gravity pulls things toward each other.
`;

const doc = (fm: string, content = body) => `---\n${fm}\n---\n${content}`;

const good = `id: KU-L00123
status: drafted
kind: reading
minutes: 10
original: true
author: { name: drafter, kind: agent }
checks:
  - { q: "What pulls a ball down?", a: "Gravity" }
  - { q: "Does gravity pull on the Moon?", a: "Yes" }
  - { q: "Which falls first, in air: feather or book?", a: "The book" }`;

test("a complete lesson passes the gate", () => {
  const { doc: d, issues } = parseLesson(doc(good));
  assert.ok(d, JSON.stringify(issues));
  assert.deepEqual(checkLesson(d!).filter((i) => i.level === "error"), []);
});

test("missing sections, too few checks and no provenance are errors", () => {
  const { doc: d } = parseLesson(
    doc(`id: KU-L00123\nstatus: drafted\nkind: reading\nchecks:\n  - { q: a, a: b }`, "## Explanation\nShort."),
  );
  const errors = checkLesson(d!).filter((i) => i.level === "error").map((i) => i.message).join("|");
  assert.match(errors, /Worked example/);
  assert.match(errors, /3 to 5 check/);
  assert.match(errors, /no sources listed/);
});

test("licences: ND and unknown are rejected, NC and ShareAlike set the lesson licence", () => {
  const withSrc = (lic: string) =>
    parseLesson(doc(`${good.replace("original: true", "original: false")}\nsources:\n  - { name: X, license: ${lic}, adapted: true }`));
  const errs = (lic: string) =>
    checkLesson(withSrc(lic).doc!).filter((i) => i.level === "error").map((i) => i.message).join("|");

  assert.match(errs("CC-BY-ND-4.0"), /forbids adaptation/);
  assert.match(errs("MIT-ish"), /unknown licence/);

  const nc = withSrc("CC-BY-NC-SA-4.0");
  assert.equal(nc.doc!.license, "CC-BY-NC-SA-4.0");
  assert.deepEqual(checkLesson(nc.doc!).filter((i) => i.level === "error"), []);

  const sa = withSrc("CC-BY-SA-4.0");
  assert.equal(sa.doc!.license, "CC-BY-SA-4.0");
  assert.deepEqual(checkLesson(sa.doc!).filter((i) => i.level === "error"), []);
});

test("a cited-only source does not change the lesson licence", () => {
  const d = parseLesson(
    doc(`${good.replace("original: true", "original: false")}\nsources:\n  - { name: Khan, license: CC-BY-ND-4.0, adapted: false }\n  - { name: OpenStax, license: CC-BY-4.0, adapted: true }`),
  );
  assert.equal(d.doc!.license, "CC-BY-4.0");
  assert.deepEqual(checkLesson(d.doc!).filter((i) => i.level === "error"), []);
});

test("review needs a different reviewer and a date", () => {
  const self = parseLesson(
    doc(`${good.replace("drafted", "reviewed")}\nreviewer: { name: drafter, kind: agent }\nreviewedAt: 2026-11-05`),
  );
  assert.match(checkLesson(self.doc!).map((i) => i.message).join(), /must not be the author/);

  const ok = parseLesson(
    doc(`${good.replace("drafted", "reviewed")}\nreviewer: { name: other, kind: human }\nreviewedAt: 2026-11-05`),
  );
  assert.deepEqual(checkLesson(ok.doc!).filter((i) => i.level === "error"), []);
});

test("unknown concepts and bad ids are caught", () => {
  const bad = parseLesson(doc(good.replace("KU-L00123", "L1")));
  assert.equal(bad.doc, null);
  const d = parseLesson(doc(`${good}\nconcepts: [gravity]`)).doc!;
  assert.match(
    checkLesson(d, { knownConcepts: new Set(["orbit"]) }).map((i) => i.message).join(),
    /unknown concept/,
  );
});

test("reading level separates a child text from a graduate one", () => {
  const easy = fleschKincaidGrade("The cat sat. The dog ran. We saw a red ball.");
  const hard = fleschKincaidGrade(
    "Gravitational interaction between extended bodies produces tidal deformation proportional to the differential acceleration.",
  );
  assert.ok(easy < 3, String(easy));
  assert.ok(hard > 12, String(hard));
});
