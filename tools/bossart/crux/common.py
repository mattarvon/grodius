"""THE BLOATED BITCH (crux), Matt's pick c5 Engorged Frost Leech: the Phase 1 painter's helpers, ported (own copy; the lane's
kit in tools/bossart is imported, never edited). Hero canvas 864x920 = 8x the real 108x115 footprint; G() maps boss-local px."""
import sys, os, random, math, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bosskit import *
S = (864, 920)       # 8x the real footprint, 108 x 115
GS = (108, 115)
def G(x, y): return (432 + 8 * x, 8 * (y + 65))     # boss-local px -> hero px
HEART = G(0, -6); FAN = G(-26, -4); RING_L = G(-26, 28); RING_R = G(26, 28)
def C(c, size=S): return tuple(const(v, size) for v in c)
def IDLE(**k):
    d = dict(nails=4, tell=0, rel=0, hurt=0, wnd=0, die=0); d.update(k); return d
STATES = [('fan tell', IDLE(tell=1)), ('rings', IDLE(rel=1)), ('hurt', IDLE(hurt=1)), ('bared', IDLE(nails=0, wnd=.45)),
          ('wounded', IDLE(nails=0, wnd=1, hurt=1)), ('dying', IDLE(nails=0, wnd=1, die=1))]

def tex(name, rng, crop=None, rot=0, wa=24, wc=9, bul=None, mirror=False):
    p = photo(name, S, crop=crop, rot=rot, mirror=mirror)
    if wa: p = warp(p, rng, wa, wc)
    if bul: p = bulge(p, *bul)
    return p
def tubes(size, paths, sc=2, steps=8):
    """kit tubes, but every path's outer ring is drawn before any inner ring: stacked segments no longer terrace into a slinky"""
    w, h = size; H = Image.new('L', (w * sc, h * sc), 0); d = ImageDraw.Draw(H)
    for k in range(steps):
        f = 1 - k / steps
        for p in paths:
            pts, w0, w1 = p[0], p[1], p[2]; lift = p[3] if len(p) > 3 else 1.0; n = len(pts) - 1; v = int(255 * lift * math.sqrt(max(0, 1 - f * f)))
            for i in range(n):
                a, b = pts[i], pts[i + 1]; t = i / max(1, n); rad = (w0 + (w1 - w0) * t) * f * sc
                if rad < .4: continue
                d.line((a[0]*sc, a[1]*sc, b[0]*sc, b[1]*sc), fill=v, width=max(1, int(rad*2)))
                d.ellipse((b[0]*sc-rad, b[1]*sc-rad, b[0]*sc+rad, b[1]*sc+rad), fill=v)
    H = H.resize(size, LAN); ht = T(H.convert('F')) * (1 / 255)
    return blur(ht, 1.5), ss(0.0, 0.08, ht)
def outline(pts, it=3, rng=None, jit=0):
    """a hand-placed silhouette: boss-local points, Chaikin-rounded. Returns hero-px points for polymask"""
    p = [G(*q) for q in pts]
    for _ in range(it):
        o = []
        for i in range(len(p)):
            a, b = p[i], p[(i + 1) % len(p)]
            o += [(a[0]*.75+b[0]*.25, a[1]*.75+b[1]*.25), (a[0]*.25+b[0]*.75, a[1]*.25+b[1]*.75)]
        p = o
    return p
def shape(rng, pts, rough=26, c=9, soft=3):
    """outline -> mask with a noise-broken edge: a lump, not a vector shape"""
    m = polymask(S, outline(pts), soft=soft); d = blur(m, 10)
    return ss(.47, .53, d + (fbm(rng, c, S, 4) - .5) * rough / 60)
def volume(M, big=120, mid=40, small=10, a=3.0, b=.8, c=.2):
    """large-scale form: without the wide term the body lights as a flat plate with a rim"""
    return blur(M, big) * a + blur(M, mid) * b + blur(M, small) * c
def smooth_union(ms, r=10, lo=.42, hi=.58):
    u = ms[0]
    for m in ms[1:]: u = mx(u, m)
    return ss(lo, hi, blur(u, r))

def rope(pts, w0, w1, lift=1.0, lumps=None, rng=None, seg=12):
    """a tube spec list whose width wanders, so nothing reads as a clean pipe"""
    out = []; n = len(pts) - 1; step = max(1, n // seg); wv = 1.0
    for i in range(0, n, step):
        a = pts[i:i + step + 1]; t0 = i / n; t1 = min(1, (i + step) / n)
        wa = (w0 + (w1 - w0) * t0); wb = (w0 + (w1 - w0) * t1)
        if rng and lumps:
            k0 = wv; wv = 1 + rng.uniform(-lumps, lumps)
            wa *= k0; wb *= wv
        out.append((a, wa, wb, lift))
    return out
def wander(rng, a, b, n=14, amp=10):
    """a jagged organic polyline between two points"""
    pts = []
    for i in range(n + 1):
        t = i / n; e = math.sin(t * math.pi)
        pts.append((a[0] + (b[0] - a[0]) * t + rng.uniform(-amp, amp) * e, a[1] + (b[1] - a[1]) * t + rng.uniform(-amp, amp) * e))
    return pts

# ------------------------------------------------------------ iron
def iron_mat(rng, rusty=.7, name='rust_113.jpg', crop=(.05, .55, .6, 1)):
    p = tex(name, rng, crop=crop, wa=20, wc=7)
    rgb = rgbT(p)
    return grade(rgb, (.02, .018, .02), (.17, .10, .07), (.74, .56, .40), contrast=1.5, keep=.22 * rusty), highpass(lumaT(p), 8, 3)
def spike_set(rng, roots, nails=4, jit=.12, wid=(10, 13), ylo=-17, yhi=15, per=4, tipx=(-49, -42, -35, -28)):
    """the shield: bar i has its tips near ox=-24-7i. Every nail is rooted in the body, so killing a bar removes one length class.
    roots(y) gives the hero x of the body surface at boss y. Returns tube specs, grouped so the longest bars go first"""
    specs = []
    for b in range(nails):
        tip = tipx[b]
        for j in range(per):
            y = ylo + (yhi - ylo) * (j + (b * .25) % 1 * .9 + rng.uniform(-.15, .15)) / per
            tx, ty = G(tip + rng.uniform(-2.5, 2.5), y)
            rx = roots(ty) + rng.uniform(4, 34)
            ang = rng.uniform(-jit, jit); ty2 = ty + (rx - tx) * ang
            w = rng.uniform(*wid)
            mid = ((tx + rx) / 2 + rng.uniform(-4, 4), (ty + ty2) / 2 + rng.uniform(-3, 3))
            specs.append(([(rx, ty2), mid, (tx, ty)], w, 2.2, 1.0))
    return specs
def spikes_layer(rng, specs, rust=None, frost=0.0):
    """iron nails with rust photo in them, lit by the same shader as the flesh; returns (layer, mask, entry map)"""
    h, m = tubes(S, specs, steps=5)
    alb, det = rust or iron_mat(rng)
    if frost:
        f = ss(.55, .75, fbm(rng, 30, S, 3))
        alb = cmix(alb, C((.66, .78, .88)), f * frost)
    L = wet(alb, h, m, detail=det, k=12, dk=3, ao=3, amb=.22, key=1.1, sss=0, spec=.7, shin=26, glint=1.2, rim=.5, rim_col=(.5, .6, .72))
    return L, m

# ------------------------------------------------------------ the heart (never a Valentine: a lump of muscle with cut vessels)
def heart(rng_seed, cx, cy, r, beat=1.0, vivid=1.0, burst=0.0):
    rng = random.Random(rng_seed)
    m = blob(rng, S, cx, cy + r * .08, r * .92 * beat, r * 1.12 * beat, rough=.17, lobes=3, ang=.42)
    m2 = blob(rng, S, cx + r * .5, cy - r * .62, r * .42, r * .36, rough=.2, lobes=4)   # atrium, off to one side
    stumps = []
    for a, l, w in [(-1.9, 1.05, .22), (-1.25, .95, .17), (-.6, .8, .13)]:
        x0, y0 = cx + math.cos(a) * r * .6, cy + math.sin(a) * r * .8
        x1, y1 = x0 + math.cos(a + rng.uniform(-.3, .3)) * r * l * .7, y0 + math.sin(a) * r * l * .7
        stumps += rope(bez((x0, y0), (x0 + 6, y0 - 12), (x1 - 8, y1 + 10), (x1, y1), 12), r * w, r * w * 1.1, .8, .12, rng, 5)
    th, tm = tubes(S, stumps)
    M = mx(smooth_union([m, m2], 4), tm)
    p = tex('path_200.jpg', rng, wa=18, wc=8, bul=(cx, cy, r * 1.6, .7))
    alb = grade(rgbT(p), (.06, .002, .005), (.42 * vivid, .012, .018), (.78, .12, .09), contrast=1.8, keep=.03)
    v = veinnet(rng, S, M, n=9, w0=5, seedpts=[(cx + r * .2, cy - r * .7), (cx - r * .5, cy - r * .4), (cx, cy)])
    alb = cmix(alb, C((.05, .005, .03)), v * .8)
    alb = cmix(alb, C((.75, .62, .44)), tm * .45)    # pale vessel walls
    hh = blur(M, r * .5) * 1.5 + dome(M, r * .38, r * .1) + th * .25 + blur(v, 1.2) * .06 + ss(.5, .8, fbm(rng, 6, S, 3)) * .10 * M
    L = wet(alb, hh, M, detail=highpass(lumaT(p), 10, 2.6), k=24, dk=5, ao=5, amb=.16, key=1.15, sss=.5, sss_col=(.8, .02, .02), spec=.7, film=film_map(rng, S, M, 7), glint=1.3, rim=0)
    return L, M

# ------------------------------------------------------------ wounds
def cavity(seed, cx, cy, rx, ry, rough=.4, lobes=4, ang=0.0):
    return blob(random.Random(seed), S, cx, cy, rx, ry, rough=rough, lobes=lobes, ang=ang, edge=2.0)
def hole_layer(seed, cav, flesh=(.20, .012, .016), depth=.9):
    """the inside of a torn cavity: concave, dark, wet, and shadowed by the rim above it"""
    rng = random.Random(seed)
    p = tex('path_196.jpg', rng, wa=26, wc=8)
    alb = grade(rgbT(p), (.012, .002, .004), flesh, (.42, .06, .05), contrast=1.4, keep=.05)
    h = (1 - dome(cav, 26, 8)) * .55
    L = wet(alb, h, cav, detail=highpass(lumaT(p), 12, 2.4), k=20, dk=5, amb=.06, sss=.15, spec=.3, rim=0, film=film_map(rng, S, cav, 8))
    # the rim's shadow, kept inside the hole
    sd = sh(blur(1 - cav, 16), 8, 16) * depth * cav
    return over(dict(rgb=C((0.004, 0, .002)), a=cl(sd)), L)
def rim_ring(cav, r=9): return cl(blur(cav, r) * 2.2) * (1 - cav)
def strands(seed, cav_box, n=8, w=(3, 7), col=(.40, .05, .05)):
    """fibres of tissue still bridging a tear (x0,y0,x1,y1 is the opening)"""
    rng = random.Random(seed); x0, y0, x1, y1 = cav_box; sp = []
    for _ in range(n):
        a = (rng.uniform(x0, x1), y0 + rng.uniform(-8, 10)); b = (a[0] + rng.uniform(-40, 40), rng.uniform(y0 + (y1 - y0) * .3, y1 + 6))
        sp += rope(wander(rng, a, b, 8, 6), rng.uniform(*w), rng.uniform(.8, 2.2), .8, .25, rng, 5)
    h, m = tubes(S, sp)
    return wet(C(col), h, m, k=12, sss=.3, sss_col=(.6, .03, .03), spec=.8, amb=.15, glint=1.1, rim=0), m

# ------------------------------------------------------------ frost, blood, gore
def rime(seed, m, h, amount=.6, up=1.0):
    """freezer rime gathers on up-facing rims and in patches. A coverage map, plus its own crystal height"""
    rng = random.Random(seed)
    dx, dy = grad(blur(h, 3)); upf = cl(-dy * 26 + -dx * 8)
    n = fbm(rng, 9, S, 5); cr = ss(.5, .72, fbm(rng, 60, S, 2))
    cov = ss(.62 - amount * .35, .85 - amount * .35, n + upf * .45 * up) * m
    return cov, cov * cr
def blood_ice(seed, starts, maxlen=120, w=(4, 8), col=(.30, .012, .02), glossy=1.0, ice=False):
    """frozen runs: long taper, no bead, slight kink. Never ball-on-a-string"""
    rng = random.Random(seed); sp = []
    for x, y in starts:
        L = rng.uniform(.3, 1) ** 1.2 * maxlen; wd = rng.uniform(*w); a = (x, y); wob = rng.uniform(-L * .08, L * .08)
        sp.append((bez(a, (x + wob, y + L * .35), (x - wob * .6, y + L * .7), (x + wob * .3, y + L), 16), wd, .5, 1.0))
    h, m = tubes(S, sp, steps=5)
    if ice:
        n = fbm(rng, 20, S, 3)
        alb = cmix(C(col), C((.62, .74, .84)), ss(.42, .66, n))
    else: alb = C(col)
    return wet(alb, h, m, k=11, sss=.35, sss_col=(.8, .04, .03), spec=.9 * glossy, shin=50, glint=1.4, amb=.28, rim=.12, film=m * .7), m
def spatter(seed, cx, cy, spread, n=60, r=(1.5, 7), col=(.34, .01, .02), bias=(0, 0)):
    """impact spatter on the body, as a wet layer: elongated, clumped, not dots"""
    rng = random.Random(seed); im = Image.new('L', S, 0); d = ImageDraw.Draw(im)
    for _ in range(n):
        a = rng.uniform(0, 6.283); q = rng.random() ** 1.6 * spread
        x = cx + math.cos(a) * q + bias[0] * q; y = cy + math.sin(a) * q + bias[1] * q; rr = rng.uniform(*r) * (1.2 - q / spread * .8)
        L = rr * rng.uniform(1, 3.4); d.line((x, y, x + math.cos(a) * L, y + math.sin(a) * L), fill=255, width=max(1, int(rr * 1.4)))
    m = blur(T(im.convert('F')) * (1 / 255), 1)
    return wet(C(col), m * .6, cl(m * 1.6), k=9, sss=.1, spec=1.0, shin=60, glint=1.2, amb=.3, rim=0, film=m)
def guts(seed, x, y, n=3, ln=170, w=17, spread=70, col=None, droop=1.0):
    """gut hanging from a tear: haustrated, uneven, each loop its own weight. Returns (layer, mask)"""
    rng = random.Random(seed); sp = []
    for i in range(n):
        x0 = x + rng.uniform(-spread, spread) * .5; L = rng.uniform(.5, 1) * ln * droop; sw = rng.uniform(-spread, spread)
        pts = bez((x0, y), (x0 + sw * 1.3, y + L * .3), (x0 - sw * 1.1, y + L * .7), (x0 + sw * .6, y + L), 34)
        sp += rope(pts, w * rng.uniform(.75, 1.2), w * rng.uniform(.45, .8), 1.0, .32, rng, 17)
    h, m = tubes(S, sp, steps=6)
    p = tex('path_197.jpg', rng, wa=30, wc=7)
    alb = grade(rgbT(p), (.09, .012, .02), (.46, .13, .13), (.82, .55, .46), contrast=1.4, keep=.05)
    fold = ridged(rng, 14, S, 3)
    alb = cmul(alb, 1 - fold * .55)
    return wet(alb, h + fold * m * -.04, m, detail=highpass(lumaT(p), 8, 2.5), k=15, dk=4, sss=.5, spec=.65, glint=1.2, film=m * .6, amb=.16, rim=.05), m
def chunks(seed, n, box, r=(8, 24), col=((.05, .002, .006), (.40, .03, .03), (.78, .32, .25))):
    """thrown meat, each a small rough lit piece"""
    rng = random.Random(seed); x0, y0, x1, y1 = box; M = None; Hh = None
    for i in range(n):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1); rr = rng.uniform(*r)
        im = Image.new('L', S, 0); d = ImageDraw.Draw(im)
        pts = [(x + math.cos(a) * rr * rng.uniform(.5, 1.3), y + math.sin(a) * rr * rng.uniform(.5, 1.1)) for a in [k * .9 for k in range(7)]]
        d.polygon(pts, fill=255)
        t = T(im.convert('F')) * (1 / 255); M = t if M is None else mx(M, t)
    M = blur(M, 1.4); M = ss(.35, .6, M)
    alb = base_from(col, fbm(rng, 40, S, 3))
    return wet(alb, blur(M, 4) * .7, M, k=12, sss=.4, spec=.9, glint=1.2, amb=.25, rim=0), M
def pore(seed, x, y, r, k=1.0):
    """an attack source swelling open: a rupture with live blood light in it"""
    rng = random.Random(seed)
    m = blob(rng, S, x, y, r, r * .85, rough=.3, lobes=4)
    glow = blob(rng, S, x, y, r * .55, r * .45, rough=.25, lobes=4)
    swell = cl(blur(m, r * .9) * 1.5) * (1 - m)
    L = dict(rgb=(glow * (.95 * k) + m * .07, glow * (.10 * k), glow * (.05 * k)), a=m)
    return L, swell
def stack(*layers):
    cv = layers[0]
    for l in layers[1:]:
        if l is not None: cv = over(l, cv)
    return cv
