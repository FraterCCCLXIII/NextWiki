#!/usr/bin/env python3
"""
Extracts events from the drawn "Timeline" sheet of World History Timeline 6.xlsm.

The sheet is a grid, not a table:
  * row 4 holds the year axis as sparse labels ("-3400" = 3400 BCE as written, "1BC", "AD 1", "2000").
    Labels are interpolated piecewise across columns, so a column maps to an astronomical year
    (year 0 = 1 BCE; as-written negative n -> n + 1).
  * column B holds section titles (ALL CAPS, e.g. EGYPT) and sub-titles (e.g. Egypt).
  * each event is text in the column matching its start year; "← X →" marks a span, and merged
    horizontal cells give its extent.
  * explicit dates in the text ("c. 1600 BC", "3100–2686 BC", "AD 70", "1st cent. AD") override the
    column-derived year.
  * the label area (columns left of the first axis label) only yields records when it carries a
    span marker and an explicit date (for example "← Early Bronze Age (3,500–2,350 BC)").

Usage:
  python3 tools/extract-world-history.py [--xlsm PATH] [--out PATH] [--sample N]

Writes newline-delimited JSON, one record per line, to packages/db/data/world-history.ndjson.
Requires openpyxl (read-only iteration is not used because merged ranges are needed).
"""

import argparse
import bisect
import collections
import json
import os
import random
import re
import sys

import openpyxl

DEFAULT_XLSM = "/Users/paulbloch/Documents/github/time-thread-web/World History Timeline 6.xlsm"
DEFAULT_OUT = "/Users/paulbloch/Documents/github/NextWiki/packages/db/data/world-history.ndjson"
SHEET = "Timeline"
AXIS_ROW = 4          # 1-based row holding the year axis
FIRST_DATA_ROW = 5    # rows above this are title/axis/junk
TITLE_COL = 2         # column B: section and sub-section titles
TABLE_HEADERS = {"Language", "Period", "Era", "Script"}
TABLE_SPAN_ROWS = 14  # rows below a Language/Period/Era/Script header treated as a mini table
ARROWS = ("←", "→")
DISAGREE_YEARS = 100  # text date vs column year differing by more than this is counted


# ---------------------------------------------------------------- text helpers

def clean(s):
    """Normalise whitespace, non-breaking spaces, dashes and Wingdings/PUA glyphs."""
    s = str(s)
    s = s.replace("\xa0", " ").replace(" ", " ").replace(" ", " ")
    s = s.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    s = re.sub(r"[\x80-\x9f-]", " ", s)
    s = s.replace("–", "-").replace("—", "-").replace("−", "-")
    s = re.sub(r"\s+", " ", s).strip()
    return s


LEADING_GLYPH = re.compile(r"^(?:ì|í|ï|Ø|§|•|▪|►|◄|▲|▼)+\s*")


def strip_glyphs(s):
    s = LEADING_GLYPH.sub("", s)
    return s.strip()


def letters_count(s):
    return len(re.findall(r"[^\W\d_]", s))


def is_all_caps_title(s):
    letters = re.findall(r"[^\W\d_]", s)
    return len(letters) >= 3 and s == s.upper()


# ---------------------------------------------------------------- year axis

def axis_label_year(v):
    """Axis label -> astronomical year, or None when the cell is not an axis label."""
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    if isinstance(v, int):
        return v + 1 if v < 0 else v
    s = clean(v)
    m = re.fullmatch(r"(-?\d+)", s)
    if m:
        n = int(m.group(1))
        return n + 1 if n < 0 else n
    m = re.fullmatch(r"(\d+)\s*(?:BCE|BC)", s)
    if m:
        return 1 - int(m.group(1))
    m = re.fullmatch(r"(?:AD|CE)\s*(\d+)|(\d+)\s*(?:AD|CE)", s)
    if m:
        return int(m.group(1) or m.group(2))
    return None


class Axis:
    """Piecewise-linear column -> astronomical year map built from the row-4 labels."""

    def __init__(self, anchors):
        anchors = sorted(set(anchors))
        self.cols = [c for c, _ in anchors]
        self.years = [y for _, y in anchors]
        # Labels are monotonic in column; keep only the monotonic subset if a stray label breaks it.
        keep_c, keep_y = [], []
        for c, y in zip(self.cols, self.years):
            if keep_y and y <= keep_y[-1]:
                continue
            keep_c.append(c)
            keep_y.append(y)
        self.cols, self.years = keep_c, keep_y
        self.first_col = self.cols[0]

    def year_at(self, col):
        i = bisect.bisect_right(self.cols, col)
        if i == 0:  # left of the first label: 2 years per column (the sheet's BCE scale)
            return round(self.years[0] + (col - self.cols[0]) * 2)
        if i == len(self.cols):
            return round(self.years[-1] + (col - self.cols[-1]) * 2)
        c0, c1 = self.cols[i - 1], self.cols[i]
        y0, y1 = self.years[i - 1], self.years[i]
        return round(y0 + (y1 - y0) * (col - c0) / (c1 - c0))


# ---------------------------------------------------------------- date parsing

ERA_RE = r"(?:BCE|BC|CE|AD)"
RANGE_RE = re.compile(
    r"(?<![\w])(?P<a_c>c\.\s*)?(?P<a_pre>BCE|BC|CE|AD)?\s*(?P<a>\d{1,6})(?!\d)\s*(?P<a_post>BCE|BC|CE|AD)?(?![A-Za-z])"
    r"\s*-\s*"
    r"(?P<b_c>c\.?\s*)?(?P<b_pre>BCE|BC|CE|AD)?\s*(?P<b>\d{1,6})(?!\d)\s*(?P<b_post>BCE|BC|CE|AD)?(?![A-Za-z])"
)
# "200 BC - 17th century AD", "8th century BC - c. 7th century BC", "8th to 6th centuries BC"
CENT_TOKEN = r"(?P<{p}c>\d{{1,2}})(?:st|nd|rd|th)\s+(?:centuries|century|cent\.|cent)\s*(?P<{p}e>BCE|BC|CE|AD)?"
CENT_MIX_RE = re.compile(
    r"(?<![\w])(?P<a_pre>BCE|BC|CE|AD)?\s*(?:c\.\s*)?(?P<a>\d{1,6})(?!\d)\s*(?P<a_post>BCE|BC|CE|AD)?(?![A-Za-z])\s*-\s*(?:c\.\s*)?"
    + CENT_TOKEN.format(p="b")
)
CENT_PAIR_RE = re.compile(
    r"(?:c\.\s*)?" + CENT_TOKEN.format(p="a") + r"\s*(?:-|to|and)\s*(?:c\.\s*)?" + CENT_TOKEN.format(p="b")
)
SINGLE_RE = re.compile(
    r"(?<![\w])(?P<c>c\.\s*)?(?:(?P<pre>BCE|BC|CE|AD)\s*)?(?P<n>\d{1,6})(?!\d)(?:\s*(?P<post>BCE|BC|CE|AD)(?![A-Za-z]))?"
)
CENTURY_RE = re.compile(
    r"(?:(?P<c1>\d{1,2})(?:st|nd|rd|th)\s*(?:-|to)\s*)?(?P<c2>\d{1,2})(?:st|nd|rd|th)\s+(?:centuries|century|cent\.|cent)\s*(?P<era>BCE|BC|CE|AD)?"
)
MILLENNIUM_RE = re.compile(r"(?P<n>\d)(?:st|nd|rd|th)\s+millennium\s*(?P<era>BCE|BC|CE|AD)?")
APPROX_RE = re.compile(r"\bc\.|\bca\b|circa|~|\?|approx", re.I)
MONEY_RE = re.compile(r"\b(million|billion|thousand)s?\b", re.I)


def norm_era(e):
    if e is None:
        return None
    return "BCE" if e in ("BC", "BCE") else "CE"


def astro(n, era):
    return 1 - n if era == "BCE" else n


def pick_era(candidates, col_year):
    """Choose the reading whose start is nearest the column year (CE when there is no column year)."""
    def score(c):
        era, a, b = c
        ya, yb = astro(a, era), astro(b, era)
        if col_year is None:
            return 0 if era == "CE" else 1
        return min(abs(ya - col_year), abs(yb - col_year))
    return min(candidates, key=score)


def parse_range(m, col_year=None):
    a, b = int(m.group("a")), int(m.group("b"))
    ea = norm_era(m.group("a_post") or m.group("a_pre"))
    eb = norm_era(m.group("b_post") or m.group("b_pre"))
    if ea is None and eb is None:
        if max(a, b) > 2100:
            return None  # "2000 - 3,787,319" style numbers, not dates
        # "1550-90": the short end takes the start's leading digits
        if b < a and len(str(b)) < len(str(a)):
            b = int(str(a)[: len(str(a)) - len(str(b))] + str(b))
        era, a, b = pick_era([("CE", a, b), ("BCE", a, b)], col_year)
        ea = eb = era
    elif ea is None:
        ea = eb if not (eb == "CE" and a > b) else "BCE"
    elif eb is None:
        eb = ea
    ya, yb = astro(a, ea), astro(b, eb)
    return min(ya, yb), max(ya, yb)


def century_bounds(c, era):
    """Astronomical (start, end) of the c-th century; BCE centuries run backwards."""
    if era == "BCE":
        return astro(c * 100, "BCE"), astro((c - 1) * 100 + 1, "BCE")
    return (c - 1) * 100 + 1, c * 100


def parse_date(text, col_year=None):
    """
    Returns dict {start, end, span_text, kind} for the first explicit date in text,
    or None. kind is 'range', 'single', 'century', 'millennium', 'end-only'.
    Thousands separators are removed first ("5,300 BC" -> "5300 BC").
    """
    text = re.sub(r"(?<=\d),(?=\d{3}\b)", "", text)
    for m in RANGE_RE.finditer(text):
        if MONEY_RE.search(text[m.end(): m.end() + 12]):
            continue
        r = parse_range(m, col_year)
        if r is None:
            continue
        start, end = r
        if start == end:
            return {"start": start, "end": None, "span_text": m.group(0), "kind": "single"}
        return {"start": start, "end": end, "span_text": m.group(0), "kind": "range"}

    pm = CENT_PAIR_RE.search(text)
    if pm:
        ea = norm_era(pm.group("ae") or pm.group("be"))
        eb = norm_era(pm.group("be") or pm.group("ae"))
        if ea is None and eb is None:
            ea = eb = "BCE" if (col_year is not None and col_year < 0) else "CE"
        ca, cb = int(pm.group("ac")), int(pm.group("bc"))
        s1, e1 = century_bounds(ca, ea)
        s2, e2 = century_bounds(cb, eb)
        return {"start": min(s1, s2), "end": max(e1, e2), "span_text": pm.group(0), "kind": "century"}

    cx = CENT_MIX_RE.search(text)
    if cx and not (cx.group("a_pre") or cx.group("a_post")):
        # "11-16th century": the bare first number is a century too
        eb = norm_era(cx.group("be")) or ("BCE" if (col_year is not None and col_year < 0) else "CE")
        s1, _ = century_bounds(int(cx.group("a")), eb)
        _, e2 = century_bounds(int(cx.group("bc")), eb)
        return {"start": min(s1, e2), "end": max(s1, e2), "span_text": cx.group(0), "kind": "century"}
    if cx:
        eb = norm_era(cx.group("be"))
        ea = norm_era(cx.group("a_post") or cx.group("a_pre")) or eb
        a = int(cx.group("a"))
        if eb is None:
            eb = ea or ("BCE" if (col_year is not None and col_year < 0) else "CE")
        if ea is None:
            ea = eb
        start = astro(a, ea)
        _, end = century_bounds(int(cx.group("bc")), eb)
        return {"start": min(start, end), "end": max(start, end), "span_text": cx.group(0), "kind": "range"}

    cm = CENTURY_RE.search(text)
    if cm:
        era = norm_era(cm.group("era"))
        c2 = int(cm.group("c2"))
        c1 = int(cm.group("c1")) if cm.group("c1") else c2
        if era is None:
            era = "BCE" if (col_year is not None and col_year < 0) else "CE"
        lo, hi = min(c1, c2), max(c1, c2)
        s_lo, _ = century_bounds(lo, era)
        _, e_hi = century_bounds(hi, era)
        return {"start": min(s_lo, e_hi), "end": max(s_lo, e_hi), "span_text": cm.group(0), "kind": "century"}

    mm = MILLENNIUM_RE.search(text)
    if mm:
        n = int(mm.group("n"))
        era = norm_era(mm.group("era")) or "CE"
        if era == "BCE":
            start, end = astro(n * 1000, "BCE"), astro((n - 1) * 1000 + 1, "BCE")
        else:
            start, end = (n - 1) * 1000 + 1, n * 1000
        return {"start": start, "end": end, "span_text": mm.group(0), "kind": "millennium"}

    fm = re.search(r"\b(?:from|since)\s+(\d{3,4})(?!\d)", text)
    if fm:  # "(from 1516)": a bare CE year after from/since
        return {"start": int(fm.group(1)), "end": None, "span_text": fm.group(0), "kind": "single"}

    for m in SINGLE_RE.finditer(text):
        if not (m.group("pre") or m.group("post")):
            continue  # bare numbers are not dates on their own
        if MONEY_RE.search(text[m.end(): m.end() + 12]):
            continue
        era = norm_era(m.group("pre") or m.group("post"))
        y = astro(int(m.group("n")), era)
        before = text[: m.start()]
        if re.search(r"\b(?:to|until|till)\s*$", before, re.I):
            return {"start": None, "end": y, "span_text": m.group(0), "kind": "end-only"}
        return {"start": y, "end": None, "span_text": m.group(0), "kind": "single"}
    return None


# ---------------------------------------------------------------- names

def make_name(text, summary):
    t = re.sub(
        r"\s*\((?=[^)]*(?:\d{3,}|\bBCE\b|\bBC\b|\bAD\b|\bCE\b|century|millennium|\bc\.))[^)]*\)",
        "",
        text,
    )
    t = re.sub(
        r"^(?:c\.\s*)?(?:(?:BCE|BC|CE|AD)\s*)?\d[\d,]*\s*(?:BCE|BC|CE|AD)?\s*"
        r"(?:-\s*(?:c\.\s*)?(?:(?:BCE|BC|CE|AD)\s*)?\d[\d,]*\s*(?:BCE|BC|CE|AD)?\s*)?[-:]\s*",
        "",
        t,
    )
    t = re.sub(r"^(?:c\.\s*)?\d[\d,]*\s*(?:BCE|BC|CE|AD)\s+", "", t)  # "c. 1150 BC Destruction ..."
    parts = re.split(r"(?<=[A-Za-z0-9\)\]])[.;:](?=\s)|\s-\s", t, maxsplit=1)
    name = parts[0].strip(" -:;,.")
    # dates left at the end of a name: "Neo-Assyrian period 911-609 BC"
    name = re.sub(r"\s+(?:c\.\s*)?\d[\d,]*\s*(?:-\s*\d[\d,]*\s*)?(?:BCE|BC|CE|AD)\b.*$", "", name).strip(" -:;,.")
    if letters_count(name) < 3:
        name = t.strip(" -:;,.")
    if letters_count(name) < 3:
        name = summary
    if len(name) > 140:
        name = name[:140].rsplit(" ", 1)[0]
    return name


# ---------------------------------------------------------------- extraction

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsm", default=DEFAULT_XLSM)
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--sample", type=int, default=0, help="print N random records for spot checks")
    args = ap.parse_args()

    print(f"reading {args.xlsm}", file=sys.stderr)
    wb = openpyxl.load_workbook(args.xlsm, data_only=True)
    ws = wb[SHEET]
    grid = [list(r) for r in ws.iter_rows(values_only=True)]
    merges = {}
    for rng in ws.merged_cells.ranges:
        merges[(rng.min_row, rng.min_col)] = (rng.max_row, rng.max_col)
    wb.close()

    nrows = len(grid)
    ncols = max((len(r) for r in grid), default=0)

    def val(r, c):  # 1-based
        row = grid[r - 1] if r - 1 < nrows else ()
        return row[c - 1] if c - 1 < len(row) else None

    # axis
    anchors = []
    for c in range(1, ncols + 1):
        y = axis_label_year(val(AXIS_ROW, c))
        if y is not None:
            anchors.append((c, y))
    if not anchors:
        sys.exit("no year axis found in row 4")
    axis = Axis(anchors)
    print(f"axis: {len(axis.cols)} labels, columns {axis.cols[0]}..{axis.cols[-1]}, "
          f"years {axis.years[0]}..{axis.years[-1]}", file=sys.stderr)

    # table blocks: header words mark a mini table whose body cells are label data, not events
    table_cells = set()
    for r in range(FIRST_DATA_ROW, nrows + 1):
        for c in range(1, ncols + 1):
            v = val(r, c)
            if isinstance(v, str) and clean(v) in TABLE_HEADERS:
                for rr in range(r, min(nrows, r + TABLE_SPAN_ROWS) + 1):
                    if rr != r and clean(val(rr, TITLE_COL) or "") and is_all_caps_title(clean(val(rr, TITLE_COL))):
                        break
                    for cc in [c]:
                        table_cells.add((rr, cc))

    stats = collections.Counter()
    skipped = collections.Counter()
    per_lane = collections.Counter()
    per_section = collections.Counter()
    records = []
    lane, section = "", ""

    for r in range(FIRST_DATA_ROW, nrows + 1):
        # section tracking from column B
        b = val(r, TITLE_COL)
        if isinstance(b, str):
            bt = clean(b)
            if bt and not any(a in bt for a in ARROWS) and not re.match(r"^(?:World population|Entries)", bt):
                if is_all_caps_title(bt):
                    lane, section = bt, ""
                else:
                    section = bt
        for c in range(1, ncols + 1):
            v = val(r, c)
            if v is None or isinstance(v, (int, float)) and not isinstance(v, bool):
                if v is not None and c >= axis.first_col:
                    skipped["numeric cell"] += 1
                continue
            if not isinstance(v, str):
                v = str(v)
            if c == TITLE_COL:
                continue
            raw = clean(v)
            if not raw:
                continue
            in_grid = c >= axis.first_col
            if (r, c) in table_cells:
                skipped["table body"] += 1
                continue
            has_span = any(a in raw for a in ARROWS)
            text = strip_glyphs(raw.replace("←", " ").replace("→", " "))
            text = clean(text)
            if not in_grid and not (has_span):
                # label area: only span markers carrying an explicit date are events
                skipped["label area"] += 1
                continue
            if letters_count(text) < 2:
                skipped["no words"] += 1
                continue
            if letters_count(text) < 3 and parse_date(text, col_year) is None:
                skipped["short label fragment"] += 1
                continue
            if text.lower().startswith("world population") or re.match(r"^Entries:", text):
                skipped["population or counter note"] += 1
                continue
            if not in_grid and MONEY_RE.search(text):
                skipped["label money note"] += 1
                continue

            col_year = axis.year_at(c) if in_grid else None
            dated = parse_date(text, col_year)
            if not in_grid and dated is None:
                skipped["label span without date"] += 1
                continue

            start = col_year
            end = None
            span_src = None
            if dated is not None:
                if dated["start"] is not None:
                    start = dated["start"]
                end = dated["end"] if dated["kind"] != "end-only" else None
                span_src = dated["kind"]
                if col_year is not None and dated["start"] is not None and abs(dated["start"] - col_year) > DISAGREE_YEARS:
                    stats["text date disagrees with column by >100y"] += 1
            if start is None:
                skipped["no start"] += 1
                continue

            merge = merges.get((r, c))
            if merge and has_span and merge[1] > c and end is None and in_grid:
                end = axis.year_at(merge[1])
                span_src = span_src or "merged"

            if end is not None and end == start:
                end = None
            if end is not None and end < start:
                start, end = end, start

            approx = bool(APPROX_RE.search(raw)) or (dated is not None and dated["kind"] in ("century", "millennium"))
            name = make_name(text, text)
            if letters_count(name) < 2:
                skipped["no name"] += 1
                continue

            rec = {
                "key": f"r{r}c{c}",
                "row": r,
                "col": c,
                "cell": f"{openpyxl.utils.get_column_letter(c)}{r}",
                "lane": lane or "(untitled)",
                "section": section or "",
                "name": name,
                "summary": text,
                "start": int(start),
                "end": int(end) if end is not None else None,
                "approx": approx,
                "source_area": "grid" if in_grid else "label",
                "column_year": int(col_year) if col_year is not None else None,
                "date_text": dated["span_text"] if dated else None,
                "date_kind": span_src,
                "has_span": has_span,
            }
            records.append(rec)
            stats["records"] += 1
            stats["explicit text date" if dated else "column-derived"] += 1
            if rec["source_area"] == "label":
                stats["label-area spans with date"] += 1
            per_lane[rec["lane"]] += 1
            per_section[(rec["lane"], rec["section"])] += 1

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print(f"\nwrote {len(records)} records to {args.out}")
    print(f"explicit text date: {stats['explicit text date']}  column-derived: {stats['column-derived']}")
    print(f"label-area spans with date: {stats['label-area spans with date']}")
    print(f"text date disagrees with column by >100y: {stats['text date disagrees with column by >100y']}")
    print("skipped:", dict(skipped))
    print("\nper lane (section title):")
    for k, v in per_lane.most_common():
        print(f"  {v:6d}  {k}")
    print(f"\nper sub-section: {len(per_section)} groups (top 15):")
    for (lk, sk), v in per_section.most_common(15):
        print(f"  {v:6d}  {lk} / {sk or '-'}")
    if args.sample:
        rnd = random.Random(42)
        for rec in rnd.sample(records, min(args.sample, len(records))):
            print(json.dumps({k: rec[k] for k in ("cell", "lane", "section", "name", "start", "end", "approx", "column_year", "date_text")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
