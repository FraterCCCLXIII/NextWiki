import Link from "next/link";
import { getStages } from "~/lib/kosmo/university";
import { CoverageBar } from "~/components/kosmo/university";

export const dynamic = "force-dynamic";
export const metadata = { title: "University" };

export default async function UniversityPage() {
  const { stages, overall } = await getStages();

  return (
    <div className="mx-auto max-w-5xl space-y-8 text-kosmo-text">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">University</h1>
        <p className="max-w-2xl text-lg text-kosmo-dim">
          A path of study from first questions to research, built around the atlas. Every
          lesson below is either an outline, a draft awaiting review, or reviewed and ready.
        </p>
      </header>

      <section className="rounded-lg border border-kosmo-line bg-kosmo-panel p-4">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 className="text-sm uppercase tracking-[0.14em] text-kosmo-dim">Coverage</h2>
          <span className="text-sm text-kosmo-dim">
            {overall.reviewed} of {overall.total} lessons reviewed
          </span>
        </div>
        <CoverageBar coverage={overall} />
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {stages.map((s) => (
          <li key={s.kuId}>
            <Link
              href={`/kosmo/university/${s.key}`}
              className="block h-full rounded-lg border border-kosmo-line bg-kosmo-panel p-4 transition-colors hover:border-kosmo-line2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-xl font-semibold">{s.name}</h3>
                <span className="shrink-0 text-xs text-kosmo-dim2">{s.ages}</span>
              </div>
              {s.blurb && <p className="mt-1 line-clamp-2 text-sm text-kosmo-dim">{s.blurb}</p>}
              <p className="mt-2 text-xs text-kosmo-dim2">
                {s.programmes} programmes · {s.modules} modules
              </p>
              <div className="mt-3">
                <CoverageBar coverage={s.coverage} />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-sm text-kosmo-dim2">
        Prefer the original interactive course map?{" "}
        <Link href="/kosmo/tools/university" className="text-kosmo-blue hover:underline">
          Open the classic University view
        </Link>
        .
      </p>
    </div>
  );
}
