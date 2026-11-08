#!/usr/bin/env python3
"""Trace every crop with the SpaceRadio tracer, keeping its output in this folder.
Run: python trace_all.py [--only mt_06,mt_11]   (needs pillow numpy scipy opencv-python-headless cairosvg, and potrace)"""
import json, os, sys
from multiprocessing import Pool
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'spaceradio-logos'))
os.environ.setdefault('DYLD_FALLBACK_LIBRARY_PATH', '/opt/homebrew/lib')
import trace as T
T.CACHE = os.path.join(HERE, '.cache'); T.CROPS = os.path.join(T.CACHE, 'crops'); T.OUT = os.path.join(T.CACHE, 'traced')


def work(name):
    return T.work((name, 'mt'))


if __name__ == '__main__':
    os.makedirs(T.OUT, exist_ok=True)
    names = [c['name'] for c in json.load(open(os.path.join(T.CACHE, 'crops.json')))]
    if len(sys.argv) > 2 and sys.argv[1] == '--only':
        names = sys.argv[2].split(',')
    with Pool(8) as p:
        for r in p.imap_unordered(work, names):
            print(*[str(x)[:300] for x in r], flush=True)
