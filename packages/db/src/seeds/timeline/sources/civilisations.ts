import fs from "node:fs";
import path from "node:path";
import { cleanText, fromHistorical, parseDateText, slugifyKey } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";

/**
 * Civilisations from the time-thread-web data: cultures.json (historical signed years) and the
 * timelines/*.json files. The cosmogenesis and comprehensive timelines are skipped; the same
 * civilisation appearing in several files is kept once (name + start + end).
 */
const DATASET = "civilisations";
const LABEL = "Civilisations";
const DIR = "time-thread-web/public/data";
const SKIP_TIMELINE = /cosmogenesis|comprehensive/i;

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function uniqueKey(base: string, taken: Set<string>): string {
  let key = base;
  for (let i = 2; taken.has(slugifyKey(key) || key); i++) key = `${base}-${i}`;
  taken.add(slugifyKey(key) || key);
  return key;
}

const rankOf = (kind: "event" | "period", start: number, end?: number) =>
  kind === "event" || end == null ? 0.3 : Math.min(1, 0.4 + (end - start) / 4000);

const source: TimelineSource = {
  id: "civilisations",
  label: LABEL,
  trustTier: "tertiary",
  async load({ root }) {
    const base = path.join(root, DIR);
    const records: TimelineRecord[] = [];
    const skipped: NonNullable<TimelineBundle["skipped"]> = [];
    const taken = new Set<string>();
    const dedupe = new Set<string>();

    const push = (r: Omit<TimelineRecord, "dataset" | "datasetLabel">, ref: string) => {
      if (!Number.isFinite(r.start)) return void skipped.push({ ref, reason: "no usable start year" });
      if (r.end != null && r.end < r.start) [r.start, r.end] = [r.end, r.start];
      if (r.end === r.start) delete r.end;
      const dupKey = `${cleanText(r.name).toLowerCase()}|${r.start}|${r.end ?? ""}`;
      if (dedupe.has(dupKey)) return void skipped.push({ ref, reason: "duplicate of an earlier civilisation" });
      dedupe.add(dupKey);
      r.key = uniqueKey(r.key, taken);
      records.push({ ...r, dataset: DATASET, datasetLabel: LABEL });
    };

    // 1. cultures.json: { cultures: [{ id, name, start, end, region, description }] }, historical years.
    const cultures = JSON.parse(fs.readFileSync(path.join(base, "cultures.json"), "utf8")).cultures ?? [];
    for (const c of cultures) {
      const start = fromHistorical(c.start);
      const end = c.end != null ? fromHistorical(c.end) : undefined;
      const region = cleanText(c.region) || undefined;
      push(
        {
          key: `culture-${c.id}`,
          kind: "period",
          type: "civilisation",
          name: cleanText(c.name),
          summary: c.description ? trunc(cleanText(c.description), 900) : undefined,
          start,
          end,
          lane: region ?? "Unassigned",
          region,
          sources: [`${DIR}/cultures.json`],
          rank: rankOf("period", start, end),
        },
        `cultures.json:${c.id}`,
      );
    }

    // 2. timelines/*.json: either { rows: [{ name, events: [{ start, end, visualType }] }] } with
    //    historical years, or { events: [{ date: "1600 BCE" }] } with free-text dates (no era = CE).
    const tdir = path.join(base, "timelines");
    const files = fs.readdirSync(tdir).filter((x) => x.endsWith(".json") && !SKIP_TIMELINE.test(x)).sort();
    for (const f of files) {
      const j = JSON.parse(fs.readFileSync(path.join(tdir, f), "utf8"));
      const tag = f.replace(/\.json$/, "");
      const file = `${DIR}/timelines/${f}`;
      if (Array.isArray(j.rows)) {
        for (const row of j.rows) {
          for (const ev of row.events ?? []) {
            const start = fromHistorical(ev.start);
            const end = ev.end != null ? fromHistorical(ev.end) : undefined;
            const kind: "event" | "period" = ev.visualType === "dot" ? "event" : "period";
            push(
              {
                key: `${tag}-${ev.id}`,
                kind,
                name: cleanText(ev.name),
                summary: ev.description ? trunc(cleanText(ev.description), 900) : undefined,
                start,
                end,
                approx: ev.fadeStart || ev.fadeEnd ? true : undefined,
                lane: cleanText(row.name) || j.name || tag,
                region: cleanText(ev.region) || undefined,
                sources: [file],
                rank: rankOf(kind, start, end),
              },
              `${f}:${ev.id}`,
            );
          }
        }
      } else if (Array.isArray(j.events)) {
        for (const ev of j.events) {
          const ref = `${f}:${ev.id}`;
          const parsed = parseDateText(ev.date ?? "", "CE");
          if (!parsed) {
            skipped.push({ ref, reason: `unparseable date "${cleanText(ev.date)}"` });
            continue;
          }
          const kind: "event" | "period" = parsed.end != null ? "period" : "event";
          push(
            {
              key: `${tag}-${ev.id}`,
              kind,
              name: cleanText(ev.title ?? ev.name),
              summary: ev.description ? trunc(cleanText(ev.description), 900) : undefined,
              start: parsed.start,
              end: parsed.end,
              approx: parsed.approx || undefined,
              lane: cleanText(ev.region) || cleanText(j.name) || tag,
              region: cleanText(ev.region) || undefined,
              data: { dateText: cleanText(ev.date) },
              sources: [file],
              rank: rankOf(kind, parsed.start, parsed.end),
            },
            ref,
          );
        }
      }
    }

    return { records, relations: [], skipped };
  },
};

export default source;
