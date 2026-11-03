/**
 * Static Kosmographica tools served from /kosmo/static/.
 * Slug -> file name inside public/kosmo/static/.
 */
export const KOSMO_TOOLS: Record<string, { file: string; title: string }> = {
  university: { file: "university.html", title: "University" },
  timeline: { file: "universe-timeline.html", title: "Timeline" },
  chemistry: { file: "chemistry.html", title: "Chemistry" },
  contraption: { file: "contraption-sim.html", title: "Simulator" },
};

export function kosmoToolSrc(slug: string): string | null {
  const tool = Object.prototype.hasOwnProperty.call(KOSMO_TOOLS, slug)
    ? KOSMO_TOOLS[slug]
    : undefined;
  return tool ? `/kosmo/static/${tool.file}` : null;
}
