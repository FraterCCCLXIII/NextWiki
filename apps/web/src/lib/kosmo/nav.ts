/**
 * The Kosmographica navigation, shared by the left sidebar (AtlasNav) and the header menu
 * (KosmoMenu). `prefix` makes a page active for any route that starts with it.
 */
export type NavPage = {
  href: string;
  label: string;
  prefix?: string;
  /** sub-heading this page sits under inside its group (rendered once, where it changes) */
  section?: string;
  /** small right-aligned detail, e.g. a size or power */
  meta?: string;
  /** active when the page has none of the query keys its siblings use (the view a bare URL opens) */
  isDefault?: boolean;
};
export type NavGroup = { name: string; pages: NavPage[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    name: "Atlas",
    pages: [
      { href: "/kosmo", label: "Overview" },
      { href: "/kosmo/timeline", label: "Timeline" },
      { href: "/kosmo/tools/timeline", label: "Kosmographica" },
      { href: "/kosmo/tools/scale", label: "Scale" },
      { href: "/kosmo/pedia", label: "Kosmopedia" },
    ],
  },
  {
    name: "Listen",
    pages: [{ href: "/kosmo/radio", label: "Space Radio" }],
  },
  {
    name: "Study",
    pages: [
      { href: "/kosmo/university", label: "Courses", prefix: "/kosmo/university" },
      { href: "/kosmo/tools/university", label: "University" },
    ],
  },
  {
    name: "Domains",
    pages: [
      { href: "/kosmo/domain/math", label: "Math" },
      { href: "/kosmo/domain/physics", label: "Physics" },
      { href: "/kosmo/tools/biology", label: "Biology" },
      { href: "/kosmo/tools/dinosaurs", label: "Dinosaurs" },
      { href: "/life", label: "Life", prefix: "/life" },
      { href: "/kosmo/domain/philosophy", label: "Philosophy" },
      { href: "/kosmo/domain/models", label: "Models" },
    ],
  },
  {
    name: "Tools",
    pages: [
      { href: "/kosmo/tools/chemistry", label: "Chemistry" },
      { href: "/kosmo/tools/spacecraft", label: "Spacecraft" },
      { href: "/kosmo/tools/contraption", label: "Simulator" },
      { href: "/kosmo/tools/flight", label: "Flight deck" },
      { href: "/kosmo/tools/graph", label: "Graph" },
    ],
  },
  {
    name: "Link Lab",
    pages: [
      { href: "/kosmo/tools/link-lab?node=beacon", label: "Beacon", meta: "6U", section: "Orbital nodes" },
      { href: "/kosmo/tools/link-lab?node=compact", label: "Compact relay", meta: "1.2 m dish", section: "Orbital nodes" },
      { href: "/kosmo/tools/link-lab?node=solar", label: "Solar relay", meta: "6 m dishes", section: "Orbital nodes" },
      { href: "/kosmo/tools/link-lab?node=relay", label: "Nuclear relay", meta: "6 m dishes", section: "Orbital nodes", isDefault: true },
      { href: "/kosmo/tools/link-lab?node=archive", label: "Archive node", meta: "0.9 m core", section: "Orbital nodes" },
      { href: "/kosmo/tools/link-lab?rig=0", label: "Desktop beacon", meta: "0.6 m · 5 W", section: "Earth transmitters" },
      { href: "/kosmo/tools/link-lab?rig=1", label: "Backyard dish", meta: "1.8 m · 50 W", section: "Earth transmitters" },
      { href: "/kosmo/tools/link-lab?rig=2", label: "Research dish", meta: "3 m · 250 W", section: "Earth transmitters" },
      { href: "/kosmo/tools/link-lab?rig=3", label: "Small research station", meta: "6 m · 1 kW", section: "Earth transmitters" },
      { href: "/kosmo/tools/link-lab?rig=4", label: "Institutional station", meta: "12 m · 5 kW", section: "Earth transmitters" },
      { href: "/kosmo/tools/link-lab?rig=5", label: "Deep-space scale", meta: "70 m · 20 kW", section: "Earth transmitters" },
      { href: "/kosmo/tools/link-lab?page=network", label: "Transmission network", section: "Network" },
      { href: "/kosmo/tools/link-lab?page=cost", label: "Cost calculator", section: "Network" },
      { href: "/kosmo/tools/centauri", label: "Centauri fleet", section: "Other craft" },
      { href: "/kosmo/tools/solar-lens", label: "Einstein ring telescope", meta: "OBS-01 · 650 AU", section: "Other craft" },
    ],
  },
  {
    name: "Lab",
    pages: [
      { href: "/kosmo/tools/flightlab", label: "Flight Lab", prefix: "/kosmo/tools/flightlab" },
      { href: "/kosmo/tools/baton", label: "Baton" },
      { href: "/kosmo/tools/warp", label: "Warp Drive" },
      { href: "/kosmo/tools/space-access", label: "Space Access" },
      { href: "/kosmo/tools/settlement", label: "Settlement" },
      { href: "/kosmo/tools/relay-map", label: "Relay Atlas" },
      { href: "/kosmo/tools/solar-lens", label: "Solar Lens" },
      { href: "/kosmo/tools/solar-lens-imaging", label: "Lens Imaging" },
      { href: "/kosmo/tools/lightspeed", label: "Lightspeed" },
      { href: "/kosmo/tools/cosmic-atlas", label: "Cosmic Atlas" },
      { href: "/kosmo/tools/oracle", label: "Oracle", prefix: "/kosmo/tools/oracle" },
    ],
  },
];

/**
 * Pages whose href carries a query (the Link Lab views) are active only when the path and every query key match.
 * `isDefault` marks the view a bare URL opens, active when none of the group's query keys is present.
 */
export function isNavActive(pathname: string, page: NavPage, search?: URLSearchParams | null) {
  const { href, prefix } = page;
  const q = href.indexOf("?");
  if (q >= 0) {
    const path = href.slice(0, q);
    if (pathname !== path) return false;
    const want = new URLSearchParams(href.slice(q + 1));
    const have = search ?? new URLSearchParams();
    const keys = ["node", "rig", "page"];
    if (page.isDefault && !keys.some((k) => have.has(k))) return true;
    return [...want.entries()].every(([k, v]) => have.get(k) === v);
  }
  if (href === "/kosmo") return pathname === "/kosmo";
  if (prefix) return pathname.startsWith(prefix);
  return pathname === href || pathname.startsWith(`${href}/`);
}
