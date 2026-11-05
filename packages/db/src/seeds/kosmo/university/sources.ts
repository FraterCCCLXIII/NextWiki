/**
 * The source ledger (sources.json) and the gap map (source-map.json).
 *
 * The ledger is the single record of every outside work the University links to, cites or
 * ingests: who made it, where it lives, under what licence, what we took, and where it is
 * stored. Lessons and syllabi point at it by id (`ref: SRC-openstax-astronomy-2e`).
 *
 * The gap map says which sources can fill which module, by stable module id (KU-M0001).
 *
 * Pure checks live here (no filesystem); sources-io.ts reads the files.
 */
import { LICENSES, isAdaptable, isKnownLicense } from "./licenses.js";

/** link: point learners at it. adapt: lessons may be written from it. ingest: a copy is stored. */
export type SourceMode = "link" | "adapt" | "ingest";
export const SOURCE_MODES: SourceMode[] = ["link", "adapt", "ingest"];

export type SourceKind = "textbook" | "course" | "site" | "collection" | "paper-set" | "standard" | "media";
export const SOURCE_KINDS: SourceKind[] = ["textbook", "course", "site", "collection", "paper-set", "standard", "media"];

export type LedgerSource = {
  /** SRC-<slug>. Stable; never reused. */
  id: string;
  title: string;
  publisher: string;
  url: string;
  kind: SourceKind;
  license: string;
  /** Where the licence is stated on the source's own site. */
  licenseUrl: string;
  /** Date (YYYY-MM-DD) someone checked the licence on the source's site. */
  licenseCheckedAt: string;
  /** Attribution line to print, as the licence requires. */
  attribution: string;
  /** Stages it is useful for (tree stage keys). */
  stages: string[];
  /** Third-party material inside it that has its own terms (images, videos, exercises). */
  exclusions?: string;
  /**
   * Whether the publisher lets AI systems read and learn from it. "restricted" means the
   * publisher forbids use in LLMs or generative AI without permission (OpenStax does), so our
   * drafting agents must not read it: it can only be linked, or read and adapted by a human.
   * Defaults to "ok" when absent.
   */
  aiUse?: "ok" | "restricted";
  /** Where the AI-use terms are stated, when restricted. */
  aiUseUrl?: string;
  /** What we do with it by default. A per-module entry in the gap map may be narrower. */
  mode: SourceMode;
  /** Present only for ingested sources. */
  ingest?: {
    /** Path under the repo, e.g. apps/web/public/kosmo/open-courses/<slug>/ */
    path: string;
    /** Size on disk in bytes, so we can watch space. */
    bytes: number;
    retrievedAt: string;
    /** What was taken, and what was left out. */
    scope: string;
  };
  notes?: string;
};

export type Ledger = {
  version: 1;
  note?: string;
  sources: Record<string, LedgerSource>;
};

export type MapEntry = {
  /** Ledger id. */
  source: string;
  /** Deep link to the part that fits: a chapter, a lecture set, a page. Falls back to the source URL. */
  url?: string;
  /** Human locator: "Ch. 4: Orbits and Gravity". */
  locator: string;
  /** How well it fills the module. */
  fit: "full" | "partial";
  /** link | adapt | ingest for this module. */
  mode: SourceMode;
  note?: string;
};

export type SourceMap = {
  version: 1;
  /** KU-M id -> entries. Modules with no entry are open gaps. */
  modules: Record<string, MapEntry[]>;
};

const ID = /^SRC-[a-z0-9][a-z0-9-]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAGES = new Set([
  "public",
  "preschool",
  "kindergarten",
  "primary",
  "middle",
  "high",
  "college",
  "masters",
  "doctoral",
  "postgrad",
]);

/** Problems with the ledger itself. Empty means sound. */
export function validateLedger(ledger: Ledger): string[] {
  const p: string[] = [];
  const urls = new Map<string, string>();
  for (const [key, s] of Object.entries(ledger.sources)) {
    const at = `${key}:`;
    if (s.id !== key) p.push(`${at} id field "${s.id}" does not match its key`);
    if (!ID.test(key)) p.push(`${at} id must look like SRC-some-slug`);
    for (const f of ["title", "publisher", "url", "licenseUrl", "attribution"] as const) {
      if (!s[f]?.trim()) p.push(`${at} ${f} is required`);
    }
    if (!/^https?:\/\//.test(s.url ?? "")) p.push(`${at} url must be http(s)`);
    if (!isKnownLicense(s.license)) p.push(`${at} unknown licence "${s.license}"`);
    if (!SOURCE_KINDS.includes(s.kind)) p.push(`${at} unknown kind "${s.kind}"`);
    if (!SOURCE_MODES.includes(s.mode)) p.push(`${at} unknown mode "${s.mode}"`);
    if (!DATE.test(s.licenseCheckedAt ?? "")) p.push(`${at} licenseCheckedAt must be YYYY-MM-DD`);
    for (const st of s.stages ?? []) if (!STAGES.has(st)) p.push(`${at} unknown stage "${st}"`);
    if (!s.stages?.length) p.push(`${at} list at least one stage`);

    // A source we may not adapt can only be linked.
    if (s.mode !== "link" && !isAdaptable(s.license)) {
      p.push(`${at} licence ${s.license} cannot be adapted or ingested; set mode to "link"`);
    }
    if (s.aiUse && s.aiUse !== "ok" && s.aiUse !== "restricted") p.push(`${at} aiUse must be ok or restricted`);
    if (s.aiUse === "restricted") {
      if (s.mode !== "link") p.push(`${at} the publisher restricts AI use; set mode to "link" until permission is recorded`);
      if (!s.aiUseUrl) p.push(`${at} restricted AI use needs aiUseUrl (where the terms are stated)`);
    }
    if (s.mode === "ingest" && !s.ingest) p.push(`${at} mode is ingest but there is no ingest record`);
    if (s.mode !== "ingest" && s.ingest) p.push(`${at} has an ingest record but mode is ${s.mode}`);
    if (s.ingest) {
      if (!s.ingest.path || !DATE.test(s.ingest.retrievedAt) || !(s.ingest.bytes >= 0) || !s.ingest.scope) {
        p.push(`${at} ingest needs path, bytes, retrievedAt and scope`);
      }
    }
    if (LICENSES[s.license]?.by && !s.attribution?.trim()) p.push(`${at} this licence requires attribution`);

    const dup = urls.get(s.url);
    if (dup) p.push(`${at} same url as ${dup}`);
    urls.set(s.url, key);
  }
  return p;
}

/** Problems with the gap map against the ledger and the set of real module ids. */
export function validateMap(map: SourceMap, ledger: Ledger, moduleIds: Set<string>): string[] {
  const p: string[] = [];
  for (const [mod, entries] of Object.entries(map.modules)) {
    if (!moduleIds.has(mod)) p.push(`${mod}: not a module in the tree`);
    if (!entries.length) p.push(`${mod}: empty entry list (delete the key)`);
    const seen = new Set<string>();
    for (const e of entries) {
      const src = ledger.sources[e.source];
      if (!src) {
        p.push(`${mod}: source ${e.source} is not in the ledger`);
        continue;
      }
      if (seen.has(e.source + e.locator)) p.push(`${mod}: ${e.source} "${e.locator}" listed twice`);
      seen.add(e.source + e.locator);
      if (!e.locator?.trim()) p.push(`${mod}: ${e.source} needs a locator`);
      if (e.url && !/^https?:\/\//.test(e.url)) p.push(`${mod}: ${e.source} url must be http(s)`);
      if (e.fit !== "full" && e.fit !== "partial") p.push(`${mod}: ${e.source} fit must be full or partial`);
      if (!SOURCE_MODES.includes(e.mode)) p.push(`${mod}: ${e.source} unknown mode "${e.mode}"`);
      if (e.mode !== "link" && !isAdaptable(src.license)) {
        p.push(`${mod}: ${e.source} is ${src.license}; it can only be linked`);
      }
      if (e.mode !== "link" && src.aiUse === "restricted") {
        p.push(`${mod}: ${e.source} restricts AI use; it can only be linked`);
      }
      if (e.mode === "ingest" && src.mode !== "ingest") {
        p.push(`${mod}: ${e.source} is marked ingest here but the ledger has no ingested copy`);
      }
    }
  }
  return p;
}

export type GapReport = {
  modules: number;
  covered: number;
  full: number;
  open: string[];
  bySource: Record<string, number>;
};

/** How many modules the map fills, and which are still open gaps. */
export function gapReport(map: SourceMap, moduleIds: string[]): GapReport {
  const bySource: Record<string, number> = {};
  let covered = 0;
  let full = 0;
  const open: string[] = [];
  for (const id of moduleIds) {
    const entries = map.modules[id];
    if (!entries?.length) {
      open.push(id);
      continue;
    }
    covered++;
    if (entries.some((e) => e.fit === "full")) full++;
    for (const s of new Set(entries.map((e) => e.source))) bySource[s] = (bySource[s] ?? 0) + 1;
  }
  return { modules: moduleIds.length, covered, full, open, bySource };
}
