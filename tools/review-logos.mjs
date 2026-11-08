#!/usr/bin/env node
/* Review form for the logo reel: shows every logo a brand's sheet holds, one switch each, and writes
   the switched-off sheet numbers back to <brand>/hidden.json, then rebuilds the reel so the switches
   are the default. The vectors are never touched, so nothing is lost by switching a logo off.
   Run:  node tools/review-logos.mjs [port]   (default 4173, loopback only) */
import { execFile } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2]) || 4173;
const BRANDS = {
  "modern-telepathy-logos": "Modern Telepathy",
  "spaceradio-logos": "SpaceRadio",
  "templeos-logos": "TempleOS",
  "kosmos-logos": "Kosmos",
};
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };

const brand = (dir) => {
  if (!BRANDS[dir]) throw new Error(`unknown brand: ${dir}`);
  /* Same single payload the reel reads: every brand's build.py writes logos.json. */
  const data = join(root, dir, "logos.json");
  if (!existsSync(data)) throw new Error(`${dir}: no logos.json yet, run ${dir}/build.py once`);
  const logos = JSON.parse(readFileSync(data, "utf8"));
  const file = join(root, dir, "hidden.json");
  const hidden = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  return { dir, name: BRANDS[dir], logos, hidden };
};

const rebuild = () => new Promise((resolve) => {
  execFile(process.execPath, [join(root, "tools", "build-logo-reel.mjs")], { cwd: root }, (err, stdout, stderr) => {
    resolve((stdout + stderr).trim() || (err ? String(err.message) : "rebuilt"));
  });
});

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
};

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/api/brand") {
    try { return send(res, 200, JSON.stringify(brand(url.searchParams.get("dir") || ""))); }
    catch (err) { return send(res, 400, JSON.stringify({ error: err.message })); }
  }
  if (url.pathname === "/api/hidden" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", async () => {
      try {
        const { dir, hidden } = JSON.parse(body);
        brand(dir);
        const clean = [...new Set((hidden || []).map(Number).filter((n) => Number.isInteger(n)))].sort((a, b) => a - b);
        writeFileSync(join(root, dir, "hidden.json"), JSON.stringify(clean) + "\n");
        const log = await rebuild();
        console.log(`${dir}/hidden.json: ${clean.length} held back -> ${log.split("\n").slice(-1)[0]}`);
        send(res, 200, JSON.stringify({ ok: true, hidden: clean, log }));
      } catch (err) { send(res, 400, JSON.stringify({ error: err.message })); }
    });
    return;
  }
  const path = url.pathname === "/" ? "/tools/review-logos.html" : url.pathname;
  /* /logo-reel/... is the built reel, so "open reel" works from the form */
  const file = normalize(path.startsWith("/logo-reel/") ? join(root, "apps", "web", "public", path) : join(root, path));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, "not found", "text/plain");
  let body = readFileSync(file);
  if (path === "/tools/review-logos.html") body = Buffer.from(body.toString("utf8").replace("__BRANDS__", JSON.stringify(BRANDS)));
  send(res, 200, body, TYPES[extname(file)] || "application/octet-stream");
});

server.listen(port, "127.0.0.1", () => console.log(`logo review form: http://127.0.0.1:${port}/`));
