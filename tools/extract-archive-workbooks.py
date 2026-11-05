#!/usr/bin/env python3
"""Exports every sheet of the archived Kosmographica workbooks to CSV so the timeline seed can read them.

  python3 tools/extract-archive-workbooks.py [--root ~/Documents/github]

Reads  <root>/evolution-of-god/reference/atlas/sources/archive/*.xlsx
Writes packages/db/data/archive-workbooks/<workbook-slug>/<sheet-slug>.csv  (sheet title kept on the first line is NOT added;
the sheet name becomes the file name, which the seed uses as the timeline lane).
Copies of the same workbooks in Messiah-Complex and Philosophy are byte-identical, so only this one is read.
"""
import csv, os, re, sys
import openpyxl

root = os.path.expanduser(sys.argv[sys.argv.index("--root") + 1]) if "--root" in sys.argv else os.path.expanduser("~/Documents/github")
src = os.path.join(root, "evolution-of-god/reference/atlas/sources/archive")
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "packages/db/data/archive-workbooks")

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60] or "sheet"

def cell(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).replace("\r\n", "\n").replace("\r", "\n").strip()

total = 0
for f in sorted(os.listdir(src)):
    if not f.endswith(".xlsx"):
        continue
    wb = openpyxl.load_workbook(os.path.join(src, f), read_only=True, data_only=True)
    wslug = slug(os.path.splitext(f)[0])
    d = os.path.join(out, wslug)
    os.makedirs(d, exist_ok=True)
    for old in os.listdir(d):
        if old.endswith(".csv"):
            os.remove(os.path.join(d, old))
    used = set()
    n = 0
    for ws in wb.worksheets:
        rows = [[cell(c) for c in r] for r in ws.iter_rows(values_only=True)]
        rows = [r for r in rows if any(r)]
        if len(rows) < 2:
            continue
        name = slug(ws.title)
        i = 2
        while name in used:
            name = f"{slug(ws.title)}-{i}"; i += 1
        used.add(name)
        with open(os.path.join(d, name + ".csv"), "w", newline="", encoding="utf8") as fh:
            csv.writer(fh).writerows(rows)
        n += 1
    print(f"{f}: {n} sheets -> {os.path.relpath(d)}")
    total += n
print("total sheets", total)
