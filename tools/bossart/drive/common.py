"""THE GRAVITY DRIVE, Matt's pick c3 Spine Wheel: shared painters for this boss only (own copy of the Phase 1 helpers in
SP/concepts/drive/dx.py; the lane's kit is imported from tools/bossart, never edited).
Hero scale is P = 4 x game px. The full canvas is the real 204 x 224 footprint, boss (0,0) at hero (CX, CY). Parts (vertebrae,
ribs, plates, eye, cord) are painted on their own small canvases round a pivot and baked at many angles, lit from the same
fixed light every time, so a turning part never turns its highlights with it."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bosskit import *
P = 4
S = (204 * P, 224 * P); CX, CY = 94 * P, 112 * P
def g(x, y): return (CX + x * P, CY + y * P)
TENT = [g(-12, -30), g(-12, 30)]
BONE = ((.05,.03,.022),(.36,.28,.17),(.76,.68,.50))
def Tc(v, size=S): return const(v, size)
def col(c, size=S): return tuple(const(v, size) for v in c)
def ss_(a, b, t):
    q = max(0, min(1, (t - a) / (b - a))); return q * q * (3 - 2 * q)
def pmask(draw, size=S, sc=2):
    w, h = size; m = Image.new('L', (w * sc, h * sc), 0); draw(ImageDraw.Draw(m), sc); return T(m.resize(size, LAN).convert('F')) * (1 / 255)
def tissue(rng, name, pal, size=S, contrast=1.5, keep=.08, crop=None, amp=26, cells=9, hp=16, gain=2.5, rot=0, mirror=False):
    """(albedo, detail height) from a photo warped over the form, never a pasted rectangle"""
    ph = warp(photo(name, size, crop=crop, rot=rot, mirror=mirror), rng, amp, cells)
    return grade(rgbT(ph), *pal, contrast=contrast, keep=keep), highpass(lumaT(ph), hp, gain)
def lumpy(paths, rng, size=S, steps=16, lump=.22, freq=.5):
    """tubes that are not clean: radius wanders along the length. paths = [(pts, w0, w1[, lift])]. Returns (height, mask)"""
    H = Image.new('L', size, 0); d = ImageDraw.Draw(H)
    for p in paths:
        pts, w0, w1 = p[0], p[1], p[2]; lift = p[3] if len(p) > 3 else 1.0; n = len(pts) - 1; ph = rng.uniform(0, 6.28); ph2 = rng.uniform(0, 6.28)
        rads = [(w0 + (w1 - w0) * (i / max(1, n))) * (1 + lump * math.sin(i * freq + ph) + lump * .6 * math.sin(i * freq * 2.7 + ph2)) for i in range(n + 1)]
        for k in range(steps):
            f = 1 - k / steps; v = int(255 * lift * math.sqrt(max(0, 1 - f * f)))
            for i in range(n):
                a, b = pts[i], pts[i + 1]; rad = rads[i + 1] * f
                if rad < .4: continue
                d.line((a[0], a[1], b[0], b[1]), fill=v, width=max(1, int(rad * 2))); d.ellipse((b[0] - rad, b[1] - rad, b[0] + rad, b[1] + rad), fill=v)
    ht = T(H.convert('F')) * (1 / 255); return blur(ht, 3), ss(0.0, 0.06, ht)
def domes(spots, size):
    """max of hemispheres: creases where lobes meet. spots = (x, y, r)"""
    im = Image.new('F', size, 0.0); src = Image.radial_gradient('L').point(lambda v: 255 * math.sqrt(max(0, 1 - min(1, v / 127.5) ** 2)))
    for x, y, r in spots:
        d = src.resize((max(2, int(r * 2)), max(2, int(r * 2))), BIC).convert('F').point(lambda v: v * ((r / 100.0) ** .5 / 255.0))
        tmp = Image.new('F', size, 0.0); tmp.paste(d, (int(x - r), int(y - r))); im = ImageMath.lambda_eval(lambda e: e['max'](e['a'], e['b']), a=im, b=tmp)
    return T(im)

# ---------------------------------------------------------------- the eye: photoreal method; split into a globe and an iris so the gaze moves
def eye(seed, R, gaze=(-.3, .03), iris=.48, pupil=.34, inner=(.50,.13,.05), outer=(.24,.02,.02), scl=(.46,.38,.26), rim=(.22,.03,.03),
        glow=0.0, haem=.35, rupt=0.0, part='all', veinglow=None):
    """painted in its own bbox (2R+6 square, centre = pivot). part: 'all', 'globe' (sclera only, no iris) or 'iris' (iris and pupil
    only, alpha = the iris disc). glow lights the pupil from inside (beam charge) but never floods the iris: the fibres must stay
    readable in every beam state, which is what the concept got wrong. veinglow lights the sclera's vessels"""
    rng = random.Random(seed); bw = int(2 * R + 6); bs = (bw, bw); ox = bw / 2.0
    gz = math.sqrt(max(.05, 1 - gaze[0] ** 2 - gaze[1] ** 2)); gv = (gaze[0], gaze[1], gz)
    e1 = (gz, 0, -gaze[0]); l = math.hypot(*e1); e1 = tuple(c / l for c in e1)
    e2 = (gv[1]*e1[2]-gv[2]*e1[1], gv[2]*e1[0]-gv[0]*e1[2], gv[0]*e1[1]-gv[1]*e1[0])
    fib = [rng.random() for _ in range(360)]; fib = [(fib[i] * .6 + fib[(i + 1) % 360] * .25 + fib[(i - 1) % 360] * .15) for i in range(360)]
    fib2 = [rng.random() for _ in range(90)]; rag = [rng.gauss(0, 1) for _ in range(40)]
    crypt = [(rng.uniform(0, 6.28), rng.uniform(.5, .85), rng.uniform(.04, .1)) for _ in range(14)]
    Rl, Gl, Bl, IM, PM, NZ, NX, NY, PC = [], [], [], [], [], [], [], [], []
    for j in range(bw):
        for i in range(bw):
            nx = (i - ox) / R; ny = (j - ox) / R; r2 = nx * nx + ny * ny
            if r2 >= 1.0:
                for L_ in (Rl, Gl, Bl, IM, PM, NZ, PC): L_.append(0.0)
                NX.append(nx); NY.append(ny); continue
            nz = math.sqrt(1 - r2); dg = nx * gv[0] + ny * gv[1] + nz * gv[2]
            u = (nx * e1[0] + ny * e1[1] + nz * e1[2]) / iris; v = (nx * e2[0] + ny * e2[1] + nz * e2[2]) / iris
            rho = math.hypot(u, v); th = math.atan2(v, u); a = (th + math.pi) / (2 * math.pi)
            f = fib[int(a * 359.99)]; f2 = fib2[int((a * 3 + rho * .35) % 1 * 89.99)]
            t = min(1, rho); c = [inner[k] + (outer[k] - inner[k]) * t for k in range(3)]
            br = (.28 + 1.1 * f * (.6 + .4 * f2)) * (1.15 if abs(rho - .52) < .06 else 1.0)
            for ca, cr, cs in crypt:
                da = (th - ca + math.pi) % (2 * math.pi) - math.pi
                if abs(da) * rho < cs * .8 and abs(rho - cr) < cs: br *= .25
            lm = max(0, min(1, (rho - .78) / .22)); br *= 1 - .9 * lm * lm
            im = (1.0 if rho < .985 else max(0.0, (1.03 - rho) / .045)) if dg > 0 else 0.0
            q = rho / (pupil * (1 + .09 * rag[int(a * 39.99)]))
            pm = (1.0 if q < .92 else max(0.0, (1.0 - q) / .08)) if dg > 0 else 0.0
            Rl.append(c[0] * br); Gl.append(c[1] * br); Bl.append(c[2] * br); IM.append(im); PM.append(pm); NZ.append(nz); NX.append(nx); NY.append(ny)
            PC.append(max(0.0, 1 - rho / max(.05, pupil * 1.25)) if dg > 0 else 0.0)
    mk = lambda L_: T((lambda im: (im.putdata(L_), im)[1])(Image.new('F', bs)))
    IR, IG, IB, IMt, PMt, nz, nx, ny, PCt = mk(Rl), mk(Gl), mk(Bl), mk(IM), mk(PM), mk(NZ), mk(NX), mk(NY), mk(PC)
    r2 = nx * nx + ny * ny; rr = cl(r2) ** .5; alpha = cl((1.0 - r2 ** .5) * R + .5)
    mott = fbm(rng, 5, bs, 4); C = cmix(scl, rim, cl(ss(.3, 1, rr) + (mott - .5) * .9 + haem * .3))
    vn = veinnet(rng, bs, const(1, bs), n=26, w0=2.6 + R * .012, branch=.09, seedpts=[(ox + math.cos(k * .7) * R * .98, ox + math.sin(k * .7) * R * .98) for k in range(9)])
    C = cmix(C, (.34, .012, .02), cl(blur(vn, 1.6) * .55 * (.4 + haem * 1.6))); C = cmix(C, (.20, .004, .01), cl(vn * .9))
    bl = ss(.6 - haem * .22, .78, fbm(rng, 6, bs, 4)) * ss(.25, .8, rr); C = cmix(C, (.13, .004, .008), bl * .85)
    if part == 'globe': IMt = IMt * 0; PMt = PMt * 0
    C = cmix(C, (IR, IG, IB), IMt)
    C = cmix(C, (.006, .004, .005), PMt)
    bump = fbm(rng, 16, bs, 4) * (1 - IMt * .92); dx, dy = grad(bump); n = nrm(nx - dx * 7, ny - dy * 7, nz + .001)
    d = dot3(n, LIGHT); diff = cl((d + .25) / 1.25); col_ = cmul(C, (.07 + diff * 1.05))
    col_ = cadd(col_, cmul((.5, .03, .03), ss(.45, 1, rr) * .28 * (.4 + .6 * diff)))
    hd = mx(dot3(n, HALF), 0.0); col_ = cadd(col_, cmul((1, .95, .9), hd ** 70.0 * .22))
    if glow:
        # the charge burns inside the pupil, a hot ring at the pupil's edge; the iris keeps its fibres (lit, not painted over)
        col_ = cadd(col_, cmul((1.0, .85, .7), PCt ** 1.4 * glow))
        col_ = cadd(col_, cmul((.9, .10, .05), cl(PCt * 3) * (1 - PCt) * IMt * glow * .5))
        col_ = cadd(col_, cmul((IR, IG, IB), IMt * glow * .9))
    vg = glow if veinglow is None else veinglow
    if vg: col_ = cadd(col_, cmul((.40, .015, .012), blur(vn, 1.2) * vg * .6 * (1 - IMt)))
    if rupt:
        wr = ridged(rng, 4, bs, 4); col_ = cmul(col_, 1 - .75 * min(1, rupt) * wr)
        col_ = cmix(col_, (.10, .005, .01), cl(ss(.35, .7, fbm(rng, 4, bs, 3)) * rupt))
        gash = ss(.86, .97, ridged(rng, 3, bs, 3)); col_ = cmix(col_, (.012, .002, .003), cl(gash * rupt * 1.2))
        alpha = alpha * cl(1.6 - rupt * .5 * ss(.4, .9, rr + (fbm(rng, 6, bs, 3) - .5) * .8) * 2)
    if part == 'iris': alpha = alpha * IMt
    return dict(rgb=cmul(col_, alpha), a=alpha)

# ---------------------------------------------------------------- damage (dx.py, sized)
def tears(rng, spots, size=S, rough=.62, lobes=9):
    m = None
    for x, y, rx, ry, a in spots:
        b = blob(rng, size, x, y, rx, ry, rough=rough, lobes=lobes, ang=a, edge=3.0); m = b if m is None else mx(m, b)
    return m if m is not None else const(0, size)
def wound(rng, cv, spots, contents=None, body=None, size=S, fringe=15):
    """tear the painted body open: a black cavity, patches of what is inside, a raw meaty lip with a torn fringe"""
    if not spots: return cv
    W_ = tears(rng, spots, size)
    if body is not None: W_ = W_ * body
    lip = ss(.2, .36, cl(blur(W_, fringe) * 2.4 + (fbm(rng, 34, size, 3) - .5) * .55))
    if body is not None: lip = lip * body
    alb, det = tissue(rng, 'meat_146.jpg', ((.05,.004,.006),(.36,.03,.03),(.68,.17,.13)), size, contrast=1.5, keep=.1, amp=20, hp=10, gain=2.8)
    h = blur(lip, 3) * .45 + fbm(rng, 18, size, 3) * .16 * lip - W_ * .5
    cv = over(wet(alb, h, lip, detail=det, k=26, dk=7, ao=7, sss=.8, spec=.42, film=film_map(rng, size, lip, 7)), cv)
    cav = ss(.5, .95, W_)
    cv = over(dict(rgb=(const(.012, size) * cav, const(.002, size) * cav, const(.003, size) * cav), a=cav), cv)
    if contents:
        pa = ss(.46, .6, fbm(rng, 9, size, 3)) * cav; cv = over(dict(rgb=cmul(contents['rgb'], pa), a=contents['a'] * pa), cv)
    sd = shadow(lip * (1 - cav), r=7, k=.8, dx=3, dy=6); cv = over(dict(rgb=sd['rgb'], a=sd['a'] * cav), cv)
    return cv
def blood(rng, cv, starts, maxlen=170, w=4.5, c=(.30,.008,.014), clip=None, size=S):
    """wandering, tapered, unequal runs that pool at the source"""
    if clip is not None: starts = [(x, y) for x, y in starts if 0 <= x < size[0] and 0 <= y < size[1] and clip.im.getpixel((int(x), int(y))) > .5]
    if not starts: return cv
    paths = []
    for x, y in starts:
        L_ = rng.uniform(.15, 1) ** 1.7 * maxlen; n = max(6, int(L_ / 5)); pts = []; px, py = x, y; dv = rng.uniform(-.3, .3)
        for i in range(n + 1):
            dv += rng.gauss(0, .16); dv *= .93; px += dv * 3; py += 5; pts.append((px, py))
        ww = w * rng.choice((.5, .7, 1, 1, 1.5, 2.4)); paths.append((pts, ww * rng.uniform(1.0, 1.9), ww * rng.uniform(.18, .42)))
    h, m = lumpy(paths, rng, size, lump=.32, freq=.55)
    return over(wet(col(c, size), h, m, k=10, sss=.25, spec=.7, glint=1.0, film=m), cv)
def bites(rng, cv, spots, size=S):
    B = 1 - tears(rng, spots, size, rough=.5, lobes=6); return dict(rgb=cmul(cv['rgb'], B), a=cv['a'] * B)
def gutcoil(rng, cx, cy, n=5, r=40, w0=15, size=S):
    paths = []
    for _ in range(n):
        a = rng.uniform(0, 6.28); x = cx + rng.uniform(-r, r); y = cy + rng.uniform(-r, r); pts = []
        for i in range(30):
            a += rng.gauss(.22, .25); x += math.cos(a) * 7; y += math.sin(a) * 7; pts.append((x, y))
        paths.append((pts, w0 * rng.uniform(.7, 1.1), w0 * rng.uniform(.5, .9)))
    h, m = lumpy(paths, rng, size, lump=.14, freq=.9)
    alb, det = tissue(rng, 'squid_322.jpg', ((.05,.006,.01),(.20,.035,.035),(.46,.20,.16)), size, contrast=1.3, keep=.03, amp=14, hp=8, gain=2.4)
    return wet(alb, h, m, detail=det, k=20, dk=4, sss=.6, spec=.6, film=m)
def hang(rng, cv, roots, size=S, c=(.26,.02,.03), w=5, maxlen=120):
    """torn tissue strands hanging from roots: tapered to nothing, never a bead on a string"""
    paths = []
    for x, y in roots:
        L = rng.uniform(.3, 1) ** 1.3 * maxlen; a = rng.uniform(-14, 14); b = rng.uniform(-14, 14)
        paths.append((bez((x, y), (x + a, y + L * .33), (x + b, y + L * .66), (x + a * .4 + b * .4, y + L), 20), w * rng.uniform(.8, 1.4), w * rng.uniform(.06, .2)))
    h, m = tubes(size, paths)
    return over(wet(col(c, size), h, m, k=14, sss=.25, spec=.55, glint=.9, film=m), cv)

# ---------------------------------------------------------------- maps: a part painted once as maps, lit at every angle
def rot_maps(M, deg, pivot):
    """rotate a dict of T maps (and albedo triples) about pivot by deg (screen: clockwise positive)"""
    out = {}
    for k, v in M.items():
        if isinstance(v, tuple): out[k] = tuple(T(c.im.rotate(-deg, BIC, center=pivot)) for c in v)
        elif isinstance(v, T): out[k] = T(v.im.rotate(-deg, BIC, center=pivot))
        else: out[k] = v
    return out
def light_maps(M, **kw):
    """the maps of a part -> a lit layer. M: alb, h, m, det (optional), film (optional)"""
    o = dict(k=22, dk=3, ao=8, sss=.3, spec=.3, shin=24); o.update(M.get('wet', {})); o.update(kw)
    return wet(M['alb'], M['h'], M['m'], detail=M.get('det'), film=M.get('film'), **o)
