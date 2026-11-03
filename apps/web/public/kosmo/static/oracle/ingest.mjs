#!/usr/bin/env node
/*
 * ingest.mjs — the calibration layer for the Dark Factory dashboard.
 *
 * Fetches live public data and writes `calibration.js`, which model.js consumes.
 * No dependencies, no API keys: every endpoint below answers keylessly.
 *
 *   node ingest.mjs            # fetch, derive, write calibration.js
 *   node ingest.mjs --dry      # derive and print, write nothing
 *
 * Sources
 *   BLS QCEW  (Quarterly Census of Employment and Wages)  employment + wages by industry
 *   BEA       value added by industry, read through FRED's public CSV endpoint
 *   BLS OEWS  national employment by occupation
 *   Eloundou  "GPTs are GPTs" occupation-level exposure scores (O*NET task ratings)
 *
 * What is measured and what is not is recorded per parameter in `provenance`.
 * The one genuinely assumed input is the staffing profile: which occupations make up
 * each sector. That is an assumption, it is written out explicitly below, and
 * `checks.wageFit` tests it against the measured wage of the same sector — so a bad
 * profile shows up as a number rather than hiding.
 */

import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const NOW = new Date();
const STAMP = NOW.toISOString().slice(0, 10);

/* ------------------------------------------------------------------ fetch */

async function get(url, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function table(text) {
  const rows = parseCSV(text.replace(/^\uFEFF/, ""));
  const head = rows.shift().map((h) => h.trim());
  return rows.filter((r) => r.length === head.length).map((r) => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i]; });
    return o;
  });
}

const num = (s) => {
  if (s === undefined || s === null) return NaN;
  const v = parseFloat(String(s).replace(/[",$]/g, ""));
  return Number.isFinite(v) ? v : NaN;
};

const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/* ------------------------------------------------------------ sector map
 *
 * Each model sector is a set of QCEW industry codes plus the BEA value-added
 * parent those codes sit under. The codes are the join key to measured data;
 * the grouping into 17 sectors is a presentational choice, not a measurement.
 */
const SECTORS = [
  { id: "software",     name: "Software & IT services",     naics: ["5415", "5417", "5132", "5182"] },
  { id: "support",      name: "Support & back office",      naics: ["561", "562"] },
  { id: "finance",      name: "Finance & insurance",        naics: ["521", "522", "523", "524", "525"] },
  { id: "media",        name: "Media, content & design",    naics: ["512", "5131", "516", "517", "519", "5414", "5418", "71"] },
  { id: "legal",        name: "Legal & professional svcs",  naics: ["5411", "5412"] },
  { id: "consulting",   name: "Management consulting",      naics: ["5413", "5416", "5419", "55"] },
  { id: "manufacturing", name: "Manufacturing",             naics: ["31-33"] },
  { id: "logistics",    name: "Logistics & transport",      naics: ["48-49"] },
  { id: "healthcare",   name: "Healthcare & social care",   naics: ["62"] },
  { id: "education",    name: "Education",                  naics: ["61"] },
  { id: "construction", name: "Construction & trades",      naics: ["23"] },
  { id: "government",   name: "Government & public sector", naics: [], gov: true },
  { id: "hospitality",  name: "Hospitality & food service", naics: ["721", "722", "81"] },
  { id: "retail",       name: "Retail & e-commerce ops",    naics: ["44-45", "42"] },
  { id: "agriculture",  name: "Agriculture & mining",       naics: ["11", "21"] },
  { id: "energy",       name: "Energy & utilities",         naics: ["22"] },
  { id: "realestate",   name: "Real estate & facilities",   naics: ["53"] }
];

/* BEA value-added parent for each QCEW code prefix. */
const PARENT_OF = [
  [/^(54|55|56)/, "PBS"],
  [/^51/, "INFO"],
  [/^(52|53)/, "FIRL"],
  [/^(61|62)/, "ESHS"],
  [/^31-33/, "MAN"],
  [/^48-49/, "TRANS"],
  [/^42$/, "WHOLESALE"],
  [/^44-45/, "RETAIL"],
  [/^23/, "CONSTR"],
  [/^11/, "AG"],
  [/^21/, "MINING"],
  [/^22/, "UTIL"],
  [/^(71|72|81)/, "RESID"]
];

/* BEA/FRED value-added series, in billions of dollars, latest quarter. */
const VA_SERIES = {
  PBS: "VAPBS",
  INFO: "VAI",
  FIRL: "VAFIRL",
  ESHS: "VAESHS",
  MAN: "VAMA",
  TRANS: "VAT",
  WHOLESALE: "VAW",
  RETAIL: "VAR",
  FI: "VAFI",
  EDU: "VAES",
  HCSA: "VAHCSA",
  CONSTR: "VAC",
  AG: "VAAFH",
  MINING: "VAM",
  UTIL: "VAU",
  GOV: "VAG",
  SPI: "VASPI" // private services-producing total: only used to derive the residual
};

/* --------------------------------------------------------- staffing profiles
 *
 * THE ONE ASSUMPTION IN THIS FILE.
 *
 * Employment share of each SOC major group within the sector. These are staffing
 * patterns — who works there — not forecasts of what a model can do. Every number
 * derived from them still uses *measured* per-occupation exposure and wages.
 *
 * `checks.wageFit` multiplies these profiles by measured occupation wages and
 * compares the result with the measured sector wage, so a wrong profile is visible.
 */
const SOC_GROUPS = {
  "11": "Management", "13": "Business & financial", "15": "Computer & mathematical",
  "17": "Architecture & engineering", "19": "Life, physical & social science",
  "21": "Community & social service", "23": "Legal", "25": "Education & library",
  "27": "Arts, design, entertainment & media", "29": "Healthcare practitioners",
  "31": "Healthcare support", "33": "Protective service", "35": "Food preparation & serving",
  "37": "Building & grounds cleaning", "39": "Personal care & service", "41": "Sales",
  "43": "Office & administrative support", "45": "Farming, fishing & forestry",
  "47": "Construction & extraction", "49": "Installation, maintenance & repair",
  "51": "Production", "53": "Transportation & material moving", "55": "Military"
};

const STAFFING = {
  software:      { "15": .46, "13": .12, "41": .11, "43": .09, "11": .08, "17": .05, "27": .03, "19": .03, "25": .02, "53": .01 },
  support:       { "43": .31, "53": .15, "13": .10, "41": .09, "37": .09, "11": .07, "51": .07, "49": .05, "21": .04, "29": .02, "39": .01 },
  finance:       { "13": .26, "43": .20, "41": .16, "11": .12, "15": .10, "23": .05, "19": .04, "37": .03, "29": .02, "53": .02 },
  media:         { "27": .34, "41": .14, "15": .13, "43": .10, "13": .09, "11": .08, "39": .04, "25": .03, "53": .03, "51": .02 },
  legal:         { "23": .40, "43": .21, "13": .13, "11": .09, "41": .08, "15": .04, "19": .02, "25": .02, "29": .01 },
  consulting:    { "13": .30, "11": .13, "17": .13, "43": .11, "41": .10, "15": .10, "19": .07, "25": .03, "53": .03 },
  manufacturing: { "51": .30, "43": .11, "49": .10, "17": .09, "11": .07, "13": .07, "53": .07, "41": .05, "19": .03, "37": .03, "29": .02, "15": .02, "47": .02, "35": .02 },
  logistics:     { "53": .55, "43": .10, "13": .08, "49": .06, "11": .05, "41": .05, "51": .04, "37": .03, "15": .02, "35": .02 },
  healthcare:    { "29": .32, "31": .28, "43": .12, "21": .07, "11": .05, "13": .04, "37": .04, "25": .03, "35": .02, "53": .02, "15": .01 },
  education:     { "25": .52, "43": .11, "11": .06, "13": .06, "21": .05, "29": .05, "37": .04, "27": .04, "39": .03, "15": .02, "53": .02 },
  construction:  { "47": .46, "49": .10, "53": .09, "43": .08, "51": .07, "11": .06, "17": .05, "13": .04, "41": .03, "37": .02 },
  government:    { "43": .20, "33": .15, "11": .10, "13": .09, "29": .08, "21": .07, "25": .06, "17": .06, "15": .05, "37": .05, "19": .04, "53": .03, "51": .02 },
  hospitality:   { "35": .52, "43": .09, "37": .08, "41": .06, "11": .05, "13": .05, "39": .04, "49": .03, "53": .03, "51": .02, "29": .02, "25": .01 },
  retail:        { "41": .50, "43": .12, "53": .10, "11": .06, "13": .06, "51": .04, "35": .04, "37": .03, "15": .02, "49": .02, "39": .01 },
  agriculture:   { "45": .30, "53": .14, "51": .12, "49": .12, "11": .07, "43": .07, "13": .06, "47": .05, "19": .03, "37": .02, "17": .02 },
  energy:        { "51": .17, "17": .15, "49": .14, "11": .10, "43": .10, "13": .08, "53": .08, "19": .06, "15": .05, "47": .04, "37": .03 },
  realestate:    { "41": .38, "43": .18, "13": .12, "11": .09, "53": .06, "37": .06, "15": .04, "23": .03, "29": .02, "49": .02 }
};

/* BEA publishes finance/insurance and real estate separately, education and health
   separately. Where a single series exists, use it directly instead of splitting by
   payroll — payroll is a terrible proxy for real estate, whose value added is mostly
   imputed rent with almost no employees. */
const DIRECT_VA = { finance: ["FI"], realestate: ["FIRL", "-FI"], education: ["EDU"], healthcare: ["HCSA"] };

/* --------------------------------------------------------------- fetching */

async function fetchQCEW() {
  // QCEW publishes quarterly; walk back from the current quarter until one answers.
  const candidates = [];
  let y = NOW.getUTCFullYear(), q = Math.floor(NOW.getUTCMonth() / 3) + 1;
  for (let i = 0; i < 6; i++) {
    candidates.push([y, q]);
    q -= 1; if (q < 1) { q = 4; y -= 1; }
  }
  for (const [yy, qq] of candidates) {
    const url = `https://data.bls.gov/cew/data/api/${yy}/${qq}/area/US000.csv`;
    try {
      const text = await get(url);
      if (text.startsWith('"area_fips"')) return { rows: table(text), url, vintage: `${yy} Q${qq}` };
    } catch { /* try the previous quarter */ }
  }
  throw new Error("QCEW: no quarter available");
}

async function fetchFred(ids) {
  const out = {};
  for (const id of ids) {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
    const rows = table(await get(url));
    let last = null, lastDate = null;
    for (const r of rows) {
      const v = num(r[Object.keys(r)[1]]);
      if (Number.isFinite(v)) { last = v; lastDate = r.observation_date || r[Object.keys(r)[0]]; }
    }
    if (last === null) throw new Error(`FRED ${id}: no observations`);
    out[id] = { value: last, date: lastDate, url };
  }
  return out;
}

async function fetchOnet() {
  // Eloundou et al., "GPTs are GPTs" — occupation-level AI exposure from O*NET task ratings.
  // alpha = any task exposed, beta = >=50% of tasks, gamma = >=80% of tasks.
  const url = "https://raw.githubusercontent.com/openai/GPTs-are-GPTs/main/data/occ_level.csv";
  const rows = table(await get(url));
  const by = {};
  for (const r of rows) {
    const soc = (r["O*NET-SOC Code"] || "").split(".")[0];
    if (!soc) continue;
    by[soc] = { beta: num(r.dv_rating_beta), gamma: num(r.dv_rating_gamma), alpha: num(r.dv_rating_alpha) };
  }
  return { by, url };
}

async function fetchOews() {
  // National employment and mean wage by occupation (cross-industry).
  const url = "https://raw.githubusercontent.com/openai/GPTs-are-GPTs/main/data/national_May2021_dl.csv";
  const rows = table(await get(url));
  const occ = [];
  for (const r of rows) {
    if (r.O_GROUP !== "detailed") continue;
    const emp = num(r.TOT_EMP);
    if (!Number.isFinite(emp) || emp <= 0) continue;
    occ.push({ soc: (r.OCC_CODE || "").trim(), group: (r.OCC_CODE || "").trim().slice(0, 2), emp, wage: num(r.A_MEAN) });
  }
  return { occ, url };
}

/* ------------------------------------------------------------------- main */

const S = {}; // sources for the output metadata
const warn = [];

console.log("fetching QCEW…");
const qcew = await fetchQCEW();
S.qcew = { name: "BLS Quarterly Census of Employment and Wages", url: qcew.url, vintage: qcew.vintage };

console.log("fetching BEA value added via FRED…");
const fredIds = Object.values(VA_SERIES).concat(["GDP", "CLF16OV", "UNRATE"]);
const fred = await fetchFred(fredIds);
S.bea = {
  name: "BEA value added by industry (via FRED series)",
  url: "https://fred.stlouisfed.org/series/" + VA_SERIES.MAN,
  vintage: fred[VA_SERIES.MAN].date,
  series: VA_SERIES
};
S.fred = {
  name: "FRED — GDP, civilian labour force, unemployment rate",
  url: "https://fred.stlouisfed.org/",
  vintage: fred.GDP.date,
  series: { GDP: "GDP", LF: "CLF16OV", UNRATE: "UNRATE" }
};

console.log("fetching O*NET exposure scores…");
const onet = await fetchOnet();
S.onet = {
  name: "Eloundou et al., GPTs are GPTs — O*NET task exposure",
  url: onet.url,
  vintage: "2023 paper, O*NET 27.x task ratings"
};

console.log("fetching OEWS occupation employment and wages…");
const oews = await fetchOews();
S.oews = {
  name: "BLS OEWS — national employment and mean wage by occupation",
  url: oews.url,
  vintage: "May 2021 (latest mirror reachable without an API key)"
};

/* ---- 1. occupation exposure by SOC major group (measured) ---- */

const groupBeta = {}, groupGamma = {}, groupWage = {}, groupEmp = {};
let matchedEmp = 0, totalEmp = 0;
for (const o of oews.occ) {
  totalEmp += o.emp;
  const ex = onet.by[o.soc];
  if (!ex) continue;
  matchedEmp += o.emp;
  const g = o.group;
  groupBeta[g] = (groupBeta[g] || 0) + o.emp * ex.beta;
  groupGamma[g] = (groupGamma[g] || 0) + o.emp * ex.gamma;
  groupEmp[g] = (groupEmp[g] || 0) + o.emp;
  if (Number.isFinite(o.wage)) groupWage[g] = (groupWage[g] || 0) + o.emp * o.wage;
}
const grp = {};
for (const g of Object.keys(groupEmp)) {
  grp[g] = {
    name: SOC_GROUPS[g] || g,
    emp: groupEmp[g],
    beta: groupBeta[g] / groupEmp[g],
    gamma: groupGamma[g] / groupEmp[g],
    wage: groupWage[g] ? groupWage[g] / groupEmp[g] : NaN
  };
}
const nationalBeta = Object.values(grp).reduce((a, x) => a + x.beta * x.emp, 0) / Object.values(grp).reduce((a, x) => a + x.emp, 0);
const nationalGamma = Object.values(grp).reduce((a, x) => a + x.gamma * x.emp, 0) / Object.values(grp).reduce((a, x) => a + x.emp, 0);

/* ---- 2. sector employment, wages and compensation from QCEW ---- */

const rows = qcew.rows;
const priv = rows.filter((r) => r.own_code === "5");
const govRows = rows.filter((r) => ["1", "2", "3"].includes(r.own_code) && r.industry_code === "10" && r.agglvl_code === "11");

const codeIndex = new Map();
for (const r of priv) {
  // 2-digit / sector codes are agglvl 14, 3-digit 15, 4-digit 16
  const ok = r.agglvl_code === "14" || r.agglvl_code === "15" || r.agglvl_code === "16";
  if (ok && !codeIndex.has(r.industry_code)) codeIndex.set(r.industry_code, r);
}

function govAggregate() {
  let emp = 0, comp = 0, wage = 0;
  for (const r of govRows) {
    const e = num(r.month1_emplvl);
    if (!Number.isFinite(e) || e <= 0) continue;
    emp += e;
    comp += num(r.total_qtrly_wages) || 0;
    wage += e * num(r.avg_wkly_wage);
  }
  return { emp, comp, wage: emp ? wage / emp : NaN };
}

const measured = [];
for (const s of SECTORS) {
  if (s.gov) {
    const g = govAggregate();
    measured.push({ id: s.id, emp: g.emp, comp: g.comp, wklyWage: g.wage, codes: ["government (federal+state+local)"] });
    continue;
  }
  let emp = 0, comp = 0, wage = 0, missing = [];
  for (const code of s.naics) {
    const r = codeIndex.get(code);
    if (!r) { missing.push(code); continue; }
    const e = num(r.month1_emplvl);
    if (!Number.isFinite(e) || e <= 0) { missing.push(code); continue; }
    emp += e;
    comp += num(r.total_qtrly_wages) || 0;
    wage += e * num(r.avg_wkly_wage);
  }
  if (missing.length) warn.push(`${s.id}: QCEW codes not found ${missing.join(", ")}`);
  measured.push({ id: s.id, emp, comp, wklyWage: emp ? wage / emp : NaN, codes: s.naics });
}

/* ---- 3. value added: allocate each BEA parent across its child sectors ---- */

/* Compensation is accumulated per code, so a sector that spans two BEA parents
   (software sits in both "professional services" and "information", media in both
   "information" and "other services") is split by measured payroll, not by guess. */
const parentComp = {};
for (const m of measured) {
  m.parents = {};
  if (m.id === "government") { m.parents.GOV = m.comp; parentComp.GOV = (parentComp.GOV || 0) + m.comp; continue; }
  const sector = SECTORS.find((s) => s.id === m.id);
  for (const code of sector.naics) {
    const r = codeIndex.get(code);
    if (!r) continue;
    const c = num(r.total_qtrly_wages) || 0;
    const hit = PARENT_OF.find(([re]) => re.test(code));
    if (!hit) { warn.push(`no BEA parent for ${m.id} code ${code}`); continue; }
    m.parents[hit[1]] = (m.parents[hit[1]] || 0) + c;
    parentComp[hit[1]] = (parentComp[hit[1]] || 0) + c;
  }
}

// The residual bucket (arts + accommodation + other services) is not published as a
// single BEA series, so it is derived: private services total minus the parents
// that are published. That is a subtraction on measured numbers, not a guess.
const va = { SPI: fred[VA_SERIES.SPI].value };
for (const p of Object.keys(VA_SERIES)) if (p !== "SPI") va[p] = fred[VA_SERIES[p]].value;
const publishedServiceParents = ["WHOLESALE", "RETAIL", "TRANS", "INFO", "FIRL", "PBS", "ESHS"];
const servicesSum = publishedServiceParents.reduce((a, p) => a + va[p], 0);
va.RESID = va.SPI - servicesSum;
if (!(va.RESID > 0)) throw new Error("BEA residual is negative — value-added series have changed shape");

const directOf = (id) => {
  const spec = DIRECT_VA[id];
  if (!spec) return null;
  return spec.reduce((a, t) => a + (t.startsWith("-") ? -va[t.slice(1)] : va[t]), 0);
};

// Direct series first, then whatever is left of each parent is split by payroll.
const allocated = {};
for (const m of measured) {
  const d = directOf(m.id);
  m.va = 0;
  if (d !== null) { m.va = d; allocated[m.id] = true; }
}
for (const m of measured) {
  if (allocated[m.id]) continue;
  for (const p of Object.keys(m.parents)) {
    m.va += va[p] * (m.parents[p] / parentComp[p]);
  }
}
const vaTotal = measured.reduce((a, m) => a + m.va, 0);

/* ---- 4. normalise employment to the household-survey aggregate ---- */

const LF = fred.CLF16OV.value / 1000;          // thousands -> millions
const URATE = fred.UNRATE.value / 100;
const GDP0 = fred.GDP.value;                   // $bn
const qcewTotal = measured.reduce((a, m) => a + m.emp, 0) / 1e6;
const employedTarget = LF * (1 - URATE);
const empScale = employedTarget / qcewTotal;

/* ---- 5. derived exposure, ceiling and threshold ---- */

function staffingProfile(id) {
  const p = STAFFING[id];
  if (!p) throw new Error(`no staffing profile for ${id}`);
  const sum = Object.values(p).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.02) warn.push(`${id}: staffing weights sum to ${round(sum, 3)}`);
  return { weights: p, sum };
}

const sectors = [];
const checks = [];

for (const s of SECTORS) {
  const m = measured.find((x) => x.id === s.id);
  const { weights, sum } = staffingProfile(s.id);
  let beta = 0, gamma = 0, impliedWage = 0;
  for (const [g, w] of Object.entries(weights)) {
    const gr = grp[g];
    if (!gr) { warn.push(`${s.id}: no measured exposure for SOC group ${g}`); continue; }
    beta += (w / sum) * gr.beta;
    gamma += (w / sum) * gr.gamma;
    if (Number.isFinite(gr.wage)) impliedWage += (w / sum) * gr.wage;
  }
  const wage = (m.wklyWage * 52) / 1000;            // $k per year, measured
  sectors.push({
    id: s.id,
    name: s.name,
    emp: round((m.emp / 1e6) * empScale, 2),          // millions, normalised
    wage: round(wage, 1),                            // $k/year, measured
    revShare: round(m.va / vaTotal, 4),
    exposure: round(beta, 3),
    ceiling: round(gamma, 3),
    threshold: round(clamp(1 - beta, 0.05, 0.95), 3),
    va: round(m.va, 1),
    laborShare: round(((m.emp / 1e6) * empScale * wage) / (GDP0 * (m.va / vaTotal)), 3),
    codes: m.codes,
    impliedWage: Number.isFinite(impliedWage) ? round(impliedWage / 1000, 1) : null
  });
}

const sectorEmp = sectors.reduce((a, s) => a + s.emp, 0);
const revSum = sectors.reduce((a, s) => a + s.revShare, 0);

const privateTotalRow = priv.find((r) => r.industry_code === "10" && r.agglvl_code === "11");
const totalQcew = (num(privateTotalRow ? privateTotalRow.month1_emplvl : 0) +
  govRows.reduce((a, r) => a + (num(r.month1_emplvl) || 0), 0)) / 1e6;

checks.push({
  id: "qcewCoverage",
  label: "QCEW employment assigned to a sector",
  value: round(qcewTotal / totalQcew, 3),
  detail: `${round(qcewTotal, 1)}M of ${round(totalQcew, 1)}M measured jobs (private + government)`,
  status: qcewTotal / totalQcew > 0.99 ? "ok" : "warn"
});

checks.push({
  id: "employmentAggregate",
  label: "Sector employment vs. labour force × (1 − U)",
  value: round(sectorEmp / employedTarget, 3),
  detail: `${round(sectorEmp, 1)}M sectors vs ${round(employedTarget, 1)}M employed (LF ${round(LF, 1)}M, U ${(URATE * 100).toFixed(1)}%)`,
  status: Math.abs(sectorEmp / employedTarget - 1) < 0.01 ? "ok" : "warn"
});

checks.push({
  id: "nationalExposure",
  label: "Employment-weighted exposure implied by the sectors",
  value: round(sectors.reduce((a, s) => a + s.exposure * s.emp, 0) / sectorEmp, 3),
  detail: `measured national mean is ${round(nationalBeta, 3)} (beta); gamma ${round(nationalGamma, 3)}`,
  status: "info"
});

checks.push({
  id: "occupationMatch",
  label: "OEWS employment matched to an O*NET exposure score",
  value: round(matchedEmp / totalEmp, 3),
  detail: `${round(matchedEmp / 1e6, 1)}M of ${round(totalEmp / 1e6, 1)}M jobs`,
  status: "ok"
});

/* The staffing profiles are the one assumption. This tests whether they put the
   sectors in the right wage order: profiles × measured occupation wages should rank
   sectors the way measured payroll does. Levels will not match — OEWS mean wages
   exclude bonuses and equity, so high-pay sectors read low — but the ranking is a
   real test of the profiles. */
function spearman(pairs) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    idx.forEach((v, i) => { r[v[1]] = i + 1; });
    return r;
  };
  const a = rank(pairs.map((p) => p[0])), b = rank(pairs.map((p) => p[1]));
  const n = a.length;
  const d2 = a.reduce((acc, v, i) => acc + (v - b[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

const wagePairs = sectors.filter((s) => s.impliedWage > 0).map((s) => [s.wage, s.impliedWage]);
checks.push({
  id: "wageRank",
  label: "Staffing profiles reproduce the measured wage ranking (Spearman ρ)",
  value: round(spearman(wagePairs), 2),
  detail: "profile weights × measured occupation wages, ranked against measured sector payroll",
  status: spearman(wagePairs) > 0.7 ? "ok" : "warn"
});

checks.push({
  id: "revShareSum",
  label: "Value-added shares sum to 1",
  value: round(revSum, 4),
  detail: `BEA value added ${round(vaTotal, 0)} of ${round(GDP0, 0)} GDP`,
  status: Math.abs(revSum - 1) < 1e-6 ? "ok" : "warn"
});

/* --------------------------------------------------------------- output */

const out = {
  meta: {
    generated: NOW.toISOString(),
    script: "ingest.mjs",
    note:
      "Generated file. Re-run `node ingest.mjs` to refresh. Every sector parameter below " +
      "carries its own provenance; nothing here is hand-edited."
  },
  sources: S,
  baseline: { lf: round(LF, 1), unrate: round(URATE, 4), gdp: round(GDP0, 0), qcewEmployment: round(qcewTotal, 1) },
  sectors,
  checks,
  groups: Object.keys(grp).sort().map((g) => ({
    code: g, name: grp[g].name, employment: round(grp[g].emp / 1e6, 2),
    beta: round(grp[g].beta, 3), gamma: round(grp[g].gamma, 3), wage: round(grp[g].wage, 0)
  })),
  staffing: STAFFING,
  provenance: {
    emp: { status: "measured", source: "qcew", detail: "QCEW employment by industry, scaled to LF×(1−U)" },
    wage: { status: "measured", source: "qcew", detail: "average weekly wage × 52, by industry" },
    revShare: { status: "measured", source: "bea", detail: "BEA value added by industry, split across sectors by measured compensation" },
    exposure: { status: "derived", source: "onet+oews", detail: "measured occupation exposure × assumed staffing profile" },
    ceiling: { status: "derived", source: "onet+oews", detail: "share of sector work with 80%+ of tasks exposed" },
    threshold: { status: "derived", source: "onet+oews", detail: "1 − exposure: the capability level at which half the sector's work is exposed" },
    priceEl: { status: "assumed", source: null, detail: "sector price elasticity — no authoritative public series" },
    wageEl: { status: "assumed", source: null, detail: "sector demand elasticity — no authoritative public series" },
    staffing: { status: "assumed", source: null, detail: "employment share of each SOC major group within a sector" }
  }
};

if (warn.length) {
  out.warnings = warn;
  console.log("\nwarnings:");
  for (const w of warn) console.log("  ! " + w);
}

console.log("\n" + "-".repeat(96));
console.log("sector            emp(M)   wage$k   VA%    exposure  ceiling  threshold  impliedW");
for (const s of sectors) {
  console.log(
    s.id.padEnd(16),
    String(s.emp).padStart(6),
    String(s.wage).padStart(8),
    (s.revShare * 100).toFixed(1).padStart(6),
    String(s.exposure).padStart(9),
    String(s.ceiling).padStart(8),
    String(s.threshold).padStart(10),
    String(s.impliedWage === null ? "-" : s.impliedWage).padStart(8)
  );
}
console.log("-".repeat(96));
for (const c of checks) console.log(` ${c.status.toUpperCase().padEnd(5)} ${c.label}: ${c.value} — ${c.detail}`);
console.log("-".repeat(96));

const js =
  "/* calibration.js — GENERATED by ingest.mjs on " + out.meta.generated + ". Do not edit by hand. */\n" +
  "var CALIBRATION = " + JSON.stringify(out, null, 2) + ";\n\n" +
  'if (typeof module !== "undefined" && module.exports) module.exports = CALIBRATION;\n';

if (DRY) {
  console.log("\n--dry: calibration.js not written");
} else {
  fs.writeFileSync("calibration.js", js);
  console.log(`\nwrote calibration.js (${(js.length / 1024).toFixed(1)} kB)`);
  if (warn.length) console.log(`${warn.length} warning(s) — see above`);
}
