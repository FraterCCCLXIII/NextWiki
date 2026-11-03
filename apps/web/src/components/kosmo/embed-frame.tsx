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
    const params = new URLSearchParams(window.location.search);
    const bg = params.get("kosmoBg");
    const addr = params.get("a"); // a cosmic address (KA1~...) to open the atlas at
    const goTo = params.get("go"); // a body to fly to (the home page tiles link here)
    const base = bg === "original" || bg === "match" ? `${src}?kosmoBg=${bg}` : src;
    setFrameSrc(addr?.startsWith("KA1~") ? `${base}#a=${encodeURIComponent(addr)}` : goTo ? `${base}#go=${encodeURIComponent(goTo)}` : base);
  }, [src]);

  // The atlas posts its camera state as a cosmic address; keep it in this page's URL (?a=...) so a view can be shared and reopened.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const d = e.data as { kosmo?: string; a?: string } | null;
      if (d?.kosmo !== "address" || typeof d.a !== "string" || !d.a.startsWith("KA1~")) return;
      const url = new URL(window.location.href);
      url.searchParams.set("a", d.a);
      url.searchParams.delete("go"); // once the address is recorded it says where you are; a stale ?go= would fight it on reload
      window.history.replaceState(window.history.state, "", url);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
