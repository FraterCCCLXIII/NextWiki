import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";
import { slugifyKey } from "../dates.js";

/**
 * Philosophers and sages on the panentheon site's Golden Chain page (panentheon/docs/lineage.md).
 * Parsed by tools/timeline-goldenchain.mjs, which the static timeline.json build shares.
 */
const PARSER = fileURLToPath(new URL("../../../../../../tools/timeline-goldenchain.mjs", import.meta.url));

interface Row { name: string; section: string; start: number; end?: number; approx?: boolean; diedOnly?: boolean; desc: string; mythological: boolean }

const source: TimelineSource = {
  id: "golden-chain",
  label: "Golden Chain philosophers",
  trustTier: "tertiary",
  async load({ root }): Promise<TimelineBundle> {
    const mod = (await import(pathToFileURL(PARSER).href)) as {
      FILE: string;
      parseGoldenChain: (t: string) => { rows: Row[]; skipped: { name: string; reason: string }[] };
    };
    const file = path.join(root, mod.FILE);
    if (!fs.existsSync(file)) {
      console.warn(`golden-chain: ${file} not found`);
      return { records: [] };
    }
    const { rows, skipped } = mod.parseGoldenChain(fs.readFileSync(file, "utf8"));
    const records: TimelineRecord[] = rows.map((r) => ({
      key: `${slugifyKey(r.name)}-${r.start}`,
      dataset: "golden-chain",
      datasetLabel: "Golden Chain",
      kind: "event",
      type: r.mythological ? "mythological" : "philosopher",
      name: r.name,
      summary: r.desc || undefined,
      start: r.start,
      end: r.end,
      approx: r.approx || undefined,
      lane: r.section,
      confidence: r.mythological ? "speculative" : "extension",
      rank: 0.5,
      sources: [mod.FILE],
      data: r.diedOnly ? { note: "only the death year is given" } : undefined,
    }));
    return { records, skipped: skipped.map((s) => ({ ref: s.name, reason: s.reason })) };
  },
};

export default source;
