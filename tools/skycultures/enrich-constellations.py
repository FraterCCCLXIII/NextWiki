#!/usr/bin/env python3
"""One-shot enrichment of apps/web/public/kosmo/static/constellations.json.

Usage: python3 tools/skycultures/enrich-constellations.py <hyg_v41.csv>

* fills missing star distances (Gaia DR3 / Bailer-Jones 2021 geometric distances, and two
  literature values, see DIST_FIX),
* completes the Equuleus figure (adds HIP105570 from HYG v4.1),
* adds the Serpens `parts` (Caput / Cauda),
* writes `story` / `origin` / `year` for all 88 constellations from constellation_lore.py,
* adds the top-level `licenses` object and extends `source`.

Idempotent: re-running reproduces the same file.  Validation: validate-constellations.py.
"""
import csv, json, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from constellation_lore import LORE  # noqa: E402

JSON_PATH = os.path.join(HERE, "..", "..", "apps", "web", "public", "kosmo", "static", "constellations.json")

# HIP -> distance in parsecs.  Gaia DR3 geometric distances (Bailer-Jones et al. 2021, r_med_geo,
# external.gaiaedr3_distance on the ESA Gaia archive) for stars whose HYG distance is the 100000 "unknown"
# sentinel.  HIP5165 (Beta Phe, binary, no Gaia parallax): 17.93 mas orbital parallax of Argyle et al. 2015
# (55.77 pc).  HIP89341 (Mu Sgr, no Gaia parallax): physical companion D of the system, Gaia DR3 parallax
# 0.6455 mas, B-J geometric 1499.95 pc (the Hipparcos 2007 parallax of the primary is 0.09+-0.28 mas, useless).
DIST_FIX = {
    "HIP56243": 3782.71,   # Omi1 Cen
    "HIP89341": 1499.95,   # Mu Sgr (companion D)
    "HIP22783": 1717.79,   # Alp Cam
    "HIP37677": 1124.41,   # 3 Pup
    "HIP107259": 4495.93,  # Mu Cep (Gaia RUWE 3.1, large uncertainty: 3.0-6.2 kpc)
    "HIP54463": 4582.56,   # Car (HD 95... G0 Ia0)
    "HIP54461": 2669.88,
    "HIP54751": 3054.44,
    "HIP31216": 838.23,    # 13 Mon
    "HIP5165": 55.77,      # Bet Phe
    "HIP51624": 625.08,    # Rho Leo
    "HIP74941": 818.42,
    "HIP74778": 703.95,    # Del Cir
    "HIP92202": 391.31,
    "HIP81122": 905.68,    # Mu Nor
    "HIP33152": 782.75,    # Omi1 CMa
    "HIP2599": 999.03,     # Kap Cas
}

GREEK = {"Alp": "α", "Bet": "β", "Gam": "γ", "Del": "δ", "Eps": "ε", "Zet": "ζ", "Eta": "η", "The": "θ",
         "Iot": "ι", "Kap": "κ", "Lam": "λ", "Mu": "μ", "Nu": "ν", "Xi": "ξ", "Omi": "ο", "Pi": "π",
         "Rho": "ρ", "Sig": "σ", "Tau": "τ", "Ups": "υ", "Phi": "φ", "Chi": "χ", "Psi": "ψ", "Ome": "ω"}


def label(sid, S):
    n = S[sid][4]
    if not n:
        return "HIP " + sid[3:]
    parts = n.split(" ")
    if len(parts) == 2 and parts[0].split("-")[0] in GREEK:
        g = GREEK[parts[0].split("-")[0]]
        if "-" in parts[0]:
            g += parts[0].split("-")[1]
        return g + " " + parts[1]
    return n


def ly(pc):
    v = pc * 3.26156
    if v < 100:
        return "%d" % round(v)
    if v < 1000:
        return "%d" % (round(v / 10) * 10)
    return "{:,}".format(round(v / 100) * 100)


def spread_sentence(c, S):
    ids = {i for l in c["figure"] for i in l if S[i][2]}
    if len(ids) < 2:
        return ""
    near = min(ids, key=lambda i: S[i][2])
    far = max(ids, key=lambda i: S[i][2])
    a, b = S[near][2], S[far][2]
    if b / a < 1.6:
        return ("Seen in three dimensions, the stars of the figure lie at broadly similar distances, "
                "about %s to %s light-years from us." % (ly(a), ly(b)))
    return ("Seen in three dimensions the figure is a line-of-sight pattern: its stars range from about %s "
            "light-years (%s) to about %s light-years (%s)." % (ly(a), label(near, S), ly(b), label(far, S)))


def hyg_star(hip, path):
    for r in csv.DictReader(open(path, encoding="utf-8")):
        if r["hip"] == str(hip):
            name = r["proper"] or ((r["bayer"] + " " + r["con"]) if r["bayer"] else ((r["flam"] + " " + r["con"]) if r["flam"] else ""))
            return [round(float(r["ra"]) * 15, 4), round(float(r["dec"]), 4), round(float(r["dist"]), 2),
                    round(float(r["mag"]), 2), name, r["spect"]]
    raise SystemExit("HIP%s not in HYG" % hip)


def main(hyg):
    d = json.load(open(JSON_PATH, encoding="utf-8"))
    S = d["stars"]
    C = {c["abbr"]: c for c in d["constellations"]}

    # 2. distances
    for k, v in DIST_FIX.items():
        if k in S:
            S[k][2] = v

    # 1. Equuleus: close the quadrilateral Gam-Del-Bet-Alp (HYG v4.1 star 10 Bet Equ)
    if "HIP105570" not in S:
        S["HIP105570"] = hyg_star(105570, hyg)
    equ = C["Equ"]
    equ["figure"] = [["HIP104521", "HIP104858", "HIP105570", "HIP104987", "HIP104521"]]
    equ["main_stars"] = ["HIP104987", "HIP104858", "HIP104521", "HIP105570"]

    # 3. Serpens parts
    ser = C["Ser"]
    if "parts" not in ser:
        ser["parts"] = [
            {"name": "Serpens Caput", "latin": "Serpens Caput", "abbr": "Ser", "genitive": "Serpentis",
             "meaning": "Serpent's head", "part": "caput",
             "main_stars": ["HIP77233", "HIP76852", "HIP77450", "HIP78072", "HIP76276", "HIP77070", "HIP77622"],
             "figure": [list(ser["figure"][0])]},
            {"name": "Serpens Cauda", "latin": "Serpens Cauda", "abbr": "Ser", "genitive": "Serpentis",
             "meaning": "Serpent's tail", "part": "cauda",
             "main_stars": ["HIP86263", "HIP89962", "HIP92946", "HIP88048", "HIP88404"],
             "figure": [list(ser["figure"][1])]},
        ]

    # 4. stories
    assert set(LORE) == set(C), (set(C) ^ set(LORE))
    for ab, c in C.items():
        origin, year, story = LORE[ab]
        c["origin"] = origin
        c["year"] = year
        sp = spread_sentence(c, S)
        c["story"] = story + (" " + sp if sp else "")
    # key order: keep story last-ish but put parts after figure
    for c in d["constellations"]:
        for k in ("origin", "year", "story"):
            c[k] = c.pop(k)
    # 5. licences and sources
    d["licenses"] = {
        "stars": "CC BY-SA 4.0. The `stars` dict and the star-derived values (positions, magnitudes, spectral types, "
                 "distances) derive from the HYG Database v4.1 (David Nash, astronexus/HYG-Database), which is CC BY-SA 4.0. "
                 "Redistribution of this file or adaptations of those values must keep attribution and the same licence.",
        "distances_added": "Gaia DR3 geometric distances (Bailer-Jones et al. 2021, via the ESA Gaia archive) and one "
                           "orbital parallax (Argyle et al. 2015) fill 17 stars whose HYG distance was unknown. "
                           "Gaia data: CC BY-SA 3.0 IGO; Bailer-Jones: VizieR/CDS terms, attribution required.",
        "figures": "Stick-figure vertices from d3-celestial (BSD-3-Clause, Olaf Frohn); edits listed in `source`.",
        "text": "The `story`, `origin` and `year` fields and the Serpens `parts` text are original wording written for "
                "this project, paraphrasing public facts from Wikipedia, I. Ridpath's Star Tales, Ptolemy, Bayer, "
                "Hevelius and Lacaille. Released under the repository licence (MIT, see LICENSE.md). Names, "
                "abbreviations, areas and meanings come from Wikipedia (CC BY-SA 4.0).",
        "boundaries": "IAU constellation boundaries by E. Delporte (1930); factual, public.",
        "see": "apps/web/public/kosmo/static/skycultures/LICENSES.md",
    }
    src = [s for s in d["source"] if not s.startswith("visible_months is computed here") or "story/origin/year" in s]
    if not any(s.startswith("Distances for 17 stars") for s in src):
        src.append("Distances for 17 stars unknown in HYG (dist 100000 sentinel) were filled from Gaia DR3 geometric "
                   "distances (Bailer-Jones et al. 2021, r_med_geo; I/352 / ESA Gaia archive), Beta Phoenicis from the "
                   "Argyle et al. 2015 orbit (17.93 mas), Mu Sagittarii from its companion D (Gaia DR3 parallax 0.6455 mas). "
                   "HIP105570 was added from HYG v4.1 to close the Equuleus quadrilateral.")
        src.append("visible_months is computed here (constellation culminating around 21h local time), only for dec > -55 deg. "
                   "story/origin/year are original text (tools/skycultures/constellation_lore.py), each ending with a "
                   "sentence computed from the stars' distances; Serpens `parts` splits the figure into Caput and Cauda.")
    d["source"] = src
    out = {"source": d["source"], "licenses": d["licenses"], "fetched": d["fetched"],
           "constellations": d["constellations"], "stars": S}
    s = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(JSON_PATH), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(s)
    os.replace(tmp, JSON_PATH)
    print("written", len(s), "bytes")


if __name__ == "__main__":
    main(sys.argv[1])
