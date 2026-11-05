"use client";

import { useEffect } from "react";
import { Pause, Play, Radio, SkipForward, Volume2 } from "lucide-react";
import { RADIO_MISSIONS, formatTime, type RadioTrack } from "~/lib/kosmo/radio";
import { radio, useRadio } from "~/lib/kosmo/radio-store";

/** SpaceRadio on the site: a synced 24/7 broadcast (everyone hears the same moment) plus the full originals library. */
export function RadioPlayer() {
  const { data, index, playing, live, time, volume, error } = useRadio();
  useEffect(() => {
    void radio.init();
  }, []);
  const tracks = data?.tracks ?? [];
  const track: RadioTrack | undefined = tracks[index];
  const { goLive, playTrack, next, toggle } = radio;

  const upNext = tracks.length ? [1, 2, 3, 4].map((n) => tracks[(index + n) % tracks.length]!) : [];
  const mission = track ? RADIO_MISSIONS[track.missionSlug] : undefined;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
            playing && live ? "border-kosmo-mint text-kosmo-mint" : "border-kosmo-line2 text-kosmo-dim"
          }`}
        >
          <Radio className="h-3.5 w-3.5" /> {playing && live ? "On air" : live ? "Station" : "Library"}
        </span>
        {!live && (
          <button type="button" onClick={() => goLive()} className="text-sm text-kosmo-mint hover:underline">
            Return to live broadcast
          </button>
        )}
      </div>

      {track ? (
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={track.art} alt="" className="h-52 w-52 shrink-0 rounded-lg object-cover shadow-2xl sm:h-60 sm:w-60" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-kosmo-dim">Now broadcasting</p>
            <h1 className="mt-2 text-4xl font-light uppercase tracking-wide text-kosmo-text sm:text-5xl">{track.title}</h1>
            <p className="mt-3 text-kosmo-dim">
              {mission?.name} · {track.artist}
            </p>
            <p className="mt-2 max-w-xl text-sm text-kosmo-dim2">{track.note}</p>
            <p className="mt-2 font-mono text-[11px] text-kosmo-dim2">
              {track.catalogId} · {track.bpm} BPM · {track.genre}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-8 text-kosmo-dim">{error ?? "Tuning in…"}</p>
      )}

      {track && (
        <div className="mt-6 rounded-xl border border-kosmo-line2 bg-kosmo-panel p-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => toggle()}
              aria-label={playing ? "Pause" : "Play"}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-kosmo-text text-kosmo-bg"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button type="button" onClick={() => next()} aria-label="Next track" className="text-kosmo-dim hover:text-kosmo-text">
              <SkipForward className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3 font-mono text-[11px] text-kosmo-dim">
              <span>{formatTime(time)}</span>
              <input
                type="range"
                min={0}
                max={track.durationSec}
                value={Math.min(time, track.durationSec)}
                disabled={live}
                onChange={(e) => radio.seek(Number(e.target.value))}
                aria-label="Seek"
                className="min-w-0 flex-1 accent-[var(--kosmo-mint,#7fe0c0)] disabled:opacity-60"
              />
              <span>{formatTime(track.durationSec)}</span>
            </div>
            <Volume2 className="hidden h-4 w-4 text-kosmo-dim sm:block" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => radio.setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="hidden w-24 sm:block"
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      )}

      {upNext.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-kosmo-text">Up next</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {upNext.map((t) => (
              <button key={t.id} type="button" onClick={() => playTrack(tracks.indexOf(t))} className="rounded-lg bg-kosmo-panel p-3 text-left hover:bg-kosmo-line2/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.art} alt="" className="mb-2 aspect-square w-full rounded object-cover" />
                <p className="truncate text-sm text-kosmo-text">{t.title}</p>
                <p className="font-mono text-[10px] text-kosmo-dim2">{t.catalogId}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-kosmo-text">SpaceRadio Originals</h2>
        <ul className="mt-3 divide-y divide-kosmo-line2 rounded-xl border border-kosmo-line2">
          {tracks.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => playTrack(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-kosmo-panel ${i === index ? "text-kosmo-mint" : "text-kosmo-text"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.art} alt="" className="h-10 w-10 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="hidden font-mono text-[11px] text-kosmo-dim2 sm:block">{t.genre}</span>
                <span className="font-mono text-[11px] text-kosmo-dim">{formatTime(t.durationSec)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
