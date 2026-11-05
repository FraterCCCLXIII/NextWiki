# Kosmographica data import

The knowledge base is **one graph and several projections**: `kosmo_entities` are
referents, `kosmo_claims` are sourced statements about them, `kosmo_taxa` are
navigation schemes, and `wiki_pages` is one renderer of the result. The catalogue
in `apps/web/public/kosmo/data/catalog/objects.json` is an *input*, not the store:
after the first import the database is the source, and `catalogObjectsJson()` in
`apps/web/src/lib/kosmo/data.ts` rebuilds the legacy JSON from it.

## Running it

```bash
pnpm db:seed:kosmo --check        # plan + report, writes nothing
pnpm db:seed:kosmo --limit 200    # partial graph (parents outside the slice will not resolve)
pnpm db:seed:kosmo                # full import, idempotent
pnpm db:kosmo:report              # entity/claim health and the article queue
pnpm -F @repo/db test             # plan, attribution and time-axis tests
```

`--check` is the review gate: it prints claim counts by method, every source host
with its row count, and every parent it could not resolve. An import should not
run until that output is boring.

## What a row becomes

| Catalogue column | Becomes |
|---|---|
| `id`, `name`, `type` | entity identity (`object:<id>`), label and primary type |
| `mass_kg`, `radius_m`, `dist_pc`, … | one numeric claim each, with unit and method |
| `spectral_type`, `discovery_method`, … | text claims |
| `discovered_by: ["A", "B"]` | one claim per name |
| `parent` | `orbits` or `part_of` relation **only when exactly one entity matches** |
| `source`, `discovery_source` | one `kosmo_sources` row per cited host, linked per claim via `kosmo_claim_sources` |
| Wikidata/Wikipedia URLs | `kosmo_entity_external_ids` |

`notes` and `discovery_note` stay on the entity: they are caveats, not statements
("mass is `pl_bmasse`, may be M sin i"). A value recomputed from a published
column is marked `method = converted` with `qualifiers.source_column`, so a wrong
number can be traced back to the column it came from without re-crawling.

Name matching is **exact-case first, then case-insensitive**, because astronomy
depends on it: `55 Cnc B` is the star and `55 Cnc b` is its planet. Parents that
stay ambiguous or missing are kept as text claims and reported; nothing is guessed.

## Identity, then values, then prose

1. **Identity** — `kosmo_entity_external_ids` (Wikidata QID, Wikipedia title,
   exoplanet archive name, catalogue id). Needed to re-import a new catalogue
   release, deduplicate SIMBAD/NED/Wikidata, and survive a rename. A duplicate
   identity is reported and the second claim is not attached.
2. **Values** — adapters write claims; no adapter writes a new JSON file. Each
   claim carries primary source, all supporting sources and a method.
3. **Prose** — an article exists only when a `wiki_pages` row is attached.
   `kosmo_entities.page_id` is the gate, and `pnpm db:kosmo:report` lists what
   still has no article by type. An entity with no article still has a page in
   this app today (the viewer links to `/kosmo/object/<id>`); when stub routes
   land, those pages become stub views and stop reserving canonical paths.

## Time

`kosmo_entities.time_start / time_end / time_precision_years / time_kind` is one
numeric axis in signed years (year 0 = 1 BCE), indexed, so a 13.8 Gyr cosmology
and a dated battle can be range-queried together. `time.ts` derives precision
from how coarse a year is, so "3,300,000 years ago" does not pretend to be exact.
History periods and events are populated from `history-taxonomy.js`.

## Known limits of this checkout

- `db:push` / `db:generate` cannot load the schema: drizzle-kit's bundler does not
  resolve the `.js` specifiers that `moduleResolution: NodeNext` requires. The DDL
  is committed as `drizzle/0007_kosmo_identity_and_time.sql` and is idempotent.
- `tsc --noEmit` fails on every `insert().values()` chain (drizzle 0.42 + TS 5.8),
  including on `main` with no changes from this work; the runtime path is tested
  by the seed and the unit tests instead.
- 22 catalogue parents cite objects that are not rows (`LMC`, `SMC`, `Orcus`,
  `Quaoar`, `Gonggong`, a few supernova hosts). They are stored as text.
- 35 Wikidata items are cited by two rows (usually a planet citing its host
  system). They are reported, not reassigned.
