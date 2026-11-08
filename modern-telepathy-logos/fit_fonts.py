#!/usr/bin/env python3
"""Replace badly damaged wordmarks with real font outlines, fitted to the source's size and spacing.
Each line is measured in the source crop, then a font is sized to that height and spaced to that width. Archivo's width axis is searched
for the closest natural proportions, so very little stretching is left over. Inter and Archivo are both under the SIL Open Font License.
Each glyph becomes its own part, so the reveals treat it as a letter. Writes .cache/fonted/mt_NN.json, which build.py prefers.
Run after trace_all.py. Needs fonttools, uharfbuzz and skia-pathops, plus the fonts in ~/Library/Fonts."""
import json, math, os, sys
import numpy as np
from PIL import Image
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.areaPen import AreaPen

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
FONTS = os.path.expanduser('~/Library/Fonts/')
INSTANCES = os.path.join(CACHE, 'font-instances')
INTER, ARCHIVO, ARCHIVO_I = 'Inter-V.ttf', 'Archivo-VariableFont_wdth,wght.ttf', 'Archivo-Italic-VariableFont_wdth,wght.ttf'
ONE = ['ModernTelepathy']; SPACED = ['Modern Telepathy']; TWO = ['Modern', 'Telepathy']; CAPS = ['MODERN', 'TELEPATHY']
# n: text lines, font file, weight, and the wordmark's box in the crop as fractions (x0, y0, x1, y1)
LOGOS = {
    10: (ONE, ARCHIVO, 600, (0, .70, 1, 1)),
    21: (CAPS, ARCHIVO, 500, (0, .70, 1, 1)),
    24: (ONE, ARCHIVO, 700, (0, 0, 1, 1)),
    29: (ONE, ARCHIVO, 650, (0, .66, 1, 1)),
    34: (ONE, ARCHIVO, 650, (0, .68, 1, 1)),
    40: (ONE, ARCHIVO, 600, (0, .72, 1, 1)),
    43: (CAPS, ARCHIVO, 400, (0, 0, 1, 1)),
    44: (ONE, ARCHIVO, 700, (0, 0, 1, .72)),
    51: (TWO, INTER, 500, (0, .56, 1, 1)),
    54: (SPACED, ARCHIVO, 500, (0, .70, 1, 1)),
    57: (TWO, ARCHIVO_I, 650, (.28, .40, 1, 1)),
    60: (ONE, ARCHIVO_I, 600, (0, .74, 1, 1)),
    68: (ONE, ARCHIVO, 650, (0, .66, 1, 1)),
    70: (ONE, ARCHIVO, 650, (0, .64, 1, 1)),
    81: (TWO, INTER, 500, (.48, 0, 1, 1)),
    83: (TWO, INTER, 450, (.46, .2, 1, .8)),
    92: (SPACED, ARCHIVO, 500, (0, .58, 1, 1)),
    93: (ONE, ARCHIVO, 700, (0, .70, 1, 1)),
}
DESCENDER_CUT = {57: .24}   # the source cuts off the y, so the last line's height is measured short by this fraction
WIDTHS = [62, 68, 75, 82, 90, 100, 112, 125]


def instance(file, wght, wdth):
    os.makedirs(INSTANCES, exist_ok=True)
    tag = '%s-%s-%s.ttf' % (file[:9].replace(',', ''), wght, wdth)
    path = os.path.join(INSTANCES, ('i-' if 'Italic' in file else '') + tag)
    if not os.path.exists(path):
        axes = {'wght': wght, 'slnt': 0} if file == INTER else {'wght': wght, 'wdth': wdth}
        instancer.instantiateVariableFont(TTFont(FONTS + file), axes, overlap=instancer.OverlapMode.REMOVE).save(path)
    return path


class Face:
    def __init__(self, path):
        self.tt = TTFont(path); self.gs = self.tt.getGlyphSet(); self.order = self.tt.getGlyphOrder()
        self.hb = hb.Font(hb.Face(hb.Blob.from_file_path(path)))

    def shape(self, text):
        buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties(); hb.shape(self.hb, buf, {'kern': True, 'liga': False})
        x, out = 0, []
        for i, p in zip(buf.glyph_infos, buf.glyph_positions):
            out.append((self.order[i.codepoint], x + p.x_offset)); x += p.x_advance
        return out

    def bounds(self, run):
        x0 = y0 = 1e9; x1 = y1 = -1e9
        for g, x in run:
            b = BoundsPen(self.gs); self.gs[g].draw(b)
            if b.bounds:
                x0, y0, x1, y1 = min(x0, b.bounds[0] + x), min(y0, b.bounds[1]), max(x1, b.bounds[2] + x), max(y1, b.bounds[3])
        return x0, y0, x1, y1


def measure(rgb, box, n_lines):
    """Ink box of each text line inside the fractional box."""
    H, W = rgb.shape[:2]
    X0, Y0, X1, Y1 = int(box[0] * W), int(box[1] * H), int(math.ceil(box[2] * W)), int(math.ceil(box[3] * H))
    a = rgb[Y0:Y1, X0:X1].astype(float)
    paper = np.median(rgb.reshape(-1, 3), axis=0)
    dist = np.sqrt(((a - paper) ** 2).sum(axis=2))
    ink = dist > .5 * np.percentile(dist, 99)
    prof = ink.sum(axis=1).astype(float)
    ys = np.where(prof > 0)[0]
    top, bot = ys[0], ys[-1] + 1
    cuts = [top]
    if n_lines == 2:
        # the emptiest row in the middle of the block separates the two lines
        lo, hi = top + (bot - top) * 3 // 10, top + (bot - top) * 7 // 10
        cuts.append(lo + int(np.argmin(prof[lo:hi + 1])))
    cuts.append(bot)
    # the wordmark's colour: the strongest ink, away from the soft edges
    colour = np.median(a[dist > .85 * np.percentile(dist, 99)], axis=0)
    out = []
    for i in range(n_lines):
        part = ink[cuts[i]:cuts[i + 1]]
        rows, cols = np.where(part.any(axis=1))[0], np.where(part.any(axis=0))[0]
        out.append({'x0': X0 + cols[0], 'x1': X0 + cols[-1] + 1, 'y0': Y0 + cuts[i] + rows[0], 'y1': Y0 + cuts[i] + rows[-1] + 1, 'ink': part.any(axis=0), 'ox': X0, 'colour': colour})
    return out


def word_spans(line):
    """Where the two words of a spaced line start and end, from the widest gap in the ink."""
    cols = line['ink']; xs = np.where(cols)[0]; best = (0, xs[0], xs[0])
    for a, b in zip(xs, xs[1:]):
        if b - a > best[0]:
            best = (b - a, a, b)
    ox = line['ox']
    return [(line['x0'], ox + best[1] + 1), (ox + best[2], line['x1'])]


def place(face, text, x0, x1, y0, y1, whole=None):
    """Glyph runs for one word group, sized to the height and spaced to the width. Returns (glyphs, leftover stretch).
    whole is the full line: its height sets the size and baseline, so two words on a line stay the same size."""
    run = face.shape(text); bx0, by0, bx1, by1 = face.bounds(run)
    if whole:
        _, by0, _, by1 = face.bounds(face.shape(whole))
    sy = (y1 - y0) / (by1 - by0); natural = (bx1 - bx0) * sy; n = max(1, len(run) - 1)
    em = sy * face.tt['head'].unitsPerEm
    track = max(-.035 * em, min(.035 * em, ((x1 - x0) - natural) / n))     # spacing takes up what it can
    sx = ((x1 - x0) - track * n) / natural                                  # any remainder is a small stretch
    out = []
    for i, (g, x) in enumerate(run):
        gx = x0 + (x - bx0) * sy * sx + track * i
        out.append((g, gx, y0 + by1 * sy, sy * sx, sy))
    return out, sx


def plan_lines(face, lines_text, lines):
    glyphs, stretch = [], []
    for row, (text, line) in enumerate(zip(lines_text, lines)):
        if ' ' in text:
            words = text.split(' ')
            for w, (a, b) in zip(words, word_spans(line)):
                g, s = place(face, w, a, b, line['y0'], line['y1'], text); glyphs += [(row, *x) for x in g]; stretch.append(s)
        else:
            g, s = place(face, text, line['x0'], line['x1'], line['y0'], line['y1']); glyphs += [(row, *x) for x in g]; stretch.append(s)
    return glyphs, stretch


def main(only=None):
    os.makedirs(os.path.join(CACHE, 'fonted'), exist_ok=True)
    for n, (text, file, wght, box) in LOGOS.items():
        if only and n not in only:
            continue
        name = 'mt_%02d' % n
        info = json.load(open(os.path.join(CACHE, 'traced', name + '.json')))
        rgb = np.array(Image.open(os.path.join(CACHE, 'crops', name + '.png')).convert('RGB'))
        lines = measure(rgb, box, len(text))
        if n in DESCENDER_CUT:
            last = lines[-1]; last['y1'] += DESCENDER_CUT[n] * (last['y1'] - last['y0'])
        widths = [100] if file == INTER else WIDTHS
        best = None
        for wd in widths:
            face = Face(instance(file, wght, wd))
            glyphs, stretch = plan_lines(face, text, lines)
            cost = sum(abs(math.log(s)) for s in stretch)
            if not best or cost < best[0]:
                best = (cost, wd, face, glyphs, stretch)
        _, wd, face, glyphs, stretch = best
        # the wordmark's traced parts go
        W, H = info['w'], info['h']; rx0, ry0, rx1, ry1 = box[0] * W - 1, box[1] * H - 1, box[2] * W + 1, box[3] * H + 1
        inside = lambda p: rx0 <= (p['b'][0] + p['b'][2]) / 2 <= rx1 and ry0 <= (p['b'][1] + p['b'][3]) / 2 <= ry1
        gone = [p for p in info['parts'] if inside(p)]
        keep = [p for p in info['parts'] if not inside(p)]
        if not gone:
            sys.exit('%s: no traced wordmark inside its box' % name)
        fill = '#%02x%02x%02x' % tuple(int(round(v)) for v in lines[0]['colour'])
        base_row = max([p.get('row', -1) for p in keep] + [-1]) + 1
        new = []
        for row, g, gx, base, sx, sy in glyphs:
            pen = SVGPathPen(face.gs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
            face.gs[g].draw(TransformPen(pen, (sx, 0, 0, -sy, gx, base)))
            d = pen.getCommands()
            if not d:
                continue
            b = BoundsPen(face.gs); face.gs[g].draw(TransformPen(b, (sx, 0, 0, -sy, gx, base)))
            ar = AreaPen(face.gs); face.gs[g].draw(ar)
            new.append({'k': 'i', 'f': fill, 'd': d, 'b': [round(v, 2) for v in b.bounds], 'a': round(abs(ar.value) * sx * sy, 1), 't': round(.09 * sy * face.tt['head'].unitsPerEm, 1), 'r': 'w', 'row': base_row + row, 'gm': '', 'ang': 0, 'ci': 0})
        info['parts'] = keep + new
        info['font'] = {'file': file, 'wght': wght, 'wdth': wd if file != INTER else None, 'text': text}
        json.dump(info, open(os.path.join(CACHE, 'fonted', name + '.json'), 'w'), separators=(',', ':'))
        print(name, file[:12], 'wght', wght, 'wdth', wd, 'stretch', ' '.join('%.2f' % s for s in stretch), 'removed', len(gone), 'glyphs', len(new), fill)


if __name__ == '__main__':
    main({int(x) for x in sys.argv[1:]} or None)
