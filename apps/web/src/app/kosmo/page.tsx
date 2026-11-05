import Link from "next/link";
import { StatTotals, DataList, DataRow } from "@repo/ui";
import { countsByKind, recentPages, wikiHref } from "~/lib/kosmo/queries";
import { BodyRow, type BodySpec } from "~/components/kosmo/BodyPoster";

export const dynamic = "force-dynamic";

type Section = { href: string; label: string; blurb: string; img: string; tag: string };

const TEX = "/kosmo/static/textures";
const HERO: Section = { href: "/kosmo/tools/timeline", label: "Timeline", blurb: "The universe, to scale, from the big bang onward.", img: `${TEX}/2k_sun.jpg`, tag: "Start here" };
const ROWS: { title: string; items: Section[] }[] = [
  {
    title: "Explore the atlas",
    items: [
      { href: "/kosmo/pedia", label: "Kosmopedia", blurb: "The catalog of everything the atlas covers.", img: `${TEX}/2k_jupiter.jpg`, tag: "Catalogue" },
      { href: "/kosmo/domain/math", label: "Math", blurb: "Numbers, structures and proofs.", img: `${TEX}/2k_neptune.jpg`, tag: "Domain" },
      { href: "/kosmo/domain/physics", label: "Physics", blurb: "Forces, particles and fields.", img: `${TEX}/2k_saturn.jpg`, tag: "Domain" },
      { href: "/kosmo/domain/philosophy", label: "Philosophy", blurb: "Questions that frame the other domains.", img: `${TEX}/2k_moon.jpg`, tag: "Domain" },
      { href: "/kosmo/domain/models", label: "Models", blurb: "Simplified pictures of how things work.", img: `${TEX}/2k_mars.jpg`, tag: "Domain" },
    ],
  },
  {
    title: "Study and build",
    items: [
      { href: "/kosmo/tools/university", label: "University", blurb: "A guided path of study through the atlas.", img: `${TEX}/2k_earth_daymap.jpg`, tag: "Learn" },
      { href: "/kosmo/tools/chemistry", label: "Chemistry", blurb: "Elements, bonds and reactions.", img: `${TEX}/2k_venus_surface.jpg`, tag: "Tool" },
      { href: "/kosmo/tools/spacecraft", label: "Spacecraft", blurb: "Every rocket and spacecraft, in 3D at true scale.", img: `${TEX}/2k_pluto.jpg`, tag: "Tool" },
      { href: "/kosmo/tools/space-access", label: "Space Access", blurb: "The lightest, cheapest way to orbit, the Moon and Mars.", img: `${TEX}/2k_mars.jpg`, tag: "Lab" },
      { href: "/kosmo/tools/shipyard", label: "Shipyard", blurb: "Design a ship, then fly it: stage, land, dock.", img: `${TEX}/2k_sun.jpg`, tag: "Lab" },
      { href: "/kosmo/tools/landing", label: "Landing Lab", blurb: "Land a rocket with ZEM/ZEV, a fuel-optimal solver or a neural net.", img: `${TEX}/2k_mars.jpg`, tag: "Lab" },
      { href: "/kosmo/tools/warp", label: "Warp Drive", blurb: "Alcubierre, Natário and Van den Broeck metrics: the Einstein tensor, the energy bill and light through the bubble.", img: `${TEX}/2k_neptune.jpg`, tag: "Lab" },
      { href: "/kosmo/tools/contraption", label: "Simulator", blurb: "Build and run small physical contraptions.", img: `${TEX}/2k_uranus.jpg`, tag: "Tool" },
    ],
  },
];

// opens the star map and flies to the body (the embed frame forwards ?go= to the atlas)
const go = (name: string) => `/kosmo/tools/timeline?go=${encodeURIComponent(name)}`;
const PLANETS: BodySpec[] = [
  { name: "Mercury", label: "Mercury", tag: "Planet", blurb: "The smallest planet, a cratered iron-rich world.", href: go("Mercury"), spec: { name: "Mercury", type: "planet", radius_m: 2.44e6, mass_kg: 3.3e23 }, glow: "rgba(200,180,150,0.25)" },
  { name: "Venus", label: "Venus", tag: "Planet", blurb: "A choked, sulphur-clouded greenhouse hotter than Mercury.", href: go("Venus"), spec: { name: "Venus", type: "planet", radius_m: 6.05e6, mass_kg: 4.87e24 }, glow: "rgba(255,190,110,0.3)" },
  { name: "Earth", label: "Earth", tag: "Planet", blurb: "The only world known to carry life.", href: go("Earth"), spec: { name: "Earth", type: "planet", radius_m: 6.37e6, mass_kg: 5.97e24 }, glow: "rgba(90,150,255,0.35)" },
  { name: "Mars", label: "Mars", tag: "Planet", blurb: "A cold red desert with the Solar System's tallest volcano.", href: go("Mars"), spec: { name: "Mars", type: "planet", radius_m: 3.39e6, mass_kg: 6.4e23 }, glow: "rgba(255,120,80,0.3)" },
  { name: "Jupiter", label: "Jupiter", tag: "Gas giant", blurb: "A planet bigger than all the others together.", href: go("Jupiter"), spec: { name: "Jupiter", type: "planet", radius_m: 7.15e7, mass_kg: 1.9e27 }, glow: "rgba(255,170,120,0.3)" },
  { name: "Saturn", label: "Saturn", tag: "Gas giant", blurb: "Banded, light enough to float, wrapped in ice rings.", href: go("Saturn"), spec: { name: "Saturn", type: "planet", radius_m: 6.0e7, mass_kg: 5.7e26 }, dist: 3.6, glow: "rgba(240,215,150,0.28)" },
  { name: "Uranus", label: "Uranus", tag: "Ice giant", blurb: "An ice giant knocked onto its side.", href: go("Uranus"), spec: { name: "Uranus", type: "planet", radius_m: 2.56e7, mass_kg: 8.7e25 }, glow: "rgba(130,230,235,0.3)" },
  { name: "Neptune", label: "Neptune", tag: "Ice giant", blurb: "A deep-blue world with the fastest winds known.", href: go("Neptune"), spec: { name: "Neptune", type: "planet", radius_m: 2.46e7, mass_kg: 1.02e26 }, glow: "rgba(70,110,255,0.35)" },
];
const CELESTIAL: BodySpec[] = [
  { name: "Sun", label: "The Sun", tag: "Star", blurb: "Our star: a boiling ball of plasma holding 99.9% of the Solar System's mass.", href: go("Sun"), spec: { name: "Sun", type: "star", radius_m: 6.96e8, mass_kg: 1.99e30, temperature_K: 5772 }, glow: "rgba(255,170,60,0.3)" },
  { name: "Moon", label: "The Moon", tag: "Moon", blurb: "Earth's companion, locked to show us one face.", href: go("Moon"), spec: { name: "Moon", type: "moon", radius_m: 1.74e6, mass_kg: 7.3e22 }, glow: "rgba(200,200,210,0.2)" },
  { name: "Pillars", label: "Pillars of Creation", tag: "Nebula", blurb: "Columns of gas and dust where new stars are being born.", href: go("Eagle Nebula"), spec: { name: "Pillars of Creation", type: "nebula", notes: "Pillars of Creation; Eagle Nebula M16 emission nebula" }, dist: 3.8, glow: "rgba(255,150,70,0.22)" },
  { name: "Crab", label: "Crab Nebula", tag: "Supernova remnant", blurb: "The wreck of a star that exploded in 1054, with a pulsar at its heart.", href: go("Crab Nebula"), spec: { name: "Crab Nebula", type: "supernova_remnant", notes: "Crab Nebula supernova remnant with pulsar wind nebula" }, dist: 3.8, glow: "rgba(100,200,220,0.2)" },
  { name: "Andromeda", label: "Andromeda", tag: "Galaxy", blurb: "Our nearest big neighbour, 2.5 million light-years away.", href: go("Andromeda Galaxy"), spec: { name: "Andromeda Galaxy", type: "galaxy", radius_m: 7.2e20, notes: "Spiral galaxy; morphology: SA(s)b" }, dist: 3.2, glow: "rgba(150,170,255,0.22)" },
  { name: "Sgr A*", label: "Sagittarius A*", tag: "Black hole", blurb: "The four-million-sun black hole at the centre of our galaxy.", href: go("Sagittarius A*"), spec: { name: "Sgr A*", type: "black_hole", radius_m: 1.27e10 }, dist: 3.6, glow: "rgba(255,160,80,0.18)" },
  { name: "Crab Pulsar", label: "Crab Pulsar", tag: "Neutron star", blurb: "A city-sized star spinning thirty times a second.", href: go("Crab Pulsar"), spec: { name: "Crab Pulsar", type: "pulsar", radius_m: 1.2e4 }, dist: 3.8, glow: "rgba(130,170,255,0.25)" },
  { name: "Great Hercules Cluster", label: "Great Hercules Cluster", tag: "Star cluster", blurb: "Messier 13: a swarm of several hundred thousand ancient stars.", href: go("Great Hercules Cluster"), spec: { name: "Great Hercules Cluster", type: "star_cluster", radius_m: 7.0e17 }, dist: 3.2, glow: "rgba(255,230,180,0.2)" },
];

/** A poster tile: a world as backdrop, a dark grade up from the bottom, the title big, the blurb sliding up on hover; neighbours dim and the tile lifts. */
function Poster({ s, index }: { s: Section; index: number }) {
  return (
    <li className="w-[min(78vw,22rem)] shrink-0 snap-start transition-opacity duration-300">
      <Link
        href={s.href}
        className="group relative block aspect-[16/10] overflow-hidden rounded-xl bg-black outline-none ring-0 transition-all duration-300 ease-out hover:z-20 hover:scale-[1.08] hover:shadow-[0_18px_60px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.18)] focus-visible:scale-[1.08] focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-90 transition-transform duration-[900ms] ease-out group-hover:scale-125"
          style={{ backgroundImage: `url(${s.img})` }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10 transition-opacity duration-300 group-hover:from-black/95" />
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,255,255,0.08),transparent_55%)]" />
        <span className="absolute left-4 top-3 text-[11px] font-medium uppercase tracking-[0.28em] text-white/60">{s.tag}</span>
        <span className="absolute right-4 top-2 text-3xl font-black tabular-nums text-white/15">{String(index + 1).padStart(2, "0")}</span>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="block text-3xl font-bold leading-none tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">{s.label}</span>
          <span className="mt-2 block max-h-0 translate-y-2 text-sm leading-snug text-white/80 opacity-0 transition-all duration-300 group-hover:max-h-16 group-hover:translate-y-0 group-hover:opacity-100">
            {s.blurb}
          </span>
        </div>
      </Link>
    </li>
  );
}

export default async function KosmoHomePage() {
  const [kinds, recent] = await Promise.all([countsByKind(), recentPages(8)]);
  const total = kinds.reduce((sum, k) => sum + k.count, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <div>
        <h1 className="mb-4 text-[clamp(3.5rem,10vw,9rem)] font-bold leading-[0.95] tracking-tight text-kosmo-text">Kosmographica</h1>
        <p className="mb-8 text-lg text-kosmo-dim">
          A map of everything, to scale. Pick a section to begin.
        </p>
        <StatTotals
          items={[
            { label: "entries", value: total },
            ...kinds.map((k) => ({ label: k.kind, value: k.count })),
          ]}
        />
      </div>

      {/* billboard: the one place to begin */}
      <Link
        href={HERO.href}
        className="group relative block min-h-[22rem] overflow-hidden rounded-2xl bg-black shadow-[0_24px_80px_rgba(0,0,0,0.6)] md:min-h-[30rem]"
      >
        <div aria-hidden="true" className="absolute inset-0 scale-105 bg-cover bg-center transition-transform duration-[1400ms] ease-out group-hover:scale-110" style={{ backgroundImage: `url(${HERO.img})` }} />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        <div className="relative flex min-h-[22rem] max-w-xl flex-col justify-end gap-4 p-8 md:min-h-[30rem] md:p-12">
          <span className="text-xs font-medium uppercase tracking-[0.34em] text-white/60">{HERO.tag}</span>
          <span className="text-[clamp(3rem,7vw,6rem)] font-black leading-[0.9] tracking-tight text-white">{HERO.label}</span>
          <span className="text-lg text-white/80 md:text-xl">{HERO.blurb}</span>
          <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-md bg-white px-6 py-3 text-base font-semibold text-black transition-colors group-hover:bg-white/85">
            ▶ Enter the Timeline
          </span>
        </div>
      </Link>

      {ROWS.map((row) => (
        <section key={row.title} className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-kosmo-text">{row.title}</h2>
          <ul className="kosmo-scroll m-0 flex list-none snap-x gap-4 overflow-x-auto overflow-y-visible px-1 pb-8 pt-3 [&:hover_li:not(:hover)]:opacity-50">
            {row.items.map((s, i) => (
              <Poster key={s.href} s={s} index={i} />
            ))}
          </ul>
        </section>
      ))}

      <BodyRow title="Planets, live" items={PLANETS} />
      <BodyRow title="Stars, nebulae, galaxies and black holes, live" items={CELESTIAL} />

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Recently updated</h2>
          <DataList>
            {recent.map((r) => {
              const href = wikiHref(r.path);
              return (
                <DataRow
                  key={r.slug}
                  label={
                    href ? (
                      <Link href={href} className="hover:text-kosmo-mint">
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )
                  }
                >
                  <span className="text-kosmo-dim">
                    {r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : ""}
                  </span>
                </DataRow>
              );
            })}
          </DataList>
        </section>
      )}
    </div>
  );
}
