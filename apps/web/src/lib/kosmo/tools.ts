/**
 * Original Kosmographica HTML pages served from /kosmo/static/ and embedded at
 * /kosmo/tools/<slug>. Slug -> file name inside public/kosmo/static/.
 * `group` drives the header menu; drop an entry once its page is rebuilt as a
 * NextWiki component.
 */
export type KosmoToolGroup = "atlas" | "oracle";

export const KOSMO_TOOLS: Record<
  string,
  { file: string; title: string; group: KosmoToolGroup }
> = {
  university: { file: "university.html", title: "University", group: "atlas" },
  timeline: { file: "universe-timeline.html", title: "Universe timeline", group: "atlas" },
  chemistry: { file: "chemistry.html", title: "Chemistry", group: "atlas" },
  biology: { file: "biology.html", title: "Biology", group: "atlas" },
  contraption: { file: "contraption-sim.html", title: "Contraption simulator", group: "atlas" },

  oracle: { file: "oracle/index.html", title: "Dark Factory", group: "oracle" },
  "oracle-abundance": { file: "oracle/abundance.html", title: "Abundance", group: "oracle" },
  "oracle-attractor": { file: "oracle/attractor.html", title: "Third attractor", group: "oracle" },
  "oracle-capacity": { file: "oracle/capacity.html", title: "Capacity", group: "oracle" },
  "oracle-century": { file: "oracle/century.html", title: "Century", group: "oracle" },
  "oracle-cyber": { file: "oracle/cyber.html", title: "Cyber", group: "oracle" },
  "oracle-development": { file: "oracle/development.html", title: "Development", group: "oracle" },
  "oracle-freight": { file: "oracle/freight.html", title: "Freight", group: "oracle" },
  "oracle-fuels": { file: "oracle/fuels.html", title: "Fuels", group: "oracle" },
  "oracle-information": { file: "oracle/information.html", title: "Information", group: "oracle" },
  "oracle-lineage": { file: "oracle/lineage.html", title: "Transmission", group: "oracle" },
  "oracle-markets": { file: "oracle/markets.html", title: "Markets", group: "oracle" },
  "oracle-metabolism": { file: "oracle/metabolism.html", title: "Metabolism", group: "oracle" },
  "oracle-religion": { file: "oracle/religion.html", title: "Awakening", group: "oracle" },
  "oracle-robots": { file: "oracle/robots.html", title: "Robots", group: "oracle" },
  "oracle-timeline": { file: "oracle/timeline.html", title: "Abacus to Singularity", group: "oracle" },
  "oracle-war": { file: "oracle/war.html", title: "War", group: "oracle" },
  "oracle-war-future": { file: "oracle/war-future.html", title: "War, to 10,000", group: "oracle" },
  "oracle-world": { file: "oracle/world.html", title: "World", group: "oracle" },
};

export function kosmoToolSrc(slug: string): string | null {
  const tool = Object.prototype.hasOwnProperty.call(KOSMO_TOOLS, slug)
    ? KOSMO_TOOLS[slug]
    : undefined;
  return tool ? `/kosmo/static/${tool.file}` : null;
}
