import path from "node:path";
import { cleanText } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";
import { readCsv } from "./_csv.js";

/**
 * Discovery dates from the Kosmographica object catalogue (kosmographica-app/catalog/objects.csv).
 * Only rows with a numeric discovery_year become events. Exoplanets are kept only when found before 2000,
 * because the archive holds about 6,400 planets and most of them are survey detections with no story.
 * The CSV has no spacecraft rows, so no launch events come from this source.
 */

const EXOPLANET_MAX_YEAR = 1999;
const WIKI_URL = /https?:\/\/en\.wikipedia\.org\/wiki\/[^\s|]+/;

const LANE_BY_TYPE: Record<string, string> = {
  planet: "Planets & moons",
  dwarf_planet: "Planets & moons",
  moon: "Planets & moons",
  exoplanet: "Exoplanets",
  exomoon_candidate: "Exoplanets",
  star: "Stars",
  white_dwarf: "Stars",
  neutron_star: "Stars",
  pulsar: "Stars",
  galaxy: "Galaxies",
  galaxy_cluster: "Galaxies",
  supercluster: "Galaxies",
  nebula: "Nebulae & clusters",
  star_cluster: "Nebulae & clusters",
  supernova_remnant: "Nebulae & clusters",
  black_hole: "Black holes & quasars",
  quasar: "Black holes & quasars",
  asteroid: "Small bodies & other",
  comet: "Small bodies & other",
  other: "Small bodies & other",
};

const splitList = (s: string | undefined) =>
  (s ?? "").split(" | ").map((x) => x.trim()).filter(Boolean);

const source: TimelineSource = {
  id: "kosmo-catalogue",
  label: "Kosmographica discoveries & missions",
  license: "Mixed: NASA data, Wikipedia (CC BY-SA), Wikidata (CC0); see kosmographica-app/catalog/README.md",
  trustTier: "tertiary",
  async load({ root }): Promise<TimelineBundle> {
    const file = path.join(root, "kosmographica-app", "catalog", "objects.csv");
    const [header = [], ...body] = readCsv(file);
    const records: TimelineRecord[] = [];
    const skipped: { ref: string; reason: string }[] = [];

    body.forEach((cells, i) => {
      const r: Record<string, string> = {};
      header.forEach((h, j) => (r[h] = cells[j] ?? ""));
      const ref = `objects.csv row ${i + 2}`;
      const year = r.discovery_year?.trim() ?? "";
      if (!year) return;
      if (!/^\d{1,4}$/.test(year)) {
        skipped.push({ ref, reason: `discovery_year not a year: ${year}` });
        return;
      }
      if (!r.name?.trim()) {
        skipped.push({ ref, reason: "no name" });
        return;
      }
      const type = r.type?.trim() || "other";
      const start = Number(year);
      if (type === "exoplanet" && start > EXOPLANET_MAX_YEAR) return;

      const wiki = WIKI_URL.exec(r.discovery_source ?? "")?.[0];
      const parts = [
        r.discovered_by && `by ${r.discovered_by}`,
        r.discovery_method && `method: ${r.discovery_method}`,
        r.discovery_facility && `facility: ${r.discovery_facility}`,
      ].filter(Boolean) as string[];
      const summary = cleanText([parts.join(", "), r.discovery_note].filter(Boolean).join(". "));

      const sources = [...new Set([...splitList(r.source), ...splitList(r.discovery_source)])];
      const externalIds: NonNullable<TimelineRecord["externalIds"]> = [{ scheme: "kosmographica", value: r.id ?? "" }];
      if (wiki) {
        const title = decodeURIComponent(wiki.split("/wiki/")[1] ?? "");
        externalIds.push({ scheme: "wikipedia", value: title, url: wiki });
      }

      records.push({
        key: r.id ?? "",
        dataset: "kosmo-catalogue",
        datasetLabel: "Kosmographica discoveries & missions",
        kind: "event",
        type: "discovery",
        name: `Discovery of ${cleanText(r.name)}`,
        ...(summary ? { summary } : {}),
        start,
        lane: LANE_BY_TYPE[type] ?? "Small bodies & other",
        confidence: "medium",
        ...(sources.length ? { sources } : {}),
        externalIds,
        rank: wiki ? 0.6 : 0.3,
        data: {
          objectType: type,
          ...(r.parent ? { parent: r.parent } : {}),
          ...(r.discovered_by ? { discoveredBy: r.discovered_by } : {}),
        },
      });
    });

    return { records, skipped };
  },
};

export default source;
