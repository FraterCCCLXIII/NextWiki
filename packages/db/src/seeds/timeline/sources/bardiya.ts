import path from "node:path";
import { readCsv } from "./_csv.js";
import { cleanText, parseDateText } from "../dates.js";
import { bardiyaLane } from "../normalize.js";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";

/**
 * Achaemenid / Bardiya timeline (Messiah repo). Column 0 is the BCE period, column 1 the
 * region/group (used as the lane), column 2 the event, then significance, key figures, notes.
 */
const DATASET = "bardiya";
const LABEL = "Bardiya & Achaemenid";
const FILE = "Messiah/docs/appendices/achaemenid-bardiya-timeline.csv";

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

const source: TimelineSource = {
  id: "bardiya",
  label: LABEL,
  trustTier: "tertiary",
  async load({ root }) {
    const rows = readCsv(path.join(root, FILE));
    const records: TimelineRecord[] = [];
    const skipped: NonNullable<TimelineBundle["skipped"]> = [];

    rows.slice(1).forEach((r, i) => {
      const n = i + 1;
      const when = cleanText(r[0]);
      const ref = `${FILE}:row ${n}`;
      const parsed = parseDateText(when, "BCE");
      if (!parsed) return void skipped.push({ ref, reason: `unparseable period "${when}"` });

      const ev = cleanText(r[2]);
      const region = cleanText(r[1]) || "Bardiya";
      const span = parsed.end != null ? parsed.end - parsed.start : 0;
      const kind: "event" | "period" = parsed.end != null && span > 60 ? "period" : "event";
      const summary = [
        ev,
        cleanText(r[3]) && `Significance: ${cleanText(r[3])}`,
        cleanText(r[4]) && `Key figures: ${cleanText(r[4])}`,
        cleanText(r[5]) && `Notes: ${cleanText(r[5])}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      records.push({
        key: `row-${n}`,
        dataset: DATASET,
        datasetLabel: LABEL,
        kind,
        name: trunc(ev || region, 90),
        summary: summary || undefined,
        start: parsed.start,
        end: parsed.end,
        approx: parsed.approx || undefined,
        lane: bardiyaLane(region),
        region,
        sources: [FILE],
        rank: kind === "period" ? Math.min(1, 0.5 + 0.3 * Math.min(1, span / 2000)) : 0.3,
        data: { dateText: when },
      });
    });

    return { records, relations: [], skipped };
  },
};

export default source;
