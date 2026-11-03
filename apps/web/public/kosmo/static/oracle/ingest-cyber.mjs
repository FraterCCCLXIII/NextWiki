#!/usr/bin/env node
/*
 * ingest-cyber.mjs — what is being exploited in the wild, 2021 to now.
 *
 *   node ingest-cyber.mjs          # fetch, derive, check, write
 *   node ingest-cyber.mjs --dry
 *
 * Cyber sits underneath every other page here: logistics, finance, food
 * distribution and command-and-control all run on the same internet, and none
 * of the models in this lab includes it because it is hard to quantify. This
 * page quantifies the one part that is published.
 *
 * Source: CISA's Known Exploited Vulnerabilities catalogue — every CVE the US
 * government has confirmed is being exploited rather than merely being
 * exploitable. That distinction is why the series is worth plotting: a
 * vulnerability database counts hypotheses, and this counts events.
 *
 * What it cannot be read as: a count of all exploitation. It is a US-agency
 * list with a legal purpose (federal remediation deadlines), so it reflects
 * what CISA prioritises and what vendors admit. Growth in it is partly growth
 * in exploitation and partly growth in the habit of cataloguing. The page says
 * so, and the checks separate the two as far as the data allows.
 */

import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);
const URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 120000);
let json;
try {
  const res = await fetch(URL, {
    signal: ctrl.signal,
    headers: { "User-Agent": "oracle-lab-ingest/1.0 (+cyber page)" }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  json = await res.json();
} finally {
  clearTimeout(timer);
}

const vulns = json.vulnerabilities;
if (!Array.isArray(vulns) || vulns.length < 500) {
  throw new Error("catalogue looks truncated: " + (vulns || []).length);
}

/* ------------------------------------------------------------ by month --- */
const monthKey = (d) => d.slice(0, 7);
const months = [];
{
  const first = vulns.map((v) => monthKey(v.dateAdded)).sort()[0];
  const last = vulns.map((v) => monthKey(v.dateAdded)).sort().pop();
  let y = +first.slice(0, 4), m = +first.slice(5, 7);
  const ey = +last.slice(0, 4), em = +last.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) {
    months.push(y + "-" + String(m).padStart(2, "0"));
    m++; if (m > 12) { m = 1; y++; }
  }
}

const perMonth = {};
for (const v of vulns) {
  const k = monthKey(v.dateAdded);
  perMonth[k] = (perMonth[k] || 0) + 1;
}
const added = months.map((k) => perMonth[k] || 0);
const cumulative = [];
added.reduce((acc, n, i) => {
  cumulative[i] = acc + n;
  return cumulative[i];
}, 0);

/* -------------------------------------------------------------- by year --- */
const isRansom = (v) => (v.knownRansomwareCampaignUse || "").toLowerCase() === "known";
const byYear = {};
for (const v of vulns) {
  const y = v.dateAdded.slice(0, 4);
  if (!byYear[y]) byYear[y] = { y, total: 0, ransom: 0 };
  byYear[y].total++;
  if (isRansom(v)) byYear[y].ransom++;
}
const years = Object.values(byYear).sort((a, b) => a.y - b.y);

/* ------------------------------------------------------------- vendors --- */
/* Vendor concentration matters because a single compromised product is a
   single point of failure across every organisation that bought it. */
const vendorMap = {};
for (const v of vulns) {
  const k = v.vendorProject || "unknown";
  if (!vendorMap[k]) vendorMap[k] = { name: k, n: 0, ransom: 0 };
  vendorMap[k].n++;
  if (isRansom(v)) vendorMap[k].ransom++;
}
const vendors = Object.values(vendorMap).sort((a, b) => b.n - a.n);
const topVendors = vendors.slice(0, 12);
const top10share = vendors.slice(0, 10).reduce((s, v) => s + v.n, 0) / vulns.length;

/* --------------------------------------------------------------- classes --- */
/* A keyword classifier, and it is only that: the catalogue carries no device
   taxonomy. The point of the split is that internet-facing edge devices are
   the ones an attacker reaches without asking anyone to click, so a rising
   share of them is a rise in a specific kind of exposure. */
const EDGE = /(vpn|firewall|gateway|router|switch|proxy|edge|load balanc|remote (access|code execution)|citrix|ivanti|fortinet|sonicwall|pulse secure|netscaler|f5 |big-?ip|pan-os|globalprotect|screenconnect|connect secure|secure connect|ssl vpn|web server|exchange server|confluence|sharepoint|teamcity|jenkins|zoho|magento|wordpress|drupal|apache|nginx|openssl|log4j|struts|spring|vmware|esxi|vcenter|exchange|outlook|chrome|android|ios |windows)/i;

let edge = 0, edgeRansom = 0;
for (const v of vulns) {
  const hay = (v.vulnerabilityName || "") + " " + (v.product || "");
  if (EDGE.test(hay)) { edge++; if (isRansom(v)) edgeRansom++; }
}

/* Lag between a CVE's publication and its addition here, where both are known.
   This is the closest the catalogue comes to a measurement of how fast a
   vulnerability becomes an incident. */
const lagDays = [];
for (const v of vulns) {
  if (!v.cveID || !v.dateAdded) continue;
  const m = /^CVE-(\d{4})-/.exec(v.cveID);
  if (!m) continue;
  /* CVE IDs are assigned before publication, so the year in the ID is a floor,
     not a date. Only years that are well before the addition are informative. */
  const cy = +m[1], ay = +v.dateAdded.slice(0, 4);
  if (ay - cy >= 1) lagDays.push(ay - cy);
}
const lagMedian = lagDays.length
  ? lagDays.sort((a, b) => a - b)[lagDays.length >> 1]
  : null;

const checks = [
  {
    label: "Entries in the catalogue",
    value: vulns.length.toLocaleString("en-US") + " · version " + (json.catalogVersion || "n/a"),
    detail: "Every CVE CISA has confirmed is being exploited, with the date it was added. The catalogue is a legal instrument — it sets remediation deadlines for US federal agencies — so it is a record of prioritisation as much as of exploitation."
  },
  {
    label: "Added in the last twelve months",
    value: added.slice(-12).reduce((s, n) => s + n, 0) + "",
    detail: "The most recent twelve months in the series. One year of additions is the right unit for comparison: the catalogue's early months are a backfill of historical exploitation, not a rate, and the chart is read from 2022 for that reason."
  },
  {
    label: "Ransomware-linked",
    value: Math.round(vulns.filter(isRansom).length / vulns.length * 100) + "% of entries",
    detail: "The catalogue flags vulnerabilities known to be used in ransomware campaigns. This is the clearest public measure of the commercialisation of exploitation: a vulnerability is not just exploitable, it is a product with customers."
  },
  {
    label: "Vendor concentration",
    value: "top 10 = " + Math.round(top10share * 100) + "% of entries",
    detail: "Share of catalogue entries belonging to the ten most-cited vendors. High concentration is a structural fact about the internet: a flaw in one widely deployed product is an event across every organisation that bought it, which is why single-product exposure behaves like systemic risk."
  },
  {
    label: "Edge and network exposure",
    value: Math.round(edge / vulns.length * 100) + "% by keyword",
    detail: "Share matching a keyword list of internet-facing products (VPNs, firewalls, gateways, mail and web servers). This is a heuristic on product names, not a device taxonomy, and it will both over- and under-count. It is here because the distinction matters: an edge device is reached without asking anyone to click."
  },
  {
    label: "Age of exploited CVEs",
    value: lagMedian == null ? "n/a" : "median " + lagMedian + " year(s) old",
    detail: "For entries whose CVE year is at least one year before the date added. A median above zero means the catalogue is dominated by vulnerabilities that were known, patchable and unpatched — exploitation is mostly a maintenance failure rather than a discovery race."
  }
];

const out = {
  generated: STAMP,
  span: { from: months[0], to: months[months.length - 1], months: months.length },
  source: {
    name: "CISA Known Exploited Vulnerabilities catalogue",
    url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    note: "A US Cybersecurity and Infrastructure Security Agency catalogue of vulnerabilities confirmed as exploited in the wild, with the date each was added. Published as a single JSON document with no key. The catalogue began in November 2021 by backfilling known exploitation, so its first months are not a rate."
  },
  months,
  added,
  cumulative,
  years,
  vendors: topVendors,
  vendorCount: vendors.length,
  top10share: +top10share.toFixed(3),
  classes: {
    edge,
    other: vulns.length - edge,
    edgeRansom,
    ransom: vulns.filter(isRansom).length
  },
  lag: { median: lagMedian, n: lagDays.length },
  checks
};

if (DRY) {
  console.log(JSON.stringify({ ...out, months: out.months.length, added: "omitted" }, null, 2));
} else {
  const body = `/* Generated by ingest-cyber.mjs on ${STAMP}. Do not edit by hand.
   ${vulns.length} entries, ${months[0]} to ${months[months.length - 1]},
   ${vendors.length} vendors, ${out.classes.ransom} ransomware-linked.
   Regenerate with:  node ingest-cyber.mjs                                    */
window.CYBER = ${JSON.stringify(out)};
`;
  fs.writeFileSync("cyber-data.js", body);
  console.log(`wrote cyber-data.js  (${(body.length / 1024).toFixed(0)} kB)`);
}

for (const c of checks) console.log(`  ${c.label}: ${c.value}`);
console.log("  months: " + months.length + ", peak month " + months[added.indexOf(Math.max.apply(null, added))] + " with " + Math.max.apply(null, added));
