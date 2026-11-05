import { fileURLToPath, pathToFileURL } from "node:url";

/** Shared with tools/build-timeline-data.mjs so the static JSON and the database agree on lanes and regions. */
const FILE = fileURLToPath(new URL("../../../../../tools/timeline-normalize.mjs", import.meta.url));
const mod = (await import(pathToFileURL(FILE).href)) as {
  bardiyaLane: (lane: string) => string;
  regionFor: (lane: string, reg?: string | null) => string | undefined;
};
export const bardiyaLane = mod.bardiyaLane;
export const regionFor = mod.regionFor;
