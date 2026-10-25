#!/usr/bin/env python3
"""Synthesized sounds for the Gravity Drive's gross-out layer (render/gross/drive.ts). All original, no samples.

  uv run --with numpy,scipy,imageio-ffmpeg python tools/gen_drive_sfx.py
    -> src/sfx/drivegut/gen-NN.ogg    stomach gurgles (ambient, while it pumps)
       src/sfx/driveretch/gen-NN.ogg  a wet "hurk" retch before an exhaust port vomits
       src/sfx/driveburst/gen-NN.ogg  the final rupture: a wet detonation, splatter and a long deflating raspberry
Reuses the building blocks of tools/gen_sfx.py.
"""
import os, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import gen_sfx as G
from gen_sfx import SR, t_, env, bp, lp, hp, place, sat, bubble, thump, squelch, wet_noise, crackle, drips

try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = 'ffmpeg'
_run = subprocess.run
def run(cmd, **k):
    if cmd and cmd[0] == 'ffmpeg': cmd = [FF] + cmd[1:]
    return _run(cmd, **k)
G.subprocess.run = run
rng = np.random.default_rng(1986)
G.rng = rng


def gurgle():
    """bowel gurgle: a run of low, rising bubbles over a wobbling lowpassed rumble"""
    d = rng.uniform(1.1, 1.8); n = int(SR * d); buf = np.zeros(n + SR // 4)
    rum = lp(rng.standard_normal(n), 220) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(3, 6) * t_(d)) ** 2)
    place(buf, rum * env(n, .2, d * .5, 2.5) * 2.5, 0)
    tt = 0
    while tt < d * .9:
        place(buf, bubble(rng.uniform(90, 320), rng.uniform(.05, .13), rng.uniform(1.5, 4), rng.uniform(.3, 1)), tt)
        tt += rng.uniform(.02, .11)
    place(buf, squelch(.35, 700, 120, rng.uniform(8, 14)) * .5, rng.uniform(.2, d * .6))
    return lp(sat(buf, 1.8), 1800)


def retch():
    """two throaty hurks (formant-filtered noise bursts) and a wet gush"""
    buf = np.zeros(int(SR * 1.4))
    at = 0
    for k in range(2):
        d = rng.uniform(.16, .26); n = int(SR * d)
        src = rng.standard_normal(n) * .6 + np.sign(np.sin(2 * np.pi * np.cumsum(np.linspace(110, 80, n)) / SR)) * .5
        v = bp(src, 450, 1100) * 1.4 + bp(src, 1800, 2600) * .5
        place(buf, v * env(n, .02, d * .45, 2.5) * (.7 + .3 * k), at)
        at += d + rng.uniform(.06, .12)
    place(buf, squelch(.45, 1600, 200, rng.uniform(16, 26)) * 1.3, at)
    place(buf, wet_noise(.35, 300, 3000, dec=.12) * .8, at + .02)
    drips(buf, at + .2, rng.integers(3, 7), .4)
    return sat(buf, 2)


def burst():
    """the drive ruptures: sub hit, a huge squelch, splatter rain, then a long deflating raspberry"""
    d = 3.2; buf = np.zeros(int(SR * d))
    place(buf, thump(90, 22, .9, 1.6), 0)
    place(buf, squelch(.9, 2600, 90, rng.uniform(10, 16)) * 1.4, 0)
    place(buf, wet_noise(.6, 200, 6000, dec=.18) * .9, .01)
    place(buf, crackle(.25, 40, 1500) * .6, .03)
    drips(buf, .3, 22, 1.8)
    # deflate: a buzzy pulse train through a lowpass, pitch sliding down with flutter
    fd = 2.2; n = int(SR * fd); tt = t_(fd)
    f = 140 * (35 / 140) ** (tt / fd) * (1 + .08 * np.sin(2 * np.pi * 7 * tt) + .05 * rng.standard_normal(n).cumsum() / np.sqrt(n) / 10)
    ph = 2 * np.pi * np.cumsum(f) / SR
    raw = (np.sin(ph) > .3).astype(float) - .3 + .25 * rng.standard_normal(n)
    flap = .6 + .4 * np.abs(np.sin(2 * np.pi * (12 - 6 * tt / fd) * tt))
    place(buf, lp(raw, 900) * flap * env(n, .05, fd * .6, 1.6) * .9, .55)
    return sat(buf, 2.2)


CATS = {'drivegut': (gurgle, 4), 'driveretch': (retch, 3), 'driveburst': (burst, 2)}
if __name__ == '__main__':
    for cat, (fn, count) in CATS.items():
        d = os.path.join(G.OUT, cat); os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            if f.startswith('gen-'): os.remove(os.path.join(d, f))
        for i in range(count):
            G.write_ogg(fn(), os.path.join(d, f'gen-{i + 1:02d}.ogg'))
        print(cat, count)
