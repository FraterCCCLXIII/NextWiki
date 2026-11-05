import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { universityDir } from "./paths.js";
import type { Ledger, SourceMap } from "./sources.js";

export async function readLedger(): Promise<Ledger> {
  try {
    return JSON.parse(await readFile(join(universityDir(), "sources.json"), "utf8")) as Ledger;
  } catch {
    return { version: 1, sources: {} };
  }
}

export async function readSourceMap(): Promise<SourceMap> {
  try {
    return JSON.parse(await readFile(join(universityDir(), "source-map.json"), "utf8")) as SourceMap;
  } catch {
    return { version: 1, modules: {} };
  }
}
