import type { Metadata } from "next";
import { TimelineApp } from "~/components/timeline/TimelineApp";

export const metadata: Metadata = {
  title: "Timeline",
  description: "A pan-and-zoom timeline of history, lineages and traditions, with branching relations.",
};

export default function KosmoTimelinePage() {
  return (
    // Full-bleed: cancel the kosmo layout's padding and fill the space under the 4rem site header.
    <div className="-m-4 h-[calc(100vh-6.25rem)] md:-m-8">
      <TimelineApp />
    </div>
  );
}
