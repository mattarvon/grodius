"""SQUID SAUCER 2000, Matt's pick c3 Natural-History Plate (bosspick/ufo/gen.py c3), ported for the bake.
Ivory scratchboard on black, blood the only colour. Hero canvas 1024x512 = 8 x the 128x64 game box; the boss origin
(0,0) is hero (512,192) (plate.gp). Parts sit where the sim puts them (src/enemies/mid/ufo.ts: LASH_O, TUMOURS, HATCH_O,
the r15 eye-core), so nothing here moves gameplay.
Phase 2 fixes over the concept (AUDIT.md section 8): the eye is an ivory socket, a pale iris and a black W pupil, so it
stays the focal at game size; the arms are thickened and edged; the hull rim is chipped, more with each wound stage,
and the six hull cracks open at the old render's hp thresholds; the drips taper and bead. The lash is drawn live.
Sources: shaw_arms.png is cut from George Shaw, "Back viewed eight armed cuttlefish" (NYPL via rawpixel, CC0 1.0),
https://www.rawpixel.com/image/378076/free-illustration-image-octopus-sketch-squid"""
import math, os, random, sys
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path: sys.path.append(HERE)   # appended: ../bake.py must win over this folder's bake.py
from plate import *
from PIL import Image, ImageOps, ImageFilter

IVORY = (0.9, 0.86, 0.74)
INK = (0.035, 0.03, 0.035)
RED = (0.62, 0.02, 0.03)
DRED = (0.24, 0.0, 0.015)
HULL = (512, 196, 450, 70)          # the disc, hero px: centre and radii (game 112 x 17.5)
CAP = (gx(3.4), gy(-10.4) + 18, 170, 76)
EYE_R = 50
HATCH_C = (gx(12), gy(11) + 6)
# hull cracks [x0, y0, x1, y1, opens below hp fraction], game px: the old render's six, same thresholds
CRACKS = [(-40, -2, -26, 8, .85), (20, -6, 34, 6, .7), (-10, -7, 2, 6, .55), (36, -4, 52, 3, .42), (-54, 1, -42, 6, .3), (6, 2, 22, 11, .18)]
STAGE_HP = (1.0, .7, .42, .18)      # the hp each wound stage paints at; src/render/gross/mid/ufo.ts stage() picks by these bands
SPLIT_X = 500                        # the death splits the hull here (hero x), down the line crack 3 starts


def jag(rng, pts, amp, n=6):
    """a polyline made torn: subdivided, the offset wandering (a walk, not a zigzag) and pinned at the ends"""
    out = []; ox = oy = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for j in range(n):
            f = j / n; ox = ox * .7 + rng.gauss(0, amp * .6); oy = oy * .7 + rng.gauss(0, amp * .6)
            out.append((x0 + (x1 - x0) * f + (ox if out else 0), y0 + (y1 - y0) * f + (oy if out else 0)))
    out.append(pts[-1]); return out


def arms_layer(cv, die):
    """George Shaw's engraved arms, cut, reversed to ivory on black and re-hung under the disc. Thickened and edged:
    at 1/8 scale the plate's fine line greyed out into pale thread"""
    src = Image.open(os.path.join(HERE, 'shaw_arms.png')).convert('L')
    lines = ImageOps.invert(src).point(lambda v: 255 if v > 70 else int(v * 2.5))
    sil = src.point(lambda v: 255 if v < 215 else 0).resize((169, 132), BOX).resize(src.size, BIC).point(lambda v: 255 if v > 60 else 0)
    sil = sil.filter(ImageFilter.MaxFilter(9))
    box = (150, 205); sz = (730, 300)
    lT = img_T_(lines, box, sz); sT = cl(img_T_(sil, box, sz) * 1.2)
    edge = cl(sT - cl(blur(sT, 3.0) * 1.8 - .75))      # an ivory edge round every arm: the arm reads as a band, not a thread
    core = cl(lT * .92 + edge * 1.4)
    over(cv, cmix(INK, IVORY, core), sT)
    return sT


def poly_mask(pts, sc=2, it=3):
    pts = chaikin(pts, it)
    return draw_L(lambda d, s: d.polygon([(x * s, y * s) for x, y in pts], fill=255), sc)


def img_T_(im, box, size_xy):
    c = Image.new('L', (W, H), 0); c.paste(im.resize(size_xy, LAN), box)
    return T(c.convert('F')) * (1 / 255)


def hull_mask(stage, die):
    """the disc, never a clean ellipse: a chipped rim always, bites torn out of it with each wound stage"""
    hx, hy, rx, ry = HULL
    q = ell_q(hx, hy, rx, ry) ** 0.5
    rough = (fbm(random.Random(31), 70, 3) - .5) * .09
    m = cl((1.0 - q + rough) * (ry / 1.5) + .5)
    cm = ell_mask(CAP[0], CAP[1], CAP[2], CAP[3]) * (1 - ss(-4, 4, Y - (CAP[1] + 26)))
    rng = random.Random(4100)
    bites = []
    for i in range(30):                 # fixed candidates: a bite opened at stage s stays open after it
        a = rng.uniform(0, math.tau); s = 0 if i < 5 else 1 if i < 11 else 2 if i < 19 else 3
        bites.append((a, s, rng.uniform(.5, 1.0)))
    holes = const(0)
    for a, s, k in bites:
        if s > stage: continue
        r = (9 + 7 * (stage - s) + 10 * s) * k * (1 + .6 * die)
        bx = hx + math.cos(a) * rx * 1.0; by = hy + math.sin(a) * ry * 1.02
        br_ = random.Random(int(a * 1000))
        poly = [(bx + math.cos(t) * r * 1.5 * br_.uniform(.35, 1.1), by + math.sin(t) * r * .9 * br_.uniform(.35, 1.1)) for t in [j * math.tau / 9 + br_.uniform(-.2, .2) for j in range(9)]]
        holes = mx(holes, draw_L(lambda d, s, poly=poly: d.polygon([(x * s, y * s) for x, y in poly], fill=255)))
    m = m * (1 - holes)
    return m, cm


def tear_poly(pts, w_):
    """a crack as a tapered sliver: widest in the middle, to nothing at both ends"""
    n = len(pts); Lf = []; Rt = []
    nm = normals(pts)
    for i, (x, y) in enumerate(pts):
        t = i / (n - 1); ww = w_ * .5 * math.sin(math.pi * t) ** .7 + .6
        Lf.append((x + nm[i][0] * ww, y + nm[i][1] * ww)); Rt.append((x - nm[i][0] * ww, y - nm[i][1] * ww))
    return Lf + Rt[::-1]


def crack_layer(cv, stage, die, allm):
    """hull cracks: black splits tapering to nothing, the raw red seam inside, a fine torn ivory lip, a hair branch or
    two. Each opens at its old hp threshold"""
    hp = STAGE_HP[stage]; rng = random.Random(4200); ends = []
    for i, (x0, y0, x1, y1, thr) in enumerate(CRACKS):
        mid = gp(((x0 + x1) / 2 + rng.uniform(-2, 2), (y0 + y1) / 2 + rng.uniform(-2, 2)))
        pts = jag(rng, [gp((x0, y0)), mid, gp((x1, y1))], 5, 9)
        br = [jag(rng, [pts[j], (pts[j][0] + rng.uniform(-40, 40), pts[j][1] + rng.uniform(-30, 30))], 4, 5) for j in (5, 12)]
        if hp > thr and not die: continue
        op = min(1.0, (thr - hp) * 4 + .35) + 2.2 * die
        w_ = 5 + 10 * op
        blk = draw_L(lambda d, s: [d.polygon([(x * s, y * s) for x, y in tear_poly(pts, w_)], fill=255)] +
                     [d.line([(x * s, y * s) for x, y in q], fill=255, width=max(1, int(2.5 * s))) for q in br])
        lip = cl(blur(blk, 2.0) * 2.2 - blk * 1.6)
        seam = draw_L(lambda d, s: d.polygon([(x * s, y * s) for x, y in tear_poly(pts, w_ * .3)], fill=255))
        over(cv, IVORY, cl(lip) * allm * .7)
        over(cv, INK, blk * allm)
        over(cv, cmix(DRED, RED, ss(0, 1, seam)), seam * allm)
        ends.append(pts[-1])
    return ends


def engrave_hull(cv, rng, hm, cm):
    """c3's disc: shaded lens and cap, engraved with contour lines that thicken with light, crosshatch, stipple"""
    hx, hy, rx, ry = HULL; capx, capy = CAP[0], CAP[1]
    allm = mx(hm, cm)
    n1 = ell_normal(hx, hy, rx, ry, 0.4); n2 = ell_normal(capx, capy, 170, 76, 0.9)
    d1 = cl(dot3(n1, L) * 0.9 + 0.25); d2 = cl(dot3(n2, L) * 0.9 + 0.25)
    shade = mix(d1, d2, cm)
    contours = draw_L(lambda d, s: [d.arc([(hx - rx * k) * s, (hy - ry * k * 0.9 - 30 * (1 - k)) * s, (hx + rx * k) * s, (hy + ry * k) * s], 0, 360,
                                          fill=255, width=int(1.8 * s)) for k in [i / 26 for i in range(4, 27)]] +
                     [d.arc([(capx - 170 * k) * s, (capy - 76 * k) * s, (capx + 170 * k) * s, (capy + 76 * k) * s], 180, 360,
                            fill=255, width=int(1.6 * s)) for k in [i / 12 for i in range(2, 13)]])
    cross = draw_L(lambda d, s: [d.line([(x * s, 0), ((x + 200) * s, H * s)], fill=255, width=int(1.2 * s)) for x in range(-200, W, 6)])
    stip = dots(rng, 5000, lambda x, y: True, .8, 1.5)
    ink = cl(contours * ss(0.1, 0.45, shade) + cross * ss(0.55, 0.85, shade) + stip * ss(0.3, 0.5, shade) * 0.6 + ss(0.92, 1.0, shade))
    chrom = draw_L(lambda d, s: [d.ellipse([(x - r) * s, (y - r * .6) * s, (x + r) * s, (y + r * .6) * s], outline=255, width=int(1.5 * s))
                                 for x, y, r in [(rng.uniform(100, 920), rng.uniform(170, 250), rng.uniform(4, 10)) for _ in range(70)]])
    ink = cl(ink + chrom * hm * 0.9)
    over(cv, cmix(INK, IVORY, ink), allm)
    edge = cl(allm - cl(blur(allm, 2.5) * 1.6 - 0.6))      # the ivory rim line follows the chips
    over(cv, IVORY, cl(edge * 1.5) * allm)
    return allm


def blood_drips(cv, rng, roots, k=1.0):
    """blood off the rim: a neck, uneven beads where it gathers, a fat tear at the end; never a ruled line"""
    sc = 2; hh = Image.new('L', (W * sc, H * sc), 0); d = ImageDraw.Draw(hh)
    for x, y, Ln, w in roots:
        n = max(8, int(Ln / 5)); xx = x; beads = [rng.uniform(.25, .8) for _ in range(rng.randint(0, 2))]
        pts = []
        for i in range(n + 1):
            t = i / n; xx += rng.uniform(-1.4, 1.4)
            r = w * (1.0 - .55 * t ** .6) * rng.uniform(.85, 1.15)
            for b in beads: r += w * .9 * max(0.0, 1 - abs(t - b) * 14)
            if i == n: r = w * 1.35
            pts.append((xx, y + Ln * t, r))
        for kk in range(6):            # height: concentric passes, a round profile
            f = 1 - kk / 6; v = int(255 * math.sqrt(max(0.0, 1 - f * f)) * .9 + 25)
            for (x0, y0, r0), (x1, y1, r1) in zip(pts, pts[1:]):
                rr = max(.6, r1 * f) * sc
                d.line([(x0 * sc, y0 * sc), (x1 * sc, y1 * sc)], fill=v, width=max(1, int(rr * 2)))
                d.ellipse([x1 * sc - rr, y1 * sc - rr, x1 * sc + rr, y1 * sc + rr], fill=v)
    h = T(hh.resize((W, H), LAN).convert('F')) * (1 / 255); m = cl(h * 3)
    n = bump_n(flat_n(), h, 5)
    over(cv, light(n, cmix(DRED, RED, h), amb=0.35, spec=1.3, shin=60, glint=.8, glint_n=n), m * k)


def tumours(cv, rng, stage, sw, cr):
    """the three volley tumours, embedded in the hull: a red boil pushing the engraved lines aside, stippled ivory on
    its lit side; swelling, it brightens and splits with pale lines. cr: burst craters, black, red-rimmed, torn flaps"""
    for i, p in enumerate(A_TUM):
        x, y = gp(p); r0 = 19 + 3 * stage
        if cr:
            hole = ell_mask(x, y - 4, r0 * .95, r0 * .62)
            ring = cl(ell_mask(x, y - 4, r0 * 1.3, r0 * .9) - hole)
            over(cv, cmix(DRED, RED, ss(.0, 1, ring)), ring)
            flaps = draw_L(lambda d, s: [d.polygon([((x + math.cos(a) * r0 * 1.0) * s, (y - 4 + math.sin(a) * r0 * .65) * s),
                                                     ((x + math.cos(a + .25) * r0 * 1.55) * s, (y - 4 + math.sin(a + .25) * r0 * 1.0) * s),
                                                     ((x + math.cos(a + .5) * r0 * 1.0) * s, (y - 4 + math.sin(a + .5) * r0 * .65) * s)], fill=255)
                                         for a in [rng.uniform(0, 6.28) for _ in range(5)]])
            over(cv, IVORY, flaps * .85)
            over(cv, (0.01, 0.0, 0.0), hole)
            over(cv, RED, ell_mask(x, y - 1, r0 * .55, r0 * .22) * .9)
            continue
        r = r0 * (1 + .75 * sw); cy_ = y - r * .3
        halo = ell_mask(x, cy_ + 2, r * 1.45, r * 1.1)
        rings = draw_L(lambda d, s: [d.arc([(x - r * k) * s, (cy_ + 2 - r * .76 * k) * s, (x + r * k) * s, (cy_ + 2 + r * .76 * k) * s], 0, 360,
                                           fill=255, width=int(2.2 * s)) for k in (1.12, 1.26, 1.4)])
        over(cv, INK, rings * halo * .85)
        a = ell_mask(x, cy_, r, r * .66, aa=5) * ss(.3, .55, fbm(random.Random(i + 70), 9, 3) + (1 - ell_q(x, cy_, r, r * .66)) * .4)
        n = ell_normal(x, cy_, r, r * .66, .7)
        sh_ = cl(dot3(n, L) * .9 + .25)
        hot = 1 + .6 * sw
        base = cmix(DRED, cmul(RED, hot), ss(.05, .9, sh_))
        stp = dots(rng, int(r * 5), lambda xx, yy: (xx - x) ** 2 + (yy - cy_) ** 2 < r * r, .8, 1.8)
        base = cmix(base, IVORY, cl(stp * ss(.5, 1, sh_) * 1.2))
        if sw > .4:     # stretched to splitting: pale lines across it
            sp = walk_lines(rng, [(x + rng.uniform(-r * .5, r * .5), cy_ + rng.uniform(-r * .3, r * .3), rng.uniform(0, 6.28)) for _ in range(4)],
                            lambda xx, yy: (xx - x) ** 2 / (r * r) + (yy - cy_) ** 2 / (r * r * .64) < .8, steps=16, st=3, w0=(1.4, 2.4))
            base = cmix(base, IVORY, sp * (sw - .4) * 1.6)
        col = light(n, base, amb=0.5, key=.55, spec=.2, shin=20.0)
        over(cv, col, a * ss(0, .35, a))


def hatch(cv, rng, br, stage):
    """the belly hatch: an engraved sphincter, ivory folds radiating, a wet red mouth that dilates for the litter"""
    x, y = HATCH_C; r = 24
    rx, ry = r * 1.5, r
    a = ell_mask(x, y, rx, ry)
    q = ell_q(x, y, rx, ry) ** .5
    nx_, ny_, nz_ = ell_normal(x, y, rx, ry)
    folds = draw_L(lambda d, s: [d.line([(x * s, y * s), ((x + math.cos(t) * r * 1.7) * s, (y + math.sin(t) * r * 1.15) * s)],
                                        fill=255, width=max(1, int(2.6 * s))) for t in [i * math.tau / 16 + .1 for i in range(16)]])
    folds = folds * (1 - ss(.75, 1.0, q))
    sh_ = cl(dot3((nx_, ny_, nz_), L) * .8 + .35)
    v = cl(folds * ss(.15, .6, sh_) * 1.2 + ss(.55, .95, q) * .35)
    base = cmix(INK, IVORY, v)
    open_ = .16 + .84 * br
    lip = ell_mask(x, y, rx * open_ * .9 + 5, ry * open_ * .9 + 4)
    base = cmix(base, cmix(DRED, RED, cl(1 - q * 1.2)), lip * .9)
    hole = ell_mask(x, y + 1, rx * open_ * .72, ry * open_ * .72)
    base = cmix(base, (0.008, 0.0, 0.003), hole)
    col = light((nx_, ny_, nz_), base, amb=0.55, key=.6, spec=.8, shin=40.0)
    over(cv, col, a)
    if br > .55:   # pale slit-eyed things crowding the hole
        for i in range(2):
            ex, ey = x - 9 + i * 18, y + 3 + i * 3; rr = 6 * br
            over(cv, IVORY, ell_mask(ex, ey, rr, rr * .8) * .9)
            over(cv, INK, ell_mask(ex, ey, rr * .7, rr * .14))


def eye_layer(look=(0.0, 0.0), mode='n'):
    """the eye-core: an ivory lid socket engraved round a dark ball, a pale iris and a black W pupil, a raw red lid rim.
    mode n: open, W pupil; t: the lash tell, lids pulled wide, pupil to a slit, bloodshot; b: blink; d: dying, blown"""
    cv = new_canvas(); rng = random.Random(77)
    cx, cy = gp(A_EYE); r = EYE_R
    sx, sy = 1.3 * r, 1.1 * r
    sm = ell_mask(cx, cy + 2, sx, sy)
    sn = ell_normal(cx, cy + 2, sx, sy, .8)
    sh_ = cl(dot3(sn, L) * .9 + .35)
    folds = draw_L(lambda d, s: [d.arc([(cx - sx * k) * s, (cy + 2 - sy * k) * s, (cx + sx * k) * s, (cy + 2 + sy * k) * s], 0, 360,
                                       fill=255, width=int(2.0 * s)) for k in (.8, .86, .92)])
    over(cv, cmix(INK, IVORY, cl(ss(.05, .5, sh_) - folds * .8 * (1 - ss(.55, .95, sh_)))), sm)
    bm = ell_mask(cx, cy, r, r); n = ell_normal(cx, cy, r, r)
    lx, ly = look; ix, iy = cx + lx * r, cy + ly * r
    iq = ell_q(ix, iy, r * .72, r * .72) ** .5
    iris = 1 - ss(.9, 1.0, iq)
    stri = draw_L(lambda d, s: [d.line([((ix + math.cos(t) * r * .3) * s, (iy + math.sin(t) * r * .3) * s),
                                        ((ix + math.cos(t) * r * .7) * s, (iy + math.sin(t) * r * .7) * s)], fill=255, width=int(1.3 * s))
                                for t in [i * math.tau / 36 for i in range(36)]])
    scl = (0.10, 0.008, 0.015)
    vess = walk_lines(rng, [(cx + math.cos(t) * r * .95, cy + math.sin(t) * r * .95, t + math.pi) for t in [rng.uniform(0, 6.28) for _ in range(10)]],
                      lambda xx, yy: (xx - cx) ** 2 + (yy - cy) ** 2 < r * r, steps=14, st=2.5, w0=(1.2, 2.2))
    base = cmix(scl, RED, vess * (.6 if mode == 'n' else .95))
    irc = cmix((0.86, 0.8, 0.66), (0.3, 0.25, 0.2), cl(stri * .7 + ss(.6, .92, iq) * .9))
    if mode in ('t', 'd'): irc = cmix(irc, RED, ss(.62, .9, iq) * .9)
    base = cmix(base, irc, iris)
    if mode == 't':
        pm = ell_mask(ix, iy, r * .62, r * .1)
    elif mode == 'd':
        pm = ell_mask(ix, iy + r * .05, r * .5, r * .44)
    else:   # a cuttlefish slit, sagging at the middle: a W at hero size, a bar at game size (two lobes read as a face)
        pm = mx(ell_mask(ix, iy, r * .62, r * .15), ell_mask(ix, iy + r * .08, r * .22, r * .16))
    base = cmix(base, (0.004, 0.003, 0.004), pm)
    col = light(n, base, amb=0.38, key=0.75, spec=1.3, shin=90.0, glint=1.0, glint_n=n)
    col = cmix(col, (0.97, 0.96, 0.9), ell_mask(cx - r * .32, cy - r * .3, r * .14, r * .1) * .95)
    over(cv, col, bm)
    lt, lb = dict(n=(-.55, .74), t=(-.8, .86), b=(.12, .2), d=(-.15, .55))[mode]   # hooded: the upper lid sits low over the iris
    edge_up = cy + lt * r + ((X - cx) * (1.0 / r)) ** 2.0 * r * .25
    up = ss(-1.5, 1.5, edge_up - Y)
    edge_lo = cy + lb * r - ((X - cx) * (1.0 / r)) ** 2.0 * r * .25
    lo = ss(-1.5, 1.5, Y - edge_lo)
    lidm = cl(up + lo) * ell_mask(cx, cy, r * 1.08, r * 1.08)
    lhatch = draw_L(lambda d, s: [d.line([(x * s, 0), ((x - 60) * s, H * s)], fill=255, width=int(1.4 * s)) for x in range(int(cx - 2 * r), int(cx + 2 * r), 6)])
    lsh = cl(ss(-r, r * .3, cy - Y) * .7 + .3)
    over(cv, cmix(INK, IVORY, cl(lsh - lhatch * .55)), lidm)
    wet = cl(1 - abs(Y - edge_lo) * (1.0 / 3.5))   # the lower lid only: a red rim on both reads as lips
    over(cv, RED, cl(wet) * ell_mask(cx, cy, r * 1.02, r * 1.02) * .95)
    return cv


def guts(cv, rng, die, seam):
    """the dying spill from the split: ropes of ivory-hatched gut and blood, hanging and lengthening"""
    xs = seam
    specs = []
    for i in range(7):
        x0 = xs + rng.uniform(-50, 50); y0 = rng.uniform(220, 280); Ln = (70 + rng.uniform(0, 160)) * die
        pts = curl_path(x0, y0, math.pi / 2 + rng.uniform(-.5, .5), Ln, rng.uniform(-.006, .006), n=30, wob=.02, ph=rng.uniform(0, 6), grav=.06)
        specs.append(dict(pts=pts, w0=rng.uniform(13, 22), w1=rng.uniform(6, 10), taper=.7))
    tb = tubes(specs, outline=3)
    hatchl = draw_L(lambda d, s: [d.line([(x * s, 0), ((x + 120) * s, H * s)], fill=255, width=int(1.4 * s)) for x in range(-200, W, 7)])
    v = cl(tb['h'] * 1.3 - .2)
    ink = cl(hatchl * ss(.25, .7, v) + ss(.82, 1, v))
    col = cmix(cmix(INK, IVORY, ink), RED, cl(tb['wr'] * 1.5 + (1 - v) * .5))
    over(cv, col, tb['mask'])


def paint(q):
    """one view. q: w wound stage 0..3, sw tumour swell 0..1, cr craters, br hatch 0..1, eye (look, mode) or None,
    die 0..1 (the dying body before it splits). Returns the RGBA hero"""
    rng = random.Random(303); stage = q.get('w', 0); die = q.get('die', 0.0)
    cv = new_canvas()
    arms_layer(cv, die)
    hm, cm = hull_mask(stage, die)
    allm = engrave_hull(cv, rng, hm, cm)
    sx, sy = gx(-14), gy(10)
    fm = poly_mask([(sx + 30, sy - 20), (sx - 40, sy - 6), (sx - 60, sy + 14), (sx - 30, sy + 22), (sx + 40, sy + 18)], it=2)
    cross = draw_L(lambda d, s: [d.line([(x * s, 0), ((x + 200) * s, H * s)], fill=255, width=int(1.2 * s)) for x in range(-200, W, 6)])
    over(cv, cmix(INK, IVORY, cl(cross * 0.8 + ss(0.85, 1, blur(fm, 3)))), fm)
    ends = crack_layer(cv, stage, die, allm)
    if die:
        seam = jag(random.Random(9), [(SPLIT_X + 6, 110), (SPLIT_X - 4, 200), (SPLIT_X + 4, 290)], 10, 5)
        sm = draw_L(lambda d, s: d.line([(x * s, y * s) for x, y in seam], fill=255, width=int((6 + 20 * die) * s), joint='curve'))
        over(cv, RED, sm * mx(allm, const(0)) * .95)
    tumours(cv, rng, stage, q.get('sw', 0.0), q.get('cr', 0))
    hatch(cv, rng, q.get('br', 0.0), stage)
    dr = random.Random(55)
    xs = [(300, 60), (470, 90), (590, 50), (760, 70), (352, 24), (690, 34), (230, 30), (830, 40)][:4 + stage]
    k = .8 + .25 * stage + 1.6 * die
    roots = [(x, 236 + dr.uniform(-8, 8), L_ * dr.uniform(.7, 1.2) * k, dr.uniform(2.8, 4.5)) for x, L_ in xs]
    roots += [(x, y - 4, (20 + 22 * stage) * dr.uniform(.6, 1.3) * (1 + 2 * die), 3.5) for x, y in ends]
    blood_drips(cv, dr, roots)
    e = q.get('eye')
    im = to_image_straight(cv)
    if e:
        im.alpha_composite(to_image_straight(eye_layer(*e)))
    return im


def bloody(im, k=1.0):
    """the hurt flash, in the plate's own terms: every ivory line runs blood for a frame"""
    r, g, b, a = im.split()
    l = im.convert('L')
    r2 = Image.eval(l, lambda v: min(255, int(v * 1.05 + 20)))
    g2 = Image.eval(l, lambda v: int(v * .16)); b2 = Image.eval(l, lambda v: int(v * .14))
    out = Image.merge('RGBA', (Image.blend(r, r2, k), Image.blend(g, g2, k), Image.blend(b, b2, k), a))
    return out
