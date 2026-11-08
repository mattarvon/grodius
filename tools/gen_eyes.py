#!/usr/bin/env python3
"""Grodius eyeballs: procedural, offline, PIL-only (numpy/scipy are not installed
on this machine, so all float maths runs through PIL ImageMath on 'F' images; the
only per-pixel Python is the iris polar lookup). Original art, no source images.

Seeded and deterministic: every concept owns a random.Random(seed).

Usage:
  python3 -I tools/gen_eyes.py concept [--out DIR] [name ...]
      1024 px concept PNGs + sheet. DIR defaults to .scratch/eyes (git-ignored).
  python3 -I tools/gen_eyes.py bake [rot] [kit]     (no args = both)
      rot: src/sprites/rot_{ball,lens,shade,spec}.png and rot_layout.json.
      kit: src/sprites/kit/eye_{cluster,flyer,rotted,burst,wrong}.png (a subfolder: the boot glob skips it until one is used).
"""
import json, math, os, random, sys, time
from PIL import Image, ImageMath, ImageDraw, ImageChops, ImageFont, features

S = 1024
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '.scratch', 'eyes')   # concept PNGs; never src/
SPRITES = os.path.join(ROOT, 'src', 'sprites')
LAYOUT_JSON = os.path.join(ROOT, 'src', 'sprites', 'rot_layout.json')
BIC = Image.Resampling.BICUBIC
BOX = Image.Resampling.BOX
LAN = Image.Resampling.LANCZOS


# ---------------------------------------------------------------- float maths
class T:
    """Thin operator wrapper over a PIL 'F' image."""
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
def const(v, size=(S, S)): return T(Image.new('F', size, float(v)))
def fromlist(vals, size=(S, S)):
    im = Image.new('F', size); im.putdata(vals); return T(im)
def flat(t):
    im = t.im
    return list(im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata())


def sh(a, dx, dy): return T(ImageChops.offset(a.im, dx, dy))


def blur(a, r):
    """Approximate gaussian: box-downsample + bicubic-up for big radii, iterated 3-tap box for small."""
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


# colour triples (each element a T or float)
def cmix(A, B, t): return tuple(mix(a, b, t) for a, b in zip(A, B))
def cmul(A, k): return tuple(a * k for a in A)
def cadd(A, B): return tuple(a + b for a, b in zip(A, B))


# ---------------------------------------------------------------- noise
def vnoise(rng, cx, cy, size=(S, S), wrapx=False):
    w, h = size
    cx = max(1, int(cx)); cy = max(1, int(cy))
    if wrapx:
        pad = 3; gw = cx + 2 * pad
        vals = [rng.random() for _ in range(cx * (cy + 1))]
        g = Image.new('F', (gw, cy + 1))
        g.putdata([vals[(j % cx) + i * cx] for i in range(cy + 1) for j in range(-pad, cx + pad)])
        W = round(w * gw / cx); x0 = round(w * pad / cx)
        return T(g.resize((W, h), BIC).crop((x0, 0, x0 + w, h)))
    g = Image.new('F', (cx + 1, cy + 1))
    g.putdata([rng.random() for _ in range((cx + 1) * (cy + 1))])
    return T(g.resize((w, h), BIC))


def fbm(rng, c, octaves=5, gain=0.5, size=(S, S), aspect=1.0, wrapx=False):
    tot = None; amp = 1.0; norm = 0.0
    for i in range(octaves):
        cx = min(size[0], c * 2 ** i); cy = min(size[1], max(1, c * aspect * 2 ** i))
        n = vnoise(rng, cx, cy, size, wrapx) * amp
        tot = n if tot is None else tot + n
        norm += amp; amp *= gain
    return tot * (1.0 / norm)


_XL = [float(x) for y in range(S) for x in range(S)]
_YL = [float(y) for y in range(S) for x in range(S)]
X = fromlist(_XL); Y = fromlist(_YL)
L = (-0.52, -0.6, 0.6); _l = math.sqrt(sum(c * c for c in L)); L = tuple(c / _l for c in L)
H = (L[0], L[1], L[2] + 1); _h = math.sqrt(sum(c * c for c in H)); H = tuple(c / _h for c in H)


def ellipse_soft(x0, y0, rx, ry, p=1.0):
    q = ((X - x0) * (1.0 / rx)) ** 2.0 + ((Y - y0) * (1.0 / ry)) ** 2.0
    return mx(1.0 - q, 0.0) ** p


def draw_mask(fn, sc=2):
    """Draw with ImageDraw at sc x supersampling; return antialiased 0..1 T."""
    im = Image.new('L', (S * sc, S * sc), 0)
    fn(ImageDraw.Draw(im), sc)
    return T(im.resize((S, S), LAN).convert('F')) * (1 / 255)


def tube(d, sc, pts, widths, fill=255):
    for i in range(len(pts) - 1):
        (x1, y1), (x2, y2) = pts[i], pts[i + 1]
        w = widths[i] * sc
        d.line([(x1 * sc, y1 * sc), (x2 * sc, y2 * sc)], fill=fill, width=max(1, int(w + .5)))
        r = w / 2
        if r > 1: d.ellipse([x2 * sc - r, y2 * sc - r, x2 * sc + r, y2 * sc + r], fill=fill)


def bez(p0, p1, p2, p3, n):
    out = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        out.append((u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
                    u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]))
    return out


# ---------------------------------------------------------------- capillaries
def veins(rng, cx, cy, R, icx, icy, iR, n, w0=(1.0, 2.2), branch=0.06, jitter=0.3,
          fade=True, steps=220, seek=0.06, start_r=0.985, fill=(160, 255)):
    """Random-walk vessels from the rim inward, tortuous, forking, thinning (and fading) toward the iris."""
    def fn(d, sc):
        def walk(x, y, a, w, wst, f, depth):
            for _ in range(steps):
                a += rng.gauss(0, jitter)
                ta = math.atan2(icy - y, icx - x)
                a += ((ta - a + math.pi) % (2 * math.pi) - math.pi) * seek
                st = max(1.5, R * 0.012)
                x2 = x + math.cos(a) * st; y2 = y + math.sin(a) * st
                if math.hypot(x2 - cx, y2 - cy) > R * 0.99: break
                if math.hypot(x2 - icx, y2 - icy) < iR: break
                ff = f
                if fade:
                    dr = math.hypot(x2 - icx, y2 - icy)
                    ff = f * min(1.0, max(0.0, (dr - iR) / (R * 0.35)))
                if ff < 8: break
                ww = w * sc
                d.line([(x * sc, y * sc), (x2 * sc, y2 * sc)], fill=int(ff), width=max(1, int(ww + .5)))
                if ww > 2.5:
                    r = ww / 2; d.ellipse([x2 * sc - r, y2 * sc - r, x2 * sc + r, y2 * sc + r], fill=int(ff))
                x, y = x2, y2
                w *= 0.988
                if w < 0.35: break
                if rng.random() < branch and depth < 5:
                    walk(x, y, a + rng.choice((-1, 1)) * rng.uniform(0.5, 1.1), w * 0.72, wst, f * 0.92, depth + 1)
        for _ in range(n):
            ang = rng.uniform(0, 2 * math.pi); r0 = R * rng.uniform(start_r - 0.05, start_r)
            x = cx + math.cos(ang) * r0; y = cy + math.sin(ang) * r0
            walk(x, y, ang + math.pi + rng.gauss(0, 0.35), rng.uniform(*w0), 0, rng.uniform(*fill), 0)
    return draw_mask(fn)


# ---------------------------------------------------------------- iris
A_N, R_N, RMAX = 1024, 192, 1.12


def iris_tex(rng, P):
    sz = (A_N, R_N)
    rr = fromlist([r / R_N * RMAX for r in range(R_N) for _ in range(A_N)], sz)
    fib = fbm(rng, 128, 3, 0.65, sz, aspect=3 / 128, wrapx=True)
    fib2 = fbm(rng, 32, 3, 0.5, sz, aspect=4 / 32, wrapx=True)
    fine = fbm(rng, 256, 2, 0.6, sz, aspect=12 / 256, wrapx=True)
    val = ss(0.3, 0.72, fib * 0.5 + fib2 * 0.3 + fine * 0.2)
    crypt = fbm(rng, 64, 3, 0.5, sz, aspect=6 / 64, wrapx=True)
    cw = ss(0.25, 0.4, rr) * (1 - ss(0.75, 0.95, rr))
    crypts = ss(P.get('crypt_t', 0.6), P.get('crypt_t', 0.6) + 0.1, crypt) * cw
    cr = P.get('coll', 0.55) + (vnoise(rng, 16, 1, sz, True) - 0.5) * 0.14 + (fib2 - 0.5) * 0.3 + (fib - 0.5) * 0.2
    inner = 1 - ss(-0.06, 0.06, rr - cr)
    ridge = 1 - ss(0.0, 0.045, abs(rr - cr))
    furrow = ss(0.6, 0.85, fbm(rng, 4, 3, 0.5, sz, aspect=12, wrapx=True)) * ss(0.65, 0.8, rr)
    oc = cmix(P['out_dk'], P['out_lt'], val)
    ic = cmix(P['in_dk'], P['in_lt'], val)
    col = cmix(oc, ic, inner)
    col = cadd(col, cmul(P['in_lt'], ridge * P.get('ridge', 0.25)))
    col = cmul(col, 1 - crypts * P.get('crypt_k', 0.75))
    col = cmul(col, 1 - furrow * 0.35)
    lim = ss(P.get('limb0', 0.8), 1.0, rr) * P.get('limbal', 0.85)
    col = cmix(col, P.get('limb_col', (0.03, 0.035, 0.03)), lim)
    return [flat(c) for c in col]


def paint_iris(rng, U, V, DG, bbox, R, sa, P):
    """Gather polar iris texture onto the sphere; returns (r,g,b,iris_mask,pupil_mask) lists."""
    TR, TG, TB = iris_tex(rng, P)
    prl = flat(vnoise(rng, 16, 1, (A_N, 1), True))
    pr0 = P.get('pupil', 0.36)
    pfn = P.get('pupil_fn')
    N = S * S
    oR = [0.0] * N; oG = [0.0] * N; oB = [0.0] * N; oM = [0.0] * N; oP = [0.0] * N
    if P.get('no_iris'):   # bake: the texture's rng draws above still happened; nothing is painted
        return oR, oG, oB, oM, oP
    aa = max(1.6 / (R * sa), P.get('iris_soft', 0.0))
    pa = max(1.6 / (R * sa), P.get('pupil_soft', 0.0))
    k2 = A_N / (2 * math.pi); kr = R_N / RMAX
    ruff = P.get('ruff', (0.12, 0.07, 0.03))
    x0, y0, x1, y1 = bbox
    sqrt, atan2 = math.sqrt, math.atan2
    for y in range(y0, y1):
        base = y * S
        for x in range(x0, x1):
            i = base + x
            if DG[i] <= 0: continue
            u = U[i]; v = V[i]; rho = sqrt(u * u + v * v)
            if rho > 1.0 + aa: continue
            ai = int((atan2(v, u) + math.pi) * k2) % A_N
            ri = min(R_N - 1, int(rho * kr))
            k = ri * A_N + ai
            m = (1.0 + aa * 0.5 - rho) / aa
            oM[i] = 0.0 if m < 0 else (1.0 if m > 1 else m)
            if pfn: dp = pfn(u, v, rho)
            else: dp = rho - pr0 * (1 + 0.05 * (prl[ai] - 0.5))
            p = 0.5 - dp / pa
            oP[i] = 0.0 if p < 0 else (1.0 if p > 1 else p)
            r_, g_, b_ = TR[k], TG[k], TB[k]
            if 0 < dp < 0.05:  # pupillary ruff
                f = 1 - dp / 0.05
                r_ += (ruff[0] - r_) * f * 0.8; g_ += (ruff[1] - g_) * f * 0.8; b_ += (ruff[2] - b_) * f * 0.8
            oR[i] = r_; oG[i] = g_; oB[i] = b_
    return oR, oG, oB, oM, oP


# ---------------------------------------------------------------- eyeball
def norm3(v):
    l = math.sqrt(sum(c * c for c in v)); return tuple(c / l for c in v)


def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def eyeball(rng, cx, cy, R, P):
    sa = P.get('iris', 0.47)
    nx = (X - cx) * (1.0 / R); ny = (Y - cy) * (1.0 / R)
    r2 = nx * nx + ny * ny
    if 'outline' in P: r2 = r2 * P['outline']
    rr = r2 ** 0.5
    alpha = cl((1.0 - rr) * R + 0.5)
    nz = mx(1.0 - r2, 0.0) ** 0.5
    g = norm3(P.get('gaze', (0, 0, 1)))
    e1 = norm3(cross((0, 1, 0), g)); e2 = cross(g, e1)
    dg = nx * g[0] + ny * g[1] + nz * g[2]
    u = (nx * e1[0] + ny * e1[1] + nz * e1[2]) * (1 / sa)
    v = (nx * e2[0] + ny * e2[1] + nz * e2[2]) * (1 / sa)
    bbox = (max(0, int(cx - R - 2)), max(0, int(cy - R - 2)), min(S, int(cx + R + 2)), min(S, int(cy + R + 2)))
    lists = paint_iris(rng, flat(u), flat(v), flat(dg), bbox, R, sa, P)
    IR, IG, IB, IM, IP = [fromlist(l) for l in lists]
    rho = (u * u + v * v) ** 0.5
    front = ss(0.0, 0.15, dg)
    ctx = dict(nx=nx, ny=ny, nz=nz, rr=rr, u=u, v=v, dg=dg, rho=rho, im=IM, pup=IP, front=front, R=R, cx=cx, cy=cy)

    # sclera: centre colour warming to an inflamed rim, mottled, capillaries
    mott = fbm(rng, 5, 5)
    rimt = ss(P.get('rim0', 0.25), 1.0, rr) ** P.get('rimp', 1.2)
    scl = cmix(P['scl'], P['rim'], cl(rimt + (mott - 0.5) * 0.5))
    blot = ss(0.55, 0.85, fbm(rng, 9, 4)) * rimt
    scl = cmix(scl, P['rim'], blot * P.get('blot', 0.5))
    scl = cmul(scl, 0.92 + (fbm(rng, 40, 3) - 0.5) * 0.12)
    icx = cx + g[0] / max(1e-3, math.hypot(g[0], g[1], g[2])) * R
    icy = cy + g[1] * R
    # bake: the vessels' stop tests change how many rng draws they take, so the ball run (which shrinks the iris to
    # nothing) pins this or every noise field after them would differ from the art
    vein_ir = P.get('vein_iR', R * sa * 1.05)
    vm = None
    for vs in P.get('veins', []):
        m = veins(rng, cx, cy, R, icx, icy, vein_ir, **vs['args'])
        halo = blur(m, vs.get('halo_r', 5))
        scl = cmix(scl, vs.get('halo_col', P['rim']), cl(halo * vs.get('halo', 0.5)))
        scl = cmix(scl, vs['col'], cl(m * vs.get('k', 1.0)))
        vm = m if vm is None else mx(vm, m)
    ctx['veins'] = vm if vm is not None else const(0)
    if 'sclera_fn' in P: scl = P['sclera_fn'](rng, ctx, scl)
    lim = (1 - ss(1.0, 1.0 + P.get('limb_w', 0.12), rho)) * front
    scl = cmul(scl, 1 - lim * P.get('limb_k', 0.5))
    if P.get('black_scl'): scl = cmul(scl, 0.0)   # bake: lens run, only what lies over the ball counts, premultiplied

    C = cmix(scl, (IR, IG, IB), IM)
    C = cmix(C, P.get('pupil_col', (0.008, 0.006, 0.006)), IP)
    if 'albedo_fn' in P: C = P['albedo_fn'](rng, ctx, C)

    # normals: sphere + sclera bump (cornea kept smooth) + optional extra height
    hb = fbm(rng, P.get('bumpc', 18), 4) * (1 - IM * 0.9) * P.get('bump', 1.0)
    if 'height_fn' in P: hb = hb + P['height_fn'](rng, ctx)
    dx, dy = grad(hb)
    kb = P.get('kb', 6.0)
    n = nrm(nx - dx * kb, ny - dy * kb, nz * P.get('flat', 1.0))
    d = dot3(n, L)
    wrap = P.get('wrap', 0.3)
    diff = cl((d + wrap) * (1 / (1 + wrap)))
    shade = P.get('amb', 0.06) + diff * P.get('key', 1.05)
    edge = P.get('edge_dark', 0.0)
    if edge: shade = shade * (1 - edge * ss(0.55, 1.0, rr))
    col = cmul(C, shade)
    srim = ss(0.4, 1.0, rr)
    term = ss(-0.35, 0.1, d) * (1 - ss(0.1, 0.55, d))
    sk = cl(srim * 0.55 + term * 0.45) * P.get('sssk', 0.5)
    col = cadd(col, cmul(P.get('sss', (0.55, 0.04, 0.03)), sk * (0.4 + 0.6 * diff)))
    col_nospec = col

    wet = P.get('wet', 1.0)
    if callable(wet): wet = wet(rng, ctx)
    hdot = mx(dot3(n, H), 0.0)
    spec = hdot ** P.get('shin', 60.0) * P.get('spec', 0.3)
    if P.get('glint', 0.0):
        hg = fbm(rng, 70, 3)
        gx, gy = grad(hg)
        kg = P.get('kg', 30.0)
        n2 = nrm(n[0] - gx * kg, n[1] - gy * kg, n[2])
        spec = spec + mx(dot3(n2, H), 0.0) ** 700.0 * P['glint']
    if P.get('win', 0.0):
        Rx = 2.0 * n[2] * n[0]; Ry = 2.0 * n[2] * n[1]
        q = ((abs(Rx - L[0]) * (1 / P.get('win_w', 0.15))) ** 4.0 + (abs(Ry - L[1]) * (1 / P.get('win_h', 0.1))) ** 4.0) ** 0.25
        spec = spec + (1 - ss(0.7, 1.0, q)) * P['win']
    if 'spec_fn' in P: spec = spec + P['spec_fn'](rng, ctx, n)
    spec = spec * wet
    sc = P.get('spec_col', (1.0, 0.95, 0.9))
    col = cadd(col, cmul(sc, spec))
    rl = ss(0.6, 1.0, rr) * cl(nx * 0.55 + ny * 0.8) * P.get('rimlight', 0.25)
    rl_col = cmul((0.55, 0.07, 0.05), rl)
    col = cadd(col, rl_col)
    if 'post_fn' in P: col, alpha = P['post_fn'](rng, ctx, col, alpha)
    out = dict(rgb=cmul(col, alpha), a=alpha, ctx=ctx)
    if P.get('layers'):   # bake: the pieces, before they are flattened
        n0 = nrm(nx, ny, nz * P.get('flat', 1.0))
        M = P.get('amb', 0.06) + cl((dot3(n0, L) + wrap) * (1 / (1 + wrap))) * P.get('key', 1.05)
        if edge: M = M * (1 - edge * ss(0.55, 1.0, rr))
        spec0 = mx(dot3(n0, H), 0.0) ** P.get('shin', 60.0) * P.get('spec', 0.3) * wet   # the same sheen, unbumped
        out.update(nospec=cadd(col_nospec, rl_col), spec=spec, spec0=spec0, spec_col=sc, M=M, im=IM, rr=rr,
                   ring=lim * P.get('limb_k', 0.5))
    return out


# ---------------------------------------------------------------- flesh / wet strands
PAL_MEAT = [(0.14, 0.012, 0.018), (0.46, 0.05, 0.06), (0.66, 0.15, 0.13), (0.72, 0.6, 0.52)]
PAL_BLOOD = [(0.12, 0.0, 0.006), (0.34, 0.01, 0.02), (0.55, 0.04, 0.04), (0.55, 0.04, 0.04)]
PAL_NERVE = [(0.3, 0.08, 0.08), (0.62, 0.36, 0.34), (0.76, 0.52, 0.48), (0.82, 0.7, 0.62)]


def flesh(rng, mask, P):
    h = blur(mask, P.get('round', 14)) + blur(mask, 2) * 0.25
    h = h + (fbm(rng, P.get('lumpc', 8), 5) - 0.5) * P.get('lumpy', 0.4) * mask
    if 'h' in P: h = h + P['h']
    dx, dy = grad(h)
    k = P.get('k', 30.0)
    n = nrm(-dx * k, -dy * k, const(1.0))
    pal = P.get('pal', PAL_MEAT)
    t1 = fbm(rng, P.get('palc', 5), 4)
    base = cmix(pal[0], pal[1], ss(0.25, 0.55, t1))
    base = cmix(base, pal[2], ss(0.55, 0.8, t1))
    fas = ss(0.6, 0.72, fbm(rng, 3, 4)) * P.get('fascia', 0.4)
    base = cmix(base, pal[3], fas)
    if 'fib' in P: base = cmul(base, 0.55 + 0.6 * P['fib'])
    if 'col_fn' in P: base = P['col_fn'](rng, h, base)
    cav = cl((h - blur(h, 8)) * P.get('cav', 6.0) + 0.5)
    d = dot3(n, L)
    diff = cl((d + 0.25) * (1 / 1.25))
    col = cmul(base, (0.05 + diff * 1.05) * (0.35 + 0.9 * cav))
    edge = (1 - ss(0.0, 0.5, blur(mask, 4))) * mask
    col = cadd(col, cmul((0.45, 0.02, 0.02), edge * 0.5))
    hg = fbm(rng, 60, 3); gx, gy = grad(hg)
    n2 = nrm(n[0] - gx * 25.0, n[1] - gy * 25.0, n[2])
    hd = mx(dot3(n2, H), 0.0)
    spec = (hd ** P.get('shin', 50.0) * P.get('spec', 0.5) + hd ** 500.0 * P.get('glint', 0.8)) * P.get('wet', 1.0)
    col = cadd(col, cmul((1.0, 0.92, 0.88), spec))
    a = mask * P.get('alpha', 1.0)
    return dict(rgb=cmul(col, a), a=a, h=h)


def strands(rng, specs, sc=2):
    """specs: list of (points, widths). Returns mask."""
    def fn(d, s):
        for pts, ws in specs: tube(d, s, pts, ws)
    return draw_mask(fn, sc)


def drip_path(rng, x, y, length, w):
    pts, ws = [], []
    n = 24
    for i in range(n + 1):
        t = i / n
        pts.append((x + math.sin(t * 3 + rng.random()) * 3 * t, y + t * length))
        ws.append(w * (1 - 0.4 * math.sin(t * math.pi) ** 0.7))
    ws[-1] = w * 1.9; ws[-2] = w * 1.5   # bead at the end
    return pts, ws


# ---------------------------------------------------------------- canvas
def new_canvas(): return [const(0), const(0), const(0), const(0)]


def over(cv, L_):
    a = L_['a']
    for i in range(3): cv[i] = L_['rgb'][i] + cv[i] * (1 - a)
    cv[3] = a + cv[3] * (1 - a)


def save(cv, name):
    a = mx(cv[3], 1e-4)
    ch = [(cv[i] / a * 255.0).im.convert('L') for i in range(3)] + [(cv[3] * 255.0).im.convert('L')]
    im = Image.merge('RGBA', ch)
    im.save(os.path.join(OUT, name + '.png'))
    return im


def shadow_layer(x0, y0, rx, ry, k=0.85):
    a = blur(ellipse_soft(x0, y0, rx, ry, 1.2), 14) * k
    return dict(rgb=(const(0), const(0), const(0)), a=a)


# ---------------------------------------------------------------- concepts
HERO_IRIS = dict(out_dk=(0.08, 0.14, 0.09), out_lt=(0.42, 0.55, 0.34), in_dk=(0.26, 0.17, 0.05), in_lt=(0.7, 0.5, 0.2),
                 coll=0.56, pupil=0.37, iris_soft=0.05, pupil_soft=0.035, limbal=0.9, limb0=0.78,
                 limb_col=(0.04, 0.06, 0.045), ridge=0.12, crypt_k=0.6, crypt_t=0.66, ruff=(0.1, 0.06, 0.02))
HERO_VEINS = [
    dict(args=dict(n=55, w0=(1.0, 2.2), branch=0.08, jitter=0.32, fill=(150, 255)), col=(0.55, 0.06, 0.07), k=0.95,
         halo=0.45, halo_r=6),
    dict(args=dict(n=120, w0=(0.45, 0.9), branch=0.05, jitter=0.42, steps=70, start_r=0.97, fill=(90, 200)), col=(0.66, 0.12, 0.12),
         k=0.8, halo=0.3, halo_r=3),
]


def hero_params(**over_):
    P = dict(HERO_IRIS)
    P.update(scl=(0.94, 0.86, 0.84), rim=(0.72, 0.28, 0.28), rim0=0.6, rimp=1.8, blot=0.3,
             veins=HERO_VEINS, gaze=(0, 0, 1), iris=0.47, limb_w=0.1, limb_k=0.3,
             amb=0.22, key=0.85, wrap=0.6, edge_dark=0.45, sssk=0.55, sss=(0.5, 0.05, 0.05),
             shin=25.0, spec=0.07, win=0.0, win_w=0.3, win_h=0.22, bump=0.6, kb=4.0, rimlight=0.15)
    P.update(over_)
    return P


def c_hero():
    rng = random.Random(1001)
    cv = new_canvas()
    over(cv, eyeball(rng, 512, 512, 470, hero_params()))
    return cv


def haem_fn(x0, y0, rad, k=0.92):
    def f(rng, ctx, scl):
        dy = Y - y0
        dye = dy * 1.1 - abs(dy) * 0.35          # squashed below: blood pools low
        q = 1 - ((X - x0) ** 2.0 + dye ** 2.0) ** 0.5 * (1.0 / rad)
        q = q + (fbm(rng, 6, 5) - 0.5) * 0.6
        m = ss(-0.05, 0.3, q) * (1 - ctx['im'])
        core = cl(ss(0.2, 0.7, q) + ss(0.0, 0.6, dy * (1.0 / rad)) * m * 0.6)
        blood = cmix((0.62, 0.04, 0.04), (0.2, 0.0, 0.015), core)
        return cmix(scl, blood, m * k)
    return f


def c_hero_rot():
    rng = random.Random(1002)
    cv = new_canvas()
    P = hero_params(scl=(0.86, 0.72, 0.62), rim=(0.6, 0.15, 0.14), blot=0.8, amb=0.14, key=0.95,
                    shin=90.0, spec=0.3, glint=1.0, kg=40.0, win=0.12, win_w=0.1, win_h=0.07, bump=1.0, edge_dark=0.6,
                    veins=[dict(HERO_VEINS[0], args=dict(HERO_VEINS[0]['args'], n=110, w0=(1.0, 2.4))), HERO_VEINS[1]])
    P['sclera_fn'] = haem_fn(330, 700, 170)

    def cloud(rng, ctx, C):   # cornea clouding: milky film thickest over the pupil
        c = fbm(rng, 6, 5)
        m = cl((1 - ss(0.4, 1.05, ctx['rho'])) * ctx['front'] * (0.25 + 0.45 * c))
        return cmix(C, (0.62, 0.66, 0.6), m)
    P['albedo_fn'] = cloud
    cv_eye = eyeball(rng, 512, 500, 450, P)
    over(cv, cv_eye)
    # mucus strand draped over the lower sclera, sagging off the edge
    pts = bez((205, 640), (300, 800), (430, 900), (560, 960), 50)
    pts = [(x, y + math.sin(i * 0.5) * 2) for i, (x, y) in enumerate(pts)]
    ws = [6 + 10 * math.sin(i / 50 * math.pi) ** 2 + 3 * math.sin(i * 0.9) for i in range(51)]
    hang = drip_path(rng, 556, 955, 60, 9)
    m = strands(rng, [(pts, ws), hang])
    over(cv, flesh(rng, m, dict(pal=[(0.5, 0.48, 0.32), (0.75, 0.72, 0.52), (0.82, 0.8, 0.62), (0.8, 0.78, 0.6)],
                                round=3, lumpy=0.0, k=12.0, shin=80.0, spec=0.9, glint=1.0, alpha=0.7, fascia=0)))
    return cv


def c_flyer():
    rng = random.Random(1003)
    cv = new_canvas()
    ex, ey, R = 300, 470, 220
    # tail: nerve + muscle strips + capillary strands streaming right, curved by motion
    fibres = []

    def fib_fn(d, sc):
        for pts, ws, f in fibres: tube(d, sc, pts, ws, f)
    specs = []
    tails = [  # (start offset angle, end point, width, kind)
        ((0.15, 0.0), (980, 400), 70, 'nerve'),
        ((0.0, -0.55), (900, 250), 52, 'm'), ((0.05, 0.6), (930, 690), 56, 'm'),
        ((-0.05, -0.85), (780, 160), 40, 'm'), ((0.0, 0.85), (800, 800), 42, 'm'), ((0.1, 0.2), (1010, 560), 46, 'm'),
    ]
    nerve = []
    for (ox, oy), (tx, ty), w, kind in tails:
        sx, sy = ex + R * (0.55 + ox), ey + R * oy * 0.8
        p = bez((sx, sy), (sx + 200, sy + 60 * (1 if oy >= 0 else -1) + 40), (tx - 220, ty + 90), (tx, ty), 60)
        ws = []
        for i in range(61):
            t = i / 60
            ws.append(w * (1 - 0.45 * t) * (1 + 0.15 * math.sin(t * 17 + w)))
        if kind == 'nerve': nerve.append((p, ws))
        else: specs.append((p[:52], ws[:52]))
        # ragged fibres fray the torn end
        for j in range(10 if kind == 'm' else 16):
            off = (j / (9 if kind == 'm' else 15) - 0.5) * w * 0.8
            cut = rng.randint(44, 60)
            pts = []
            for i, (x, y) in enumerate(p[:cut]):
                t = i / 60
                pts.append((x, y + off * (1 - 0.4 * t) + math.sin(t * 9 + j) * 3 * t))
            fw = [max(1.0, w * 0.13 * (1 - i / cut * 0.6)) for i in range(len(pts))]
            f = rng.randint(140, 255)
            fibres.append((pts, fw, f))
            (nerve if kind == 'nerve' else specs).append((pts, fw))
    cone = bez((ex + R * 0.3, ey), (ex + R * 1.0, ey + 10), (ex + R * 1.4, ey + 30), (ex + R * 2.0, ey + 10), 40)
    specs.append((cone, [R * (1.45 - 1.15 * (i / 40) ** 0.8) for i in range(41)]))
    fib = draw_mask(fib_fn)
    mus = strands(rng, specs)
    over(cv, flesh(rng, mus, dict(pal=PAL_MEAT, fib=fib, round=6, k=25.0, fascia=0.35, shin=60.0, spec=0.6)))
    nm = strands(rng, nerve)
    over(cv, flesh(rng, nm, dict(pal=PAL_NERVE, fib=fib, round=10, k=22.0, fascia=0.2, shin=40.0, spec=0.4)))
    # capillary strands, dripping
    caps = []
    for i in range(14):
        sx, sy = ex + R * rng.uniform(0.3, 0.8), ey + R * rng.uniform(-0.75, 0.75)
        tx, ty = rng.uniform(700, 1010), sy + rng.uniform(-80, 140)
        p = bez((sx, sy), (sx + 150, sy + rng.uniform(-40, 40)), (tx - 150, ty + rng.uniform(20, 120)), (tx, ty), 50)
        wc = rng.uniform(2.5, 6.0)
        caps.append((p, [wc * (1 - 0.6 * k / 50) for k in range(51)]))
    for i in range(7):
        x = rng.uniform(430, 900); y = 520 + (x - 430) * 0.25 + rng.uniform(-20, 60)
        caps.append(drip_path(rng, x, y, rng.uniform(40, 160), rng.uniform(2.5, 5)))
    cm = strands(rng, caps)
    over(cv, flesh(rng, cm, dict(pal=PAL_BLOOD, round=2, k=10.0, lumpy=0.0, shin=90.0, spec=0.9, glint=1.0)))
    # blood mist
    def mist(d, sc):
        for i in range(260):
            t = rng.random() ** 0.7
            x = ex + R * 0.6 + t * 650 + rng.gauss(0, 20)
            y = ey + rng.gauss(0, 60 + 120 * t) + 60 * t
            r = rng.uniform(0.6, 3.2) * sc * (1 - 0.5 * t)
            d.ellipse([x * sc - r, y * sc - r, x * sc + r, y * sc + r], fill=int(255 * (1 - t * 0.7)))
    mm = draw_mask(mist)
    mm = mx(mm, blur(mm, 6) * 0.6)
    over(cv, dict(rgb=cmul((0.35, 0.01, 0.02), mm * 0.85), a=mm * 0.85))
    # the eye, iris at the leading (left) edge
    P = hero_params(gaze=(-0.78, 0.05, 0.62), amb=0.16, key=0.95, spec=0.15, win=0.2, glint=0.4)
    P['veins'] = [dict(HERO_VEINS[0], args=dict(HERO_VEINS[0]['args'], n=90)), HERO_VEINS[1]]
    over(cv, eyeball(rng, ex, ey, R, P))
    return cv


def c_icon():
    rng = random.Random(1007)
    cv = new_canvas()
    ex, ey, R = 512, 420, 330
    over(cv, shadow_layer(512, 925, 260, 52, 0.97))
    # raised, swollen forked veins with clotted nodes
    nodes = []
    vspecs = []
    for i in range(9):
        a = i / 9 * 2 * math.pi + rng.uniform(-0.2, 0.2)
        x = ex + math.cos(a) * R * 0.98; y = ey + math.sin(a) * R * 0.98
        ang = a + math.pi + rng.gauss(0, 0.25)
        pts = [(x, y)]
        for k in range(rng.randint(9, 14)):
            ang += rng.gauss(0, 0.35)
            x += math.cos(ang) * R * 0.025; y += math.sin(ang) * R * 0.025
            pts.append((x, y))
        nodes.append((x, y))
        vspecs.append((pts, [5.5 - 1.5 * k / len(pts) for k in range(len(pts))]))
        for sgn in (-1, 1):   # fork at the node
            bx, by, ba = x, y, ang + sgn * rng.uniform(0.6, 1.0)
            bp = [(bx, by)]
            for k in range(rng.randint(5, 9)):
                ba += rng.gauss(0, 0.3)
                bx += math.cos(ba) * R * 0.022; by += math.sin(ba) * R * 0.022
                bp.append((bx, by))
            vspecs.append((bp, [3.6 - 2.2 * k / len(bp) for k in range(len(bp))]))
    vm = strands(rng, vspecs)

    def node_fn(d, sc):
        for x, y in nodes:
            r = rng.uniform(6, 10) * sc
            d.ellipse([x * sc - r, y * sc - r, x * sc + r, y * sc + r], fill=255)
    nm = draw_mask(node_fn)
    nx0, ny0 = nodes[6]

    def scl_fn(rng, ctx, scl):
        scl = haem_fn(nx0, ny0, 60, 0.85)(rng, ctx, scl)
        scl = cmix(scl, (0.62, 0.05, 0.06), cl(vm * 1.1))
        return cmix(scl, (0.16, 0.0, 0.02), nm)

    def h_fn(rng, ctx): return blur(vm, 2) * 5.0 + blur(nm, 2) * 6.0

    def spec_dot(rng, ctx, n):   # one hard catchlight in the pupil
        q = ((X - (ex - 0.1 * R)) ** 2.0 + (Y - (ey - 0.12 * R)) ** 2.0) ** 0.5
        return (1 - ss(R * 0.022, R * 0.03, q)) * 3.0
    P = dict(out_dk=(0.12, 0.05, 0.42), out_lt=(0.38, 0.3, 0.95), in_dk=(0.16, 0.22, 0.6), in_lt=(0.45, 0.62, 1.0),
             coll=0.62, pupil=0.44, crypt_t=0.55, crypt_k=0.85, ridge=0.35, limbal=0.95, limb0=0.86,
             limb_col=(0.04, 0.02, 0.1), iris_soft=0.02, ruff=(0.05, 0.03, 0.1),
             scl=(0.9, 0.86, 0.68), rim=(0.72, 0.5, 0.36), rim0=0.5, blot=0.2, veins=[
                 dict(args=dict(n=40, w0=(0.4, 0.8), branch=0.04, steps=60, fill=(80, 170)), col=(0.6, 0.1, 0.1),
                      k=0.7, halo=0.2)],
             gaze=(0, 0.02, 1), iris=0.46, amb=0.12, key=1.0, wrap=0.35, edge_dark=0.3, sssk=0.45,
             shin=140.0, spec=0.5, glint=0.9, kg=30.0, win=0.0, bump=0.5, kb=4.0,
             sclera_fn=scl_fn, height_fn=h_fn, spec_fn=spec_dot)
    over(cv, eyeball(rng, ex, ey, R, P))
    # mucus strands hanging from the underside toward the shadow
    m = strands(rng, [drip_path(rng, 470, ey + R * 0.97, 220, 10), drip_path(rng, 565, ey + R * 0.94, 120, 7)])
    over(cv, flesh(rng, m, dict(pal=[(0.5, 0.48, 0.3), (0.74, 0.72, 0.5), (0.82, 0.8, 0.6), (0.8, 0.78, 0.6)],
                                round=3, lumpy=0.0, k=12.0, shin=90.0, spec=0.9, glint=1.0, alpha=0.75, fascia=0)))
    return cv


def c_burst():
    rng = random.Random(2001)
    cv = new_canvas()
    P = hero_params(scl=(0.8, 0.68, 0.3), rim=(0.5, 0.12, 0.07), rim0=0.55, rimp=1.5, blot=0.35,
                    out_dk=(0.06, 0.09, 0.11), out_lt=(0.32, 0.4, 0.44), in_dk=(0.2, 0.12, 0.05), in_lt=(0.45, 0.3, 0.12),
                    coll=0.45, pupil=0.33, gaze=(-0.18, 0.1, 1), amb=0.07, key=1.1, wrap=0.25, edge_dark=0.5,
                    shin=120.0, spec=0.35, glint=1.1, kg=45.0, win=0.0, bump=1.2, kb=7.0,
                    veins=[dict(args=dict(n=95, w0=(1.6, 4.2), branch=0.1, jitter=0.3, fill=(170, 255)), col=(0.4, 0.02, 0.03),
                                k=1.0, halo=0.7, halo_r=7, halo_col=(0.6, 0.12, 0.08)),
                           dict(args=dict(n=240, w0=(0.5, 1.1), branch=0.06, jitter=0.45, steps=80, fill=(110, 230)),
                                col=(0.62, 0.08, 0.07), k=0.9, halo=0.35, halo_r=3)])
    P['sclera_fn'] = haem_fn(330, 690, 175, 0.95)
    over(cv, eyeball(rng, 512, 512, 440, P))
    return cv


def _smin(a, b, k):
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


def wrong_pupil(u, v, rho):
    d1 = math.hypot(u, v + 0.21) - 0.19
    d2 = math.hypot(u * 1.15, v - 0.2) - 0.15
    d3 = max(abs(u) - (0.02 + 0.06 * max(v - 0.3, 0.0)), 0.3 - v)   # coloboma keyhole draining to the rim
    return _smin(_smin(d1, d2, 0.12), d3, 0.08)


def c_wrong():
    rng = random.Random(2005)
    cv = new_canvas()
    P = hero_params(scl=(0.62, 0.55, 0.46), rim=(0.32, 0.03, 0.03), rim0=0.35, rimp=1.0, blot=0.6,
                    out_dk=(0.2, 0.08, 0.02), out_lt=(0.72, 0.42, 0.08), in_dk=(0.25, 0.02, 0.02), in_lt=(0.62, 0.1, 0.04),
                    coll=0.5, crypt_t=0.55, crypt_k=0.9, ridge=0.3, limbal=1.0, limb0=0.8, limb_col=(0.02, 0.0, 0.0),
                    iris=0.56, iris_soft=0.02, pupil_soft=0.012, pupil_fn=wrong_pupil, gaze=(0, 0.06, 1),
                    amb=0.05, key=1.1, wrap=0.2, edge_dark=0.75, sssk=0.7, shin=150.0, spec=0.35, glint=0.9, win=0.0,
                    win_w=0.09, win_h=0.06, limb_k=0.7, limb_w=0.18,
                    veins=[dict(args=dict(n=70, w0=(1.4, 3.4), branch=0.09, fill=(160, 255)), col=(0.3, 0.01, 0.02), k=1.0,
                                halo=0.6, halo_r=6), HERO_VEINS[1]])
    over(cv, eyeball(rng, 512, 512, 440, P))
    return cv


def rot_params(rng):
    """ROT's parameters. rng draw order is the art: do not reorder anything here."""
    outline = 1 + (fbm(rng, 3, 3) - 0.5) * 0.22

    def wrinkles(rng, ctx):
        f = fbm(rng, 5, 5, 0.55)
        crease = 1 - abs(f - 0.5) * 2.0
        return (ss(0.75, 0.97, crease) * 1.4 + fbm(rng, 30, 3) * 0.4) * (1 - ctx['im'] * 0.85)

    def necro(rng, ctx, scl):
        n = fbm(rng, 4, 5)
        patch = ss(0.6, 0.66, n) * (1 - ctx['im'])
        halo = ss(0.5, 0.6, n) * (1 - patch) * (1 - ctx['im'])
        scl = cmix(scl, (0.42, 0.42, 0.14), halo * 0.7)
        return cmix(scl, cmix((0.1, 0.06, 0.03), (0.02, 0.02, 0.01), ss(0.66, 0.75, n)), patch)

    def cataract(rng, ctx, C):
        c = fbm(rng, 8, 5)
        m = cl((1 - ss(0.85, 1.08, ctx['rho'])) * ctx['front'] * (0.72 + 0.35 * c))
        ctx['haze'] = m
        return cmix(C, cmix((0.5, 0.55, 0.48), (0.72, 0.76, 0.68), c), m)

    def wet(rng, ctx): return 0.15 + 0.85 * ss(0.45, 0.65, fbm(rng, 6, 4))
    P = hero_params(scl=(0.5, 0.5, 0.36), rim=(0.3, 0.2, 0.1), rim0=0.3, rimp=1.0, blot=0.5,
                    out_dk=(0.12, 0.16, 0.12), out_lt=(0.35, 0.4, 0.3), in_dk=(0.2, 0.18, 0.1), in_lt=(0.4, 0.36, 0.2),
                    pupil_col=(0.18, 0.2, 0.17), outline=outline, flat=0.7, height_fn=wrinkles, kb=14.0, bump=0.6,
                    sclera_fn=necro, albedo_fn=cataract, wet=wet, amb=0.05, key=1.05, wrap=0.2, edge_dark=0.6,
                    sss=(0.3, 0.12, 0.03), shin=70.0, spec=0.5, glint=0.9, win=0.25, win_w=0.1, win_h=0.07,
                    gaze=(0.12, 0.2, 1),
                    veins=[dict(args=dict(n=40, w0=(1.0, 2.6), branch=0.07, fill=(120, 230)), col=(0.18, 0.05, 0.07), k=0.9,
                                halo=0.3, halo_col=(0.25, 0.12, 0.06))])
    return P, outline


ROT_C = (512, 520, 400)   # the art's ball: centre and radius on the concept canvas


def c_rot():
    rng = random.Random(2002)
    cv = new_canvas()
    P, _ = rot_params(rng)
    over(cv, eyeball(rng, *ROT_C, P))
    return cv


# (sideways tilt, height) of each eye's lid slit in the kit's cluster: heavy, each at its own angle, none of them round
CLUSTER_LIDS = [(-0.22, 0.6), (0.3, 0.56), (0.1, 0.62), (-0.4, 0.58), (0.5, 0.54)]


def c_cluster(lids=False):
    rng = random.Random(2006)
    cv = new_canvas()
    eyes = [(390, 440, 150, (-0.5, -0.3, 1)), (660, 400, 118, (0.5, -0.4, 1)), (610, 670, 132, (0.15, 0.5, 1)),
            (365, 715, 92, (-0.6, 0.35, 1)), (815, 600, 78, (0.7, 0.1, 1))]
    lump = const(0)
    for x, y, r in [(512, 560, 330), (380, 440, 220), (660, 410, 190), (610, 690, 210), (365, 715, 160), (815, 600, 140)]:
        lump = mx(lump, ellipse_soft(x, y, r, r * 0.95, 0.6))
    lump = blur(ss(0.12, 0.2, lump + (fbm(rng, 6, 5) - 0.5) * 0.16), 2)
    rims = const(0); aps = []
    for i_, (x, y, R, g) in enumerate(eyes):
        if lids:
            tilt, tall = CLUSTER_LIDS[i_]
            c_, s_ = math.cos(tilt), math.sin(tilt)
            du = (X - x) * c_ + (Y - y) * s_; dv = (Y - y) * c_ - (X - x) * s_
            dist = (du ** 2.0 + (dv * (1.0 / tall)) ** 2.0) ** 0.5 * (1.0 / R)
        else:
            dist = ((X - x) ** 2.0 + (Y - y) ** 2.0) ** 0.5 * (1.0 / R)
        dist = dist + (fbm(rng, 10, 3) - 0.5) * 0.12
        ap = 1 - ss(0.8, 0.84, dist)
        aps.append(ap)
        rims = rims + (1 - ss(0.0, 0.22, abs(dist - 0.93))) * 0.9
    vs = []
    for i in range(len(eyes)):
        for j in range(i + 1, len(eyes)):
            if rng.random() < 0.6:
                (x1, y1, *_), (x2, y2, *_) = eyes[i], eyes[j]
                mx_, my_ = (x1 + x2) / 2 + rng.uniform(-60, 60), (y1 + y2) / 2 + rng.uniform(-60, 60)
                p = bez((x1, y1), (mx_, my_), (mx_, my_), (x2, y2), 60)
                p = [(a + math.sin(k * 0.4 + i) * 5, b + math.cos(k * 0.33 + j) * 5) for k, (a, b) in enumerate(p)]
                vs.append((p, [rng.uniform(9, 15)] * 61))
    vmask = strands(rng, vs) * lump
    vthin = veins(rng, 512, 560, 470, 512, 560, 0, 60, w0=(1.0, 2.5), fade=False, seek=0.0, start_r=0.9) * lump

    def colf(rng, h, base):
        base = cmix(base, (0.18, 0.02, 0.07), vmask * 0.9)
        return cmix(base, (0.3, 0.02, 0.04), vthin * 0.8)
    over(cv, flesh(rng, lump, dict(pal=PAL_MEAT, round=20, lumpy=0.6, k=40.0, fascia=0.35, shin=55.0, spec=0.6,
                                   h=rims * 0.5 + blur(vmask, 2) * 0.35 + vthin * 0.1, col_fn=colf)))
    irises = [((0.2, 0.12, 0.04), (0.6, 0.42, 0.14)), ((0.12, 0.14, 0.16), (0.4, 0.44, 0.46)),
              ((0.18, 0.04, 0.02), (0.5, 0.16, 0.06)), ((0.12, 0.16, 0.06), (0.4, 0.46, 0.18)),
              ((0.2, 0.15, 0.04), (0.55, 0.45, 0.15))]
    for (x, y, R, g), ap, (dk, lt) in zip(eyes, aps, irises):
        P = hero_params(out_dk=dk, out_lt=lt, in_dk=cmul(dk, 0.8), in_lt=cmul(lt, 1.1), gaze=g, iris=0.5,
                        scl=(0.82, 0.7, 0.62), rim=(0.55, 0.1, 0.1), rim0=0.4, amb=0.08, key=1.05, wrap=0.3,
                        shin=120.0, spec=0.35, glint=0.9, win=0.0,
                        veins=[dict(HERO_VEINS[0], args=dict(HERO_VEINS[0]['args'], n=30)), dict(HERO_VEINS[1],
                               args=dict(HERO_VEINS[1]['args'], n=50))])
        e = eyeball(rng, x, y, R, P)
        shadow = 0.2 + 0.8 * ss(0.1, 0.9, blur(sh(ap, int(R * 0.05), int(R * 0.07)), max(3, R * 0.05)))
        e['rgb'] = cmul(e['rgb'], shadow * ap); e['a'] = e['a'] * ap
        over(cv, e)
    return cv


CONCEPTS = [('hero', 'Hero', c_hero), ('hero_rot', 'Hero, rotted', c_hero_rot), ('flyer', 'Flyer', c_flyer),
            ('icon', 'Icon', c_icon), ('burst', 'Burst', c_burst), ('wrong', 'Wrong', c_wrong),
            ('rot', 'Rot', c_rot), ('cluster', 'Cluster', c_cluster)]


def sprite(name):
    im = Image.open(os.path.join(OUT, name + '.png'))
    crop = im.crop((40, 150, 1024, 806))     # 3:2 window around eye + tail
    sm = crop.resize((48, 32), LAN)
    sm.save(os.path.join(OUT, name + '_48x32.png'))
    big = sm.resize((192, 128), Image.Resampling.NEAREST)
    big.save(os.path.join(OUT, name + '_48x32_x4.png'))
    bg = Image.new('RGBA', (192 * 2 + 30, 128 + 20), (10, 5, 6, 255))
    bg.alpha_composite(big, (10, 10)); bg.alpha_composite(big.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (212, 10))
    bg.save(os.path.join(OUT, name + '_48x32_x4_dark.png'))


def sheet(names):
    cols = 4 if len(names) > 6 else 3
    rows = (len(names) + cols - 1) // cols
    cw = 1800 // cols
    sh_ = Image.new('RGBA', (cw * cols, (cw + 30) * rows), (10, 5, 6, 255))
    d = ImageDraw.Draw(sh_)
    try: font = ImageFont.load_default(size=22)
    except TypeError: font = ImageFont.load_default()
    for i, (n, label) in enumerate(names):
        p = os.path.join(OUT, n + '.png')
        if not os.path.exists(p): continue
        im = Image.open(p).resize((cw - 10, cw - 10), LAN)
        x, y = (i % cols) * cw, (i // cols) * (cw + 30)
        sh_.alpha_composite(im, (x + 5, y + 5))
        d.text((x + 12, y + cw - 2), f'{i + 1}. {label}', fill=(170, 140, 130, 255), font=font)
    sh_.convert('RGB').save(os.path.join(OUT, 'sheet.png'))


# ---------------------------------------------------------------- bake: shared
ROT_R_ART = 256        # ball radius in sprite px at the concept's R; see the report for what this costs in bytes
ROT_HALF = 504         # concept px, half the square all full-ball layers share: 1.26 R, the canvas's room below the ball
ROT_SHADE_PX = 256     # smooth, so it upscales
M_FLOOR = 0.15         # de-light never divides by less: rim scatter over a near-zero M would clip the surface to white
SPEC_MAX = 0.92        # no layer reaches pure white
SPEC_DIM = 0.9         # art-director: only glints above 80 % L, no pure white
SPEC_GAIN = 1.6        # source-over dims the art's additive highlight; art-director asked its upper-left peak back to about 180
SPEC_TINT = (1.0, 0.9, 0.72)   # art-director: warm, it went dry and grey
ROT_OUTLINE_N = 72


def to8(t): return cl(t * 255.0, 0.0, 255.0).im.convert('L')


def delit(col, MF):
    """col / MF as a colour triple, scaled down whole if a channel passes 1: clipping red alone turns the oxide flakes on
    the dark side green"""
    d = [c / MF for c in col]
    k = mx(mx(mx(d[0], d[1]), d[2]), 1.0)
    return [c / k for c in d]


def fit(t, box, px, how=LAN): return T(t.im.crop(box).resize((px, px), how))


def write_rgb(chs, name):
    """opaque RGB at 5 bits a channel. 256 colours can't hold the ball: the de-lit surface spans olive, oxide and grey at
    full range, so a palette merged the bile halos into grey and put teal blocks in the shadows. Its creases hide the steps"""
    bits = lambda v: min(255, v + 4) & 0xF8
    im = Image.merge('RGB', [c.im.convert('L').point(bits) for c in chs])
    im.save(os.path.join(SPRITES, name + '.png'), optimize=True)


def write_alpha(a8, col, name):
    """one colour with an alpha plane: a palette of 256 copies of col plus a tRNS ramp, one byte a pixel"""
    p = a8.convert('P')
    p.putpalette(list(col) * 256)
    p.save(os.path.join(SPRITES, name + '.png'), optimize=True, transparency=bytes(range(256)))


def write_rgba(im, name):
    """8-bit palette with alpha when libimagequant is here (it dithers well); else plain RGBA"""
    if features.check('libimagequant'):
        q = im.quantize(256, method=Image.Quantize.LIBIMAGEQUANT, dither=Image.Dither.FLOYDSTEINBERG)
        q.save(os.path.join(SPRITES, name + '.png'), optimize=True)
    else:
        im.save(os.path.join(SPRITES, name + '.png'), optimize=True)


def sprite_bytes(*names):
    tot = 0
    for n in names:
        b = os.path.getsize(os.path.join(SPRITES, n + '.png'))
        tot += b
        print(f'  {n}.png {b} bytes', flush=True)
    print(f'  total {tot} bytes', flush=True)


# ---------------------------------------------------------------- bake: ROT
def rot_run(**over_):
    rng = random.Random(2002)
    P, outline = rot_params(rng)
    gaze0 = norm3(P['gaze'])
    cx, cy, R = ROT_C
    P.update(layers=1, vein_iR=R * P.get('iris', 0.47) * 1.05)
    P.update(over_)
    return eyeball(rng, cx, cy, R, P), outline, gaze0


def outline_radii(outline):
    # the art's edge is rr = 1 with rr^2 = |p|^2 * outline(p), so walk each ray out to where that crosses 1
    cx, cy, R = ROT_C
    px = outline.im.load()
    out = []
    for k in range(ROT_OUTLINE_N):
        th = k / ROT_OUTLINE_N * 2 * math.pi
        c, s = math.cos(th), math.sin(th)
        lo_, hi = 0.6, 1.25
        for _ in range(24):
            m = (lo_ + hi) / 2
            if m * m * px[cx + c * m * R, cy + s * m * R] < 1: lo_ = m
            else: hi = m
        out.append(round((lo_ + hi) / 2, 4))
    return out


def bake_rot():
    cx, cy, R = ROT_C
    k = ROT_R_ART / R
    box = (cx - ROT_HALF, cy - ROT_HALF, cx + ROT_HALF, cy + ROT_HALF)
    px = round(2 * ROT_HALF * k)
    floor_M = lambda M: mx(mn(M, 1.0), M_FLOOR)

    # ball: no lens, no ring (rho is huge everywhere), so the surface continues under where the lens sits
    e, outline, gaze0 = rot_run(iris=1e-4, no_iris=1)
    MF = floor_M(e['M'])
    keep = 1 - ss(1.12, 1.16, e['rr'])   # past the furthest the clip can reach: flat, for bytes
    surf = [fit(c * keep * 255.0, box, px) for c in delit(e['nospec'], MF)]
    write_rgb(surf, 'rot_ball')
    # shade: everything the de-light took out, as black over the finished picture
    write_alpha(fit(1 - MF, box, ROT_SHADE_PX, BOX).__mul__(255.0).im.convert('L'), (0, 0, 0), 'rot_shade')
    # spec: source-over stands in for the art's add, close at low strength and never white at high
    # Where the art's lens sat there were no glints, and with the ball's bump carried on under it they'd sit on the lens
    # at this gaze as glitter: keep only the smooth sheen there, faded so no circle shows when the lens moves off
    d = ((X - (cx + gaze0[0] * R)) ** 2.0 + (Y - (cy + gaze0[1] * R)) ** 2.0) ** 0.5 * (1 / (0.47 * R))
    sa_ = cl(mix(e['spec0'], e['spec'], ss(0.85, 1.1, d)) * SPEC_GAIN) * SPEC_MAX * (1 - ss(1.04, 1.1, e['rr']))
    write_alpha(cl(fit(sa_, box, px) * 255.0, 0.0, 255.0).im.convert('L'),
                tuple(int(c * SPEC_DIM * 255) for c in SPEC_TINT), 'rot_spec')
    radii = outline_radii(outline)
    del e

    # lens: at the art's own gaze, not face on as first planned. The disc's edge is a 9 px step in the bump, and its black
    # crescent and pale lower rim are that step's shading: face on, M is near 1 there and the pale side clips away
    e, _, _ = rot_run(black_scl=1)
    MF = floor_M(e['M'])
    # coverage is the disc, then over the ball the ring's darkening and the cloud's pale skirt past the disc edge: the art
    # has both, and both belong to the lens because they move with it
    a = cl(1 - (1 - e['im']) * (1 - e['ring']) * (1 - e['ctx']['haze']))
    half = math.ceil(0.47 * R * 1.12) + 4
    lx, ly = cx + round(gaze0[0] * R), cy + round(gaze0[1] * R)
    lbox = (lx - half, ly - half, lx + half, ly + half)
    lpx = round(2 * half * k)
    A = cl(fit(a, lbox, lpx))
    # the specks on the disc go with it, a fleck in the cataract: as part of spec they'd stay behind when it moved
    glint = cl(e['spec']) * e['im'] * SPEC_DIM
    lit = [c + g * glint for c, g in zip(e['nospec'], e['spec_col'])]
    chans = []
    for c in delit(lit, MF):   # black_scl made this premultiplied; resample it so, or the ring bleeds over the disc edge
        chans.append(to8(cl(fit(c, lbox, lpx) / mx(A, 1 / 255))))
    write_rgba(Image.merge('RGBA', chans + [to8(A)]), 'rot_lens')

    # the renderer's table, beside the sprites: asset scripts write only into asset folders (.claude/rules/tools.md)
    with open(LAYOUT_JSON, 'w') as f:
        json.dump(dict(outline=[round(v, 4) for v in radii], half=round(ROT_HALF / R, 4), lensHalf=round(half / R, 4),
                       gazeX=round(gaze0[0], 4), gazeY=round(gaze0[1], 4)), f, indent=1)
        f.write('\n')
    sprite_bytes('rot_ball', 'rot_lens', 'rot_shade', 'rot_spec')


# ---------------------------------------------------------------- bake: kit
def grade_out_pink(cv):
    # pink is pale flesh: green and blue close to a strong red. Sink it to old tallow (art-director: hue about 42, 25 % less
    # saturation), weighted by that paleness so saturated wound red, with its low green, stays as it is
    r, g, b, a = cv
    pale = ss(0.12, 0.45, g / mx(r, 1e-3))
    b2 = mn(b, g) * (1 - 0.45 * pale)
    g2 = mix(g, b2 + (r - b2) * (42 / 60), pale)   # with r the largest and b the smallest, hue = 60 * (g - b) / (r - b)
    grey = (r + g2 + b2) * (1 / 3)
    sat = 0.25 * pale
    k = 1 - 0.38 * pale
    return [mix(r, grey, sat) * k, mix(g2, grey, sat) * k, mix(b2, grey, sat) * k, a]


def kit_sprite(cv, name, px, crop=None):
    """premultiplied resample: the canvas layers are premultiplied, so edges stay clean"""
    r, g, b, a = grade_out_pink(cv)
    w, h = px
    box = crop or (0, 0, S, S)
    ch = [c.im.crop(box).resize((w, h), LAN) for c in (r, g, b, a)]
    A = T(ch[3])
    A = cl(A)
    out = [to8(cl(T(c) / mx(A, 1 / 255))) for c in ch[:3]] + [to8(A)]
    write_rgba(Image.merge('RGBA', out), 'kit/' + name)


def bake_kit():
    # sizes are the sprite's px (2x game size); crops are the concept's own composition unless noted
    kit_sprite(c_cluster(lids=True), 'eye_cluster', (160, 160))
    kit_sprite(c_flyer(), 'eye_flyer', (72, 48), (40, 150, 1024, 806))   # the concept's 3:2 window around eye + tail
    kit_sprite(c_hero_rot(), 'eye_rotted', (56, 56))
    kit_sprite(c_burst(), 'eye_burst', (56, 56))
    kit_sprite(c_wrong(), 'eye_wrong', (80, 80))
    sprite_bytes(*('kit/eye_' + n for n in ('cluster', 'flyer', 'rotted', 'burst', 'wrong')))


def main_concept(args):
    global OUT
    if '--out' in args:
        i = args.index('--out')
        OUT = os.path.abspath(args[i + 1])
        del args[i:i + 2]
    os.makedirs(OUT, exist_ok=True)
    want = set(args)
    for name, label, fn in CONCEPTS:
        if want and name not in want: continue
        t = time.time()
        save(fn(), name)
        if name == 'flyer': sprite(name)
        print(name, f'{time.time() - t:.1f}s', flush=True)
    sheet([(n, l) for n, l, _ in CONCEPTS])


if __name__ == '__main__':
    mode, rest = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ('', [])
    if mode == 'concept':
        main_concept(rest)
    elif mode == 'bake':
        want = set(rest) or {'rot', 'kit'}
        if 'rot' in want: bake_rot()
        if 'kit' in want: bake_kit()
    else:
        sys.exit(__doc__)
