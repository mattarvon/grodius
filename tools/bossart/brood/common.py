"""THE BROOD MOTHER, shared helpers for this boss only (own copy of the Phase 1 concept's com.py; the lane's kit is imported,
never edited). Hero canvas 520x620 = 10x the real 52x62 footprint; boss origin (0,0) sits at hero (260,280)."""
import sys, os, math, random, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bosskit import *
SC = 10; GS = (52, 62); S = (520, 620); OX, OY = 26 * SC, 28 * SC
def g(x, y): return (OX + x * SC, OY + y * SC)
VENT = g(-16, 6); SNZ = g(-18, -4); HIT = (OX, OY, 200)
def col(c, size=S): return tuple(const(v, size) for v in c)
def L2T(im): return T(im.convert('F')) * (1 / 255)
def draw(fn, size=S, sc=2):
    im = Image.new('L', (size[0] * sc, size[1] * sc), 0); fn(ImageDraw.Draw(im), sc); return L2T(im.resize(size, LAN))
def chaikin(pts, it=3, closed=True):
    for _ in range(it):
        q = []; n = len(pts)
        for i in range(n if closed else n - 1):
            a, b = pts[i], pts[(i + 1) % n]; q += [(a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25), (a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75)]
        pts = q
    return pts
def lev(im, cut=2): return ImageOps.autocontrast(im.convert('RGB'), cutoff=cut)
def tornmask(rng, out, wide=14, amp=1.5, fine=.35, cells=(14, 70)):
    """a polygon whose every edge is torn: wide-blurred mask thresholded against coarse and fine noise"""
    m0 = polymask(S, out, soft=3); a = fbm(rng, cells[0], S, 5); b = vnoise(rng, cells[1], int(cells[1] * 1.2), S)
    w = blur(m0, wide); return ss(.47, .53, w + (a - .5) * amp + (b - .5) * fine) * ss(.1, .28, w)  # second term drops crumbs far from the body
def rpoly(rng, cx, cy, rx, ry, n=22, j=.18, ang=0.0):
    pts = []; ca, sa = math.cos(ang), math.sin(ang); ph = rng.uniform(0, 6.28); ph2 = rng.uniform(0, 6.28)
    for i in range(n):
        a = i / n * 6.283; k = 1 + j * (.6 * math.sin(a * 2 + ph) + .5 * math.sin(a * 3 + ph2)) + rng.uniform(-j, j) * .6
        x = math.cos(a) * rx * k; y = math.sin(a) * ry * k
        pts.append((cx + x * ca - y * sa, cy + x * sa + y * ca))
    return pts
def polys(plist, size=S, soft=1.0):
    def f(d, s):
        for p in plist: d.polygon([(x * s, y * s) for x, y in p], fill=255)
    t = draw(f, size); return blur(t, soft) if soft else t
def bump(cx, cy, rx, ry=None, ang=0.0, size=S, p=1.0):
    """smooth dome field 0..1 inside the ellipse (not a mask: a height to add)"""
    from bosskit import _field
    d = _field(size, cx, cy, rx, ry or rx, ang); return ss(1.0, 0.0, d) ** p
def wobble(rng, pts, amp, every=1):
    out = []; ph = rng.uniform(0, 6.28); f = rng.uniform(.15, .35)
    for i, (x, y) in enumerate(pts):
        out.append((x + math.sin(i * f + ph) * amp + rng.uniform(-amp, amp) * .25, y + math.cos(i * f * .7 + ph) * amp * .6))
    return out
def vtubes(size, paths, sc=2, steps=6):
    """like kit.tubes, but every level is drawn across all segments before the next, so chained segments stay smooth. Later paths in `paths` still merge: use for one family"""
    w, h = size; H = Image.new('L', (w * sc, h * sc), 0); d = ImageDraw.Draw(H)
    for k in range(steps):
        f = 1 - k / steps; v = int(255 * math.sqrt(max(0, 1 - f * f))) + (12 if k == 0 else 0)
        for pts, w0, w1 in paths:
            n = len(pts) - 1
            for i in range(n):
                a, b = pts[i], pts[i + 1]; t = i / max(1, n); rad = (w0 + (w1 - w0) * t) * f * sc
                if rad < .4: continue
                d.line((a[0]*sc, a[1]*sc, b[0]*sc, b[1]*sc), fill=v, width=max(1, int(rad*2)))
                d.ellipse((b[0]*sc-rad, b[1]*sc-rad, b[0]*sc+rad, b[1]*sc+rad), fill=v)
    H = H.resize(size, LAN); ht = T(H.convert('F')) * (1 / 255)
    return blur(ht, 1), ss(0.0, 0.05, ht)
def ropes(rng, anchors, length=(90, 200), w=(7, 15), colr=(.30, .28, .15), bloody=.3, web=2, size=S, lean=0.0):
    """mucus ropes: stretched thick to thin to thick-ish, forks and sagging webs, no beads on strings. Ends drawn out to a slack point"""
    segs = []; ends = []
    for (x, y) in anchors:
        L = rng.uniform(*length); wd = rng.uniform(*w); wob = rng.uniform(-18, 18)
        pts = bez((x, y), (x + wob + lean * L * .2, y + L * .35), (x - wob + lean * L * .5, y + L * .7), (x + rng.uniform(-10, 10) + lean * L, y + L), 18)
        pts = wobble(rng, pts, 2.2); n = len(pts) - 1; neck = rng.uniform(.45, .7)
        for i in range(n):
            t0, t1 = i / n, (i + 1) / n
            f = lambda t: wd * (1.0 - .72 * ss_f(0, neck, t) + .07 * ss_f(neck, .85, t) - .2 * ss_f(.85, 1, t))
            segs.append(([pts[i], pts[i + 1]], max(1.6, f(t0)), max(1.6, f(t1))))
        ends.append(pts)
        if rng.random() < .5:  # a fork that peels off the rope and thins out
            k = rng.randint(5, 11); p = pts[k]
            q = bez(p, (p[0] + rng.uniform(-16, 16), p[1] + 22), (p[0] + rng.uniform(-30, 30), p[1] + 44), (p[0] + rng.uniform(-44, 44), p[1] + rng.uniform(46, 90)), 8)
            segs.append((q, wd * .3, 1.6))
    for _ in range(web):  # slack strand sagging between two ropes
        a, b = rng.sample(ends, 2) if len(ends) > 1 else (ends[0], ends[0])
        p = a[rng.randint(4, 12)]; q = b[rng.randint(4, 12)]; my = max(p[1], q[1]) + rng.uniform(10, 34)
        segs.append((bez(p, (p[0] * .7 + q[0] * .3, my), (p[0] * .3 + q[0] * .7, my), q, 12), 2.2, 2.2))
    h, m = vtubes(size, segs, steps=5)
    tint = ss(.5, .75, fbm(rng, 5, size, 3)) * bloody
    base = cmix(col(colr, size), col((.26, .03, .03), size), tint)
    return wet(base, h * .8, m, k=11, sss=.06, sss_col=(.3, .22, .05), spec=.75, glint=.9, film=m, amb=.2)
def ss_f(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def tear(rng, path, wmax, jag=.3, size=S, power=.7):
    """a jagged rip polygon along a path; wmax is half width"""
    n = len(path) - 1; L = []; R = []
    for i, (x, y) in enumerate(path):
        a = path[min(i + 1, n)]; b = path[max(i - 1, 0)]; dx, dy = a[0] - b[0], a[1] - b[1]; l = math.hypot(dx, dy) or 1
        t = i / n; wd = wmax * max(0, math.sin(t * math.pi)) ** power
        L.append((x - dy / l * wd * rng.uniform(1 - jag, 1 + jag), y + dx / l * wd * rng.uniform(1 - jag, 1 + jag)))
        R.append((x + dy / l * wd * rng.uniform(1 - jag, 1 + jag), y - dx / l * wd * rng.uniform(1 - jag, 1 + jag)))
    return polys([L + R[::-1]], size, soft=.8)
def rawmeat(rng, name='path_200.jpg', dark=1.0, size=S):
    ph = warp(photo(name, size), rng, 22, 9); r = rgbT(ph)
    alb = grade(r, (.035, .003, .006), (.30 * dark, .022, .024), (.70 * dark, .20, .15), contrast=1.9, keep=.04)
    return alb, highpass(lumaT(ph), 9, 3.4)
def grubmass(rng, size=S):
    """the seething fill: mold_227's real clustered pale mass, graded to dirty cream. Reads as packed larvae"""
    ph = warp(photo('mold_227.jpg', size), rng, 16, 9); r = rgbT(ph)
    return grade(r, (.03, .012, .01), (.36, .25, .15), (.80, .68, .48), contrast=2.5, keep=0), highpass(lumaT(ph), 8, 3.0)
def apply_tear(base, h, det, t, raw, rawdet, depth=.9, lip=.2):
    rim = cl(blur(t, 9) * 2.0) * (1 - t); core = ss(.45, 1, blur(t, 6)) * t
    base = cmix(base, raw, ss(.1, .5, blur(t, 1.5)))
    base = cmix(base, raw, rim * .55)
    base = cmul(base, 1 - core * depth)
    h = h + rim * lip - t * .1 - core * .22
    if det is not None: det = mix(det, rawdet, ss(.1, .5, t))
    return base, h, det, core
def grubs(rng, items, size=S, colr=None, shade=True):
    """segmented, wet, tapered larvae: items = (x, y, ang, len, w, curl). Head end is at (x, y). Returns (layer, mask). Dark gut line, transverse creases, spiracle bristles"""
    paths = []; rings = []; heads = []
    for x, y, a, ln, wd, cu in items:
        p0 = (x, y); p3 = (x + math.cos(a + cu) * ln, y + math.sin(a + cu) * ln)
        p1 = (x + math.cos(a) * ln * .35, y + math.sin(a) * ln * .35); p2 = (x + math.cos(a + cu * 1.6) * ln * .7, y + math.sin(a + cu * 1.6) * ln * .7)
        pts = bez(p0, p1, p2, p3, 18); n = len(pts) - 1
        for i in range(n):  # fat in the middle, pointed at the head
            t0, t1 = i / n, (i + 1) / n; pr = lambda t: wd * (.35 + .65 * ss_f(0, .22, t)) * (1 - .35 * ss_f(.55, 1, t))
            paths.append(([pts[i], pts[i + 1]], pr(t0), pr(t1)))
        step = max(3, int(max(1.0, wd * .55) / max(.1, ln / 18)))
        for i in range(2, n, step):
            ax, ay = pts[i]; bx, by = pts[i + 1]; dx, dy = bx - ax, by - ay; l = math.hypot(dx, dy) or 1; wi = wd * (.35 + .65 * ss_f(0, .22, i / n)) * (1 - .35 * ss_f(.55, 1, i / n))
            rings.append(((ax - dy / l * wi, ay + dx / l * wi), (ax + dy / l * wi, ay - dx / l * wi)))
        heads.append((pts[0], wd))
    h, m = vtubes(size, paths, steps=6)
    rg = draw(lambda d, s: [d.line((r[0][0] * s, r[0][1] * s, r[1][0] * s, r[1][1] * s), fill=255, width=max(1, int(1.7 * s))) for r in rings], size)
    rg = blur(rg, .9) * m
    hd = draw(lambda d, s: [d.ellipse(((p[0] - w * .4) * s, (p[1] - w * .4) * s, (p[0] + w * .4) * s, (p[1] + w * .4) * s), fill=255) for p, w in heads], size)
    gm, gd = grubmass(rng, size); noise = fbm(rng, 9, size, 3)
    base = cmix(col((.62, .50, .38), size), gm, .4) if colr is None else col(colr, size)
    base = cmul(base, (1 - rg * .5) * (.7 + .6 * noise))
    base = cmix(base, col((.03, .02, .015), size), blur(hd, .7) * .92)
    L = wet(base, h * .55 - rg * .08, m, detail=gd, k=16, dk=1.5, ao=6, sss=.2, sss_col=(.4, .12, .06), spec=.55, glint=.8, film=m * .6, amb=.13)
    return L, m
def spatter(rng, centre, n, spread, size=S, colr=(.34, .01, .02), rmin=2, rmax=7, up=False):
    """thrown blood: elongated along the throw, never round beads"""
    pl = []; 
    for _ in range(n):
        a = rng.uniform(0, 6.283) if not up else rng.uniform(math.pi * .9, math.pi * 2.1); d = rng.uniform(.25, 1) ** .7 * spread; r = rng.uniform(rmin, rmax); st = rng.uniform(1.6, 4)
        x, y = centre[0] + math.cos(a) * d, centre[1] + math.sin(a) * d
        pl.append(rpoly(rng, x, y, r * st, r, n=8, j=.25, ang=a))
    m = polys(pl, size, soft=.7); 
    return wet(col(colr, size), blur(m, 1.5) * .5, m, k=12, sss=.25, spec=.9, glint=1.0, film=m, amb=.2)
def outside_tatters(rng, anchors, length=(50, 130), w=(8, 16), raw=None, size=S):
    """hanging strips of torn tissue, flat-ish and tapering, not uniform tubes"""
    segs = []
    for x, y in anchors:
        L = rng.uniform(*length); wd = rng.uniform(*w); pts = wobble(rng, bez((x, y), (x + rng.uniform(-14, 14), y + L * .3), (x + rng.uniform(-20, 20), y + L * .6), (x + rng.uniform(-14, 14), y + L), 12), 2.5)
        segs.append((pts, wd, 1.5))
    h, m = vtubes(size, segs, steps=4)
    alb, det = rawmeat(rng, size=size)
    return wet(alb, h * .7, m, detail=det, k=14, dk=3, sss=.5, spec=.5, film=m * .6)
