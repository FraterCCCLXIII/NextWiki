import Link from "next/link";
import { notFound } from "next/navigation";
import { getStage } from "~/lib/kosmo/university";
import { CoverageBar } from "~/components/kosmo/university";

export const dynamic = "force-dynamic";

export default async function UniversityStagePage({ params }: { params: Promise<{ stage: string }> }) {
  const { stage: key } = await params;
  const data = await getStage(key);
  if (!data) notFound();
  const { stage, programmes } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 text-kosmo-text">
      <nav className="text-sm text-kosmo-dim">
        <Link href="/kosmo/university" className="hover:underline">
          University
        </Link>{" "}
        / {stage.name}
      </nav>
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">{stage.name}</h1>
        <p className="text-kosmo-dim">
          {stage.ages} · {stage.programmes} programmes · {stage.modules} modules
        </p>
        {stage.blurb && <p className="max-w-2xl text-kosmo-dim">{stage.blurb}</p>}
        <div className="max-w-xl pt-1">
          <CoverageBar coverage={stage.coverage} />
        </div>
      </header>

      {programmes.map((p) => (
        <section key={p.kuId} className="rounded-lg border border-kosmo-line bg-kosmo-panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold">{p.name}</h2>
            <span className="text-xs text-kosmo-dim2">{p.kuId}</span>
          </div>
          <div className="mt-2 max-w-md">
            <CoverageBar coverage={p.coverage} compact />
          </div>
          <ul className="mt-3 divide-y divide-kosmo-line">
            {p.modules.map((m) => (
              <li key={m.kuId}>
                <Link
                  href={`/kosmo/university/${stage.key}/${m.kuId.toLowerCase()}`}
                  className="flex items-center justify-between gap-4 py-2 hover:text-kosmo-mint"
                >
                  <span>{m.name}</span>
                  <span className="shrink-0 text-xs text-kosmo-dim">
                    {m.coverage.reviewed + m.coverage.drafted > 0 && (
                      <span className="mr-2 text-kosmo-amber">
                        {m.coverage.reviewed} reviewed · {m.coverage.drafted} drafted
                      </span>
                    )}
                    {m.lessons} lessons
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
