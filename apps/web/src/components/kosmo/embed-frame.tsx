"use client";

import { useEffect, useState } from "react";

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
  const [frameSrc, setFrameSrc] = useState(src);

  // Internal look switch: /kosmo/tools/<tool>?kosmoBg=original|match is forwarded to the page
  // (kosmo-theme.js stores it), so it can be flipped from the wiki URL.
  useEffect(() => {
    const bg = new URLSearchParams(window.location.search).get("kosmoBg");
    setFrameSrc(bg === "original" || bg === "match" ? `${src}?kosmoBg=${bg}` : src);
  }, [src]);

  return (
    <div className="relative h-full w-full">
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-kosmo-bg"
        />
      )}
      <iframe
        src={frameSrc}
        title={title}
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
