#!/usr/bin/env python3
"""Validate constellations.json: 88 constellations, unique ids, every figure star resolves with a positive
distance, Serpens parts resolve.  Usage: python3 validate-constellations.py [path]"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    HERE, "..", "..", "apps", "web", "public", "kosmo", "static", "constellations.json")
d = json.load(open(path, encoding="utf-8"))
S, C = d["stars"], d["constellations"]
errs = []
if len(C) != 88:
    errs.append("expected 88 constellations, got %d" % len(C))
abbrs = [c["abbr"] for c in C]
if len(set(abbrs)) != len(abbrs):
    errs.append("duplicate abbr")
if len({c["name"] for c in C}) != len(C):
    errs.append("duplicate name")
nodist = []
unres = []
segs = 0
for c in C:
    figs = [(c["abbr"], c["figure"])] + [(c["abbr"] + ":" + p["name"], p["figure"]) for p in c.get("parts", [])]
    for tag, fig in figs:
        for line in fig:
            segs += len(line) - 1
            for i in line:
                if i not in S:
                    unres.append((tag, i))
                elif not S[i][2] or S[i][2] <= 0:
                    nodist.append((tag, i))
    for k in ("story", "origin", "year"):
        if not c.get(k):
            errs.append("%s missing %s" % (c["abbr"], k))
    n = len(c["story"].split(". "))
    if not 3 <= n <= 7:
        errs.append("%s story has %d sentences" % (c["abbr"], n))
if unres:
    errs.append("unresolved: %s" % unres)
if nodist:
    errs.append("no distance: %s" % nodist)
for k, v in S.items():
    if len(v) != 6:
        errs.append("bad star row " + k)
print("constellations", len(C), "stars", len(S), "figure segments", segs,
      "stars without dist (whole dict)", sum(1 for v in S.values() if not v[2]))
print("top-level keys", list(d.keys()))
if errs:
    print("FAIL")
    for e in errs:
        print(" -", e)
    sys.exit(1)
print("OK")
