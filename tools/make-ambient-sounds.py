#!/usr/bin/env python3
"""Make the ambient intro sounds: no beat, no melody, slow swells that sit under a logo reveal.
Half are the original clips stretched until their rhythm dissolves, which keeps their tone. Half are synthesized drones and pads.
Same seed, same files. Writes .m4a to kosmographica-logos/audio and spaceradio-logos/audio. Needs numpy, scipy, and macOS afconvert."""
import os, shutil, subprocess, tempfile, wave
import numpy as np
from scipy.signal import fftconvolve, butter, sosfiltfilt

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'kosmographica-logos', 'audio')
OUTS = [SRC, os.path.join(ROOT, 'spaceradio-logos', 'audio')]
SR = 44100
LEN = 10.0
rng = np.random.default_rng(1977)


def read(path):
    t = tempfile.mktemp(suffix='.wav')
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@%d' % SR, '-c', '1', path, t], check=True)
    w = wave.open(t); a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768; w.close(); os.remove(t)
    return a


def stretch(a, seconds, W=2 ** 16):
    """Paulstretch: overlapping long windows with random phases, so transients melt away. Two runs make it stereo."""
    n = int(seconds * SR); hop = W // 4; win = np.hanning(W); out = np.zeros((n + W, 2))
    step = max(1, int((len(a) - W) / (n / hop))) if len(a) > W else 1
    pad = np.concatenate([a, np.zeros(W)])
    for ch in range(2):
        pos = 0.0
        for i in range(0, n, hop):
            seg = pad[int(pos):int(pos) + W]
            if len(seg) < W:
                seg = np.pad(seg, (0, W - len(seg)))
            mag = np.abs(np.fft.rfft(seg * win))
            out[i:i + W, ch] += np.fft.irfft(mag * np.exp(2j * np.pi * rng.random(len(mag)))) * win
            pos = min(pos + step, max(0, len(a) - W // 2))
    return out[:n]


def lowpass(x, hz, order=4):
    return sosfiltfilt(butter(order, hz, 'low', fs=SR, output='sos'), x, axis=0)


def reverb(x, seconds=3.5, mix=.45, cut=4500):
    n = int(seconds * SR); t = np.arange(n) / SR
    ir = lowpass(rng.standard_normal((n, 2)), cut) * np.exp(-t * 6.9 / seconds)[:, None]
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    wet /= np.max(np.abs(wet)) + 1e-9
    return x / (np.max(np.abs(x)) + 1e-9) * (1 - mix) + wet * mix


def tone(hz, seconds, detune=.0, phase_drift=.15):
    """A sine that wanders very slightly, so nothing sounds static."""
    t = np.arange(int(seconds * SR)) / SR
    wob = np.sin(2 * np.pi * rng.uniform(.03, .11) * t + rng.uniform(0, 6)) * phase_drift
    return np.sin(2 * np.pi * hz * (1 + detune) * t + wob * 2 * np.pi)


def pad(freqs, seconds=LEN, harmonics=(1, .35, .12), detune=.0015):
    t = int(seconds * SR); x = np.zeros((t, 2))
    for f in freqs:
        for h, amp in enumerate(harmonics, 1):
            for ch, d in ((0, -detune), (1, detune)):
                x[:, ch] += amp * tone(f * h, seconds, d)
    return x


def slow_swell(seconds, peak_at=.45):
    t = np.linspace(0, 1, int(seconds * SR))
    rise = np.clip(t / peak_at, 0, 1); fall = np.clip((1 - t) / (1 - peak_at), 0, 1)
    return (np.sin(rise * np.pi / 2) ** 2 * np.sin(fall * np.pi / 2) ** .6)[:, None]


def finish(x):
    """Long fade in and out, then an even loudness across the set."""
    n = len(x); fi = int(1.6 * SR); fo = int(3.2 * SR); env = np.ones(n)
    env[:fi] = np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
    env[-fo:] = np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    x = x * env[:, None] - np.mean(x * env[:, None], axis=0)
    x *= 10 ** (-20 / 20) / (np.sqrt(np.mean(x ** 2)) + 1e-9)
    p = np.max(np.abs(x))
    return x * (.89 / p) if p > .89 else x


def stretched(name, cut):
    return finish(reverb(lowpass(stretch(read(os.path.join(SRC, name)), LEN), cut)))


def deep_space():      # open fifth far down, with air
    a = pad([41.2, 61.74, 82.41], harmonics=(1, .5, .25, .1)); return finish(reverb(lowpass(a, 900) * slow_swell(LEN), mix=.35))


def nebula():          # filtered noise rising under a quiet fifth
    n = lowpass(rng.standard_normal((int(LEN * SR), 2)), 1400); n /= np.max(np.abs(n))
    return finish(reverb(n * .5 * slow_swell(LEN, .6) + pad([110, 164.81], harmonics=(1, .2)) * .35 * slow_swell(LEN, .55), mix=.5))


def glass():           # pure high partials beating slowly
    return finish(reverb(pad([392.0, 587.33, 880.0, 1318.5], harmonics=(1,), detune=.0009) * slow_swell(LEN, .5), mix=.6, cut=7000))


def dark_pad():        # minor ninth, no third on top
    return finish(reverb(lowpass(pad([73.42, 110.0, 174.61, 261.63, 329.63], harmonics=(1, .3, .1)), 1600) * slow_swell(LEN, .4), mix=.5))


def orbit():           # sub swell with one distant inharmonic bell
    t = np.arange(int(LEN * SR)) / SR
    b = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-np.maximum(0, t - 2.2) * 1.1) * (t > 2.2) for f, a in ((311.1, 1), (466.2, .5), (789.3, .3), (1243.7, .12)))
    return finish(reverb(pad([55.0, 82.41], harmonics=(1, .4)) * .7 * slow_swell(LEN, .5) + np.stack([b, b], 1) * .25, seconds=5, mix=.6))


def horizon():         # a long slow rise that resolves to nothing
    return finish(reverb(lowpass(pad([65.41, 98.0, 146.83, 196.0], harmonics=(1, .4, .2)), 1200) * slow_swell(LEN, .75), mix=.45))


SOUNDS = [
    ('ambient-entrance', lambda: stretched('magical-entrance.mp3', 3200)), ('ambient-chime', lambda: stretched('boot-screen-chime.mp3', 2600)),
    ('ambient-felt', lambda: stretched('warm-felted-piano.mp3', 2000)), ('ambient-swell', lambda: stretched('sound-2.mp3', 1800)),
    ('ambient-arp', lambda: stretched('soft-major-arp.mp3', 2600)), ('ambient-digital', lambda: stretched('digital-chime.mp3', 3000)),
    ('ambient-deep-space', deep_space), ('ambient-nebula', nebula), ('ambient-glass', glass), ('ambient-dark-pad', dark_pad), ('ambient-orbit', orbit), ('ambient-horizon', horizon),
]
for name, make in SOUNDS:
    x = make()
    wav = tempfile.mktemp(suffix='.wav')
    w = wave.open(wav, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    target = os.path.join(OUTS[0], name + '.m4a')
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '112000', wav, target], check=True); os.remove(wav)
    shutil.copyfile(target, os.path.join(OUTS[1], name + '.m4a'))
    print(name, '%.1fs' % (len(x) / SR), 'peak %.2f' % np.max(np.abs(x)), '%dKB' % (os.path.getsize(target) // 1024))
