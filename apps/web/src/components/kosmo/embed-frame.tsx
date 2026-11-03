"use client";

import { useEffect, useRef, useState } from "react";
import { KOSMO_SCROLL_EVENT } from "~/components/layout/ScrollFeather";

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
  const frameRef = useRef<HTMLIFrameElement>(null);
  const attachedDoc = useRef<Document | null>(null);

  // The embedded page scrolls inside the iframe (same origin): tell the header feather when it does.
  const attachScroll = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || attachedDoc.current === doc) return;
    attachedDoc.current = doc;
    doc.addEventListener(
      "scroll",
      (e) => {
        const t = e.target;
        // the iframe has its own Element class, so test the node type instead of `instanceof Element`
        const top = (t as Node | null)?.nodeType === 1 ? (t as Element).scrollTop : (doc.scrollingElement?.scrollTop ?? 0);
        window.dispatchEvent(new CustomEvent(KOSMO_SCROLL_EVENT, { detail: top > 4 }));
      },
      { capture: true, passive: true }
    );
  };

  // React does not replay an iframe's load event that fired before hydration, so also attach on mount.
  useEffect(() => {
    attachScroll();
    setLoaded(Boolean(frameRef.current?.contentDocument?.readyState === "complete"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

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
        ref={frameRef}
        onLoad={() => {
          setLoaded(true);
          attachScroll();
        }}
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
