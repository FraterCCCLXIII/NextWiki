#!/usr/bin/env node
/**
 * Stores a local copy of an open course in the repo and records it in the source ledger.
 *
 *   node tools/university-ingest.mjs <SRC-id> <url> [<url>...] [--max-mb 25] [--scope "what was taken"]
 *
 * - <SRC-id> must already be in packages/db/src/seeds/kosmo/university/sources.json, with a licence
 *   we may adapt (ND and no-licence sources are link-only and are refused).
 * - Files land in apps/web/public/kosmo/open-courses/<slug>/ and a LICENSE-AND-CREDITS.txt is written
 *   next to them from the ledger entry.
 * - The run aborts if the download passes --max-mb (default 25) so a test ingest cannot eat the disk.
 * - On success the ledger entry gets mode "ingest" and an ingest record (path, bytes, date, scope).
 *   Run `pnpm --filter @repo/db db:university:sources --write` afterwards.
 */
import { mkdir, readFile, stat, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ledgerFile = path.join(root, "packages/db/src/seeds/kosmo/university/sources.json");
const REFUSED = new Set(["CC-BY-ND-4.0", "CC-BY-NC-ND-4.0", "TOS"]);

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  const [, v] = args.splice(i, 2);
  return v;
};
const maxMb = Number(flag("--max-mb", "25"));
const scope = flag("--scope", "");
const [id, ...urls] = args;
if (!id || !urls.length) {
  console.error("usage: university-ingest.mjs <SRC-id> <url>... [--max-mb 25] [--scope text]");
  process.exit(2);
}

const ledger = JSON.parse(await readFile(ledgerFile, "utf8"));
const src = ledger.sources[id];
if (!src) throw new Error(`${id} is not in the ledger; add it first`);
if (REFUSED.has(src.license) || !/^(CC0|PD|OGL|CC-BY)/.test(src.license)) {
  throw new Error(`${id} is ${src.license}: link-only, cannot be ingested`);
}
if (!scope) throw new Error("pass --scope describing what is being taken and what is left out");

const slug = id.replace(/^SRC-/, "");
const rel = `apps/web/public/kosmo/open-courses/${slug}`;
const dir = path.join(root, rel);
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });

let total = 0;
const limit = maxMb * 1024 * 1024;
try {
  for (const url of urls) {
    const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "NextWiki-OER-ingest (non-commercial education portal)" } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (total + declared > limit) throw new Error(`${url}: ${declared} bytes would pass the ${maxMb} MB cap`);
    const buf = Buffer.from(await res.arrayBuffer());
    total += buf.length;
    if (total > limit) throw new Error(`${url}: passed the ${maxMb} MB cap`);
    const disp = /filename="?([^";]+)"?/i.exec(res.headers.get("content-disposition") ?? "")?.[1];
    const name = disp || decodeURIComponent(new URL(res.url).pathname.split("/").filter(Boolean).pop() || "index.html");
    await writeFile(path.join(dir, name), buf);
    console.log(`  ${name}  ${(buf.length / 1e6).toFixed(2)} MB`);
  }
} catch (e) {
  await rm(dir, { recursive: true, force: true });
  throw e;
}

const retrievedAt = new Date().toISOString().slice(0, 10);
await writeFile(
  path.join(dir, "LICENSE-AND-CREDITS.txt"),
  [
    src.title,
    `Publisher: ${src.publisher}`,
    `Source: ${src.url}`,
    `Licence: ${src.license} (${src.licenseUrl})`,
    `Credit: ${src.attribution}`,
    src.exclusions ? `Not covered by this licence: ${src.exclusions}` : "",
    `Retrieved: ${retrievedAt}`,
    `Taken: ${scope}`,
    `Files fetched from: ${urls.join(", ")}`,
    "",
  ]
    .filter((l) => l !== "")
    .join("\n"),
);

// Count what is really on disk.
let bytes = 0;
for (const f of (await import("node:fs")).readdirSync(dir)) bytes += (await stat(path.join(dir, f))).size;

src.mode = "ingest";
src.ingest = { path: rel + "/", bytes, retrievedAt, scope };
await writeFile(ledgerFile, JSON.stringify(ledger, null, 2) + "\n");
console.log(`Ingested ${id}: ${(bytes / 1e6).toFixed(2)} MB at ${rel}/`);
