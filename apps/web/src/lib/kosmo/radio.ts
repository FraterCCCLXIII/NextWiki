/** SpaceRadio: the 24/7 station schedule, ported from the spaceradio repo. Data lives in public/radio/tracks.json. */
export type RadioTrack = {
  id: string;
  title: string;
  artist: string;
  catalogId: string;
  durationSec: number;
  bpm: number;
  genre: string;
  energy: number;
  missionSlug: string;
  note: string;
  audio: string;
  art: string;
};
export type RadioData = { epochMs: number; tracks: RadioTrack[] };

export const RADIO_MISSIONS: Record<string, { name: string; tieIn: string }> = {
  "deep-orbit": { name: "Deep Orbit", tieIn: "Always-on station bed" },
  "demo-flight": { name: "Demo Flight", tieIn: "Platform demo" },
  "mars-relay": { name: "Mars Relay", tieIn: "Mars exploration" },
  jwst: { name: "Deep Sky", tieIn: "JWST imagery" },
  artemis: { name: "Artemis Hour", tieIn: "Artemis program" },
  "voyager-tribute": { name: "Voyager Tribute", tieIn: "Voyager heritage" },
};

/** Where the wall-clock broadcast is right now: every listener hears the same track at the same offset. */
export function clockPosition(data: RadioData, now = Date.now()) {
  const total = data.tracks.reduce((s, t) => s + t.durationSec, 0);
  let remaining = (((now - data.epochMs) / 1000) % total + total) % total;
  for (let i = 0; i < data.tracks.length; i++) {
    const d = data.tracks[i]!.durationSec;
    if (remaining < d) return { index: i, offsetSec: remaining };
    remaining -= d;
  }
  return { index: 0, offsetSec: 0 };
}

export function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}
