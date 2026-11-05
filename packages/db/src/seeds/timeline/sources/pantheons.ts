import fs from "node:fs";
import path from "node:path";
import { cleanText, fromHistorical, NOW_YEAR, slugifyKey } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineRelation, TimelineSource } from "../types.js";

/**
 * Interpretatio-Universalis deity graph. Nodes with a numeric attestedFrom become events in their
 * tradition's lane; edges whose two ends were kept become relations. The root *-expansion.json
 * files, eurasian-deity-graph-starter.json and data/<group>/<file>.json are read; the first
 * occurrence of a node id wins.
 */
const DATASET = "pantheons";
const LABEL = "Pantheons & deities";
const BASE = "Interpretatio-Universalis";

const EDGE_CAT: Record<Exclude<TimelineRelation["cat"], "other">, string[]> = {
  genealogical: ["parent_child", "sibling", "consort", "teacher_of", "mythic_pair"],
  linguistic: ["linguistic_cognate", "reconstructed_descent", "etymological"],
  parallel: ["functional_parallel", "mythic_parallel", "storm_god_parallel", "shared_myth_motif"],
  influence: ["cultural_influence", "syncretism", "syncretic_identification", "adapted_from", "iconographic_diffusion"],
  theological: ["manifestation_of", "emanation_of", "incarnation_of", "avatar_of", "wrathful_form_of"],
  transmission: [],
};
const catOf = (t: string): TimelineRelation["cat"] =>
  (Object.keys(EDGE_CAT) as (keyof typeof EDGE_CAT)[]).find((c) => EDGE_CAT[c].includes(t)) ?? "other";

const CONFIDENCE_RANK: Record<string, number> = { high: 0.8, medium: 0.55, low: 0.35, speculative: 0.2 };

interface RawNode {
  id: string;
  name?: string;
  tradition?: string;
  region?: string;
  type?: string;
  period?: string;
  domains?: string[];
  description?: string;
  attestedFrom?: unknown;
  attestedTo?: unknown;
  confidenceLevel?: string;
  sources?: unknown[];
}
interface RawEdge {
  source: string;
  target: string;
  relationType?: string;
  confidence?: unknown;
}

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function uniqueKey(base: string, taken: Set<string>): string {
  let key = base;
  for (let i = 2; taken.has(slugifyKey(key) || key); i++) key = `${base}-${i}`;
  taken.add(slugifyKey(key) || key);
  return key;
}

function listFiles(base: string): string[] {
  const files = fs
    .readdirSync(base)
    .filter((f) => f.endsWith("-expansion.json") || f === "eurasian-deity-graph-starter.json")
    .sort();
  const dataDir = path.join(base, "data");
  if (fs.existsSync(dataDir)) {
    for (const group of fs.readdirSync(dataDir).sort()) {
      const dir = path.join(dataDir, group);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) files.push(path.join("data", group, f));
    }
  }
  return files;
}

const source: TimelineSource = {
  id: "pantheons",
  label: LABEL,
  trustTier: "structured",
  async load({ root }) {
    const base = path.join(root, BASE);
    const skipped: NonNullable<TimelineBundle["skipped"]> = [];

    const nodes = new Map<string, { node: RawNode; file: string }>();
    const edges: RawEdge[] = [];
    for (const f of listFiles(base)) {
      let json: { nodes?: RawNode[]; edges?: RawEdge[] };
      try {
        json = JSON.parse(fs.readFileSync(path.join(base, f), "utf8"));
      } catch {
        skipped.push({ ref: `${BASE}/${f}`, reason: "unreadable JSON" });
        continue;
      }
      const file = f.split(path.sep).join("/");
      for (const n of json.nodes ?? []) if (n?.id && !nodes.has(n.id)) nodes.set(n.id, { node: n, file: `${BASE}/${file}` });
      for (const e of json.edges ?? []) if (e?.source && e?.target) edges.push(e);
    }

    const records: TimelineRecord[] = [];
    const taken = new Set<string>();
    const keyOf = new Map<string, string>();

    for (const [id, { node: n, file }] of nodes) {
      if (typeof n.attestedFrom !== "number") continue;
      const name = cleanText(n.name);
      if (!name) {
        skipped.push({ ref: `${file}:${id}`, reason: "empty name" });
        continue;
      }
      const start = fromHistorical(n.attestedFrom);
      const to = typeof n.attestedTo === "number" ? fromHistorical(n.attestedTo) : n.attestedTo === "present" ? NOW_YEAR : undefined;
      const end = to != null && to !== start ? to : undefined;
      const key = uniqueKey(id, taken);
      keyOf.set(id, key);
      records.push({
        key,
        dataset: DATASET,
        datasetLabel: LABEL,
        kind: "event",
        type: "deity",
        name,
        summary: n.description ? trunc(cleanText(n.description), 900) : undefined,
        start,
        end,
        lane: cleanText(n.tradition) || "Unknown tradition",
        region: cleanText(n.region) || undefined,
        confidence: n.confidenceLevel || undefined,
        sources: [file, ...(n.sources ?? []).slice(0, 4).map((s) => cleanText(s))],
        rank: CONFIDENCE_RANK[n.confidenceLevel ?? ""] ?? 0.4,
        data: { type: n.type, period: n.period, domains: n.domains },
      });
    }

    const relations: TimelineRelation[] = [];
    const seen = new Set<string>();
    for (const e of edges) {
      const a = keyOf.get(e.source);
      const b = keyOf.get(e.target);
      if (!a || !b || e.source === e.target) continue;
      const type = String(e.relationType ?? "related");
      const sig = `${a}>${b}:${type}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      relations.push({
        from: `${DATASET}:${a}`,
        to: `${DATASET}:${b}`,
        type,
        cat: catOf(type),
        weight: typeof e.confidence === "number" ? e.confidence : undefined,
      });
    }

    return { records, relations, skipped };
  },
};

export default source;
