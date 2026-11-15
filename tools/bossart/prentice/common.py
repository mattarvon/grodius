"""THE BUTCHER'S APPRENTICE, shared helpers for this boss only: the Phase 1 painter's kit (SP/concepts/prentice/src/pk.py) ported.
The lane's kit (tools/bossart/bosskit.py) is imported untouched. Body canvas S = 480x560 = 8x a 60x70 game area, boss (0,0) at (288,280)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bosskit import *
S = (480, 560); OX, OY = 288, 280
def G(x, y): return (OX + x * 8, OY + y * 8)
X, Y = coords(S)
HOT = (.85, .30, .06)
RAW = dict(shadow=(.03,.003,.006), mid=(.27,.018,.022), hi=(.60,.17,.13))

def tex(name, rng, crop=None, amp=26, cells=9, rot=0, mirror=False, size=S):
    return warp(photo(name, size, crop=crop, rot=rot, mirror=mirror), rng, amp, cells)
def tissue(p, shadow=RAW['shadow'], mid=RAW['mid'], hi=RAW['hi'], contrast=1.6, keep=.06, r=18, g=2.6):
    return grade(rgbT(p), shadow, mid, hi, contrast=contrast, keep=keep), highpass(lumaT(p), r, g)
def flesh(base, h, m, det, **kw):
    a = dict(k=26, dk=6, ao=7, sss=.55, spec=.30, glint=.8, rim=.14, rim_col=HOT); a.update(kw)
    return wet(base, h, m, detail=det, **a)
def metal(rng, m, h, name='rust_107.jpg', crop=None, pal=((.012,.010,.011),(.17,.105,.08),(.50,.32,.22)), contrast=1.5, keep=.10, k=18, dk=2.6, spec=.3, seedamp=14, **kw):
    p = tex(name, rng, crop=crop, amp=seedamp, cells=8); base = grade(rgbT(p), *pal, contrast=contrast, keep=keep); det = highpass(lumaT(p), 16, 2.0)
    a = dict(k=k, dk=dk, ao=6, sss=0.0, spec=spec, shin=16, glint=.55, rim=.16, rim_col=HOT); a.update(kw)
    return wet(base, h, m, detail=det, **a)

def gutpath(rng, x, y, dx, dy, n=5, w=(9, 15), wob=26, seg=7):
    """one lumpy hanging length: segments of unequal bore, never a clean tube"""
    out = []; px, py = x, y; lw = rng.uniform(*w)
    for i in range(n):
        nx = px + dx + rng.uniform(-wob, wob); ny = py + dy + rng.uniform(-wob * .4, wob * .4)
        c1 = (px + rng.uniform(-wob, wob), py + dy * .3); c2 = (nx + rng.uniform(-wob, wob), ny - dy * .3)
        nw = rng.uniform(*w) * (1 - i / (n + 2) * .6)
        out.append((bez((px, py), c1, c2, (nx, ny), seg), lw, nw)); px, py, lw = nx, ny, nw
    return out
def runs(rng, starts, maxlen=70, w=4, col=(.20,.008,.012)):
    """blood runs: thick where they leave, thread-thin when they end. No bead on the end: the ball-on-a-string failure"""
    paths = []
    for x, y in starts:
        L = rng.uniform(.3, 1) ** 1.4 * maxlen; wob = rng.uniform(-w, w); wd = w * rng.uniform(.7, 1.3)
        paths.append((bez((x, y), (x + wob, y + L * .35), (x - wob * .6, y + L * .7), (x + wob * .3, y + L), 12), wd, wd * .15))
    h, m = tubes(S, paths)
    return wet(tuple(const(c, S) for c in col), h, m, k=12, sss=.05, spec=.7, glint=.9, film=m, rim=0)
def spray(rng, cx, cy, n=60, spread=90, r=(1.5, 6), col=(.26,.012,.014)):
    """flung gore: irregular flecks, for hurt and dying"""
    im = Image.new('L', (S[0] * 2, S[1] * 2), 0); d = ImageDraw.Draw(im)
    for _ in range(n):
        a = rng.uniform(0, 6.283); q = rng.gauss(0, 1) * spread; x, y = cx + math.cos(a) * q, cy + math.sin(a) * q; rr = rng.uniform(*r)
        d.polygon([(2 * (x + math.cos(t) * rr * rng.uniform(.5, 1.4)), 2 * (y + math.sin(t) * rr * rng.uniform(.5, 1.4))) for t in [i * 1.05 for i in range(6)]], fill=255)
    m = T(im.resize(S, LAN).convert('F')) * (1 / 255)
    return wet(tuple(const(c, S) for c in col), m, m, k=8, sss=0, spec=.6, film=m, rim=0), m
def strokes(paths, sc=2):
    """width-varying gashes -> soft mask"""
    h, m = tubes(S, paths, sc=sc); return m
def ring(mask, r=7): return cl(blur(mask, r) - mask * .92) * 1.8
# ------------------------------------------------------------------ second-pass helpers
def rough(m, rng, amt=.5, c=14, r=3, lo=.42, hi=.56):
    """eat a tube or polygon mask with noise so its edge is torn meat, not a vector curve"""
    return ss(lo, hi, blur(m, r) + (fbm(rng, c, S, 3) - .5) * amt) * ss(.02, .10, blur(m, r + 7))
def limb(rng, paths, name, pal, amt=.5, k=24, crop=None, **kw):
    """meat strap with a torn edge and real photo surface. Returns (layer, mask)"""
    h, m = tubes(S, paths); M = rough(m, random.Random(rng.random()), amt); p = tex(name, rng, crop=crop, amp=26, cells=7)
    base, det = tissue(p, pal['shadow'], pal['mid'], pal['hi'], contrast=1.45)
    H = blur(h, 2) + (fbm(rng, 12, S, 3) - .5) * .14 + M * .1
    return flesh(base, H, M, det, k=k, **kw), M
def hotmouth(cv, mask, amt, rng, floor=.0):
    """an opening with fire deep inside: black at the lip, dull red, then a broken orange core. Never a flat fill"""
    deep = ss(.15, .85, blur(mask, 3.5)); brk = .55 + .45 * ss(.35, .6, fbm(rng, 18, S, 3)); a = (amt + floor)
    red = cmul((.60, .05, .012), ss(.0, .5, deep)); core = cmul((.95, .30, .04), ss(.55, 1, deep) * brk)
    return over(dict(rgb=cmul(cadd(cadd((.01, .001, .001), cmul(red, a)), cmul(core, a)), mask), a=mask), cv)
