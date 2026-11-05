// Source-list parsing and registry resolution. A catalogue row cites its values
// as a " | "-joined list of URLs (an archive TAP query, an encyclopedia list, a
// Wikidata item), so attribution is per URL, not per row.
import {
  SOURCE_REGISTRY,
  type KosmoSourceRegistryEntry,
} from "./sources-registry.js";

export interface ParsedSource {
  url: string;
  /** Hostname, or null when the entry is not a URL. */
  host: string | null;
  /** Registry entry for this host, when one exists. */
  entry: KosmoSourceRegistryEntry | null;
  /** Stable source key: the registry key when registered, else the host. */
  key: string;
}

export function splitSourceField(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Exact host match, then a suffix match so www./sub. variants resolve. */
export function matchRegistryEntry(
  host: string,
  registry: readonly KosmoSourceRegistryEntry[] = SOURCE_REGISTRY,
): KosmoSourceRegistryEntry | null {
  const h = host.toLowerCase();
  const exact = registry.find((e) => e.key.toLowerCase() === h);
  if (exact) return exact;
  return (
    registry.find(
      (e) =>
        h.endsWith(`.${e.key.toLowerCase()}`) ||
        e.key.toLowerCase().endsWith(`.${h}`),
    ) ?? null
  );
}

export function parseSourceField(
  value: unknown,
  registry: readonly KosmoSourceRegistryEntry[] = SOURCE_REGISTRY,
): ParsedSource[] {
  const out: ParsedSource[] = [];
  const seen = new Set<string>();
  for (const url of splitSourceField(value)) {
    const host = hostOf(url);
    const entry = host ? matchRegistryEntry(host, registry) : null;
    const key = entry?.key ?? host;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ url, host, entry, key });
  }
  return out;
}

/** Hosts cited by the given source fields that have no registry entry. */
export function unregisteredHosts(
  values: unknown[],
  registry: readonly KosmoSourceRegistryEntry[] = SOURCE_REGISTRY,
): { host: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    for (const source of parseSourceField(value, registry)) {
      if (source.entry) continue;
      const key = source.host ?? source.url;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count);
}
