import Link from "next/link";

const SECTIONS = [
  { href: "/kosmo/tools/timeline", label: "Timeline", blurb: "The universe, to scale, from the big bang onward." },
  { href: "/kosmo/pedia", label: "Kosmopedia", blurb: "The catalog of everything the atlas covers." },
  { href: "/kosmo/domain/math", label: "Math", blurb: "Numbers, structures and proofs." },
  { href: "/kosmo/domain/physics", label: "Physics", blurb: "Forces, particles and fields." },
  { href: "/kosmo/domain/philosophy", label: "Philosophy", blurb: "Questions that frame the other domains." },
  { href: "/kosmo/domain/models", label: "Models", blurb: "Simplified pictures of how things work." },
  { href: "/kosmo/tools/university", label: "University", blurb: "A guided path of study through the atlas." },
  { href: "/kosmo/tools/chemistry", label: "Chemistry", blurb: "Elements, bonds and reactions." },
  { href: "/kosmo/tools/contraption", label: "Simulator", blurb: "Build and run small physical contraptions." },
];

export default function KosmoHomePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-3 text-3xl font-semibold">Kosmographica</h1>
      <p className="mb-8 text-kosmo-dim">
        A map of everything, to scale. Pick a section to begin.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="block rounded border border-kosmo-line bg-kosmo-panel p-4 hover:border-kosmo-mint"
            >
              <span className="block font-medium text-kosmo-mint">{s.label}</span>
              <span className="block text-sm text-kosmo-dim">{s.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
