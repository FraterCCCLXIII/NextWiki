// Turns a catalogue file into a database plan without touching a database.
// Everything here is pure so the import can be checked (`--check`), diffed and
// unit-tested before a single row is written.
import type { KosmoClaimMethod } from "../../schema/kosmo.js";
import { slugify } from "./text.js";
import { parseSourceField, type ParsedSource } from "./sources.js";

export interface CatalogueRow {
  id: string;
  name: string;
  alt_names?: string[] | null;
  type: string;
  parent?: string | null;
  source?: string | null;
  discovery_source?: string | null;
  [field: string]: unknown;
}

/** Types whose parent is a body they orbit; everything else gets `part_of`. */
export const ORBIT_TYPES = new Set([
  "planet",
  "dwarf_planet",
  "moon",
  "exoplanet",
  "exomoon_candidate",
  "asteroid",
  "comet",
]);

/** Columns that are identity or provenance, not claims. */
export const NON_CLAIM_FIELDS = new Set([
  "id",
  "name",
  "alt_names",
  "type",
  "parent",
  "source",
  "discovery_source",
  // Long free-text caveats stay on the entity; they are not statements.
  "notes",
  "discovery_note",
]);

const UNIT_SUFFIX = /_(kg|m|W|K|pc|deg|days)$/;

/**
 * Fields the source published in other units or as another column. The value is
 * still exactly what the source says, recomputed — hence `converted`, with the
 * original column recorded as a qualifier.
 */
const EXOPLANET_COLUMNS: Record<string, string> = {
  mass_kg: "pl_bmasse",
  radius_m: "pl_rade",
  semi_major_axis_m: "pl_orbsmax",
  period_days: "pl_orbper",
  temperature_K: "st_teff",
  dist_pc: "sy_dist",
  ra_deg: "ra",
  dec_deg: "dec",
  discovery_year: "disc_year",
};

export interface PlannedClaim {
  predicate: string;
  /** Column it came from, for the check report. */
  field: string;
  /** Catalogue id of the target entity, for relations. */
  objectId?: string;
  valueText?: string;
  valueNum?: number;
  unit?: string;
  method: KosmoClaimMethod;
  qualifiers?: Record<string, unknown>;
  sourceKeys: string[];
}

export interface PlannedExternalId {
  scheme: string;
  value: string;
  url?: string;
  sourceKey?: string;
}

export interface PlannedEntity {
  objectId: string;
  slug: string;
  name: string;
  type: string;
  data: CatalogueRow;
  sourceKeys: string[];
  claims: PlannedClaim[];
  externalIds: PlannedExternalId[];
}

export type PlanIssueCode =
  | "duplicate_id"
  | "unresolved_parent"
  | "ambiguous_parent"
  | "self_parent"
  | "unregistered_source"
  | "duplicate_external_id";

export interface PlanIssue {
  code: PlanIssueCode;
  objectId: string;
  detail: string;
  candidates?: string[];
}

export interface PlanStats {
  rows: number;
  entities: number;
  claims: number;
  numericClaims: number;
  textClaims: number;
  parentLinks: number;
  unresolvedParents: number;
  ambiguousParents: number;
  claimsWithoutSource: number;
  duplicateIds: number;
  duplicateExternalIds: number;
  methods: Record<string, number>;
  sources: { key: string; url: string; registered: boolean; rows: number }[];
  externalIdSchemes: Record<string, number>;
  unregisteredHosts: { host: string; count: number }[];
}

export interface ImportPlan {
  entities: PlannedEntity[];
  issues: PlanIssue[];
  stats: PlanStats;
}

export interface PlanOptions {
  /** Only plan the first n rows. Used for smoke tests of the importer. */
  limit?: number;
}

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function unitFor(field: string): string | undefined {
  return field.match(UNIT_SUFFIX)?.[1];
}

function methodFor(row: CatalogueRow, field: string): KosmoClaimMethod {
  if (
    (row.type === "exoplanet" || row.type === "exomoon_candidate") &&
    EXOPLANET_COLUMNS[field]
  ) {
    return "converted";
  }
  return "verbatim";
}

function qualifiersFor(
  row: CatalogueRow,
  field: string,
): Record<string, unknown> | undefined {
  if (
    (row.type === "exoplanet" || row.type === "exomoon_candidate") &&
    EXOPLANET_COLUMNS[field]
  ) {
    return { source_column: EXOPLANET_COLUMNS[field] };
  }
  return undefined;
}

const WIKIDATA_URL = /^https?:\/\/(?:www\.)?wikidata\.org\/wiki\/(Q\d+)/i;
const WIKIPEDIA_URL =
  /^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/i;

export function externalIdsFor(
  row: CatalogueRow,
  sources: ParsedSource[],
): PlannedExternalId[] {
  const out: PlannedExternalId[] = [
    { scheme: "kosmo_catalog", value: String(row.id) },
  ];
  const seen = new Set<string>();

  for (const source of sources) {
    const wikidata = WIKIDATA_URL.exec(source.url);
    if (wikidata?.[1]) {
      const value = wikidata[1].toUpperCase();
      if (!seen.has(`wikidata:${value}`)) {
        seen.add(`wikidata:${value}`);
        out.push({
          scheme: "wikidata",
          value,
          url: `https://www.wikidata.org/wiki/${value}`,
          sourceKey: source.key,
        });
      }
      continue;
    }
    const wikipedia = WIKIPEDIA_URL.exec(source.url);
    if (wikipedia?.[2]) {
      const value = decodeURIComponent(wikipedia[2]).replace(/_/g, " ");
      // A list article ("List of natural satellites") is a citation, not this
      // object's identity. Only a page titled with the object's own name or
      // alias counts as an identity across releases.
      const titles = [row.name, ...(row.alt_names ?? [])]
        .filter((n): n is string => typeof n === "string")
        .map((n) => n.trim().replace(/\s+/g, " ").toLowerCase());
      const isAboutThisObject = titles.includes(value.toLowerCase());
      if (isAboutThisObject && !seen.has(`wikipedia:${value}`)) {
        seen.add(`wikipedia:${value}`);
        out.push({
          scheme: "wikipedia",
          value,
          url: source.url,
          sourceKey: source.key,
        });
      }
    }
  }

  // The archive's planet name is the join key for a future re-import.
  if (row.type === "exoplanet") {
    const fromArchive = sources.some(
      (s) => s.entry?.key === "exoplanetarchive.ipac.caltech.edu",
    );
    if (fromArchive && !seen.has(`exoplanet_archive:${row.name}`)) {
      seen.add(`exoplanet_archive:${row.name}`);
      out.push({
        scheme: "exoplanet_archive",
        value: String(row.name),
        sourceKey: "exoplanetarchive.ipac.caltech.edu",
      });
    }
  }

  return out;
}

/**
 * Plans the whole catalogue. Parent names are resolved only when exactly one
 * entity can be meant: a name shared by two rows ("55 Cnc b" is both a planet
 * and a star entry) is reported, never guessed.
 */
export function planCatalogue(
  input: readonly CatalogueRow[],
  options: PlanOptions = {},
): ImportPlan {
  const rows = options.limit ? input.slice(0, options.limit) : [...input];
  const issues: PlanIssue[] = [];

  const byId = new Map<string, string>();
  // Two name tiers: exact as written, then case-insensitive. Astronomy depends
  // on the distinction — "55 Cnc B" is the star and "55 Cnc b" is its planet.
  const byExactName = new Map<string, Set<string>>();
  const byName = new Map<string, Set<string>>();
  const seenIds = new Set<string>();
  let duplicateIds = 0;

  for (const row of rows) {
    const id = String(row.id);
    if (seenIds.has(id)) {
      duplicateIds += 1;
      issues.push({
        code: "duplicate_id",
        objectId: id,
        detail: "the same id appears more than once in the catalogue",
      });
      continue;
    }
    seenIds.add(id);
    byId.set(id.toLowerCase(), id);
    const names = [row.name, ...(row.alt_names ?? [])];
    for (const name of names) {
      if (typeof name !== "string" || !name.trim()) continue;
      const exactKey = name.trim().replace(/\s+/g, " ");
      const exactSet = byExactName.get(exactKey) ?? new Set<string>();
      exactSet.add(id);
      byExactName.set(exactKey, exactSet);

      const key = normalizeName(name);
      const set = byName.get(key) ?? new Set<string>();
      set.add(id);
      byName.set(key, set);
    }
  }

  let unresolvedParents = 0;
  let ambiguousParents = 0;
  let duplicateExternalIds = 0;
  const registryRows = new Map<
    string,
    { url: string; registered: boolean; rows: number }
  >();
  const externalIdSeen = new Map<string, string>();
  const externalIdSchemes: Record<string, number> = {};
  const methods: Record<string, number> = {};

  const resolveParent = (
    parent: string,
    selfId: string,
  ): { id?: string; ambiguous?: string[]; self?: boolean } => {
    const name = normalizeName(parent);
    // A name claimed by two rows is ambiguous even when its slug happens to
    // match one of their ids: the catalogue uses slugs for ids, so the slug
    // fallback would otherwise turn a coincidence into false confidence.
    const exactCandidates = byExactName.get(parent.trim().replace(/\s+/g, " "));
    if (exactCandidates) {
      const others = [...exactCandidates].filter((id) => id !== selfId);
      if (others.length === 1) return { id: others[0]! };
      if (others.length > 1) return { ambiguous: others };
      return { self: true };
    }
    const candidates = byName.get(name);
    const direct = byId.get(parent.trim().toLowerCase());
    if (candidates) {
      const others = [...candidates].filter((id) => id !== selfId);
      if (others.length === 1) return { id: others[0]! };
      if (others.length > 1) return { ambiguous: others };
      // The only row claiming this name is the subject itself.
      return { self: true };
    }
    if (direct && direct !== selfId) return { id: direct };
    const bySlug = byId.get(slugify(parent));
    if (bySlug && bySlug !== selfId) return { id: bySlug };
    return {};
  };

  const entities: PlannedEntity[] = [];
  const plannedIds = new Set<string>();

  for (const row of rows) {
    const id = String(row.id);
    // Duplicate rows were counted above; plan each id once.
    if (!seenIds.has(id) || plannedIds.has(id)) continue;
    plannedIds.add(id);

    const valueSources = parseSourceField(row.source);
    const discoverySources = parseSourceField(row.discovery_source);
    const allSources = dedupeSources([...valueSources, ...discoverySources]);
    const allKeys = allSources.map((s) => s.key);

    for (const source of allSources) {
      const entry = registryRows.get(source.key);
      registryRows.set(source.key, {
        url: entry?.url ?? source.url,
        registered: Boolean(source.entry),
        rows: (entry?.rows ?? 0) + 1,
      });
      if (!source.entry) {
        issues.push({
          code: "unregistered_source",
          objectId: id,
          detail: `${source.host ?? source.url} has no entry in the source registry`,
        });
      }
    }

    const claims: PlannedClaim[] = [];

    for (const [field, value] of Object.entries(row)) {
      if (NON_CLAIM_FIELDS.has(field)) continue;
      if (value === null || value === undefined || value === "") continue;

      const isDiscovery = field.startsWith("discovery_") || field === "discovered_by";
      const sourceKeys = isDiscovery
        ? dedupeKeys([...discoverySources.map((s) => s.key), ...allKeys])
        : allKeys;

      if (typeof value === "number" && Number.isFinite(value)) {
        claims.push({
          predicate: field,
          field,
          valueNum: value,
          unit: unitFor(field),
          method: methodFor(row, field),
          qualifiers: qualifiersFor(row, field),
          sourceKeys,
        });
        continue;
      }

      if (typeof value === "string") {
        claims.push({
          predicate: field,
          field,
          valueText: value,
          method: "verbatim",
          sourceKeys,
        });
        continue;
      }

      if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        for (const item of value) {
          if (!item.trim()) continue;
          claims.push({
            predicate: field,
            field,
            valueText: item,
            method: "verbatim",
            sourceKeys,
          });
        }
      }
    }

    // Relations are planned last but written with the same claim pipeline.
    if (typeof row.parent === "string" && row.parent.trim()) {
      const predicate = ORBIT_TYPES.has(row.type) ? "orbits" : "part_of";
      const resolution = resolveParent(row.parent, id);
      if (resolution.self) {
        issues.push({
          code: "self_parent",
          objectId: id,
          detail: `parent "${row.parent}" resolves to the entity itself`,
        });
      } else if (resolution.ambiguous) {
        ambiguousParents += 1;
        issues.push({
          code: "ambiguous_parent",
          objectId: id,
          detail: `parent "${row.parent}" matches ${resolution.ambiguous.length} entities; left unlinked`,
          candidates: resolution.ambiguous,
        });
        claims.push({
          predicate,
          field: "parent",
          valueText: row.parent,
          method: "verbatim",
          sourceKeys: allKeys,
        });
      } else if (resolution.id) {
        claims.push({
          predicate,
          field: "parent",
          objectId: resolution.id,
          method: "verbatim",
          sourceKeys: allKeys,
        });
      } else {
        unresolvedParents += 1;
        issues.push({
          code: "unresolved_parent",
          objectId: id,
          detail: `parent "${row.parent}" is not in the catalogue`,
        });
        claims.push({
          predicate,
          field: "parent",
          valueText: row.parent,
          method: "verbatim",
          sourceKeys: allKeys,
        });
      }
    }

    const externalIds = externalIdsFor(row, allSources);
    for (const ext of externalIds) {
      const key = `${ext.scheme}:${ext.value.toLowerCase()}`;
      const owner = externalIdSeen.get(key);
      if (owner && owner !== id) {
        duplicateExternalIds += 1;
        issues.push({
          code: "duplicate_external_id",
          objectId: id,
          detail: `${ext.scheme}:${ext.value} is also claimed by ${owner}`,
          candidates: [owner],
        });
        continue;
      }
      externalIdSeen.set(key, id);
      externalIdSchemes[ext.scheme] = (externalIdSchemes[ext.scheme] ?? 0) + 1;
    }

    for (const claim of claims) {
      methods[claim.method] = (methods[claim.method] ?? 0) + 1;
    }

    entities.push({
      objectId: id,
      slug: `object:${id}`,
      name: String(row.name),
      type: row.type || "other",
      data: row,
      sourceKeys: allKeys,
      claims,
      externalIds,
    });
  }

  const stats: PlanStats = {
    rows: rows.length,
    entities: entities.length,
    claims: entities.reduce((n, e) => n + e.claims.length, 0),
    numericClaims: entities.reduce(
      (n, e) => n + e.claims.filter((c) => c.valueNum !== undefined).length,
      0,
    ),
    textClaims: entities.reduce(
      (n, e) => n + e.claims.filter((c) => c.valueText !== undefined).length,
      0,
    ),
    parentLinks: entities.reduce(
      (n, e) => n + e.claims.filter((c) => c.objectId !== undefined).length,
      0,
    ),
    unresolvedParents,
    ambiguousParents,
    claimsWithoutSource: entities.reduce(
      (n, e) => n + e.claims.filter((c) => c.sourceKeys.length === 0).length,
      0,
    ),
    duplicateIds,
    duplicateExternalIds,
    methods,
    sources: [...registryRows.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.rows - a.rows),
    externalIdSchemes,
    unregisteredHosts: [...registryRows.entries()]
      .filter(([, v]) => !v.registered)
      .map(([key, v]) => ({ host: key, count: v.rows }))
      .sort((a, b) => b.count - a.count),
  };

  return { entities, issues, stats };
}

function dedupeKeys(keys: string[]): string[] {
  return [...new Set(keys.filter(Boolean))];
}

function dedupeSources(sources: ParsedSource[]): ParsedSource[] {
  const seen = new Set<string>();
  const out: ParsedSource[] = [];
  for (const source of sources) {
    if (seen.has(source.key)) continue;
    seen.add(source.key);
    out.push(source);
  }
  return out;
}

const ISSUE_SAMPLES = 8;

/** Printed by `--check` and at the end of a real import. */
export function formatPlanReport(plan: ImportPlan): string {
  const s = plan.stats;
  const lines: string[] = [];
  lines.push(
    `rows ${s.rows} · entities ${s.entities} · claims ${s.claims} (${s.numericClaims} numeric, ${s.textClaims} text)`,
  );
  lines.push(`parent links resolved: ${s.parentLinks}`);
  lines.push(
    `parents unresolved: ${s.unresolvedParents} · ambiguous (not guessed): ${s.ambiguousParents}`,
  );
  lines.push(
    `claims without a source: ${s.claimsWithoutSource} · duplicate ids: ${s.duplicateIds} · duplicate external ids: ${s.duplicateExternalIds}`,
  );
  lines.push(
    `methods: ${Object.entries(s.methods)
      .map(([m, n]) => `${m} ${n}`)
      .join(", ")}`,
  );
  lines.push(
    `external ids: ${Object.entries(s.externalIdSchemes)
      .map(([scheme, n]) => `${scheme} ${n}`)
      .join(", ")}`,
  );
  lines.push(
    `sources: ${s.sources
      .map((src) => `${src.key}${src.registered ? "" : " (UNREGISTERED)"} ×${src.rows}`)
      .join(", ")}`,
  );
  for (const host of s.unregisteredHosts) {
    lines.push(`  ! register ${host.host} (${host.count} rows) before importing`);
  }
  const byCode = new Map<string, PlanIssue[]>();
  for (const issue of plan.issues) {
    const list = byCode.get(issue.code) ?? [];
    list.push(issue);
    byCode.set(issue.code, list);
  }
  for (const [code, list] of byCode) {
    lines.push(`${code}: ${list.length}`);
    for (const issue of list.slice(0, ISSUE_SAMPLES)) {
      lines.push(
        `  - ${issue.objectId}: ${issue.detail}${issue.candidates ? ` [${issue.candidates.join(", ")}]` : ""}`,
      );
    }
    if (list.length > ISSUE_SAMPLES) {
      lines.push(`  … ${list.length - ISSUE_SAMPLES} more`);
    }
  }
  return lines.join("\n");
}
