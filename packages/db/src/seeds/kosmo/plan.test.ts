import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { planCatalogue, type CatalogueRow } from "./plan.js";
import { parseSourceField } from "./sources.js";
import { SOURCE_REGISTRY } from "./sources-registry.js";

const EXO_VALUES =
  "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name&format=csv";
const EXO_DISCOVERY =
  "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+discoverymethod&format=csv";
const WIKI_SUN = "https://en.wikipedia.org/wiki/Sun";
const WIKI_ANDROMEDA = "https://en.wikipedia.org/wiki/Messier_object";
const WIKIDATA_ANDROMEDA = "https://www.wikidata.org/wiki/Q2469";

const FIXTURE: CatalogueRow[] = [
  {
    id: "sun",
    name: "Sun",
    alt_names: ["Sol"],
    type: "star",
    parent: null,
    radius_m: 695700000,
    source: WIKI_SUN,
  },
  {
    id: "earth",
    name: "Earth",
    alt_names: [],
    type: "planet",
    parent: "Sun",
    mass_kg: 5.972e24,
    period_days: 365.256,
    source: WIKI_SUN,
  },
  {
    id: "55-cnc-b",
    name: "55 Cnc b",
    alt_names: [],
    type: "exoplanet",
    parent: "55 Cnc",
    mass_kg: 1.5e27,
    source: EXO_VALUES,
    discovered_by: ["Butler et al.", "Marcy et al."],
    discovery_method: "radial velocity",
    discovery_source: EXO_DISCOVERY,
  },
  {
    id: "55-cnc",
    name: "55 Cnc",
    alt_names: [],
    type: "star",
    source: EXO_VALUES,
  },
  {
    // A second row claims the planet's name; a parent of "55 Cnc b" is ambiguous.
    id: "55-cnc-b-star",
    name: "55 Cnc B",
    alt_names: ["55 Cnc b"],
    type: "star",
    parent: "55 Cnc",
    source: EXO_VALUES,
  },
  {
    // Upper case B is the star, lower case b the planet: not the same name.
    id: "55-cnc-c",
    name: "55 Cnc c",
    alt_names: [],
    type: "exoplanet",
    parent: "55 Cnc B",
    source: EXO_VALUES,
  },
  {
    id: "altair",
    name: "Altair",
    alt_names: [],
    type: "star",
    parent: "55 Cnc b",
    source: WIKI_SUN,
  },
  {
    id: "andromeda-galaxy",
    name: "Andromeda Galaxy",
    alt_names: ["M31"],
    type: "galaxy",
    parent: "Local Group",
    source: `${WIKI_ANDROMEDA} | ${WIKIDATA_ANDROMEDA}`,
  },
  {
    id: "orphan",
    name: "Orphan Object",
    alt_names: [],
    type: "nebula",
    source: "https://example.org/unknown-catalogue",
  },
];

const plan = planCatalogue(FIXTURE);
const entity = (id: string) => {
  const found = plan.entities.find((e) => e.objectId === id);
  assert.ok(found, `entity ${id} planned`);
  return found;
};
const issueFor = (id: string, code: string) =>
  plan.issues.find((i) => i.objectId === id && i.code === code);

describe("catalogue plan: entities and claims", () => {
  it("plans one entity per row", () => {
    assert.equal(plan.entities.length, FIXTURE.length);
    assert.equal(plan.stats.rows, FIXTURE.length);
  });

  it("turns every numeric column into a claim with its unit", () => {
    const earth = entity("earth");
    const mass = earth.claims.find((c) => c.predicate === "mass_kg");
    assert.ok(mass);
    assert.equal(mass.valueNum, 5.972e24);
    assert.equal(mass.unit, "kg");
    assert.equal(mass.method, "verbatim");

    const period = earth.claims.find((c) => c.predicate === "period_days");
    assert.equal(period?.unit, "days");
  });

  it("marks recomputed exoplanet values as converted and keeps the source column", () => {
    const planet = entity("55-cnc-b");
    const mass = planet.claims.find((c) => c.predicate === "mass_kg");
    assert.ok(mass);
    assert.equal(mass.method, "converted");
    assert.deepEqual(mass.qualifiers, { source_column: "pl_bmasse" });
  });

  it("does not turn identity or long caveats into claims", () => {
    const sun = entity("sun");
    const predicates = sun.claims.map((c) => c.predicate);
    assert.ok(!predicates.includes("id"));
    assert.ok(!predicates.includes("name"));
    assert.ok(!predicates.includes("alt_names"));
    assert.ok(!predicates.includes("source"));
  });

  it("writes one claim per name for a list-valued column", () => {
    const planet = entity("55-cnc-b");
    const authors = planet.claims.filter((c) => c.predicate === "discovered_by");
    assert.deepEqual(
      authors.map((c) => c.valueText),
      ["Butler et al.", "Marcy et al."],
    );
  });

  it("attributes discovery claims to the discovery source first", () => {
    const planet = entity("55-cnc-b");
    const author = planet.claims.find((c) => c.predicate === "discovered_by");
    assert.equal(
      author?.sourceKeys[0],
      "exoplanetarchive.ipac.caltech.edu",
    );
  });
});

describe("catalogue plan: relations", () => {
  it("links an orbiter to the body it orbits", () => {
    const earth = entity("earth");
    const orbits = earth.claims.find((c) => c.predicate === "orbits");
    assert.equal(orbits?.objectId, "sun");
    assert.equal(orbits?.valueText, undefined);
  });

  it("matches a parent by exact case before falling back to case-insensitive", () => {
    const planet = entity("55-cnc-c");
    const orbits = planet.claims.find((c) => c.predicate === "orbits");
    assert.equal(orbits?.objectId, "55-cnc-b-star");
    assert.equal(orbits?.valueText, undefined);
  });

  it("uses part_of for non-orbiting objects", () => {
    const andromeda = entity("andromeda-galaxy");
    const partOf = andromeda.claims.find((c) => c.predicate === "part_of");
    assert.equal(partOf?.valueText, "Local Group");
  });

  it("refuses to guess a parent that two entities claim", () => {
    const altair = entity("altair");
    const relation = altair.claims.find((c) => c.field === "parent");
    assert.equal(relation?.objectId, undefined, "not linked");
    assert.equal(relation?.valueText, "55 Cnc b", "name preserved");
    const issue = issueFor("altair", "ambiguous_parent");
    assert.ok(issue);
    assert.deepEqual(issue?.candidates?.sort(), ["55-cnc-b", "55-cnc-b-star"]);
    assert.equal(plan.stats.ambiguousParents, 1);
  });

  it("keeps an unresolved parent as text and reports it", () => {
    assert.equal(plan.stats.unresolvedParents, 1);
    assert.ok(issueFor("andromeda-galaxy", "unresolved_parent"));
  });
});

describe("catalogue plan: identity and attribution", () => {
  it("extracts a Wikidata id from a citation list", () => {
    const andromeda = entity("andromeda-galaxy");
    const qid = andromeda.externalIds.find((e) => e.scheme === "wikidata");
    assert.equal(qid?.value, "Q2469");
    assert.equal(qid?.url, WIKIDATA_ANDROMEDA);
  });

  it("extracts a Wikipedia title and the archive planet name", () => {
    const sun = entity("sun");
    const wiki = sun.externalIds.find((e) => e.scheme === "wikipedia");
    assert.equal(wiki?.value, "Sun");

    const planet = entity("55-cnc-b");
    const archive = planet.externalIds.find(
      (e) => e.scheme === "exoplanet_archive",
    );
    assert.equal(archive?.value, "55 Cnc b");
  });

  it("records the catalogue id as an external identity", () => {
    const sun = entity("sun");
    assert.ok(
      sun.externalIds.some(
        (e) => e.scheme === "kosmo_catalog" && e.value === "sun",
      ),
    );
  });

  it("flags a source host with no registry entry", () => {
    assert.deepEqual(plan.stats.unregisteredHosts, [
      { host: "example.org", count: 1 },
    ]);
    assert.ok(issueFor("orphan", "unregistered_source"));
  });

  it("splits a multi-source citation and resolves each host", () => {
    const parsed = parseSourceField(`${WIKI_ANDROMEDA} | ${WIKIDATA_ANDROMEDA}`);
    assert.deepEqual(
      parsed.map((p) => p.key),
      ["en.wikipedia.org", "www.wikidata.org"],
    );
    assert.ok(parsed.every((p) => p.entry !== null));
  });

  it("gives every claim at least one source", () => {
    assert.equal(plan.stats.claimsWithoutSource, 0);
    for (const e of plan.entities) {
      for (const claim of e.claims) {
        assert.ok(claim.sourceKeys.length > 0, `${e.objectId}.${claim.field}`);
      }
    }
  });
});

describe("source registry", () => {
  it("has one entry per host with a licence, credit and tier", () => {
    const keys = SOURCE_REGISTRY.map((e) => e.key);
    assert.equal(new Set(keys).size, keys.length, "keys are unique");
    for (const entry of SOURCE_REGISTRY) {
      assert.ok(entry.licence && entry.licence.length > 0, entry.key);
      assert.ok(entry.credit && entry.credit.length > 0, entry.key);
      assert.ok(entry.publisher, entry.key);
      assert.ok(
        ["primary", "structured", "tertiary", "generated"].includes(
          entry.trustTier,
        ),
        entry.key,
      );
    }
  });
});

describe("shipped catalogue", () => {
  const catalogPath = path.resolve(
    process.cwd(),
    "..",
    "..",
    "apps",
    "web",
    "public",
    "kosmo",
    "data",
    "catalog",
    "objects.json",
  );

  it("plans the whole shipped catalogue with full attribution", () => {
    assert.ok(
      fs.existsSync(catalogPath),
      `catalogue not found at ${catalogPath}`,
    );
    const rows = JSON.parse(
      fs.readFileSync(catalogPath, "utf8"),
    ) as CatalogueRow[];
    const full = planCatalogue(rows);

    assert.equal(full.stats.rows, 12560);
    assert.equal(full.stats.entities, 12560);
    assert.equal(full.stats.duplicateIds, 0);
    assert.deepEqual(
      full.stats.unregisteredHosts,
      [],
      "every cited host is in the registry",
    );
    assert.equal(full.stats.claimsWithoutSource, 0);

    // Every finite number in every row becomes exactly one claim.
    let expectedNumbers = 0;
    for (const row of rows) {
      for (const [field, value] of Object.entries(row)) {
        if (field === "id" || field === "type") continue;
        if (typeof value === "number" && Number.isFinite(value)) {
          expectedNumbers += 1;
        }
      }
    }
    assert.equal(full.stats.numericClaims, expectedNumbers);

    // Parents the catalogue cites but does not contain (LMC, SMC, Orcus,
    // Quaoar, Gonggong, a few supernovae hosts) stay as text and are reported.
    assert.equal(full.stats.unresolvedParents, 22);
    assert.equal(
      full.issues.filter((i) => i.code === "unresolved_parent").length,
      22,
    );
    // "55 Cnc B" (star) and "TOI-2267 B" (star) are no longer confused with
    // the lower-case planet names, so nothing is left ambiguous.
    assert.equal(full.stats.ambiguousParents, 0);
    assert.equal(full.stats.parentLinks, 7056);

    // Identity beyond the slug: Wikidata, Wikipedia, the exoplanet archive.
    assert.equal(full.stats.externalIdSchemes.wikidata, 703);
    assert.equal(full.stats.externalIdSchemes.wikipedia, 37);
    assert.equal(full.stats.externalIdSchemes.exoplanet_archive, 6451);
    assert.equal(full.stats.externalIdSchemes.kosmo_catalog, 12560);
    assert.ok((full.stats.methods.converted ?? 0) > 0);

    // 35 Wikidata items are cited by two rows (usually a planet row citing its
    // host system). They are reported, and the second claim is not attached,
    // rather than silently reassigning an identity.
    assert.equal(full.stats.duplicateExternalIds, 35);
    assert.ok(
      full.issues.every(
        (i) => i.code !== "duplicate_external_id" || i.candidates?.length,
      ),
    );
  });

  it("keeps the axis consistent: every planned relation points at a planned entity", () => {
    const rows = JSON.parse(
      fs.readFileSync(catalogPath, "utf8"),
    ) as CatalogueRow[];
    const full = planCatalogue(rows);
    const ids = new Set(full.entities.map((e) => e.objectId));
    for (const e of full.entities) {
      for (const claim of e.claims) {
        if (claim.objectId === undefined) continue;
        assert.ok(ids.has(claim.objectId), `${e.objectId} -> ${claim.objectId}`);
        assert.notEqual(claim.objectId, e.objectId, "no self relation");
      }
    }
  });
});
