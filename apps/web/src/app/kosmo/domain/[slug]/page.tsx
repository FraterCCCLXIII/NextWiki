import { promises as fs } from "fs";
import path from "path";
import { notFound } from "next/navigation";
import { Tree, StatTotals, type TreeData } from "@repo/ui";

const SLUGS = ["math", "physics", "philosophy", "models"] as const;
type Slug = (typeof SLUGS)[number];

type RawNode = {
  name: string;
  what?: string;
  law?: string;
  who?: string;
  year?: string | number | null;
  status?: string;
  link?: string;
  children?: RawNode[];
};

type DomainFile = {
  domain?: string;
  blurb?: string;
  columns?: string[];
  nodes: RawNode[];
};

function adapt(node: RawNode): TreeData {
  return {
    name: node.name,
    status: node.status,
    link: node.link,
    blurb: node.what,
    children: node.children?.map(adapt),
  };
}

function countNodes(nodes: RawNode[]): { total: number; withStatus: number; withLink: number } {
  let total = 0;
  let withStatus = 0;
  let withLink = 0;
  const walk = (n: RawNode) => {
    total += 1;
    if (n.status) withStatus += 1;
    if (n.link) withLink += 1;
    n.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return { total, withStatus, withLink };
}

async function loadDomain(slug: Slug): Promise<DomainFile | null> {
  const file = path.join(process.cwd(), "public", "kosmo", "data", "domains", `${slug}.json`);
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as DomainFile;
  } catch {
    return null;
  }
}

export default async function KosmoDomainPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(SLUGS as readonly string[]).includes(slug)) notFound();

  const data = await loadDomain(slug as Slug);
  if (!data) notFound();

  const counts = countNodes(data.nodes);

  return (
    <main className="min-h-screen bg-kosmo-bg text-kosmo-text">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">{data.domain ?? slug}</h1>
          {data.blurb && <p className="text-kosmo-dim">{data.blurb}</p>}
        </header>

        <StatTotals
          items={[
            { label: "nodes", value: counts.total },
            { label: "with status", value: counts.withStatus },
            { label: "with wiki link", value: counts.withLink },
          ]}
        />

        <section className="rounded-lg border border-kosmo-line bg-kosmo-panel p-2 md:p-4">
          <Tree nodes={data.nodes.map(adapt)} />
        </section>
      </div>
    </main>
  );
}
