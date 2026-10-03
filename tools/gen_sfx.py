#!/usr/bin/env python3
"""Procedural gore + explosion sound pack for Grodius. Everything here is synthesized from
noise/oscillators/filters (no samples), so the output is ours to ship under any license.

  python3 tools/gen_sfx.py            -> src/sfx/<category>/gen-NN.ogg
Categories: splat_s splat_m splat_l bone silly explode_s explode_l
Drop extra files (Kenney, Freesound CC0, your own recordings) into the same folders;
the game picks randomly from everything in a folder.
"""
import os, subprocess, tempfile, wave
import numpy as np
from scipy import signal

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'sfx')
rng = np.random.default_rng(666)


def t_(d): return np.arange(int(SR * d)) / SR
def env(n, a=.002, d=.2, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-curve * np.maximum(0, t - a) / max(d, 1e-3))
    return e
def bp(x, lo, hi, order=2):
    lo, hi = max(20, lo), min(SR / 2 - 100, hi)
    return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, min(f, SR / 2 - 100), 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return signal.sosfilt(signal.butter(order, max(20, f), 'highpass', fs=SR, output='sos'), x)
def sweep_lp(x, f0, f1, steps=48):
    """time-varying lowpass: crossfade blocks filtered at exponentially swept cutoffs"""
    out = np.zeros_like(x); n = len(x); edges = np.linspace(0, n, steps + 1).astype(int)
    for i in range(steps):
        f = f0 * (f1 / f0) ** (i / max(1, steps - 1))
        a, b = edges[i], edges[i + 1]
        pad = min(a, 2048)
        out[a:b] = lp(x[a - pad:b], f)[pad:]
    return out
def place(buf, x, at):
    i = int(at * SR)
    if i >= len(buf): return
    m = min(len(x), len(buf) - i); buf[i:i + m] += x[:m]
def sat(x, drive=2.0): return np.tanh(x * drive) / np.tanh(drive)
def norm(x, peak=.92):
    m = np.max(np.abs(x)) or 1
    return x / m * peak
def fade(x, ms=12):
    n = int(SR * ms / 1000); x[-n:] *= np.linspace(1, 0, n); return x

# ---------- building blocks ----------
def bubble(f=900, d=.06, rise=6.0, amp=1.0):
    """bubble pop: decaying sine whose pitch rises (Minnaert resonance)"""
    t = t_(d); ph = 2 * np.pi * np.cumsum(f * (1 + rise * t)) / SR
    return np.sin(ph) * env(len(t), .001, d * .35, 3) * amp
def wet_noise(d, lo, hi, a=.002, dec=.15):
    n = int(SR * d); return bp(rng.standard_normal(n), lo, hi) * env(n, a, dec)
def thump(f0=110, f1=35, d=.25, amp=1.0):
    t = t_(d); ph = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t * 18)) / SR
    return np.sin(ph) * env(len(t), .002, d * .4) * amp
def squelch(d=.25, f0=1800, f1=250, am=28):
    """squish: noise through a downward-swept lowpass, chopped by a fast wobble = wet suction"""
    n = int(SR * d); t = np.arange(n) / SR
    x = sweep_lp(rng.standard_normal(n), f0, f1)
    wob = .55 + .45 * np.sin(2 * np.pi * (am + rng.uniform(-6, 6)) * t + rng.uniform(0, 6)) ** 2
    return x * wob * env(n, .006, d * .5, 3)
def crackle(d=.08, n_imp=25, lo=1500):
    n = int(SR * d); x = np.zeros(n)
    for _ in range(n_imp):
        i = rng.integers(0, n); w = rng.integers(8, 60)
        x[i:i + w] += rng.standard_normal(min(w, n - i)) * rng.uniform(.3, 1) * np.exp(-np.arange(min(w, n - i)) / 10)
    return hp(x, lo)
def drips(buf, start, count, spread):
    for k in range(count):
        place(buf, bubble(rng.uniform(500, 1700), rng.uniform(.03, .07), rng.uniform(4, 10), rng.uniform(.15, .45)),
              start + rng.uniform(0, spread))

# ---------- categories ----------
def splat_s():
    """drone/hatchling pop: quick wet pop + a couple of bubbles"""
    d = rng.uniform(.18, .32); buf = np.zeros(int(SR * (d + .15)))
    place(buf, wet_noise(d, 400, rng.uniform(2500, 5000), dec=d * .25) * .9, 0)
    place(buf, thump(rng.uniform(160, 240), rng.uniform(50, 80), .12, .6), 0)
    for _ in range(rng.integers(2, 5)):
        place(buf, bubble(rng.uniform(700, 2200), rng.uniform(.025, .05), rng.uniform(5, 12), rng.uniform(.3, .7)), rng.uniform(0, .08))
    return sat(buf, 1.6)
def splat_m():
    """squelchy rupture: squelch + meat thump + spatter"""
    d = rng.uniform(.3, .5); buf = np.zeros(int(SR * (d + .35)))
    place(buf, squelch(d, rng.uniform(1400, 2600), rng.uniform(180, 400), rng.uniform(18, 40)) * 1.1, 0)
    place(buf, thump(rng.uniform(120, 170), rng.uniform(35, 55), .25, .9), 0)
    place(buf, wet_noise(.12, 1500, 7000, dec=.03) * .5, rng.uniform(0, .02))
    drips(buf, .1, rng.integers(2, 6), .3)
    return sat(buf, 2.2)
def splat_l():
    """big heavy burst: double rupture, sub thump, long spatter + drip tail"""
    d = rng.uniform(.5, .8); buf = np.zeros(int(SR * (d + .8)))
    place(buf, thump(rng.uniform(100, 140), rng.uniform(25, 40), .45, 1.2), 0)
    place(buf, squelch(d, 2400, 140, rng.uniform(14, 26)) * 1.2, 0)
    place(buf, squelch(d * .6, 3000, 300, rng.uniform(30, 45)) * .7, rng.uniform(.05, .14))
    place(buf, wet_noise(.25, 800, 8000, dec=.06) * .7, .01)
    place(buf, crackle(.1, 18, 2000) * .5, rng.uniform(0, .05))
    drips(buf, .25, rng.integers(5, 11), .9)
    return sat(buf, 2.6)
def bone():
    """bone snap: dry crack cluster + a little woody resonance"""
    d = rng.uniform(.06, .14); buf = np.zeros(int(SR * (d + .2)))
    place(buf, crackle(d, rng.integers(20, 50), rng.uniform(1200, 2500)) * 1.4, 0)
    place(buf, thump(rng.uniform(400, 700), rng.uniform(200, 300), .07, .4), 0)
    if rng.random() < .6: place(buf, crackle(.05, 12, 2500) * .8, d + rng.uniform(.02, .08))
    return sat(buf, 1.8)
def silly():
    """the comedy layer: wet raspberries, rubbery blorps, gurgles"""
    kind = rng.integers(0, 3)
    if kind == 0:  # wet raspberry: flapping buzz with pitch wobble, through a wet lowpass
        d = rng.uniform(.35, .8); t = t_(d)
        f = rng.uniform(70, 140) * (1 + .25 * np.sin(2 * np.pi * rng.uniform(3, 7) * t)) * (1 - .35 * t / d)
        ph = 2 * np.pi * np.cumsum(f) / SR
        x = signal.sawtooth(ph) + .6 * rng.standard_normal(len(t)) * (signal.square(ph) > 0)
        x = sweep_lp(x, rng.uniform(1200, 2000), 400) * env(len(t), .01, d * .6, 2)
        return sat(norm(x) * 1.0, 2.5)
    if kind == 1:  # blorp: rubbery downward boing through formant
        d = rng.uniform(.25, .45); t = t_(d)
        f = rng.uniform(300, 520) * np.exp(-t * rng.uniform(4, 8)) + 60
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .004, d * .5, 2.5)
        x = x + .4 * bp(x ** 3, 300, 2500)
        buf = np.zeros(int(SR * (d + .2))); place(buf, x, 0); drips(buf, d * .6, 3, .2)
        return sat(buf, 1.8)
    # gurgle: run of bubbles with a sinking pitch
    d = rng.uniform(.5, .9); buf = np.zeros(int(SR * (d + .1))); n = rng.integers(10, 22)
    for k in range(n):
        f = 900 * (1 - .6 * k / n) * rng.uniform(.8, 1.2)
        place(buf, bubble(f, rng.uniform(.04, .08), rng.uniform(3, 8), rng.uniform(.4, 1)), k * d / n + rng.uniform(0, .02))
    place(buf, lp(rng.standard_normal(len(buf)), 300) * .15 * env(len(buf), .02, d * .5, 2), 0)
    return sat(buf, 1.6)
def explosion(big):
    """layered blast: transient crack, sub drop, roaring body with closing filter, debris crackle tail"""
    d = rng.uniform(1.4, 2.4) if big else rng.uniform(.6, 1.0); n = int(SR * d); buf = np.zeros(n + SR // 4)
    body = sweep_lp(rng.standard_normal(n), rng.uniform(5000, 9000), rng.uniform(150, 300)) * env(n, .003, d * (.35 if big else .25), 2.2)
    place(buf, body * (1.2 if big else 1.0), 0)
    place(buf, thump(rng.uniform(90, 130), rng.uniform(22, 35), d * .7, 1.6 if big else 1.0), 0)
    place(buf, hp(rng.standard_normal(int(SR * .03)), 2000) * env(int(SR * .03), .0005, .008) * 1.2, 0)
    if big:  # second detonation + rumble
        place(buf, sweep_lp(rng.standard_normal(n // 2), 4000, 200) * env(n // 2, .004, d * .2, 2.5) * .8, rng.uniform(.12, .3))
        place(buf, lp(rng.standard_normal(n), 90) * env(n, .05, d * .6, 1.5) * 1.5, 0)
    tail = int(SR * d * .8); deb = np.zeros(tail)
    for _ in range(int(rng.uniform(40, 90) if big else rng.uniform(15, 35))):
        i = int(rng.uniform(0, 1) ** 1.8 * tail); w = rng.integers(20, 200)
        seg = rng.standard_normal(min(w, tail - i)) * np.exp(-np.arange(min(w, tail - i)) / rng.uniform(8, 40))
        deb[i:i + len(seg)] += seg * rng.uniform(.1, .6) * (1 - i / tail)
    place(buf, bp(deb, 600, 6000) * .6, d * .1)
    return sat(buf, 3.2 if big else 2.6)  # driven hard: violent, crunchy

CATS = {
    'splat_s': (splat_s, 14), 'splat_m': (splat_m, 14), 'splat_l': (splat_l, 10), 'bone': (bone, 10),
    'silly': (silly, 12), 'explode_s': (lambda: explosion(False), 10), 'explode_l': (lambda: explosion(True), 8),
}

def write_ogg(x, path):
    x = norm(x, .9).astype(np.float32)
    nz = np.nonzero(np.abs(x) > 2e-4)[0]
    x = fade(x[:nz[-1] + int(SR * .02)] if len(nz) else x)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        tmp = f.name
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-c:a', 'libvorbis', '-q:a', '4', path], check=True)
    os.unlink(tmp)

if __name__ == '__main__':
    for cat, (fn, count) in CATS.items():
        d = os.path.join(OUT, cat); os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            if f.startswith('gen-'): os.remove(os.path.join(d, f))
        for i in range(count):
            write_ogg(fn(), os.path.join(d, f'gen-{i + 1:02d}.ogg'))
        print(cat, count)
