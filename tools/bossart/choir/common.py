"""THE NAIL CHOIR, shared helpers for this boss only (own copy of the Phase 1 painter's helpers, ck.py + eye.py + the strap
fibres of c3.py; the lane's kit is imported, never edited). Paint at 8x game size. Every helper takes the canvas size, so the
body (720x800 = 90x100 game px, boss origin at hero (360, 400)) and a nailbar (200x320) share one code path."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bosskit import *
from PIL import Image, ImageDraw, ImageFilter

SC = 8.0
S = (720, 800); OX, OY = 360, 400          # body canvas, boss (0,0)
def P(x, y): return (OX + x * SC, OY + y * SC)


def rough(m, rng, size, amt=.25, c=9, r=3):
    "break a mask's edge with noise: no clean geometry"
    return ss(.46, .54, blur(m, r) + (fbm(rng, c, size, 4) - .5) * amt)


def rawmeat(rng, size):
    im = warp(photo('path_196.jpg', size), rng, 20, 8)
    return grade(rgbT(im), (.035, .002, .004), (.30, .018, .02), (.60, .13, .10), contrast=1.5, keep=.04), highpass(lumaT(im), 10, 2.4)


class Scene:
    """layers with one global damage map: the same tear cuts every part it crosses, in its height field, before lighting.
    add() returns the part's layers (shadow, lit) instead of compositing, so a bake can cache a part and re-stack it"""
    def __init__(s, seed, size=S, key=.95):
        s.size = size; s.rng = random.Random(seed); s.cv = canvas(size)
        s.t = const(0, size); s.b = const(0, size); s.key = key; s.raw = None

    def tear(s, x, y, rx, ry, ang=0, rg=.34, lobes=6, at=P):
        if rx <= .2 or ry <= .2: return
        px, py = at(x, y); s.t = mx(s.t, blob(s.rng, s.size, px, py, rx * SC, ry * SC, rough=rg, lobes=lobes, ang=ang, edge=5))
        if s.raw is None: s.raw = rawmeat(random.Random(77), s.size)

    def bite(s, x, y, rx, ry, ang=0, rg=.4, lobes=5, at=P):
        if rx <= .2 or ry <= .2: return
        px, py = at(x, y); s.b = mx(s.b, blob(s.rng, s.size, px, py, rx * SC, ry * SC, rough=rg, lobes=lobes, ang=ang, edge=3))

    def part(s, base, h, m, det=None, sh_r=8, sh_k=.75, cut=True, **kw):
        m = m * (1 - s.b)
        if cut and s.raw is not None:
            t = s.t
            lip = ss(.02, .45, blur(t, 7)) * (1 - t); deep = ss(.5, .95, blur(t, 10))
            base = cmix(base, s.raw[0], t); base = cmix(base, (const(.012, s.size), const(.001, s.size), const(.002, s.size)), deep)
            base = cmix(base, (const(.20, s.size), const(.012, s.size), const(.016, s.size)), lip * .55)
            h = h + lip * .13 - t * .2 - deep * .22
            det = mix(det if det is not None else const(.5, s.size), s.raw[1], t)
        kw.setdefault('key', s.key)
        out = [shadow(m, sh_r, sh_k)] if sh_r else []
        out.append(wet(base, h, m, detail=det, **kw)); return out

    def add(s, *a, **k):
        for L in s.part(*a, **k): s.cv = over(L, s.cv)

    def lay(s, layer): s.cv = over(layer, s.cv)


def stack(cv, layers):
    for L in layers: cv = over(L, cv)
    return cv


def runs(rng, size, starts, maxlen, w, col=(.30, .012, .016)):
    "blood that creeps and thins: uneven width, no bead on a string"
    paths = []
    for x, y in starts:
        L = rng.uniform(.3, 1) ** 1.3 * maxlen; px, py = x, y; n = rng.randint(3, 5); wd = w * rng.uniform(.8, 1.5)
        for i in range(n):
            ny = py + L / n; nx = px + rng.uniform(-w, w)
            w2 = wd * rng.uniform(.45, 1.05)
            paths.append((bez((px, py), (px + rng.uniform(-3, 3), py + L / n * .3), (nx + rng.uniform(-3, 3), py + L / n * .7), (nx, ny), 8), wd, w2)); px, py = nx, ny; wd = w2
        paths.append((bez((px, py), (px, py + 6), (px, py + L / n * .5), (px + rng.uniform(-2, 2), py + L / n), 6), wd, .5))
    h, m = tubes(size, paths)
    base = tuple(const(c, size) for c in col)
    return wet(base, h * .5, m, k=12, sss=.25, spec=.75, glint=1.0, film=m, ao=2)


def nail_paths(items):
    "items (rx,ry,tx,ty,w[,bend]): root, tip, shank half-width"
    p = []
    for it in items:
        rx, ry, tx, ty, w = it[:5]; b = it[5] if len(it) > 5 else 0
        nx, ny = -(ty - ry), (tx - rx); l = max(1, math.hypot(nx, ny)); nx /= l; ny /= l
        mx_, my_ = (rx + tx) / 2 + nx * b, (ry + ty) / 2 + ny * b
        p.append((bez((rx, ry), (mx_, my_), (mx_, my_), (tx, ty), 10), w, w * .22))
    return p


def nails(rng, size, items, glint=0.0, rustn='rust_336.jpg', heads=(), grade_dark=1.0):
    "rusted iron nails shaded from a tube height field, real rust photo as albedo and micro detail. glint: the singing frost-white"
    paths = nail_paths(items)
    for (x, y, r) in heads: paths.append(([(x - .1, y), (x + .1, y)], r, r))
    h, m = tubes(size, paths)
    im = warp(photo(rustn, size), rng, 30, 8)
    base = grade(rgbT(im), (.03, .016, .012), (.22 * grade_dark, .11 * grade_dark, .06 * grade_dark), (.70, .50, .34), contrast=1.7, keep=.1)
    det = highpass(lumaT(im), 6, 2.6)
    if glint:
        # the nails sing: rime races up them, brightest toward the tips (h is lowest at the thin tip, so use the tip mask)
        base = cmix(base, (const(.74, size), const(.88, size), const(.99, size)), cl(m * .82 * glint))
    return wet(base, h * .55, m, detail=det, k=10, dk=3, ao=2.5, sss=0, spec=.7 + .5 * glint, shin=26, glint=1.0 + glint), m


def rime(rng, m, size, amt=.6, c=26):
    "frost that sits on the up-left faces and in crust patches: never a coat of paint"
    X, Y = coords(size); lean = cl(1.2 - (X / float(size[0])) * .5 - (Y / float(size[1])) * .9)
    r = ss(.52, .72, fbm(rng, c, size, 4) * .6 + fbm(rng, 6, size, 3) * .4 + (lean - .5) * .25)
    return r * m * amt


FROST = (.34, .43, .50)
def frosted(base, r, size):
    return cmix(base, tuple(const(c, size) for c in FROST), r)


# ------------------------------------------------------------------ the strap fibres (c3)
def fibres(rng, pts, w0, w1, n=11, fray=.3, flare=1.5):
    "a strap as a bundle of fibres following the path, each stopping at its own length and splaying at the torn end: no sausage caps"
    out = []; N = len(pts) - 1
    for k in range(n):
        off = (k / (n - 1) - .5) * 2; endf = 1 - rng.random() ** 1.6 * fray; jit = rng.uniform(-.1, .1); path = []
        for i in range(int(N * endf) + 1):
            t = i / N; x, y = pts[i]; x2, y2 = pts[min(N, i + 1)]; x1, y1 = pts[max(0, i - 1)]
            dx, dy = x2 - x1, y2 - y1; l = max(1e-3, math.hypot(dx, dy)); nx, ny = -dy / l, dx / l
            wd = (w0 + (w1 - w0) * t) * (1 + max(0, (t - .7) / .3) * flare * .6)
            ox = (off + jit) * wd + rng.uniform(-.8, .8)
            path.append((x + nx * ox, y + ny * ox))
        out.append((path, (w0 + (w1 - w0) * .3) * .32 * rng.uniform(.6, 1.2), max(1.2, w1 * .16)))
    return out


def strap(s, rng, pts, w0, w1, tissue, det, lift=.42, sh=6, tendon=True, keep=1.0, fray=.3):
    """extraocular muscle: striated bundle, pale tendon sheet at the eye end, frayed where it was ripped from the orbit.
    keep < 1: the strap was torn off, only that much of it is still on the globe, and the stump splays wide"""
    if keep < 1:
        n = max(3, int(len(pts) * keep)); pts = pts[:n]; w1 = w0 + (w1 - w0) * keep; fray = .55
    fp = fibres(rng, pts, w0, w1, n=max(8, int(w0 / 2.2)), fray=fray, flare=1.5 if keep >= 1 else 2.6)
    h, m = tubes(s.size, fp)
    t = tissue
    if tendon:
        a = pts[0]; X, Y = coords(s.size); dd = ((X - a[0]) ** 2 + (Y - a[1]) ** 2) ** .5
        t = cmix((const(.56, s.size), const(.50, s.size), const(.40, s.size)), t, ss(14, 70, dd))
    return s.part(t, h * lift, m, det=det, sh_r=sh, sh_k=.85, k=18, dk=7, ao=3, sss=.55, sss_col=(.5, .02, .03), spec=.3,
                  film=film_map(rng, s.size, m, 8))


# ------------------------------------------------------------------ the eye (eye.py)
def iris_tex(rng, res, pup, col_in, col_out, col_ring):
    "a flat iris disc of hand-noised radial fibres; affine-projected onto the globe later. Not a clean ring: the pupil edge is torn"
    o = Image.new('RGB', (res, res), tuple(int(255 * v) for v in col_out)); d = ImageDraw.Draw(o); c = res / 2
    for i in range(900):
        a = rng.uniform(0, 6.283); r0 = rng.uniform(pup * .8, .55) * c; r1 = rng.uniform(.5, 1.0) * c; t = rng.random()
        col = tuple(int(255 * (col_in[k] * (1 - t) + col_ring[k] * t)) for k in range(3))
        d.line((c + math.cos(a) * r0, c + math.sin(a) * r0, c + math.cos(a + rng.uniform(-.06, .06)) * r1, c + math.sin(a + rng.uniform(-.06, .06)) * r1), fill=col, width=rng.choice((1, 1, 2, 3)))
    o = o.filter(ImageFilter.GaussianBlur(1))
    pts = []
    for i in range(36):
        a = i / 36 * 6.283; rr_ = pup * c * (1 + rng.uniform(-.14, .14) + .12 * math.sin(a * 3 + 1)); pts.append((c + math.cos(a) * rr_, c + math.sin(a) * rr_))
    pm = Image.new('L', (res, res), 0); ImageDraw.Draw(pm).polygon(pts, fill=255); pm = pm.filter(ImageFilter.GaussianBlur(res / 170))
    im = Image.new('L', (res, res), 0); ImageDraw.Draw(im).ellipse((1, 1, res - 2, res - 2), fill=255); im = im.filter(ImageFilter.GaussianBlur(res / 90))
    return o, pm, im


def project(tex, cen, Rd, g, size=S):
    "disc texture to its foreshortened place on the globe (a cap on a sphere is close to an ellipse)"
    res = tex.size[0]; gx, gy, gz = g; pl = math.hypot(gx, gy) or 1e-3; ex, ey = gx / pl, gy / pl
    sc = (res / 2) / Rd
    a11, a12 = ex / max(gz, .15), ey / max(gz, .15); b11, b12 = -ey, ex
    m11 = sc * (a11 * ex + b11 * (-ey)); m12 = sc * (a12 * ex + b12 * (-ey)); m21 = sc * (a11 * ey + b11 * ex); m22 = sc * (a12 * ey + b12 * ex)
    c = res / 2
    M = (m11, m12, c - m11 * cen[0] - m12 * cen[1], m21, m22, c - m21 * cen[0] - m22 * cen[1])
    return tex.transform(size, Image.Transform.AFFINE, M, BIC)


def L2T(im): return T(im.convert('F')) * (1 / 255)


def globe(rng, cx, cy, R, lump=.1, dent=None, squash=1.0, size=S):
    "the globe as a height field and mask: wrinkled outline, dents. h is scaled so the wet() shader sees a real sphere"
    X, Y = coords(size); nx = (X - cx) * (1 / R); ny = (Y - cy) * (1 / (R * squash))
    rr = (nx * nx + ny * ny) ** .5 + (fbm(rng, 4, size, 3) - .5) * lump
    if dent:
        for dx, dy, dr, dk in dent:
            q = ((X - dx) ** 2 + (Y - dy) ** 2) ** .5 * (1 / dr); rr = rr + ss(1, 0, q) * dk
    nz = mx(1 - rr * rr, 0.0) ** .5; mask = ss(1.0 + 1.5 / R, 1.0 - 1.5 / R, rr)
    return nz, mask, rr
