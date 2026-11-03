"use client";

import { useState } from "react";

interface EmbedFrameProps {
  src: string;
  title: string;
}

/**
 * Full-width iframe for a static Kosmographica tool, with a loading skeleton.
 */
export function EmbedFrame({ src, title }: EmbedFrameProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative min-h-[80vh] w-full">
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse rounded-md bg-kosmo-bg/60"
        />
      )}
      <iframe
        src={src}
        title={title}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className="h-full min-h-[80vh] w-full border-0"
      />
    </div>
  );
}
