import assert from "node:assert/strict";
import test from "node:test";
import { gapReport, validateLedger, validateMap, type Ledger, type LedgerSource, type SourceMap } from "./sources.js";

const src = (over: Partial<LedgerSource> = {}): LedgerSource => ({
  id: "SRC-a",
  title: "A book",
  publisher: "Pub",
  url: "https://example.org/a",
  kind: "textbook",
  license: "CC-BY-4.0",
  licenseUrl: "https://example.org/license",
  licenseCheckedAt: "2026-11-05",
  attribution: "A book by Pub, CC BY 4.0",
  stages: ["college"],
  mode: "adapt",
  ...over,
});
const ledger = (...s: LedgerSource[]): Ledger => ({ version: 1, sources: Object.fromEntries(s.map((x) => [x.id, x])) });

test("a sound ledger has no problems", () => {
  assert.deepEqual(validateLedger(ledger(src())), []);
});

test("ND and unknown licences can only be linked", () => {
  assert.match(validateLedger(ledger(src({ license: "CC-BY-ND-4.0" }))).join(), /set mode to "link"/);
  assert.deepEqual(validateLedger(ledger(src({ license: "CC-BY-ND-4.0", mode: "link" }))), []);
  assert.match(validateLedger(ledger(src({ license: "Made-up" }))).join(), /unknown licence/);
});

test("ingest needs a record, and a record needs ingest", () => {
  assert.match(validateLedger(ledger(src({ mode: "ingest" }))).join(), /no ingest record/);
  const rec = { path: "x/", bytes: 10, retrievedAt: "2026-11-05", scope: "all" };
  assert.match(validateLedger(ledger(src({ ingest: rec }))).join(), /ingest record but mode/);
  assert.deepEqual(validateLedger(ledger(src({ mode: "ingest", ingest: rec }))), []);
});

test("sources that restrict AI use are link-only and say where", () => {
  const p = validateLedger(ledger(src({ aiUse: "restricted" }))).join();
  assert.match(p, /set mode to "link"/);
  assert.match(p, /aiUseUrl/);
  assert.deepEqual(validateLedger(ledger(src({ aiUse: "restricted", aiUseUrl: "https://example.org/terms", mode: "link" }))), []);
  const l = ledger(src({ aiUse: "restricted", aiUseUrl: "https://example.org/terms", mode: "link" }));
  const map: SourceMap = { version: 1, modules: { "KU-M0001": [{ source: "SRC-a", locator: "x", fit: "full", mode: "adapt" }] } };
  assert.match(validateMap(map, l, new Set(["KU-M0001"])).join(), /restricts AI use/);
});

test("licence date, stage, url and duplicates are checked", () => {
  const p = validateLedger(ledger(src({ licenseCheckedAt: "yesterday", stages: ["nope"], url: "ftp://x" }))).join();
  assert.match(p, /YYYY-MM-DD/);
  assert.match(p, /unknown stage/);
  assert.match(p, /http/);
  const two = { version: 1 as const, sources: { "SRC-a": src(), "SRC-b": src({ id: "SRC-b" }) } };
  assert.match(validateLedger(two).join(), /same url/);
});

test("map entries must point at real sources and modules, and respect licences", () => {
  const l = ledger(src(), src({ id: "SRC-nd", url: "https://example.org/nd", license: "CC-BY-ND-4.0", mode: "link" }));
  const map: SourceMap = {
    version: 1,
    modules: {
      "KU-M0001": [{ source: "SRC-a", locator: "Ch 1", fit: "full", mode: "adapt" }],
      "KU-M0002": [{ source: "SRC-missing", locator: "Ch 1", fit: "full", mode: "link" }],
      "KU-M0003": [{ source: "SRC-nd", locator: "Unit 1", fit: "partial", mode: "adapt" }],
      "KU-M9999": [{ source: "SRC-a", locator: "Ch 2", fit: "full", mode: "link" }],
      "KU-M0004": [{ source: "SRC-a", locator: "Ch 3", fit: "full", mode: "ingest" }],
    },
  };
  const p = validateMap(map, l, new Set(["KU-M0001", "KU-M0002", "KU-M0003", "KU-M0004"])).join("|");
  assert.match(p, /SRC-missing is not in the ledger/);
  assert.match(p, /SRC-nd is CC-BY-ND-4.0; it can only be linked/);
  assert.match(p, /KU-M9999: not a module/);
  assert.match(p, /no ingested copy/);
  assert.doesNotMatch(p, /KU-M0001/);
});

test("gap report counts open modules", () => {
  const map: SourceMap = {
    version: 1,
    modules: {
      "KU-M0001": [{ source: "SRC-a", locator: "x", fit: "partial", mode: "link" }],
      "KU-M0002": [{ source: "SRC-a", locator: "y", fit: "full", mode: "link" }],
    },
  };
  const r = gapReport(map, ["KU-M0001", "KU-M0002", "KU-M0003"]);
  assert.deepEqual({ covered: r.covered, full: r.full, open: r.open }, { covered: 2, full: 1, open: ["KU-M0003"] });
  assert.equal(r.bySource["SRC-a"], 2);
});
