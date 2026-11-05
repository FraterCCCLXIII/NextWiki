#!/usr/bin/env node
/* Numbered selection sheet of every logo's final frame, similar ones together.
   Run: node kosmographica-logos/build-sheet.mjs  →  sheet.html + sheet-numbers.json (number → logo id) */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const match = readFileSync(join(dir, "traced-v2-clean.html"), "utf8").match(/const TRACED=(\{.*\})/);
if (!match) throw new Error("TRACED not found");
const TRACED = JSON.parse(match[1]);
const reveals = readFileSync(join(dir, "clean-reveals.js"), "utf8");
const buildTraced = new Function("TRACED", "document", `${reveals}\nreturn buildTraced;`)(TRACED, {});

/* Within a group, the same idea from different sheets sits side by side. */
const GROUPS = [
  ["Rainbow K, striped arms", ["10", "17", "D09", "29", "C02", "50", "61"]],
  ["K as a mark", ["56", "63", "34", "12", "D11"]],
  ["Rainbow arcs and fans", ["49", "D12", "Star", "32"]],
  ["Discs and bullseyes", ["D07", "C07", "60"]],
  ["Stripes that turn a corner", ["28", "36", "C04", "D10"]],
  ["Slanted speed stripes", ["33", "C01", "11", "18", "D14", "C06"]],
  ["Straight colour bars", ["52", "C03", "30", "D08", "59", "57", "31", "54"]],
  ["Framed and ringed", ["C05", "16"]],
  ["Band through the word", ["35", "C09"]],
  ["Stairs and rising bars", ["14", "C08", "D02", "D13", "D15"]],
  ["Wedges, arrows and beams", ["D05", "15", "D01", "38", "D03"]],
  ["Swooshes, orbits and ribbons", ["51", "D06", "62", "58", "D04"]],
  ["Colour in the letters and pixels", ["55", "64", "13", "42", "53"]],
];

const placed = GROUPS.flatMap(([, ids]) => ids);
const missing = Object.keys(TRACED).filter((id) => !placed.includes(id));
const unknown = placed.filter((id) => !TRACED[id]);
const dupes = placed.filter((id, i) => placed.indexOf(id) !== i);
if (unknown.length || dupes.length) throw new Error(`unknown: ${unknown} dupes: ${dupes}`);
if (missing.length) GROUPS.push(["Other", missing]);

let n = 0;
const numbers = {};
const body = GROUPS.map(([title, ids]) => {
  const cells = ids
    .map((id) => {
      n += 1;
      numbers[n] = id;
      return `<figure style="background:${TRACED[id].paper || "#fdf7ee"}"><figcaption><b>${n}</b><span>${id}</span></figcaption>${buildTraced(id, `s${n}`)}</figure>`;
    })
    .join("");
  return `<section><h2>${title}</h2><div class="grid">${cells}</div></section>`;
}).join("");

writeFileSync(join(dir, "sheet-numbers.json"), JSON.stringify(numbers, null, 1));
writeFileSync(
  join(dir, "sheet.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kosmographica Logo Sheet</title>
<style>
*{box-sizing:border-box;margin:0}
body{background:#15151b;color:#ececf1;font:14px/1.4 system-ui,sans-serif;padding:20px 16px 48px}
h1{font-size:20px;font-weight:600}
p{color:#a4a4b2;margin:4px 0 20px}
h2{font-size:13px;font-weight:600;letter-spacing:.04em;color:#c8c8d4;margin:24px 0 10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
figure{position:relative;aspect-ratio:3/2;border-radius:8px;overflow:hidden;padding:28px 12px 8px}
figcaption{position:absolute;left:10px;top:6px;right:10px;display:flex;justify-content:space-between;align-items:baseline;color:#17171b}
figcaption b{font-size:18px}
figcaption span{font-size:11px;color:#6d6d78}
.logo{width:100%;height:100%}
svg{display:block;width:100%;height:100%;overflow:visible}
svg *{transform-box:fill-box;transform-origin:50% 50%}
</style></head><body><h1>Kosmographica logos</h1><p>${n} logos, grouped by idea. Pick by the big number. The small label is the logo's id.</p>${body}</body></html>`
);
console.log(`${n} logos in ${GROUPS.length} groups${missing.length ? `; ungrouped: ${missing}` : ""}`);
