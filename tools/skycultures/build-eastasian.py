#!/usr/bin/env python3
"""Build chinese.json / korean.json / japanese.json sky cultures from Stellarium's
skycultures (index.json + description.md) and HYG v4.1.

usage: build-eastasian.py <srcdir> <outdir> <constellations.json>
srcdir holds chinese.json chinese.md korean.json korean.md japanese.json japanese.md hyg.csv
(downloaded from github.com/Stellarium/stellarium skycultures/<id>/ and
github.com/astronexus/HYG-Database hyg/CURRENT/hygdata_v41.csv).
"""
import csv, json, re, sys, collections

src, out, consfile = sys.argv[1:4]
STARS = json.load(open(consfile))["stars"]

HYG = {}
with open(f"{src}/hyg.csv", encoding="utf8") as f:
    for r in csv.DictReader(f):
        if r["hip"]:
            HYG[int(r["hip"])] = r


def extra_star(hip):
    r = HYG[hip]
    name = r["proper"] or (
        f'{r["bayer"]} {r["con"]}' if r["bayer"] and r["con"] else
        f'{r["flam"]} {r["con"]}' if r["flam"] and r["con"] else f"HIP {hip}")
    d = float(r["dist"]) if r["dist"] else None
    if d is not None and d >= 99999:
        d = None
    return [round(float(r["ra"]) * 15, 4), round(float(r["dec"]), 4),
            None if d is None else round(d, 2), float(r["mag"]), name, r["spect"]]


stats = collections.defaultdict(lambda: collections.Counter())


def convert_lines(cult, lines):
    """HIP int lists -> our polylines; drop DSO/Gaia/unknown ids, splitting runs."""
    res, extra = [], {}
    for ln in lines:
        run = []
        for s in ln:
            ok = isinstance(s, int) and s > 0 and (f"HIP{s}" in STARS or s in HYG)
            if not ok:
                stats[cult]["dropped_points"] += 1
                if len(run) > 1:
                    res.append(run)
                run = []
                continue
            k = f"HIP{s}"
            if k not in STARS and k not in extra:
                extra[k] = extra_star(s)
            run.append(k)
        if len(run) > 1:
            res.append(run)
    return res, extra


SYMBOLS = [  # (english, native, romanized per culture)
    ("Azure Dragon of the East", {"chinese": ("苍龙", "Cānglóng"), "korean": ("청룡(靑龍)", "Cheongnyong"), "japanese": ("青龍(せいりゅう)", "Seiryū")}),
    ("Black Tortoise of the North", {"chinese": ("玄武", "Xuánwǔ"), "korean": ("현무(玄武)", "Hyeonmu"), "japanese": ("玄武(げんぶ)", "Genbu")}),
    ("White Tiger of the West", {"chinese": ("白虎", "Báihǔ"), "korean": ("백호(白虎)", "Baekho"), "japanese": ("白虎(びゃっこ)", "Byakko")}),
    ("Vermilion Bird of the South", {"chinese": ("朱雀", "Zhūquè"), "korean": ("주작(朱雀)", "Jujak"), "japanese": ("朱雀(すざく)", "Suzaku")}),
]
SYM_MEANING = ["Azure Dragon (east, spring)", "Black Tortoise (north, winter)", "White Tiger (west, autumn)", "Vermilion Bird (south, summer)"]


def sym_of(n):  # mansion number 1..28
    return (n - 1) // 7


def four_symbols(cult, mansion_figs):
    """mansion_figs: list of 28 figures in mansion order."""
    figs = []
    for i, (en, nat) in enumerate(SYMBOLS):
        ms = mansion_figs[i * 7:(i + 1) * 7]
        lines, extra = [], {}
        for m in ms:
            lines += m["lines"]
            extra.update(m.get("extraStars", {}))
        fig = {
            "id": f"{cult}-four-symbols-{en.split()[0].lower()}",
            "name": en, "native": nat[cult][0], "romanized": nat[cult][1],
            "meaning": SYM_MEANING[i], "kind": "constellation", "group": "Four Symbols",
            "lines": lines,
        }
        if extra:
            fig["extraStars"] = extra
        fig["story"] = (f"One of the Four Symbols (sixiang); it governs seven of the Twenty-Eight Mansions: "
                        + ", ".join(m["name"] for m in ms)
                        + ". Lines shown are the union of those seven mansion asterisms (derived, not a separate historical star pattern).")
        figs.append(fig)
    return figs


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def mk(cult, key, name, native, rom, kind, group, lines, extra, story, **kw):
    fig = {"id": f"{cult}-{key}", "name": name, "native": native, "romanized": rom,
           "meaning": name, "kind": kind, "group": group, "lines": lines}
    if extra:
        fig["extraStars"] = extra
    fig["story"] = story
    fig.update(kw)
    return fig


# ---------------------------------------------------------------- Chinese
def build_chinese():
    d = json.load(open(f"{src}/chinese.json"))
    mans = d["lunar_system"]["names"]
    man_native = [m["native"] + "宿" for m in mans]
    sym_names = [s[0] for s in SYMBOLS]
    rows = []
    for l in open(f"{src}/chinese.md", encoding="utf8").read().split("\n")[130:488]:
        if not l.startswith("|<notr>"):
            continue
        m = re.findall(r"<notr>(.*?)</notr>", l)
        parts = l.strip("|").split("|")
        en = re.sub(r"<.*?>", "", parts[2]).strip()
        counts = [re.sub(r"<.*?>", "", p).strip() for p in parts[3:5]]
        rows.append((m[0].strip(), m[1].strip(), en, counts))
    entries = d["constellations"]
    def clean(n):
        return re.sub(r"\(.*?\)", "", n).replace("*", "").strip()
    used = set()
    figs, order = [], []
    group = "Other"
    cur_ctx = None
    for nat, pin, en, counts in rows:
        header = counts[0] == ""
        if header:
            if nat.endswith("垣"):
                group = f"Three Enclosures / {en}"; cur_ctx = nat
            elif nat in man_native:
                i = man_native.index(nat)
                group = f"Four Symbols / {sym_names[sym_of(i + 1)]} / {en}"; cur_ctx = nat
            else:
                group = "Southern Sky (added late Ming dynasty)"; cur_ctx = None
            # mansion main xingguan has the mansion's own name
        cands = [e for e in entries if e["id"] not in used and clean(e["common_name"]["native"]) == clean(nat)]
        if not cands:
            continue
        if len(cands) > 1:
            pref = [e for e in cands if f"({cur_ctx})" in e["common_name"]["native"]]
            cands = pref or cands
        e = cands[0]
        used.add(e["id"])
        lines, extra = convert_lines("chinese", e["lines"])
        ismansion = header and nat in man_native
        cn = e["common_name"]
        if ismansion:
            kind = "mansion"
        else:
            kind = "asterism"
        prim, added = counts
        story = (f"Xingguan (star official) of the {group.split(' / ')[-1] if not header else en}. "
                 if not ismansion else f"Main xingguan of the {en}, one of the Twenty-Eight Mansions. ")
        if prim.isdigit():
            story += f"Per the Yixiang kaocheng (1756) and its 1844 continuation it has {prim} primary stars and {added} added stars. "
        story += "Identification from Stellarium's Chinese sky culture (Sun Shuwei, based on Yi Shitong's catalogue)."
        figs.append(mk("chinese", slug(e["id"].split()[-1]) and f"{e['id'].split()[-1]}-" + slug(cn["english"]),
                       cn["english"], cn["native"], cn["pronounce"], kind, group, lines, extra, story))
        order.append(e["id"])
    # anything left (not in table)
    for e in entries:
        if e["id"] in used:
            continue
        lines, extra = convert_lines("chinese", e["lines"])
        cn = e["common_name"]
        figs.append(mk("chinese", e["id"].split()[-1] + "-" + slug(cn["english"]), cn["english"], cn["native"],
                       cn["pronounce"], "asterism", "Other",
                       lines, extra, "Xingguan from Stellarium's Chinese sky culture."))
        stats["chinese"]["not_in_table"] += 1
    byname = {f["name"] + "|" + f["group"]: f for f in figs}
    # enclosures
    encl = {"Purple Forbidden Enclosure": ("紫微垣", "Zǐwēiyuán", ["Purple Forbidden Left Wall", "Purple Forbidden Right Wall"], "the emperor's inner palace around the north celestial pole"),
            "Supreme Palace Enclosure": ("太微垣", "Tàiwēiyuán", ["Supreme Palace Left Wall", "Supreme Palace Right Wall"], "the court and government offices, covering Virgo, Coma Berenices and Leo"),
            "Heavenly Market Enclosure": ("天市垣", "Tiānshìyuán", ["Heavenly Market Left Wall", "Heavenly Market Right Wall"], "the celestial marketplace, covering Serpens, Ophiuchus, Aquila and Corona Borealis")}
    agg = []
    for en, (nat, rom, walls, desc) in encl.items():
        lines, extra = [], {}
        for w in walls:
            f = next(x for x in figs if x["name"] == w)
            lines += f["lines"]; extra.update(f.get("extraStars", {}))
        fig = mk("chinese", "enclosure-" + slug(en), en, nat, rom, "constellation", "Three Enclosures", lines, extra,
                 f"One of the Three Enclosures (san yuan): {desc}. Lines shown are its left and right walls (derived).")
        agg.append(fig)
    mans_figs = []
    for nat in man_native:
        mans_figs.append(next(f for f in figs if f["kind"] == "mansion" and f["native"].replace("宿", "") == nat.replace("宿", "")))
    agg += four_symbols("chinese", mans_figs)
    figs = agg + figs
    return {
        "id": "chinese", "name": "Chinese", "region": "East Asia", "era": "c. 1000 BCE - present",
        "color": "#e2554b",
        "description": "The traditional Chinese star system: Three Enclosures around the pole, the Twenty-Eight Mansions along the ecliptic grouped into the Four Symbols, and the xingguan asterisms of the Yixiang kaocheng.",
        "source": [
            "Stellarium sky culture 'chinese' (index.json, description.md): https://github.com/Stellarium/stellarium/tree/master/skycultures/chinese - Karrie Berglund (Digitalis Education Solutions) from Hong Kong Space Museum maps; Sun Shuwei (200+ xingguan, 3000+ stars) after Yi Shitong, Chinese and Western Contrast Star Chart and Catalogue 1950.0, and Yixiang kaocheng (1756) / Xubian (1844).",
            "HYG Star Database v4.1 (astronexus/HYG-Database, hyg/CURRENT/hygdata_v41.csv) for stars not already in constellations.json: https://github.com/astronexus/HYG-Database",
        ],
        "license": "CC-BY-SA-4.0 (Stellarium skycultures/chinese; HYG v4.1 data also CC-BY-SA-4.0). Share-alike applies to this file.",
        "figures": figs,
    }


# ------------------------------------------------------- Korean / Japanese
def paragraphs(cult, start, key):
    L = open(f"{src}/{cult}.md", encoding="utf8").read().split("\n")[start:]
    secs, cur = [], None
    for l in L:
        if l.startswith("#####"):
            cur = [l.lstrip("#").strip(), []]; secs.append(cur)
        elif l.startswith("##"):
            break
        elif cur is not None:
            cur[1].append(l)
    res = []
    for h, body in secs:
        paras = [p.strip() for p in "\n".join(body).split("\n\n") if p.strip() and not p.strip().startswith(("!", "<", "|"))]
        res.append((h, paras))
    return res


def short_story(paras):
    if not paras:
        return None
    t = paras[0]
    t = re.sub(r"!\[.*?\]\(.*?\)", "", t)
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"[*_]", "", t)
    sents = re.split(r"(?<=[.!?])\s+", t)
    return " ".join(sents[:3]).strip()


def build_east(cult):
    d = json.load(open(f"{src}/{cult}.json"))
    mans = d["lunar_system"]["names"]
    entries = d["constellations"]
    start = 99 if cult == "korean" else 113
    secs = paragraphs(cult, start, cult)
    byhead = collections.defaultdict(list)
    for h, p in secs:
        byhead[h.lower()].append(p)
    figs, man_figs = [], {}
    seen = collections.Counter()
    last_man = 0
    enclosure = {"P": "Purple Forbidden Enclosure", "S": "Supreme Palace Enclosure", "H": "Heavenly Market Enclosure"}
    jidx = 0
    for e in entries:
        raw = e["id"].split()[-1]
        cn = e["common_name"]
        lines, extra = convert_lines(cult, e["lines"])
        seen[raw] += 1
        key = raw + ("x" if seen[raw] > 1 else "")
        if raw[0] in "PSH":
            group = f"Three Enclosures / {enclosure[raw[0]]}"
            kind = "asterism"
        elif raw[0] == "J":
            group = "Japanese additions (Tenmon Kyoto)"
            kind = "asterism"
        else:
            n = int(raw[:2])
            letter = raw[2]
            # Japanese data repeats id 05A for the Tail mansion; fix by sequence
            if letter == "A" and n == last_man and seen[raw] > 1:
                n += 1; key = f"{n:02d}A"
            last_man = n
            m = mans[n - 1]
            group = f"Four Symbols / {SYMBOLS[sym_of(n)][0]} / {m['english']} Mansion"
            kind = "mansion" if letter == "A" and key.startswith(f"{n:02d}A") else "asterism"
        name = cn["english"]
        story = None
        hs = byhead.get(name.lower()) or byhead.get(re.sub(r"\s*\(.*?\)", "", name).lower())
        if cult == "japanese" and raw[0] == "J":
            jidx += 1
            hs = [secs[jidx - 1][1]] if jidx <= len(secs) else None
        if hs:
            story = short_story(hs.pop(0))
        if not story:
            story = f"{name}, an East Asian star official as identified in Stellarium's {cult.capitalize()} sky culture."
        if kind == "mansion":
            story = f"One of the Twenty-Eight Mansions ({m['english']}). " + story
            story = story if len(story) < 700 else story[:700].rsplit(" ", 1)[0] + "..."
        fig = mk(cult, key + "-" + slug(name), name, cn["native"], cn["pronounce"], kind, group, lines, extra, story)
        if "lines1" in e:
            stats[cult]["alt_lines_dropped"] += 1
        figs.append(fig)
        if kind == "mansion":
            man_figs[n] = fig
    ordered = [man_figs[i] for i in range(1, 29)]
    figs = four_symbols(cult, ordered) + figs
    return figs


def build_korean():
    return {
        "id": "korean", "name": "Korean", "region": "East Asia", "era": "Goguryeo tomb murals (c. 5th c.) - Joseon (Cheonsang Yeolcha Bunyajido, 1395)",
        "color": "#3fb6c9",
        "description": "The Korean form of the Chinese star system: Three Palaces (enclosures), Twenty-Eight Mansions (isipalsu) and the Four Symbols, with Korean readings of the Hanja names.",
        "source": [
            "Stellarium sky culture 'korean' (index.json, description.md): https://github.com/Stellarium/stellarium/tree/master/skycultures/korean - contributed by Jeong Tae-Min; star identification by Lyu Haocheng.",
            "HYG Star Database v4.1 (astronexus/HYG-Database): https://github.com/astronexus/HYG-Database",
        ],
        "license": "GPL-2.0 (Stellarium skycultures/korean states 'GNU GPL v2.0'; names/identifications/descriptions derive from it). Star rows from HYG v4.1 are CC-BY-SA-4.0. Licence compatibility of the GPL-2.0 part with the rest of the dataset is unresolved: flag for the license agent.",
        "figures": build_east("korean"),
    }


def build_japanese():
    return {
        "id": "japanese", "name": "Japanese", "region": "East Asia", "era": "Nara/Heian period - Edo period (Yasui Santetsu / Shibukawa Harumi, Tenmon Seisho)",
        "color": "#e8b84a",
        "description": "Japan's adaptation of the Chinese star system as shown on the Edo-era Yasui (Shibukawa Harumi) star map, with Japanese readings, the 28 shuku with their native star names, and 61 asterisms (J01-J61) unique to Japan named for the Ritsuryo court offices.",
        "source": [
            "Stellarium sky culture 'japanese' (index.json, description.md): https://github.com/Stellarium/stellarium/tree/master/skycultures/japanese - Alexander Wolf; 300+ constellations and description by Lyu Haocheng, after the Tenmon Seisho / Tenmon Kyoto star charts.",
            "HYG Star Database v4.1 (astronexus/HYG-Database): https://github.com/astronexus/HYG-Database",
        ],
        "license": "CC-BY-SA-4.0 (Stellarium skycultures/japanese; HYG v4.1 data also CC-BY-SA-4.0). Share-alike applies to this file.",
        "figures": build_east("japanese"),
    }


for name, fn in [("chinese", build_chinese), ("korean", build_korean), ("japanese", build_japanese)]:
    c = fn()
    ids = collections.Counter(f["id"] for f in c["figures"])
    for i, n in ids.items():
        if n > 1:
            k = 0
            for f in c["figures"]:
                if f["id"] == i:
                    k += 1
                    if k > 1:
                        f["id"] = f"{i}-{k}"
    omitted = [f["name"] for f in c["figures"] if not f["lines"]]
    c["figures"] = [f for f in c["figures"] if f["lines"]]
    if omitted:
        print(name, "omitted (only DSO/Gaia/unresolvable points, no drawable line):", omitted)
    json.dump(c, open(f"{out}/{name}.json", "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    kinds = collections.Counter(f["kind"] for f in c["figures"])
    print(name, len(c["figures"]), dict(kinds), dict(stats[name]))
