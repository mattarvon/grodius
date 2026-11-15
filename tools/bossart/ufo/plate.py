"""SQUID SAUCER 2000 bake: the Phase 1 concept toolkit (bosspick/ufo/lib.py), ported unchanged except the game-sprite
helpers, which Baker (../bake.py) replaces. Saucer concept toolkit: PIL-only float painting (numpy is not installed), after scratchpad/eyes/gen_eyes.py.

Hero canvas is 1024x512; the game sprite is the same picture BOX-reduced x8 to 128x64, then hard-alpha'd, palette-
limited and outlined. Gameplay anchors (src/enemies/mid/ufo.ts, entity-relative px) map to hero px via gx()/gy():
entity centre = game (64, 24) = hero (512, 192).
"""
import math, os, random
from PIL import Image, ImageMath, ImageDraw, ImageChops, ImageFilter

W, H = 1024, 512
SCALE = 8
GW, GH = W // SCALE, H // SCALE
CX, CY = 512, 192
OUT = os.path.dirname(os.path.abspath(__file__))
BIC = Image.Resampling.BICUBIC
BOX = Image.Resampling.BOX
LAN = Image.Resampling.LANCZOS
NEAR = Image.Resampling.NEAREST

# gameplay anchors, entity-relative game px (enemies/mid/ufo.ts + render/gross/mid/ufo.ts)
A_LASH = (-34, 9)
A_TUM = [(-24, -7), (6, -10), (30, -5)]
A_HATCH = (12, 11)
A_EYE = (-0.7, 4.7)       # the r=15 eye-core
A_WINGS = [(-34, 2, 10), (32, 0, 9)]
A_DOME = (3.4, -10.4)


def gx(x): return CX + x * SCALE
def gy(y): return CY + y * SCALE
def gp(p): return (gx(p[0]), gy(p[1]))


# ---------------------------------------------------------------- float maths over PIL 'F'
class T:
    __slots__ = ('im',)

    def __init__(s, im): s.im = im

    def _op(s, o, f):
        if isinstance(o, T):
            return T(ImageMath.lambda_eval(lambda e: f(e['a'], e['b']), a=s.im, b=o.im))
        o = float(o)
        return T(ImageMath.lambda_eval(lambda e: f(e['a'], o), a=s.im))

    def __add__(s, o): return s._op(o, lambda a, b: a + b)
    __radd__ = __add__
    def __sub__(s, o): return s._op(o, lambda a, b: a - b)
    def __rsub__(s, o): return s._op(o, lambda a, b: b - a)
    def __mul__(s, o): return s._op(o, lambda a, b: a * b)
    __rmul__ = __mul__
    def __truediv__(s, o): return s._op(o, lambda a, b: a / b)
    def __neg__(s): return s * -1.0
    def __pow__(s, p): return s._op(p, lambda a, b: a ** b)
    def __abs__(s): return T(ImageMath.lambda_eval(lambda e: abs(e['a']), a=s.im))


def _mm(a, b, op):
    if isinstance(b, T):
        return T(ImageMath.lambda_eval(lambda e: e[op](e['a'], e['b']), a=a.im, b=b.im))
    b = float(b)
    return T(ImageMath.lambda_eval(lambda e: e[op](e['a'], b), a=a.im))


def mx(a, b): return _mm(a, b, 'max')
def mn(a, b): return _mm(a, b, 'min')
def cl(a, lo=0.0, hi=1.0): return mn(mx(a, lo), hi)


def ss(e0, e1, x):
    t = cl((x - e0) * (1.0 / (e1 - e0)))
    return t * t * (3.0 - 2.0 * t)


def mix(a, b, t): return a + (b - a) * t
def const(v, size=(W, H)): return T(Image.new('F', size, float(v)))
def fromlist(vals, size=(W, H)):
    im = Image.new('F', size); im.putdata(vals); return T(im)
def sh(a, dx, dy): return T(ImageChops.offset(a.im, dx, dy))


def blur(a, r):
    if r <= 0: return a
    im = a.im; w, h = im.size
    if r >= 3:
        k = max(2, int(r / 1.6))
        im = im.resize((max(1, w // k), max(1, h // k)), BOX).resize((w, h), BIC)
        r = 1.2
    t = T(im)
    for _ in range(max(1, round(1.5 * r * r))):
        t = (sh(t, 1, 0) + sh(t, -1, 0) + t) * (1 / 3)
        t = (sh(t, 0, 1) + sh(t, 0, -1) + t) * (1 / 3)
    return t


def grad(h): return (sh(h, -1, 0) - sh(h, 1, 0)) * 0.5, (sh(h, 0, -1) - sh(h, 0, 1)) * 0.5


def nrm(a, b, c):
    l = mx((a * a + b * b + c * c) ** 0.5, 1e-5)
    return a / l, b / l, c / l


def dot3(n, v): return n[0] * v[0] + n[1] * v[1] + n[2] * v[2]
def cmix(A, B, t): return tuple(mix(a, b, t) for a, b in zip(A, B))
def cmul(A, k): return tuple(a * k for a in A)
def cadd(A, B): return tuple(a + b for a, b in zip(A, B))


def vnoise(rng, cx, cy, size=(W, H)):
    w, h = size
    cx = max(1, int(cx)); cy = max(1, int(cy))
    g = Image.new('F', (cx + 1, cy + 1))
    g.putdata([rng.random() for _ in range((cx + 1) * (cy + 1))])
    return T(g.resize((w, h), BIC))


def fbm(rng, c, octaves=5, gain=0.5, size=(W, H), aspect=0.5):
    tot = None; amp = 1.0; norm = 0.0
    for i in range(octaves):
        cx = min(size[0], c * 2 ** i); cy = min(size[1], max(1, c * aspect * 2 ** i))
        n = vnoise(rng, cx, cy, size) * amp
        tot = n if tot is None else tot + n
        norm += amp; amp *= gain
    return tot * (1.0 / norm)


X = fromlist([float(x) for y in range(H) for x in range(W)])
Y = fromlist([float(y) for y in range(H) for x in range(W)])


def _n3(v):
    l = math.sqrt(sum(c * c for c in v)); return tuple(c / l for c in v)


L = _n3((-0.52, -0.62, 0.6))
HV = _n3((L[0], L[1], L[2] + 1))
RIM = _n3((0.75, 0.45, 0.25))   # a cold back/under light so the silhouette separates from deep space


def ellipse_soft(x0, y0, rx, ry, p=1.0):
    q = ((X - x0) * (1.0 / rx)) ** 2.0 + ((Y - y0) * (1.0 / ry)) ** 2.0
    return mx(1.0 - q, 0.0) ** p


def ell_q(x0, y0, rx, ry): return ((X - x0) * (1.0 / rx)) ** 2.0 + ((Y - y0) * (1.0 / ry)) ** 2.0


def ell_mask(x0, y0, rx, ry, aa=1.5):
    """antialiased hard ellipse"""
    q = ell_q(x0, y0, rx, ry) ** 0.5
    return cl((1.0 - q) * (min(rx, ry) / aa) + 0.5)


def ell_normal(x0, y0, rx, ry, flat=1.0):
    nx = (X - x0) * (1.0 / rx); ny = (Y - y0) * (1.0 / ry)
    nz = mx(1.0 - nx * nx - ny * ny, 0.0) ** 0.5 * flat
    # normalised and clamped: outside the ellipse nx/ny grow without bound, and a spec power of that overflows to inf
    return nrm(cl(nx, -1.0, 1.0), cl(ny, -1.0, 1.0), nz)


def draw_L(fn, sc=2, bg=0):
    """ImageDraw at sc x supersampling into an 'L' image; returns 0..1 T"""
    im = Image.new('L', (W * sc, H * sc), bg)
    fn(ImageDraw.Draw(im), sc)
    return T(im.resize((W, H), LAN).convert('F')) * (1 / 255)


def draw_mask(fn, sc=2): return draw_L(fn, sc)


# ---------------------------------------------------------------- paths
def chaikin(pts, it=3):
    for _ in range(it):
        out = [pts[0]]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            out += [(x0 * .75 + x1 * .25, y0 * .75 + y1 * .25), (x0 * .25 + x1 * .75, y0 * .25 + y1 * .75)]
        out.append(pts[-1]); pts = out
    return pts


def curl_path(x0, y0, a0, length, curv, n=60, curl_end=0.0, wob=0.0, ph=0.0, grav=0.0):
    """integrate a path: heading a0, curvature curv (+ an end curl growing toward the tip) and a slight wobble"""
    pts = [(x0, y0)]; a = a0; st = length / n; x, y = x0, y0
    for i in range(n):
        f = i / n
        a += curv * st + curl_end * st * f ** 3 + wob * math.sin(ph + f * 9) * st
        a += ((math.pi / 2 - a + math.pi) % (2 * math.pi) - math.pi) * grav * f   # weight: it hangs
        x += math.cos(a) * st; y += math.sin(a) * st
        pts.append((x, y))
    return pts


def normals(pts):
    out = []
    for i in range(len(pts)):
        a = pts[max(0, i - 1)]; b = pts[min(len(pts) - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]; d = math.hypot(dx, dy) or 1
        out.append((-dy / d, dx / d))
    return out


# ---------------------------------------------------------------- tubes (tentacles, arms, strands)
def tubes(specs, sc=2, steps=7, outline=3.0):
    """Draw tapered round tubes. Each spec: dict(pts, w0, w1, suck=side(+1/-1/0), sr=sucker radius factor,
    hooks=bool, every=px between suckers, taper=exp). Later specs overlap earlier ones (an outline separates them).
    Returns dict(mask, h (0..1 round profile), suck (sucker rim), cup (sucker cup), hook) as T."""
    S = (W * sc, H * sc)
    mk = Image.new('L', S, 0); hh = Image.new('L', S, 0)
    sk = Image.new('L', S, 0); cu = Image.new('L', S, 0); hk = Image.new('L', S, 0); wr = Image.new('L', S, 0)
    dm, dh, ds, dc, dk = (ImageDraw.Draw(i) for i in (mk, hh, sk, cu, hk)); dw = ImageDraw.Draw(wr)
    for spc in specs:
        pts = spc['pts']; n = len(pts); w0 = spc['w0']; w1 = spc.get('w1', 1.0); tp = spc.get('taper', 1.0)
        ws = [w1 + (w0 - w1) * (1 - i / (n - 1)) ** tp for i in range(n)]
        P = [(x * sc, y * sc) for x, y in pts]
        def stroke(d, wf, add, val):
            for i in range(n - 1):
                w = max(1, ws[i] * wf * sc + add * sc)
                d.line([P[i], P[i + 1]], fill=val, width=int(w + .5))
                r = w / 2
                d.ellipse([P[i + 1][0] - r, P[i + 1][1] - r, P[i + 1][0] + r, P[i + 1][1] + r], fill=val)
        # outline: knock out what's under, so overlapping tubes read as separate
        stroke(dh, 1.0, outline, 0); stroke(ds, 1.0, outline, 0); stroke(dc, 1.0, outline, 0); stroke(dk, 1.0, outline, 0)
        stroke(dm, 1.0, outline, 255)
        dw_ = None
        if spc.get('wrinkle', 1):
            # knock out old wrinkles under this tube, then ring creases across it, denser toward the root
            stroke(dw, 1.0, outline, 0)
            nm = normals(pts); acc = 0.0
            for i in range(1, n - 1):
                acc += math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
                if acc < max(4.0, ws[i] * 0.28): continue
                acc = 0; hw = ws[i] * 0.5 * 0.92; j = (i * 7919) % 5 / 5 - 0.4
                dw.line([((pts[i][0] - nm[i][0] * hw) * sc, (pts[i][1] - nm[i][1] * hw) * sc),
                         ((pts[i][0] + nm[i][0] * hw * (0.6 + j)) * sc, (pts[i][1] + nm[i][1] * hw * (0.6 + j)) * sc)],
                        fill=200, width=max(1, int(sc * max(1.0, ws[i] * 0.07))))
        for k in range(steps):
            f = 1 - k / steps
            stroke(dh, f, 0, int(255 * math.sqrt(max(0.0, 1 - f * f)) * 0.92 + 20))
        side = spc.get('suck', 0)
        if side:
            nm = normals(pts); acc = 0.0; every = spc.get('every', 14)
            for i in range(1, n - 1):
                acc += math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
                if acc < every * max(.45, ws[i] / w0): continue
                acc = 0
                r = ws[i] * spc.get('sr', .3)
                if r < 1.2: continue
                ox = pts[i][0] + nm[i][0] * side * ws[i] * spc.get('so', .3)
                oy = pts[i][1] + nm[i][1] * side * ws[i] * spc.get('so', .3)
                X0, Y0, R0 = ox * sc, oy * sc, r * sc
                ds.ellipse([X0 - R0, Y0 - R0, X0 + R0, Y0 + R0], fill=255)
                dh.ellipse([X0 - R0, Y0 - R0, X0 + R0, Y0 + R0], fill=255)
                ri = R0 * .58
                dc.ellipse([X0 - ri, Y0 - ri, X0 + ri, Y0 + ri], fill=255)
                dh.ellipse([X0 - ri, Y0 - ri, X0 + ri, Y0 + ri], fill=150)
                if spc.get('hooks') and r > 2.5:
                    a = math.atan2(nm[i][1] * side, nm[i][0] * side)
                    hp = [(X0 + math.cos(a + t) * ri * (1.4 - t * .3), Y0 + math.sin(a + t) * ri * (1.4 - t * .3)) for t in (-.9, -.3, .3, .9, 1.4)]
                    dk.line(hp, fill=255, width=max(1, int(R0 * .35)))
    cv = lambda im: T(im.resize((W, H), LAN).convert('F')) * (1 / 255)
    return dict(mask=cv(mk), h=cv(hh), suck=cv(sk), cup=cv(cu), hook=cv(hk), wr=cv(wr))


# ---------------------------------------------------------------- lighting
def light(n, base, amb=0.07, key=1.0, wrap=0.3, spec=0.3, shin=40.0, glint=0.0, glint_n=None, wet=1.0,
          rim=0.0, rim_col=(0.25, 0.35, 0.5), spec_col=(1.0, 0.95, 0.9)):
    d = dot3(n, L)
    diff = cl((d + wrap) * (1 / (1 + wrap)))
    col = cmul(base, amb + diff * key)
    hd = cl(dot3(n, HV))
    s = hd ** shin * spec
    if glint and glint_n is not None:
        s = s + cl(dot3(glint_n, HV)) ** 400.0 * glint
    if not isinstance(wet, float) or wet != 1.0: s = s * wet
    col = cadd(col, cmul(spec_col, s))
    if rim:
        r = cl(dot3(n, RIM)) ** 3.0 * rim
        col = cadd(col, cmul(rim_col, r))
    return col


def bump_n(n, h, k):
    dx, dy = grad(h)
    return nrm(n[0] - dx * k, n[1] - dy * k, n[2])


def glint_normals(rng, n, c=90, k=30.0):
    hg = fbm(rng, c, 3)
    gx_, gy_ = grad(hg)
    return nrm(n[0] - gx_ * k, n[1] - gy_ * k, n[2])


def flat_n(): return (const(0), const(0), const(1))


def palette_ramp(t, stops):
    """t 0..1 through a list of (pos, rgb) stops"""
    col = stops[0][1]
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        col = cmix(col, c1, ss(p0, p1, t)) if p1 > p0 else col
    return col


def dots(rng, n, region, rmin, rmax, sc=2, val=(160, 255), cluster=None):
    """random dots (chromatophores, pores) inside region(x,y)->bool; returns T"""
    def fn(d, s):
        k = 0; tries = 0
        while k < n and tries < n * 30:
            tries += 1
            x = rng.uniform(0, W); y = rng.uniform(0, H)
            if not region(x, y): continue
            r = rng.uniform(rmin, rmax) ** 1 * s
            v = rng.randint(*val)
            d.ellipse([x * s - r, y * s - r, x * s + r, y * s + r], fill=v)
            k += 1
    return draw_L(fn, sc)


def walk_lines(rng, starts, inside, steps=160, st=3.0, jitter=0.28, branch=0.05, w0=(1.0, 2.5), decay=0.985, sc=2, seek=None):
    """random-walk vessel / crack network. starts: [(x,y,a)]; inside(x,y)->bool"""
    def fn(d, s):
        def walk(x, y, a, w, depth, v):
            for _ in range(steps):
                a += rng.gauss(0, jitter)
                if seek:
                    ta = math.atan2(seek[1] - y, seek[0] - x)
                    a += ((ta - a + math.pi) % (2 * math.pi) - math.pi) * 0.05
                x2 = x + math.cos(a) * st; y2 = y + math.sin(a) * st
                if not inside(x2, y2): break
                ww = w * s
                d.line([(x * s, y * s), (x2 * s, y2 * s)], fill=v, width=max(1, int(ww + .5)))
                if ww > 2.5:
                    r = ww / 2; d.ellipse([x2 * s - r, y2 * s - r, x2 * s + r, y2 * s + r], fill=v)
                x, y = x2, y2; w *= decay
                if w < 0.35: break
                if rng.random() < branch and depth < 4:
                    walk(x, y, a + rng.choice((-1, 1)) * rng.uniform(.5, 1.1), w * .7, depth + 1, int(v * .9))
        for (x, y, a) in starts:
            walk(x, y, a, rng.uniform(*w0), 0, rng.randint(170, 255))
    return draw_L(fn, sc)


# ---------------------------------------------------------------- canvas
def new_canvas(): return [const(0), const(0), const(0), const(0)]


def over(cv, rgb, a):
    for i in range(3): cv[i] = cl(rgb[i] if isinstance(rgb[i], T) else const(rgb[i]), 0.0, 4.0) * a + cv[i] * (1 - a)
    cv[3] = a + cv[3] * (1 - a)


def to_image(cv):
    a = cl(cv[3])
    ch = [(cl(cv[i] / mx(a, 1e-4) * a / mx(a, 1e-4)) * 255.0).im.convert('L') for i in range(3)] + [(a * 255.0).im.convert('L')]
    return Image.merge('RGBA', ch)


def to_image_straight(cv):
    """cv colour channels here are straight (not premultiplied): over() keeps them premultiplied-by-coverage, so
    divide back by alpha for export."""
    a = cl(cv[3])
    ch = [(cl(cv[i] / mx(a, 1e-4)) * 255.0).im.convert('L') for i in range(3)] + [(a * 255.0).im.convert('L')]
    return Image.merge('RGBA', ch)
