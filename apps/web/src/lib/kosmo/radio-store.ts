"use client";

import { useSyncExternalStore } from "react";
import { clockPosition, type RadioData } from "./radio";

/**
 * Module-level player: the <audio> element lives outside React, so client-side navigation
 * (switching tabs/pages) never unmounts it and the music keeps playing.
 */
export type RadioState = {
  data: RadioData | null;
  index: number;
  playing: boolean;
  live: boolean;
  time: number;
  volume: number;
  error: string | null;
};

const VOL_KEY = "spaceradio-volume";
let state: RadioState = { data: null, index: 0, playing: false, live: true, time: 0, volume: 0.75, error: null };
const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let loading = false;

function set(patch: Partial<RadioState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = "none";
    audio.volume = state.volume;
    audio.addEventListener("timeupdate", () => set({ time: audio!.currentTime }));
    audio.addEventListener("play", () => set({ playing: true }));
    audio.addEventListener("pause", () => set({ playing: false }));
    audio.addEventListener("error", () => set({ error: "This track could not be played.", playing: false }));
    audio.addEventListener("ended", () => radio.next());
  }
  return audio;
}

function load(i: number, offset: number) {
  const t = state.data?.tracks[i];
  if (!t) return;
  const a = el();
  set({ index: i, error: null, time: offset });
  a.src = t.audio;
  a.addEventListener(
    "loadedmetadata",
    () => {
      if (offset > 0 && offset < (a.duration || Infinity) - 0.25) a.currentTime = offset;
    },
    { once: true },
  );
  a.play().catch(() => set({ playing: false, error: "Playback was blocked. Press play." }));
}

export const radio = {
  async init() {
    if (state.data || loading) return;
    loading = true;
    try {
      const data = (await (await fetch("/radio/tracks.json")).json()) as RadioData;
      set({ data, index: clockPosition(data).index });
      try {
        const v = parseFloat(localStorage.getItem(VOL_KEY) ?? "");
        if (v >= 0 && v <= 1) radio.setVolume(v);
      } catch {
        /* storage blocked */
      }
    } catch {
      set({ error: "Could not load the station playlist." });
    } finally {
      loading = false;
    }
  },
  goLive() {
    if (!state.data) return;
    const p = clockPosition(state.data);
    set({ live: true });
    load(p.index, p.offsetSec);
  },
  playTrack(i: number) {
    set({ live: false });
    load(i, 0);
  },
  next() {
    if (!state.data) return;
    if (state.live) radio.goLive();
    else load((state.index + 1) % state.data.tracks.length, 0);
  },
  prev() {
    if (!state.data) return;
    const n = state.data.tracks.length;
    set({ live: false });
    load((state.index - 1 + n) % n, 0);
  },
  toggle() {
    const a = el();
    if (!a.src) return radio.goLive();
    if (a.paused) a.play().catch(() => set({ error: "Playback was blocked." }));
    else a.pause();
  },
  seek(sec: number) {
    el().currentTime = sec;
  },
  setVolume(v: number) {
    set({ volume: v });
    if (audio) audio.volume = v;
    try {
      localStorage.setItem(VOL_KEY, String(v));
    } catch {
      /* storage blocked */
    }
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useRadio(): RadioState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
