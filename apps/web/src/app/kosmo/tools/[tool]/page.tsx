import { notFound } from "next/navigation";
import { EmbedFrame } from "~/components/kosmo/embed-frame";
import { KOSMO_TOOLS, kosmoToolSrc } from "~/lib/kosmo/tools";

interface ToolPageProps {
  params: Promise<{ tool: string }>;
}

export function generateStaticParams() {
  return Object.keys(KOSMO_TOOLS).map((tool) => ({ tool }));
}

export default async function KosmoToolPage({ params }: ToolPageProps) {
  const { tool } = await params;
  const src = kosmoToolSrc(tool);
  if (!src) notFound();

  return (
    // Full-bleed: cancel the kosmo layout's padding and fill the space under the 4rem site header.
    <div className="-m-4 h-[calc(100vh-4rem)] md:-m-8">
      <EmbedFrame src={src} title={KOSMO_TOOLS[tool]!.title} />
    </div>
  );
}
