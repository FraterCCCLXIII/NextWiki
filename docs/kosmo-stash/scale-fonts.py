#!/usr/bin/env python3
"""Scales fixed pixel font sizes in the embedded Kosmographica pages (apps/web/public/kosmo/static).

Usage: python3 docs/kosmo-stash/scale-fonts.py 1.2
It multiplies `font-size: Npx`, the size in `font: ... Npx` shorthands and canvas `ctx.font = '... Npx'`
strings. It is NOT idempotent: run it once, and use git to go back. rem/em/% sizes are left alone
because they follow their (already scaled) parents.
"""
import glob, os, re, sys

factor = float(sys.argv[1])
root = os.path.join(os.path.dirname(__file__), "..", "..", "apps", "web", "public", "kosmo", "static")
files = []
for pat in ("*.html", "*.css", "oracle/*.html", "oracle/*.css", "oracle/*.js"):
    files += glob.glob(os.path.join(root, pat))
skip = re.compile(r"(-data|-claims)\.js$|kosmo-theme\.js$|gapminder")
num = r"(\d+(?:\.\d+)?)"

def scale(m):
    v = float(m.group(2)) * factor
    out = f"{round(v)}" if v >= 10 else f"{round(v, 1):g}"
    return m.group(1) + out + "px"

patterns = [
    re.compile(r"(font-size\s*:\s*)" + num + "px"),
    re.compile(r"(\bfont\s*:\s*(?:(?:italic|oblique|bold|normal|small-caps|\d{3})\s+)*)" + num + "px"),
    re.compile(r"(\.font\s*=\s*['\"`](?:(?:italic|bold|normal|\d{3})\s+)*)" + num + "px"),
]
total = 0
for f in sorted(set(files)):
    if skip.search(f):
        continue
    s = open(f, encoding="utf-8").read()
    n = s
    for p in patterns:
        n = p.sub(scale, n)
    if n != s:
        open(f, "w", encoding="utf-8").write(n)
        total += 1
        print("scaled", os.path.relpath(f, root))
print("files changed:", total)
