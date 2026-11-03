import { notFound } from "next/navigation";
import { Tree, StatTotals, type TreeData } from "@repo/ui";
import { getDomainTree, type DomainNode } from "~/lib/kosmo/queries";

export const dynamic = "force-dynamic";

const DOMAINS: Record<string, { title: string; blurb: string }> = {
  math: { title: "Math", blurb: "Numbers, structures and proofs." },
  physics: { title: "Physics", blurb: "Forces, particles and fields." },
  philosophy: { title: "Philosophy", blurb: "Questions that frame the other domains." },
  models: { title: "Models", blurb: "Simplified pictures of how things work." },
};

function adapt(node: DomainNode): TreeData {
  return {
    name: node.name,
    status: node.status ?? undefined,
    link: node.link ?? undefined,
    blurb: node.blurb ?? undefined,
    children: node.children.length ? node.children.map(adapt) : undefined,
  };
}

function countNodes(nodes: DomainNode[]): { total: number; withStatus: number; withLink: number } {
  let total = 0;
  let withStatus = 0;
  let withLink = 0;
  const walk = (n: DomainNode) => {
    total += 1;
    if (n.status) withStatus += 1;
    if (n.link) withLink += 1;
    n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return { total, withStatus, withLink };
}

export default async function KosmoDomainPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = Object.prototype.hasOwnProperty.call(DOMAINS, slug) ? DOMAINS[slug] : undefined;
  if (!meta) notFound();

  const nodes = await getDomainTree(slug);
  if (nodes.length === 0) notFound();

  const counts = countNodes(nodes);

  return (
    <main className="min-h-screen bg-kosmo-bg text-kosmo-text">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">{meta.title}</h1>
          <p className="text-kosmo-dim">{meta.blurb}</p>
        </header>

        <StatTotals
          items={[
            { label: "nodes", value: counts.total },
            { label: "with status", value: counts.withStatus },
            { label: "with wiki link", value: counts.withLink },
          ]}
        />

        <section className="rounded-lg border border-kosmo-line bg-kosmo-panel p-2 md:p-4">
          <Tree nodes={nodes.map(adapt)} />
        </section>
      </div>
    </main>
  );
}
