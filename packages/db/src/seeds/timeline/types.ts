/**
 * Contract between timeline source modules (one per dataset) and the importer (import.ts).
 * A source module only turns its raw files into TimelineRecord[]; it never touches the database.
 * Years are ASTRONOMICAL (year 0 = 1 BCE): "500 BCE" is -499, "1 CE" is 1. See dates.ts.
 */
export interface TimelineRecord {
  /** Stable id inside the dataset (a row number or source id). Re-importing must produce the same key. */
  key: string;
  /** Dataset slug, kebab-case, e.g. "bardiya". Becomes part of the entity slug. */
  dataset: string;
  /** Human label for the dataset, e.g. "Bardiya & Achaemenid". */
  datasetLabel: string;
  kind: "event" | "period";
  /** Finer type: figure, deity, tradition, battle, temple, reign, text, ... */
  type?: string;
  name: string;
  summary?: string;
  /** Astronomical year the thing starts (or happens). */
  start: number;
  /** Astronomical end year for periods and lifespans. */
  end?: number;
  /** Bounds of uncertainty on `start`, when the source states them. */
  startMin?: number;
  startMax?: number;
  /** Source wrote "c.", "~", "?" or gave only a century. */
  approx?: boolean;
  /** The row/lane this belongs to on the timeline (region, tradition, theme). */
  lane: string;
  region?: string;
  /** high|medium|low|speculative for graded sources; in-source|extension|interpretive for the evidence-grade scheme. */
  confidence?: string;
  /** Citations / provenance strings (file path, URL, bibliographic reference). */
  sources?: string[];
  externalIds?: { scheme: string; value: string; url?: string }[];
  lat?: number;
  lon?: number;
  /** 0..1 significance used to thin out the timeline at wide zoom. Omit if unknown. */
  rank?: number;
  /** Anything else worth keeping verbatim (original date text, extra columns). */
  data?: Record<string, unknown>;
}

export interface TimelineRelation {
  /** `${dataset}:${key}` of the subject record. */
  from: string;
  /** `${dataset}:${key}` of the object record. */
  to: string;
  /** Relation type as written by the source, e.g. teacher_of, linguistic_cognate. */
  type: string;
  /** Visual / semantic family. */
  cat: "transmission" | "genealogical" | "linguistic" | "parallel" | "influence" | "theological" | "other";
  weight?: number;
}

export interface TimelineBundle {
  records: TimelineRecord[];
  relations?: TimelineRelation[];
  /** Rows the module could not use, with a reason, for the coverage report. */
  skipped?: { ref: string; reason: string }[];
}

export interface TimelineSource {
  /** Unique id; used by `--only`. */
  id: string;
  label: string;
  license?: string;
  trustTier?: "primary" | "structured" | "tertiary" | "generated";
  /** Reads the raw files and returns normalised records. Must be deterministic and must not write to the database. */
  load(ctx: { root: string }): Promise<TimelineBundle>;
}
