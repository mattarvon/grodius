#!/usr/bin/env python3
"""Synthesized sounds for THE KEEPSAKE, the vinyl doll-head midboss (enemies/mid/keepsake.ts, D53). All original, no
samples: modal steel, rubber, plastic and a reed-and-bellows crier, built from noise, oscillators and filters.

  uv run --with numpy,scipy,imageio-ffmpeg python tools/gen_keepsake_sfx.py
    -> src/sfx/keep_tink/gen-NN.ogg     a fork landing on rock: a steel ping, a bounce and a grit scrape (4)
       src/sfx/keep_throw/gen-NN.ogg    the aimed throw: an air whoosh with a steel "shing" riding it (3)
       src/sfx/keep_whirr/gen-NN.ogg    the boomerang spinning: a whup-whup whirr with glints of steel (2)
       src/sfx/keep_wail/gen-NN.ogg     the wail: a doll's tilt crier ("ma... maaa"), warped, sagging and wet (2)
       src/sfx/keep_thud/gen-NN.ogg     a face hit: a dull rubbery thud on hollow vinyl (4)
       src/sfx/keep_squelch/gen-NN.ogg  a wound hit: a short wet squelch into the brain (4)
       src/sfx/keep_clack/gen-NN.ogg    the sleep eyes rolling and clacking against the lids (3)
Every file is peak-normalized by gen_sfx.write_ogg; its level in the mix is set where it plays (keepsake.ts SND).
Reuses the building blocks of tools/gen_sfx.py. Seeded: the same run writes the same files.
"""
import os, subprocess, sys
import numpy as np
from scipy import signal
sys.path.insert(0, os.path.dirname(__file__))
import gen_sfx as G
from gen_sfx import SR, t_, env, bp, lp, hp, place, sat, bubble, thump, squelch, crackle

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
G.rng = rng  # the shared blocks (squelch, crackle) draw from this one stream too


def modes(f0, ratios, decays, amps, d, f_drop=0.0):
    """modal ring: decaying sines at f0 * ratio, each with its own decay (s) and level; f_drop bends them down a little"""
    t = t_(d); out = np.zeros(len(t))
    for r, dc, a in zip(ratios, decays, amps):
        f = f0 * r * (1 - f_drop * (1 - np.exp(-t * 30)))
        out += np.sin(2 * np.pi * np.cumsum(f) / SR + rng.uniform(0, 6.28)) * np.exp(-t / dc) * a
    return out


def click(d=.004, lo=1500, hi=7000):
    n = int(SR * d); return bp(rng.standard_normal(n), lo, hi) * env(n, .0003, d * .4, 3)


def tink():
    """a dinner fork lands on rock: a free-bar steel ping (inharmonic tine modes) on a gritty contact click, then one or
    two quieter bounces. Light and short (~.2 s): five land in a fountain, so no long ring and no shrill top"""
    buf = np.zeros(int(SR * .32))
    f0 = rng.uniform(1050, 1450)
    rat = [1, 2.76 * rng.uniform(.98, 1.02), 5.40 * rng.uniform(.97, 1.03), 8.93]
    at, amp = 0.0, 1.0
    for b in range(rng.integers(2, 4)):
        ring = modes(f0 * rng.uniform(.99, 1.01), rat, [.05 * amp + .02, .03, .016, .008], [1, .55, .3, .12], .16)
        place(buf, ring * amp, at)
        place(buf, click(.004, 1800, 7000) * 1.3 * amp, at)  # steel on stone
        place(buf, crackle(.018, 6, 2500) * .5 * amp, at + .002)  # grit under the tines
        at += rng.uniform(.045, .08) * (1 - .3 * b); amp *= rng.uniform(.3, .45)
    place(buf, lp(rng.standard_normal(int(SR * .02)), 600) * env(int(SR * .02), .001, .006) * .5, 0)  # the knock of it
    return lp(sat(buf, 1.4), 7000)


def throw():
    """the aimed throw: an air whoosh (noise through a bandpass that sweeps up and back, like a pass-by) with a steel
    "shing" swelling in it, the fork's tines singing as it cuts the air"""
    d = rng.uniform(.38, .46); n = int(SR * d); t = t_(d)
    x = rng.standard_normal(n); out = np.zeros(n); B = 32; e = np.linspace(0, n, B + 1).astype(int)
    for i in range(B):  # block-swept bandpass: 700 Hz -> 2.6 kHz at the pass -> 900 Hz
        u = i / (B - 1); fc = 700 * (2600 / 700) ** np.sin(np.pi * min(1, u * 1.25)) if u < .8 else 900 + 1700 * (1 - u) * 5
        a, b = e[i], e[i + 1]; pad = min(a, 1024)
        out[a:b] = bp(x[a - pad:b], fc * .7, fc * 1.4)[pad:]
    whoosh = out * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.6
    f0 = rng.uniform(1500, 1800)
    shing = modes(f0, [1, 2.76, 5.4], [.12, .07, .04], [1, .4, .15], d, f_drop=-.03)  # bends up a hair: the pass-by
    shing *= np.minimum(1, t / .03) * (1 + .15 * np.sin(2 * np.pi * 23 * t))
    return lp(sat(whoosh * 1.4 + shing * .35, 1.5), 8000)


def whirr():
    """the big fork thrown as a boomerang: whup-whup air at its spin rate (it slows a little), with a glint of steel each
    turn. About a second: played as it leaves and again, faster, as it turns back"""
    d = 1.05; n = int(SR * d); t = t_(d)
    rate = rng.uniform(13, 16) * (1 - .18 * t / d)
    ph = 2 * np.pi * np.cumsum(rate) / SR
    blade = np.abs(np.sin(ph)) ** 3  # two blade passes a turn (handle, tines)
    air = bp(rng.standard_normal(n), 380, 1900) * (.25 + blade)
    hum = np.sin(2 * np.pi * np.cumsum(rate * 6.5) / SR) * .25 * blade  # the body of the spin, low
    glint = modes(rng.uniform(1700, 2000), [1, 2.76], [.3, .15], [1, .3], d) * (np.sin(ph * .5) ** 16) * .4
    x = (air + lp(hum, 900) + glint) * env(n, .06, d * .55, 1.4) * np.minimum(1, (d - t) / .12)
    return lp(sat(x * 1.3, 1.6), 6000)


def formant(src, tracks, block=256):
    """source through parallel resonant bandpasses whose centres move: tracks = [(f(t) array per sample, Q, gain)].
    Block-wise, filter state carried across blocks so the sweep is click-free"""
    n = len(src); out = np.zeros(n)
    for fc, bw, g in tracks:
        zi = np.zeros(2); y = np.zeros(n)
        for a in range(0, n, block):
            b = min(n, a + block); f = float(fc[(a + b) // 2])
            bb, aa = signal.iirpeak(f, bw, fs=SR)
            y[a:b], zi = signal.lfilter(bb, aa, src[a:b], zi=zi)
        out += y * g
    return out


def wail():
    """a vintage doll's tilt crier: a weight drops, a little bellows pushes air through a reed, and the cap opening on
    its throat makes "ma... maaa". Here it is pitched down into a man's range, doubled a quarter-tone flat, warped like
    a stretched tape, running out of air as it sags, and gargling: the second syllable lands ~.73 s in, on the ring's
    release (KEEP.wail 44 f). ~2.1 s"""
    d = 2.15; n = int(SR * d); t = t_(d)
    syl = [(.03, .52, 1.0), (.72, 1.35, 1.1)]  # (start, length, level) of "ma" and "maaa"
    f = np.full(n, 300.0); vow = np.zeros(n); amp = np.zeros(n)
    for k, (s0, L, lv) in enumerate(syl):
        i0, i1 = int(s0 * SR), int(min(d, s0 + L) * SR); u = (t[i0:i1] - s0) / L
        base = (340 if k == 0 else 360) * rng.uniform(.96, 1.04)
        f[i0:i1] = base * (1 + .08 * np.sin(np.pi * np.minimum(1, u * 2.5))) * (1 - (.12 if k == 0 else .42) * u ** 1.4)
        vow[i0:i1] = np.clip(u / .18, 0, 1)  # "m" (lips shut) opening to "a"
        amp[i0:i1] = lv * np.minimum(1, u / .06) * np.clip((1 - u) / .25, 0, 1) * (1 - .25 * u)
    amp = lp(amp, 40)
    warp = 1 + .035 * np.sin(2 * np.pi * 5.3 * t) + .02 * np.sin(2 * np.pi * .9 * t + 1) + .015 * lp(rng.standard_normal(n), 6) * 8
    f = lp(f, 25) * warp
    ph = 2 * np.pi * np.cumsum(f) / SR
    reed = signal.sawtooth(ph, .12) + .6 * signal.square(ph, .3)  # a buzzy free reed, not a throat
    twin = signal.sawtooth(2 * np.pi * np.cumsum(f * .971) / SR, .12)  # a quarter-tone flat: the uncanny double
    under = np.sin(ph * .5) * .5  # an octave below, faint: something larger crying through it
    srcv = (reed + .55 * twin + under) * amp
    F1 = 260 + 560 * vow; F2 = 1100 + 250 * vow; F3 = np.full(n, 2450.0)
    voice = formant(srcv, [(F1, 4.0, 1.0), (F2, 6.0, .55), (F3, 8.0, .25)])
    voice += lp(srcv, 320) * .35 * (1 - vow)  # the hum of the closed "m"
    air = bp(rng.standard_normal(n), 1200, 4500) * amp * .12  # the bellows leaking
    wet = np.zeros(n + SR // 3)
    place(wet, voice + air, 0)
    tt = .85
    while tt < 1.95:  # gargling in the throat of the second cry
        place(wet, bubble(rng.uniform(160, 420), rng.uniform(.04, .09), rng.uniform(2, 5), rng.uniform(.1, .25)), tt)
        tt += rng.uniform(.05, .14)
    place(wet, click(.006, 600, 3000) * 2, 0)  # the weight dropping inside
    place(wet, lp(rng.standard_normal(int(SR * .04)), 500) * env(int(SR * .04), .001, .012) * .8, 0)
    x = lp(sat(wet, 2.0), 3600)
    # a short dark room so it doesn't sound like a clean synth in a void (the game's own reverb adds the hall)
    ir = rng.standard_normal(int(SR * .18)) * np.exp(-np.arange(int(SR * .18)) / (SR * .04))
    return x + lp(signal.fftconvolve(x, ir)[:len(x)], 1800) * .05


def thud():
    """a shot slapping the vinyl face: a hollow rubber knock. A low thump, the head's cavity booming briefly, a flex
    that bends the pitch down, everything under ~1.5 kHz. Dull on purpose: x.15 damage should sound like it"""
    d = .16; buf = np.zeros(int(SR * d))
    place(buf, thump(rng.uniform(190, 240), rng.uniform(75, 95), .12, 1.0), 0)
    place(buf, modes(rng.uniform(280, 360), [1, 1.6, 2.3], [.035, .022, .012], [.7, .3, .15], .12, f_drop=.12), 0)
    place(buf, lp(click(.006, 300, 2500), 1200) * 1.2, 0)
    return lp(sat(buf, 1.6), 1500)


def squelch_hit():
    """a shot going into the brain round the fork: a short wet squelch with a meat knock and a bubble"""
    d = rng.uniform(.14, .2); buf = np.zeros(int(SR * (d + .12)))
    place(buf, squelch(d, rng.uniform(1800, 2600), rng.uniform(260, 380), rng.uniform(30, 46)) * 1.2, 0)
    place(buf, thump(rng.uniform(140, 180), rng.uniform(55, 70), .09, .55), 0)
    place(buf, bubble(rng.uniform(380, 700), rng.uniform(.03, .05), rng.uniform(3, 7), .35), d * rng.uniform(.4, .8))
    return sat(buf, 1.9)


def clack():
    """the sleep eyes: two weighted eyes rock on their wire and clack against the lid stops, a hair apart. A tiny roll,
    then hard plastic: a click, a short body ring and a low tok. ~.07 s"""
    buf = np.zeros(int(SR * .09))
    place(buf, lp(rng.standard_normal(int(SR * .012)), 2500) * env(int(SR * .012), .006, .004) * .2, 0)  # the roll
    for k, at in enumerate([.012, .012 + rng.uniform(.006, .013)]):
        a = 1 if k == 0 else rng.uniform(.6, .8)
        place(buf, click(.003, 1500, 6000) * 1.4 * a, at)
        place(buf, modes(rng.uniform(1200, 1650), [1, 2.3], [.012, .006], [.6, .25], .05) * a, at)
        place(buf, thump(rng.uniform(520, 640), rng.uniform(380, 420), .03, .5 * a), at)
    return lp(sat(buf, 1.5), 7500)


CATS = {'keep_tink': (tink, 4), 'keep_throw': (throw, 3), 'keep_whirr': (whirr, 2), 'keep_wail': (wail, 2),
        'keep_thud': (thud, 4), 'keep_squelch': (squelch_hit, 4), 'keep_clack': (clack, 3)}
if __name__ == '__main__':
    for cat, (fn, count) in CATS.items():
        d = os.path.join(G.OUT, cat); os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            if f.startswith('gen-'): os.remove(os.path.join(d, f))
        for i in range(count):
            G.write_ogg(fn(), os.path.join(d, f'gen-{i + 1:02d}.ogg'))
        print(cat, count)
