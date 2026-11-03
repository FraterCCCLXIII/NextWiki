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
    <div className="flex min-h-[80vh] w-full flex-col">
      <EmbedFrame src={src} title={KOSMO_TOOLS[tool]!.title} />
    </div>
  );
}
