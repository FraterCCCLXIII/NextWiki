/**
 * The Kosmographica navigation, shared by the left sidebar (AtlasNav) and the header menu
 * (KosmoMenu). `prefix` makes a page active for any route that starts with it.
 */
export type NavPage = { href: string; label: string; prefix?: string };
export type NavGroup = { name: string; pages: NavPage[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    name: "Atlas",
    pages: [
      { href: "/kosmo", label: "Overview" },
      { href: "/kosmo/timeline", label: "Timeline" },
      { href: "/kosmo/tools/timeline", label: "Kosmographica" },
      { href: "/kosmo/pedia", label: "Kosmopedia" },
    ],
  },
  {
    name: "Study",
    pages: [{ href: "/kosmo/tools/university", label: "University" }],
  },
  {
    name: "Domains",
    pages: [
      { href: "/kosmo/domain/math", label: "Math" },
      { href: "/kosmo/domain/physics", label: "Physics" },
      { href: "/kosmo/tools/biology", label: "Biology" },
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
    ],
  },
  {
    name: "Lab",
    pages: [{ href: "/kosmo/tools/oracle", label: "Oracle", prefix: "/kosmo/tools/oracle" }],
  },
];

export function isNavActive(pathname: string, page: NavPage) {
  const { href, prefix } = page;
  if (href === "/kosmo") return pathname === "/kosmo";
  if (prefix) return pathname.startsWith(prefix);
  return pathname === href || pathname.startsWith(`${href}/`);
}

