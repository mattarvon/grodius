"""THE DISSOLVING WOMB, shared helpers for this boss only (own copy; the lane's kit is imported, never edited).
Hero canvas 480x768 = 9.6 x the real 50x80 footprint. Boss origin (0,0) sits at hero (240,269): fit up 28, down 30 + strands to 52."""
import sys, os, math, random, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bosskit import *
S = (480, 768); W, H = S; K = 9.6; OX, OY = 240, 269
GS = (50, 80); AT = (.76, .607)
SPOUT = (OX - 2 * K, OY - 19 * K)
def gp(x, y): return (OX + x * K, OY + y * K)
#                 tell   gey   swell  hurt wound die
P = dict(idle=   (0,    0,    0,     0,   0,    0),
         tell=   (1,    0,    0,     0,   0,    0),
         geyser= (0,    1,    0,     0,   0,    0),
         swell=  (0,    0,    1,     0,   0,    0),
         hurt=   (0,    0,    0,     1,   0,    0),
         wounded=(0,    0,    0,     0,   1,    0),
         dying=  (0,    0,    0,     0,   1,    1))
STATES = ['tell', 'geyser', 'swell', 'hurt', 'wounded', 'dying']
def st(name): return dict(zip(('tell', 'gey', 'sw', 'hurt', 'wound', 'die'), P[name]))
_vc = {}
def voronoi(seed, size, pts, scale=4):
    """F1 and F2-F1 in hero px; scale-reduced python loop, cached: no numpy here. F2-F1 near 0 = cell wall"""
    key = (seed, size, tuple(pts), scale)
    if key in _vc: return _vc[key]
    w, h = size[0] // scale, size[1] // scale; a = []; b = []; ids = []
    P_ = [(x / scale, y / scale) for x, y in pts]
    for j in range(h):
        for i in range(w):
            f1 = f2 = 1e18; k = 0
            for n, (x, y) in enumerate(P_):
                d = (i - x) ** 2 + (j - y) ** 2
                if d < f1: f2 = f1; f1 = d; k = n
                elif d < f2: f2 = d
            a.append(math.sqrt(f1) * scale); b.append((math.sqrt(f2) - math.sqrt(f1)) * scale); ids.append(k)
    A = Image.new('F', (w, h)); A.putdata(a); B = Image.new('F', (w, h)); B.putdata(b)
    I = Image.new('F', (w, h)); I.putdata(ids)
    r = (T(A.resize(size, BIC)), T(B.resize(size, BIC)), T(I.resize(size, NEAR)))
    _vc[key] = r; return r
def polar(size, cx, cy, fn, scale=2):
    """evaluate fn(angle from straight down, radius) on a reduced grid; the seam is straight up"""
    w, h = size[0] // scale, size[1] // scale; o = []
    for j in range(h):
        for i in range(w):
            dx = i * scale - cx; dy = j * scale - cy
            o.append(fn(math.atan2(dx, dy), math.hypot(dx, dy)))
    im = Image.new('F', (w, h)); im.putdata(o); return T(im.resize(size, BIC))
def strands(rng, size, roots, col=(.20,.02,.03), maxlen=120, w=4, sway=14, film=True, k=14, lift=1.0):
    """torn fibres and threads: tapered to nothing, wandering, never ball-on-a-string. roots = (x, y[, len])"""
    paths = []
    for r in roots:
        x, y = r[0], r[1]; L = r[2] if len(r) > 2 else rng.uniform(.25, 1) ** 1.4 * maxlen
        a = rng.uniform(-sway, sway); b = rng.uniform(-sway, sway)
        paths.append((bez((x, y), (x + a, y + L * .33), (x + b, y + L * .66), (x + a * .4 + b * .4, y + L), 20), w * rng.uniform(.8, 1.4), w * rng.uniform(.06, .2), lift))
    h, m = tubes(size, paths)
    base = tuple(const(c, size) for c in col)
    return wet(base, h, m, k=k, sss=.25, spec=.55, glint=.9, film=m if film else None), m
def ragged_holes(rng, size, spots, rough=.5, lobes=8):
    """eaten holes: unions of blobs"""
    t = const(0, size)
    for x, y, rx, ry in spots:
        t = mx(t, blob(rng, size, x, y, rx, ry, rough=rough, lobes=lobes))
    return t
def blood_runs(rng, size, starts, maxlen=160, w=5, col=(.30,.012,.02)):
    """blood running down the surface: tapers, beads irregularly, sheds sideways"""
    paths = []
    for x, y in starts:
        L = rng.uniform(.3, 1) * maxlen; xx = x; yy = y; pts = [(x, y)]; n = 12
        for i in range(n):
            xx += rng.uniform(-4, 4); yy += L / n; pts.append((xx, yy))
        paths.append((pts, w * rng.uniform(.5, 1.1), w * rng.uniform(.15, .45)))
    h, m = tubes(size, paths); return wet(tuple(const(c, size) for c in col), h * .7, m, k=10, sss=.1, spec=.8, glint=1, film=m), m
def tissue(name, rng, amp=26, cells=9, crop=None, rot=0, mirror=False, bul=None):
    im = warp(photo(name, S, crop=crop, rot=rot, mirror=mirror), rng, amp, cells)
    if bul: im = bulge(im, *bul)
    return im
def solid(col, a):
    """a premultiplied flat-colour layer through mask a"""
    return dict(rgb=cmul(col, a), a=a)
def tatters(rng, size, roots, sc=2):
    """torn membrane rags: tapering, jagged edges, some forked, some with holes. roots=(x,y,len,width)"""
    w, h = size; im = Image.new('L', (w * sc, h * sc), 0); d = ImageDraw.Draw(im)
    for x, y, L, wd in roots:
        n = int(abs(L) / 16) + 3; lean = rng.uniform(-.14, .14); l = []; r = []; xx = x
        for i in range(n + 1):
            t = i / n; yy = y + L * t; xx += rng.uniform(-7, 7) + lean * abs(L) / n
            ww = wd * (1 - t) ** .75 * rng.uniform(.55, 1.2)
            l.append(((xx - ww) * sc, yy * sc)); r.append(((xx + ww) * sc, (yy + rng.uniform(-6, 6)) * sc))
        d.polygon(l + r[::-1], fill=255)
    m = T(im.resize(size, LAN).convert('F')) * (1 / 255); return blur(m, .7)
