"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KOSMO_SCROLL_EVENT } from "~/components/layout/ScrollFeather";
import { kosmoRouteForUrl } from "~/lib/kosmo/tools";
import { LogoLoader } from "~/components/ui/LogoLoader";

interface EmbedFrameProps {
  src: string;
  title: string;
}

/**
 * Iframe for a static Kosmographica page that fills whatever container it is
 * given (the tool route sizes that to the space below the site header).
 *
 * Routing: the embedded pages link to each other by file name. Those links are caught here and turned into real
 * Next.js navigations (kosmoRouteForUrl), so the address bar, header highlight and back button follow, and a page
 * can post its hash up so deep links like /kosmo/tools/dinosaurs#38862 are shareable.
 */
export function EmbedFrame({ src, title }: EmbedFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [frameSrc, setFrameSrc] = useState(src);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const attachedDoc = useRef<Document | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryKey = searchParams?.toString() ?? "";

  // The embedded page scrolls inside the iframe (same origin): tell the header feather when it does.
  const attachScroll = (doc: Document) => {
    // a freshly loaded embedded page starts unscrolled: clear any feather left on by the page before it
    window.dispatchEvent(new CustomEvent(KOSMO_SCROLL_EVENT, { detail: false }));
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

  // Links to other embedded pages become real navigations instead of moving only the iframe.
  const attachLinks = (doc: Document) => {
    doc.addEventListener(
      "click",
      (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
        const route = kosmoRouteForUrl(a.href, window.location.origin);
        if (!route) return;
        e.preventDefault();
        router.push(route);
      },
      true
    );
  };

  const attach = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || attachedDoc.current === doc) return;
    attachedDoc.current = doc;
    attachScroll(doc);
    attachLinks(doc);
  };

  // React does not replay an iframe's load event that fired before hydration, so also attach on mount.
  useEffect(() => {
    attach();
    setLoaded(Boolean(frameRef.current?.contentDocument?.readyState === "complete"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Whatever the address bar carries is handed to the embedded page: /kosmo/tools/<tool>?kosmoBg=original|match is stored
  // by kosmo-theme.js, ?a= (a cosmic address, KA1~...) and ?go= (a body to fly to) become the atlas's #a= / #go= hash,
  // any other query (?handoff=1) is passed through, and a plain #hash (a selected item) is passed through too.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addr = params.get("a");
    const goTo = params.get("go");
    params.delete("a");
    params.delete("go");
    const qs = params.toString();
    const base = qs ? `${src}${src.includes("?") ? "&" : "?"}${qs}` : src;
    setFrameSrc(
      addr?.startsWith("KA1~")
        ? `${base}#a=${encodeURIComponent(addr)}`
        : goTo
          ? `${base}#go=${encodeURIComponent(goTo)}`
          : `${base}${window.location.hash}`
    );
  }, [src, queryKey]);

  // Messages from the embedded page:
  //  - the atlas posts its camera state as a cosmic address; keep it in this page's URL (?a=...) so a view can be shared and reopened
  //  - any page can post its hash ({kosmo:"hash", h:"#38862"}) so the selected item lives in the URL
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const d = e.data as { kosmo?: string; a?: string; h?: string } | null;
      if (d?.kosmo === "address" && typeof d.a === "string" && d.a.startsWith("KA1~")) {
        const url = new URL(window.location.href);
        url.searchParams.set("a", d.a);
        url.searchParams.delete("go"); // once the address is recorded it says where you are; a stale ?go= would fight it on reload
        window.history.replaceState(window.history.state, "", url);
      } else if (d?.kosmo === "hash" && typeof d.h === "string" && /^#?[\w%.~=&,-]*$/.test(d.h)) {
        const url = new URL(window.location.href);
        url.hash = d.h;
        window.history.replaceState(window.history.state, "", url);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="relative h-full w-full">
      {!loaded && (
        <div className="absolute inset-0 z-10 bg-kosmo-bg">
          <LogoLoader fill />
        </div>
      )}
      <iframe
        src={frameSrc}
        title={title}
        ref={frameRef}
        onLoad={() => {
          setLoaded(true);
          attach();
          // a page that navigated itself in script (location.href = ...) bypasses the click hook: follow it
          const win = frameRef.current?.contentWindow;
          const route = win ? kosmoRouteForUrl(win.location.href, window.location.origin) : null;
          if (route && route.split(/[?#]/)[0] !== pathname) router.replace(route);
        }}
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
