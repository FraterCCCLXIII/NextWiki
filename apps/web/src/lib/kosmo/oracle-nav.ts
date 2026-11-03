/**
 * The Oracle lab's five groups, in the order its own nav used (oracle/theme.js):
 * the machine that produces, the planet it runs on, the conflicts it generates,
 * the minds that govern it, and the long clock all of it sits against.
 * `slug` is the /kosmo/tools/<slug> route, a key of KOSMO_TOOLS.
 */
export const ORACLE_GROUPS: { name: string; pages: { slug: string; label: string }[] }[] = [
  {
    name: "Machine",
    pages: [
      { slug: "oracle", label: "Dark Factory" },
      { slug: "oracle-robots", label: "Robots" },
      { slug: "oracle-abundance", label: "Abundance" },
      { slug: "oracle-markets", label: "Markets" },
    ],
  },
  {
    name: "Earth",
    pages: [
      { slug: "oracle-fuels", label: "Fuels" },
      { slug: "oracle-world", label: "World" },
      { slug: "oracle-freight", label: "Freight" },
      { slug: "oracle-metabolism", label: "Metabolism" },
    ],
  },
  {
    name: "Conflict",
    pages: [
      { slug: "oracle-war", label: "War" },
      { slug: "oracle-war-future", label: "War 10k" },
      { slug: "oracle-cyber", label: "Cyber" },
    ],
  },
  {
    name: "Minds",
    pages: [
      { slug: "oracle-development", label: "Development" },
      { slug: "oracle-religion", label: "Awakening" },
      { slug: "oracle-lineage", label: "Transmission" },
      { slug: "oracle-attractor", label: "Metacrisis" },
      { slug: "oracle-capacity", label: "Capacity" },
      { slug: "oracle-information", label: "Information" },
    ],
  },
  {
    name: "Time",
    pages: [
      { slug: "oracle-century", label: "Century" },
      { slug: "oracle-timeline", label: "Timeline" },
    ],
  },
];
