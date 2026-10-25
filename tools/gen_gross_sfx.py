# Synthesize Grodius midboss gross-out one-shots (wet pops, gargles, sloshes, a birth gush). All original, CC0.
# Usage: uv run --with numpy,imageio-ffmpeg python tools/gen_gross_sfx.py src/sfx   (writes src/sfx/gross_{pop,gargle,slosh,gush}/gen-NN.ogg)
import numpy as np, wave, subprocess, os, sys, tempfile
import imageio_ffmpeg
SR = 22050
OUT = sys.argv[1]
rng = np.random.default_rng(1986)
FF = imageio_ffmpeg.get_ffmpeg_exe()

def lp(x, fc):
    a = np.exp(-2 * np.pi * np.asarray(fc) / SR) * np.ones(len(x))
    y = np.zeros_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s; y[i] = s
    return y

def bp(x, fc, q=4):
    fc = np.asarray(fc) * np.ones(len(x)); y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        w = 2 * np.pi * fc[i] / SR; al = np.sin(w) / (2 * q); c = np.cos(w); a0 = 1 + al
        v = (al * x[i] - al * x2 + 2 * c * y1 - (1 - al) * y2) / a0
        x2, x1, y2, y1 = x1, x[i], y1, v; y[i] = v
    return y

def bubble(n, f0, tau, rise=3.0):
    t = np.arange(n) / SR
    f = f0 * (1 + rise * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / tau)

def place(buf, sig, at):
    i = int(at * SR); j = min(len(buf), i + len(sig)); buf[i:j] += sig[:j - i]

def norm(x, pk=.9):
    x = x - np.mean(x)
    fade = np.ones(len(x)); k = int(.01 * SR); fade[-k:] = np.linspace(1, 0, k); x = x * fade
    return x / (np.max(np.abs(x)) + 1e-9) * pk

def pop(v):
    n = int(.22 * SR); t = np.arange(n) / SR; b = np.zeros(n)
    f = (700 + v * 250) * np.exp(-t * 40) + 140
    b += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .035)
    b += lp(rng.standard_normal(n) * np.exp(-t / .012), 3000) * .8
    for k in range(3 + v):
        place(b, bubble(int(.05 * SR), rng.uniform(500, 1400), .012, 6) * .35, rng.uniform(.03, .14))
    return norm(b)

def gargle(v):
    d = .85 + .1 * v; n = int(d * SR); t = np.arange(n) / SR
    env = np.minimum(1, t / .06) * np.minimum(1, (d - t) / .2)
    f0 = 95 + 15 * v + 8 * np.sin(2 * np.pi * 5 * t)
    saw = 2 * ((np.cumsum(f0) / SR) % 1) - 1
    throat = bp(saw, 500 + 250 * np.sin(2 * np.pi * (1.3 + v * .4) * t), 3) * 2.2
    am = (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(18 + 10 * rng.random(n) ) / SR)))
    throat *= lp(am, 60) * .8 + .2
    b = throat * env
    tt = 0.02
    while tt < d - .08:
        place(b, bubble(int(.06 * SR), rng.uniform(250, 700), rng.uniform(.012, .03), 5) * rng.uniform(.4, 1), tt)
        tt += rng.uniform(.018, .05)
    b += lp(rng.standard_normal(n), 900) * env * .5
    return norm(b)

def slosh(v):
    d = .7; n = int(d * SR); t = np.arange(n) / SR
    env = np.sin(np.pi * np.minimum(1, t / d)) ** 1.5
    nz = rng.standard_normal(n)
    b = bp(nz, 180 + 500 * np.sin(np.pi * t / d) ** 2 + 80 * v, 2.5) * env * 2
    b += lp(nz, 300) * env
    for k in range(6 + 2 * v):
        place(b, bubble(int(.09 * SR), rng.uniform(150, 420), rng.uniform(.02, .05), 2) * rng.uniform(.4, .9), rng.uniform(.05, d - .12))
    return norm(b)

def gush(v):
    d = 1.15; n = int(d * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    splat = lp(nz, 2500) * np.exp(-t / .08) * 1.4
    pour = bp(nz, 300 + 900 * np.exp(-t / .3), 1.8) * np.exp(-t / .45) * 2
    f = 190 * np.exp(-t * 2.2) + 55 + 10 * v
    blorp = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .35) * 1.1
    b = splat + pour + blorp
    for k in range(18):
        place(b, bubble(int(.08 * SR), rng.uniform(180, 900), rng.uniform(.01, .04), 4) * rng.uniform(.3, .9), rng.uniform(.04, .9))
    return norm(b)

def write(bank, i, x):
    d = os.path.join(OUT, bank); os.makedirs(d, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f: wp = f.name
    with wave.open(wp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())
    op = os.path.join(d, f'gen-{i + 1:02d}.ogg')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', wp, '-c:a', 'libvorbis', '-q:a', '3', op], check=True)
    os.remove(wp); print(op, os.path.getsize(op))

for i in range(4): write('gross_pop', i, pop(i))
for i in range(3): write('gross_gargle', i, gargle(i))
for i in range(3): write('gross_slosh', i, slosh(i))
for i in range(2): write('gross_gush', i, gush(i))
