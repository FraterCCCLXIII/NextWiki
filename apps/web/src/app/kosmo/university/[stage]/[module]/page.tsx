import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "~/lib/kosmo/university";
import { CoverageBar, StatusBadge } from "~/components/kosmo/university";

export const dynamic = "force-dynamic";

export default async function UniversityModulePage({
  params,
}: {
  params: Promise<{ stage: string; module: string }>;
}) {
  const { stage, module: moduleParam } = await params;
  const mod = await getModule(moduleParam.toUpperCase());
  if (!mod || mod.stage !== stage) notFound();

  const href = (kuId: string, s: string) => `/kosmo/university/${s}/${kuId.toLowerCase()}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 text-kosmo-text">
      <nav className="text-sm text-kosmo-dim">
        <Link href="/kosmo/university" className="hover:underline">
          University
        </Link>{" "}
        /{" "}
        <Link href={`/kosmo/university/${stage}`} className="hover:underline">
          {stage}
        </Link>{" "}
        / {mod.programme}
      </nav>
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">{mod.name}</h1>
        <p className="text-sm text-kosmo-dim2">{mod.kuId}</p>
        <div className="max-w-xl">
          <CoverageBar coverage={mod.coverage} />
        </div>
      </header>

      {mod.requires.length > 0 && (
        <p className="text-sm text-kosmo-dim">
          Builds on:{" "}
          {mod.requires.map((r, i) => (
            <span key={r.kuId}>
              {i > 0 && ", "}
              <Link href={href(r.kuId, r.stage)} className="text-kosmo-blue hover:underline">
                {r.name}
              </Link>
            </span>
          ))}
        </p>
      )}

      <ol className="divide-y divide-kosmo-line rounded-lg border border-kosmo-line bg-kosmo-panel">
        {mod.lessons.map((l, i) => (
          <li key={l.kuId}>
            <Link
              href={`/kosmo/university/${stage}/${mod.kuId.toLowerCase()}/${l.kuId.toLowerCase()}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-kosmo-line/40"
            >
              <span className="w-6 shrink-0 text-right text-sm text-kosmo-dim2">{i + 1}</span>
              <span className="min-w-0 flex-1">{l.title}</span>
              {l.minutes && <span className="shrink-0 text-xs text-kosmo-dim2">{l.minutes} min</span>}
              <StatusBadge status={l.status} />
            </Link>
          </li>
        ))}
      </ol>

      {mod.openSources.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Open resources for this module</h2>
          <p className="text-sm text-kosmo-dim">
            Free, openly licensed material from other publishers. Each link opens the source; licences and credits are
            listed with it.
          </p>
          <ul className="divide-y divide-kosmo-line rounded-lg border border-kosmo-line bg-kosmo-panel">
            {mod.openSources.map((s) => (
              <li key={`${s.sourceId}-${s.locator}`} className="space-y-1 px-4 py-3">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-kosmo-blue hover:underline"
                >
                  {s.locator}
                </a>
                <p className="text-sm text-kosmo-dim">
                  {s.title} · {s.publisher} · {s.fit === "full" ? "covers the module" : "covers part of it"}
                </p>
                <p className="text-xs text-kosmo-dim2">
                  {s.attribution}{" "}
                  <a href={s.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {s.licenseName}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mod.requiredBy.length > 0 && (
        <p className="text-sm text-kosmo-dim">
          Leads to:{" "}
          {mod.requiredBy.map((r, i) => (
            <span key={r.kuId}>
              {i > 0 && ", "}
              <Link href={href(r.kuId, r.stage)} className="text-kosmo-blue hover:underline">
                {r.name}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
