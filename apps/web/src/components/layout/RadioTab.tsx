"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Pause, Play, Radio, SkipBack, SkipForward } from "lucide-react";
import { radio, useRadio } from "~/lib/kosmo/radio-store";

const btn =
  "flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-background-level1 hover:text-text-primary disabled:opacity-40";

/** Top-nav mini player: cover, 10-character scrolling title, back / play-pause / forward. Audio lives in radio-store, so it survives navigation. */
export function RadioTab() {
  const { data, index, playing } = useRadio();
  useEffect(() => {
    void radio.init();
  }, []);
  const track = data?.tracks[index];
  const ready = !!track;

  return (
    <div className="hidden items-center gap-1 sm:flex">
      <style>{`@keyframes radio-marquee{0%,15%{transform:translateX(0)}85%,100%{transform:translateX(var(--radio-shift))}}`}</style>
      <Link
        href="/kosmo/radio"
        title={track ? `${track.title} — Space Radio` : "Space Radio"}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-background-level1"
      >
        {track ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.art} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
        ) : (
          <Radio className="h-5 w-5 shrink-0" />
        )}
        {/* a 10-character window; longer titles scroll through it */}
        <span className="block w-[10ch] overflow-hidden whitespace-nowrap">
          {track ? (
            <span
              key={track.id}
              className="inline-block"
              style={
                track.title.length > 10
                  ? ({
                      "--radio-shift": `calc(-${track.title.length}ch + 10ch)`,
                      animation: `radio-marquee ${Math.max(6, track.title.length * 0.5)}s ease-in-out infinite alternate`,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {track.title}
            </span>
          ) : (
            "Space Radio"
          )}
        </span>
      </Link>
      <button type="button" className={btn} disabled={!ready} onClick={() => radio.prev()} aria-label="Previous track">
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={btn}
        disabled={!ready}
        onClick={() => radio.toggle()}
        aria-label={playing ? "Pause Space Radio" : "Play Space Radio"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button type="button" className={btn} disabled={!ready} onClick={() => radio.next()} aria-label="Next track">
        <SkipForward className="h-4 w-4" />
      </button>
    </div>
  );
}
