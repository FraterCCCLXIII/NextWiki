import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson } from "~/lib/kosmo/university";
import { StatusBadge } from "~/components/kosmo/university";
import { HighlightedContent, renderMarkdownToHtml } from "~/lib/markdown";

export const dynamic = "force-dynamic";

const STAGE_ORDER = ["public", "preschool", "kindergarten", "primary", "middle", "high", "college", "masters", "doctoral", "postgrad"];

const SECTIONS: [string, string][] = [
  ["explanation", "Explanation"],
  ["workedExample", "Worked example"],
  ["activity", "Activity"],
  ["summary", "Summary"],
];

export default async function UniversityLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ stage: string; module: string; lesson: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const { stage, module: moduleParam, lesson: lessonParam } = await params;
  const { draft } = await searchParams;
  const lesson = await getLesson(lessonParam.toUpperCase());
  if (!lesson || !lesson.module) notFound();
  if (lesson.stage !== stage || lesson.module.kuId !== moduleParam.toUpperCase()) notFound();

  const { row, module: mod } = lesson;
  const status = row.status;
  // Reviewed lessons are shown. Drafts only on request, so unreviewed text is never served by default.
  // Outlines have no body to show.
  const showBody = status === "reviewed" || (status === "drafted" && draft === "1");

  let html = "";
  let markdown = "";
  if (showBody && row.sections) {
    markdown = SECTIONS.map(([key, label]) => `## ${label}\n\n${row.sections?.[key] ?? ""}`).join("\n\n");
    html = await renderMarkdownToHtml(markdown);
  }

  const base = `/kosmo/university/${stage}/${mod.kuId.toLowerCase()}`;
  const lessonHref = (id: string) => `${base}/${id.toLowerCase()}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-kosmo-text">
      <nav className="text-sm text-kosmo-dim">
        <Link href="/kosmo/university" className="hover:underline">
          University
        </Link>{" "}
        /{" "}
        <Link href={`/kosmo/university/${stage}`} className="hover:underline">
          {stage}
        </Link>{" "}
        /{" "}
        <Link href={base} className="hover:underline">
          {mod.name}
        </Link>
      </nav>

      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">{lesson.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-kosmo-dim">
          <StatusBadge status={status} />
          {row.minutes && <span>{row.minutes} min</span>}
          {row.kind && <span className="capitalize">{row.kind}</span>}
          <span className="text-kosmo-dim2">{lesson.kuId}</span>
        </div>
        {lesson.concepts.length > 0 && (
          <p className="text-sm text-kosmo-dim">Teaches: {lesson.concepts.join(", ")}</p>
        )}
      </header>

      {status === "stub" && (
        <div className="rounded-lg border border-dashed border-kosmo-line2 p-4 text-kosmo-dim">
          This lesson is an outline: the title and its place in the course are set, and the
          teaching text has not been written yet.
          {(lesson.go || lesson.pedia) && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {lesson.go && (
                <Link href={`/kosmo/tools/timeline?go=${encodeURIComponent(lesson.go)}`} className="text-kosmo-blue hover:underline">
                  Explore {lesson.go} on the map
                </Link>
              )}
              {lesson.pedia && (
                <Link href={`/kosmo/pedia?q=${encodeURIComponent(lesson.pedia)}`} className="text-kosmo-blue hover:underline">
                  Look up {lesson.pedia} in Kosmopedia
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {status === "drafted" && !showBody && (
        <div className="rounded-lg border border-kosmo-amber/50 p-4 text-kosmo-dim">
          A draft of this lesson exists but has not passed review, so it is not shown by default.{" "}
          <Link href={`${lessonHref(lesson.kuId)}?draft=1`} className="text-kosmo-amber hover:underline">
            Read the unreviewed draft anyway
          </Link>
          .
        </div>
      )}

      {status === "drafted" && showBody && (
        <div className="rounded-lg border border-kosmo-amber/50 p-3 text-sm text-kosmo-amber">
          Unreviewed draft. It has not been checked for accuracy, reading level or licences.
        </div>
      )}

      {showBody && (
        <>
          <article className="prose prose-invert max-w-none">
            <HighlightedContent content={markdown} renderedHtml={html} />
          </article>

          {row.checks && row.checks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">Check yourself</h2>
              <ol className="list-decimal space-y-3 pl-6">
                {row.checks.map((c) => (
                  <li key={c.q}>
                    <p>{c.q}</p>
                    {c.options && (
                      <ul className="mt-1 list-disc pl-5 text-kosmo-dim">
                        {c.options.map((o) => (
                          <li key={o}>{o}</li>
                        ))}
                      </ul>
                    )}
                    <details className="mt-1 text-sm">
                      <summary className="cursor-pointer text-kosmo-blue">Show the answer</summary>
                      <p className="mt-1 text-kosmo-mint">{c.a}</p>
                    </details>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <footer className="space-y-1 border-t border-kosmo-line pt-4 text-xs text-kosmo-dim2">
            <p>
              Written by {row.authorName ?? "unknown"}
              {row.authorKind ? ` (${row.authorKind})` : ""}.
              {row.reviewerName
                ? ` Reviewed by ${row.reviewerName} (${row.reviewerKind})${
                    row.reviewedAt ? ` on ${row.reviewedAt.toISOString().slice(0, 10)}` : ""
                  }${row.reviewerKind === "agent" ? "; not yet checked by a person" : ""}.`
                : ""}
            </p>
            <p>
              Licence: {row.license ?? "unspecified"}.{" "}
              {row.original ? "Original text, no source material adapted." : null}
            </p>
            {row.sources && row.sources.length > 0 && (
              <ul className="list-disc pl-5">
                {row.sources.map((s) => (
                  <li key={s.name}>
                    {s.url ? (
                      <a href={s.url} className="hover:underline" rel="noreferrer">
                        {s.name}
                      </a>
                    ) : (
                      s.name
                    )}{" "}
                    ({s.license}, {s.adapted ? "adapted" : "linked"})
                  </li>
                ))}
              </ul>
            )}
          </footer>
        </>
      )}

      {lesson.spiral.length > 0 && (
        <section className="space-y-2 rounded-lg border border-kosmo-line bg-kosmo-panel p-4">
          <h2 className="text-sm uppercase tracking-[0.14em] text-kosmo-dim">
            The same idea at other levels
          </h2>
          <ul className="space-y-1 text-sm">
            {lesson.spiral
              .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
              .map((s) => (
                <li key={s.kuId} className="flex items-center justify-between gap-3">
                  <Link href={`/kosmo/university/${s.stage}/${s.moduleKuId.toLowerCase()}/${s.kuId.toLowerCase()}`} className="hover:text-kosmo-mint">
                    <span className="text-kosmo-dim2">{s.stage}:</span> {s.title}
                  </Link>
                  <StatusBadge status={s.status} />
                </li>
              ))}
          </ul>
        </section>
      )}

      <nav className="flex justify-between gap-4 border-t border-kosmo-line pt-4 text-sm">
        {lesson.prev ? (
          <Link href={lessonHref(lesson.prev.kuId)} className="text-kosmo-blue hover:underline">
            ← {lesson.prev.title}
          </Link>
        ) : (
          <span />
        )}
        {lesson.next ? (
          <Link href={lessonHref(lesson.next.kuId)} className="text-right text-kosmo-blue hover:underline">
            {lesson.next.title} →
          </Link>
        ) : (
          <Link href={base} className="text-kosmo-blue hover:underline">
            Back to {mod.name} →
          </Link>
        )}
      </nav>
    </div>
  );
}
