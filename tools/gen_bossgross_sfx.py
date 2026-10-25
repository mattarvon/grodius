#!/usr/bin/env python3
"""Synthesized one-shots for the gross biome bosses (src/render/gross/biomebosses.ts). Ours, no samples.
  uv run --with numpy,scipy,imageio-ffmpeg python tools/gen_bossgross_sfx.py
-> src/sfx/gsizzle/gen-NN.ogg   (grease hitting a hot floor, fat popping, guts frying)
   src/sfx/gicecrack/gen-NN.ogg (frozen meat / nail bar shattering)
"""
import os, subprocess, tempfile, wave
import numpy as np
from scipy import signal
import imageio_ffmpeg

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'sfx')
rng = np.random.default_rng(1986)
FF = imageio_ffmpeg.get_ffmpeg_exe()

def env(n, a=.002, d=.2, curve=4.0):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-curve * np.maximum(0, t - a) / max(d, 1e-3))
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [max(20, lo), min(SR / 2 - 100, hi)], 'bandpass', fs=SR, output='sos'), x)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'highpass', fs=SR, output='sos'), x)
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'lowpass', fs=SR, output='sos'), x)

def sizzle(d):
    n = int(SR * d)
    hiss = hp(rng.standard_normal(n), 3500) * .35
    hiss *= (.55 + .45 * lp(rng.standard_normal(n), 18) * 4).clip(0, 1.5)  # boiling flutter
    crackle = np.zeros(n)
    for _ in range(int(d * rng.uniform(70, 120))):  # fat popping
        i = rng.integers(0, n - 400); L = rng.integers(40, 300)
        crackle[i:i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(.3, 1)
    crackle = hp(crackle, 1500)
    wet = bp(rng.standard_normal(n), 300, 1200) * .25 * env(n, .005, .08, 3)  # the splat it starts with
    x = (hiss + crackle * .6) * env(n, .01, d * .45, 2.2) + wet
    return x

def icecrack(d):
    n = int(SR * d)
    x = np.zeros(n)
    t0 = 0
    for k in range(rng.integers(4, 8)):  # splintering clicks
        i = int(t0 * SR); L = rng.integers(200, 1400)
        if i + L >= n: break
        x[i:i + L] += hp(rng.standard_normal(L), 2500) * np.exp(-np.arange(L) / (L / 5)) * rng.uniform(.5, 1)
        t0 += rng.uniform(.004, .03)
    t = np.arange(n) / SR
    for f in rng.uniform(2400, 5200, 3):  # glassy ring
        x += np.sin(2 * np.pi * f * t) * np.exp(-t * rng.uniform(25, 45)) * .12
    x += lp(rng.standard_normal(n), 220) * env(n, .002, .07, 3) * 1.2  # the meat thud under it
    x += bp(rng.standard_normal(n), 400, 1500) * env(n, .003, .05, 4) * .4  # wet crunch
    return x

def write_ogg(x, path):
    x = x / (np.abs(x).max() + 1e-9) * .89
    fd, tmp = tempfile.mkstemp(suffix='.wav'); os.close(fd)
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    subprocess.run([FF, '-loglevel', 'error', '-y', '-i', tmp, '-c:a', 'libvorbis', '-q:a', '4', path], check=True)
    os.remove(tmp)

for cat, fn, ds in [('gsizzle', sizzle, [.45, .6, .8, 1.0]), ('gicecrack', icecrack, [.35, .45, .55])]:
    d = os.path.join(OUT, cat); os.makedirs(d, exist_ok=True)
    for i, dur in enumerate(ds):
        write_ogg(fn(dur), os.path.join(d, f'gen-{i + 1:02d}.ogg'))
    print(cat, len(ds))
