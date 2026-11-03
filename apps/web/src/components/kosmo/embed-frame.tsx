"use client";

import { useState } from "react";

interface EmbedFrameProps {
  src: string;
  title: string;
}

/**
 * Iframe for a static Kosmographica page that fills whatever container it is
 * given (the tool route sizes that to the space below the site header).
 */
export function EmbedFrame({ src, title }: EmbedFrameProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative h-full w-full">
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-kosmo-bg"
        />
      )}
      <iframe
        src={src}
        title={title}
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
