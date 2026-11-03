"use client";

import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

/** Event the embedded pages fire (see EmbedFrame) when something inside their iframe scrolls. */
export const KOSMO_SCROLL_EVENT = "kosmo:scrolled";

/**
 * A soft gradient under the header that fades in once the page (or anything scrollable on it, or inside an
 * embedded page) has scrolled, so content slides under the header instead of being cut off by it.
 */
export function ScrollFeather() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // scroll does not bubble, so listen in the capture phase to hear every scroll container on the page
    const onScroll = (e: Event) => {
      const t = e.target;
      const top =
        t instanceof Element ? t.scrollTop : (document.scrollingElement?.scrollTop ?? 0);
      setScrolled(top > 4);
    };
    const onEmbedded = (e: Event) => setScrolled(Boolean((e as CustomEvent<boolean>).detail));
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener(KOSMO_SCROLL_EVENT, onEmbedded);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener(KOSMO_SCROLL_EVENT, onEmbedded);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-16 z-20 h-10 transition-opacity duration-200",
        scrolled ? "opacity-100" : "opacity-0"
      )}
      style={{
        background:
          "linear-gradient(to bottom, var(--color-background-default) 0%, color-mix(in srgb, var(--color-background-default) 70%, transparent) 40%, transparent 100%)",
      }}
    />
  );
}
