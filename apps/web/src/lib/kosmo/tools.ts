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
  scale: { file: "scale.html", title: "Scale of things", group: "atlas" },
  chemistry: { file: "chemistry.html", title: "Chemistry", group: "atlas" },
  biology: { file: "biology.html", title: "Biology", group: "atlas" },
  dinosaurs: { file: "dinosaurs.html", title: "Dinosaurs", group: "atlas" },
  spacecraft: { file: "spacecraft.html", title: "Spacecraft", group: "atlas" },
  shipyard: { file: "shipyard.html", title: "Shipyard", group: "atlas" },
  centauri: { file: "centauri-lab.html", title: "Centauri Fleet", group: "atlas" },
  landing: { file: "landing-lab.html", title: "Landing Lab", group: "atlas" },
  baton: { file: "baton-lab.html", title: "Baton Lab", group: "atlas" },
  flightlab: { file: "flight-lab.html", title: "Flight Lab", group: "atlas" },
  warp: { file: "warp-lab.html", title: "Warp Drive Lab", group: "atlas" },
  "space-access": { file: "space-access.html", title: "Space Access", group: "atlas" },
  settlement: { file: "settlement-lab.html", title: "Settlement Lab", group: "atlas" },
  contraption: { file: "contraption-sim.html", title: "Contraption simulator", group: "atlas" },
  graph: { file: "graph.html", title: "Graph & calculator", group: "atlas" },
  flight: { file: "flight/index.html", title: "Orbital Flight Deck", group: "atlas" },
  "flight-deck": { file: "flight/deck.html", title: "Flight deck console", group: "atlas" },
  "flight-dynamics": { file: "flight/dynamics.html", title: "Flight dynamics", group: "atlas" },
  effects: { file: "effects.html", title: "Effects lab", group: "atlas" },
  "nebula-lab": { file: "nebula-lab.html", title: "Nebula lab", group: "atlas" },
  "ring-lab": { file: "ring-lab.html", title: "Ring lab", group: "atlas" },
  "telescope-fx": { file: "telescope-fx.html", title: "Telescope effects", group: "atlas" },
  "link-lab": { file: "link-lab/index.html", title: "Space Radio link lab", group: "atlas" },
  "relay-map": { file: "relay-map/index.html", title: "Solar relay atlas", group: "atlas" },
  "solar-lens": { file: "solar-lens/index.html", title: "Solar gravitational lens", group: "atlas" },
  "solar-lens-imaging": { file: "solar-lens/imaging.html", title: "Solar lens imaging", group: "atlas" },
  lightspeed: { file: "lightspeed/index.html", title: "Lightspeed", group: "atlas" },
  "cosmic-atlas": { file: "cosmic-atlas/index.html", title: "Cosmic Atlas", group: "atlas" },

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

const DOMAIN_SLUGS = ["math", "physics", "philosophy", "models"];

/**
 * Where a link found inside an embedded static page really lives in the Next.js app, or null if it is not one of ours.
 * Embedded pages link to each other by file name (chemistry.html, domain.html?d=math, kosmopedia.html); those would only
 * navigate the iframe and leave the address bar, header and back button behind. `href` must already be absolute
 * (an anchor's .href, or location.href), which also resolves relative links such as lineage.html inside /oracle/.
 */
export function kosmoRouteForUrl(href: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const m = url.pathname.match(/^\/kosmo\/static\/(.+)$/);
  if (!m) return null;
  const file = m[1]!;
  const tail = `${url.search}${url.hash}`;
  const slug = Object.keys(KOSMO_TOOLS).find((k) => KOSMO_TOOLS[k]!.file === file);
  if (slug) return `/kosmo/tools/${slug}${tail}`;
  if (file === "domain.html") {
    const d = url.searchParams.get("d") ?? "";
    return DOMAIN_SLUGS.includes(d) ? `/kosmo/domain/${d}${url.hash}` : null;
  }
  if (file === "kosmopedia.html") return `/kosmo/pedia${url.hash}`;
  return null;
}
