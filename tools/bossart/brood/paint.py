"""THE BROOD MOTHER, Matt's pick c3 Tapeworm Knot: a loose knot of segmented ribbon bursting from a ruptured gut, its hook crown
reared at the player. Ported from the Phase 1 generator (concepts/brood/work/c3.py with patches 4-9 applied), with the motion and
state parameters Phase 2 needs. paint(q) -> RGBA hero (520x620, 10x game). Run through bake.py.

q keys (all default 0 unless noted):
  ph     motion phase 0..1: peristalsis runs along every ribbon (a contraction wave, a sideways bend, a push-pull slide)
  vent   birth-vent dilation (idle .2). The vent is a ROUND puncture in the gut wall, never a slit (D46)
  swell  the heave: gut and ribbons fatten, the vent rim swells and reddens
  gush   the birth: a ribbon end tears out of the vent, larvae and blood pour after it
  fl     crown: -1 clenched shut, 0 rest, 1 fully flared (the sneeze tell)
  spit   the sneeze released: mucus thrown off the crown at the player
  hurt   flinch: crown clenches, fresh blood
  wound  0 whole, 1 torn (two front loops torn off, the gut split), 2 ruined (most front loops gone, the gut gaping)
  die    0..1 the death: the knot unravels, ribbons rot through, the gut empties
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

LEVELS = [(1.0, 22), (.9, 96), (.74, 150), (.5, 190), (.25, 215)]


def ribbon_maps(pts, w0, w1, seg=9, size=S, ph=0.0, wave=0.0, slide=0.0):
    """a tapeworm strobila: flat, each proglottid a stepped trapezoid wider at its back edge so the silhouette is serrated.
    wave: strength of a contraction travelling along it at phase ph; slide: the segments move along the body by this many px.
    Returns height, mask, crease"""
    d_ = [0.0]
    for i in range(1, len(pts)): d_.append(d_[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    total = d_[-1]

    def at(s):
        s = max(0.0, min(total, s))
        for i in range(1, len(pts)):
            if d_[i] >= s:
                f = (s - d_[i - 1]) / max(1e-5, d_[i] - d_[i - 1]); x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f; y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f
                dx, dy = pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]; l = math.hypot(dx, dy) or 1; return x, y, -dy / l, dx / l
        x, y = pts[-1]; dx, dy = pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1]; l = math.hypot(dx, dy) or 1; return x, y, -dy / l, dx / l
    quads = []; r = random.Random(int(total)); creases = []
    s = -slide % (seg * 2.2) - seg * 2.2   # segments start before the root and slide on: the pattern moves, the body does not
    while s < total - 2:
        sl = seg * r.uniform(.75, 1.25); e = s + sl
        if e <= 0: s = e; continue
        sa = max(0.0, s); t = sa / total
        wd = (w0 + (w1 - w0) * t) * min(1.0, .35 + sa / 46.0) * min(1.0, .25 + (total - sa) / 60.0)
        wd *= 1 + wave * math.sin((sa / 70.0 - ph) * 6.283)   # the peristaltic squeeze: a fat ring rolling along
        sl2 = (e - sa) * (.8 + .9 * (1 - wd / max(w0, 1)))
        e2 = min(total, sa + max(2.0, sl2)); a = at(sa); b = at(e2); wa = wd * .9; wb = wd * 1.07
        quads.append((a, b, wa, wb)); creases.append(((a[0] + a[2] * wa, a[1] + a[3] * wa), (a[0] - a[2] * wa, a[1] - a[3] * wa))); s = e2

    def fn(d, sc):
        for f, v in LEVELS:
            for a, b, wa, wb in quads:
                d.polygon([((a[0] + a[2] * wa * f) * sc, (a[1] + a[3] * wa * f) * sc), ((b[0] + b[2] * wb * f) * sc, (b[1] + b[3] * wb * f) * sc),
                           ((b[0] - b[2] * wb * f) * sc, (b[1] - b[3] * wb * f) * sc), ((a[0] - a[2] * wa * f) * sc, (a[1] - a[3] * wa * f) * sc)], fill=v)
    ht = draw(fn, size); mk = ss(.02, .07, ht)
    cr = draw(lambda d, sc: [d.line((q[0][0] * sc, q[0][1] * sc, q[1][0] * sc, q[1][1] * sc), fill=255, width=int(1.4 * sc)) for q in creases], size)
    return blur(ht, 2.0), mk, blur(cr, .6) * mk


def path(rng, *c, n=30, wob=2.5): return wobble(rng, bez(*c, n), wob)


def bendpath(pts, ph, amp, k=1.5, sgn=1):
    """a sideways S-wave travelling down a ribbon, anchored at its root: the knot writhes, the roots stay in the gut"""
    n = len(pts) - 1; out = []
    for i, (x, y) in enumerate(pts):
        a = pts[min(i + 1, n)]; b = pts[max(i - 1, 0)]; dx, dy = a[0] - b[0], a[1] - b[1]; l = math.hypot(dx, dy) or 1
        t = i / n; o = amp * math.sin((t * k - ph) * 6.283) * sgn * ss_f(0, .35, t)
        out.append((x - dy / l * o, y + dx / l * o))
    return out


VX, VY = VENT[0] + 6, VENT[1]   # the vent's centre in hero px (boss (-15.4, +6))
# width, width, ctrl points: each drawn front over back, so this order IS the knot. Ribbons 3 and 8 now root in the vent: the worm
# visibly pours out of the puncture, and their trailing ends are the ropes below
RIBS = [
  (28, 16, ((330, 120), (500, 60), (510, 300), (350, 300))), (30, 18, ((240, 90), (60, 40), (40, 300), (250, 280))), (26, 14, ((420, 260), (500, 420), (400, 590), (320, 615))),
  (26, 13, ((VX + 18, VY + 26), (170, 420), (120, 540), (140, 612))), (32, 18, ((180, 130), (340, 40), (470, 170), (300, 230))), (30, 16, ((360, 340), (250, 200), (120, 210), (170, 330))),
  (31, 14, ((220, 340), (290, 460), (400, 470), (440, 340))), (20, 8, ((400, 200), (510, 180), (500, 80), (420, 30))), (20, 8, ((VX - 30, VY + 18), (40, 400), (60, 480), (24, 566))),
  (24, 10, ((200, 110), (150, 60), (240, 10), (300, 40))), (24, 10, ((250, 360), (260, 470), (235, 560), (262, 612))), (32, 18, ((330, 170), (420, 280), (300, 430), (190, 370))),
]
# loops torn off by stage: stage 1 loses two front loops, stage 2 most of the front and one vent ribbon
DROP = {0: (), 1: (4, 11), 2: (4, 5, 6, 11, 3)}
# per-ribbon motion: wave strength, bend amplitude (hero px), S frequency, direction, phase offset. Thin loose ends move most
MOT = [(.10, 9, 1.2, 1, .0), (.12, 10, 1.1, -1, .3), (.10, 12, 1.4, 1, .55), (.16, 14, 1.6, -1, .15), (.08, 7, 1.0, 1, .7), (.10, 8, 1.2, -1, .45),
       (.09, 8, 1.1, 1, .9), (.12, 15, 1.5, -1, .2), (.14, 16, 1.7, 1, .6), (.10, 12, 1.3, -1, .8), (.13, 13, 1.5, 1, .35), (.08, 7, 1.0, -1, .05)]

_C = {}


def base():
    """the photo-driven albedos and details: identical for every frame, so held surfaces never shimmer between frames"""
    if _C: return _C
    rng = random.Random(303)
    ph = warp(lev(photo('squid_322.jpg', S, crop=(.28, .16, .78, .9))), rng, 18, 9); rg = rgbT(ph); dph = highpass(lumaT(ph), 8, 2.8)
    ph2 = warp(lev(photo('meat_134.jpg', S, crop=(.24, .08, .9, .92))), rng, 30, 8); d2 = highpass(lumaT(ph2), 8, 2.4); r2 = rgbT(ph2)
    ivory = grade(rg, (.13, .08, .07), (.52, .45, .37), (.86, .80, .68), contrast=1.0, keep=0)
    ivory = cmix(ivory, grade(r2, (.16, .03, .035), (.50, .24, .22), (.76, .62, .54), contrast=1.1, keep=0), ss(.5, .66, fbm(rng, 5, S, 3)) * .7)
    det = mix(dph, d2, .4); raw, rawd = rawmeat(rng, 'path_203.jpg', .9)
    gm = tornmask(rng, [(150, 150), (230, 120), (330, 200), (430, 210), (390, 330), (420, 410), (300, 390), (240, 470), (170, 400), (84, 390), (100, 300), (60, 240)], wide=9, amp=1.9, fine=.3)
    ghe = dome(gm, 20, 6) * .8 + ridged(rng, 5, S, 3) * .3 + (fbm(rng, 5, S, 3) - .5) * .9 * gm
    stain = [ss(.5, .68, fbm(random.Random(100 + i), 6, S, 3)) for i in range(len(RIBS) + 2)]
    rot = [fbm(random.Random(500 + i), 9, S, 3) for i in range(len(RIBS) + 2)]
    blood = grade(r2, (.05, .002, .004), (.30, .015, .02), (.55, .07, .06), contrast=1.4, keep=0)
    _C.update(ivory=ivory, det=det, raw=raw, rawd=rawd, gm=gm, ghe=ghe, stain=stain, rot=rot, blood=blood)
    return _C


def ribbon(cv, i, pts, w0, w1, q, B, seg=9):
    """one strobila with its cast shadow. Stains and rot grow with wound and death"""
    w, die, hurt = q['wound'], q['die'], q['hurt']
    wv, amp, kk, sg, po = MOT[i % len(MOT)]
    ph = q['ph'] + po
    pts = bendpath(pts, ph, amp * (1 + .5 * q['swell']) * (1 - .6 * die), kk, sg)
    hh, mm, cr = ribbon_maps(pts, w0 * (1 + .12 * q['swell']), w1, seg, ph=ph, wave=wv * (1 + .8 * q['swell'] + 1.2 * hurt), slide=math.sin(ph * 6.283) * 7)
    if die: mm = mm * ss(.36 + .2 * die, .42 + .2 * die, B['rot'][i] + .12)   # rotting through: holes eat the ribbon
    alb = cmul(B['ivory'], (1 - cr * .86) * (1 - ss(.3, 0, hh) * .55))
    st = B['stain'][i] * min(1.0, .3 + .32 * w + .4 * hurt + .5 * die)
    alb = cmix(alb, B['blood'], st)
    L = wet(alb, hh * .3 - cr * .03, mm, detail=B['det'], k=30, dk=3.0, ao=1.6, sss=.42 + .2 * w, sss_col=(.55, .06, .05), spec=.14, glint=.75,
            film=mm * (.4 + .15 * w), amb=.2, rim=.05, rim_col=(.5, .42, .3))
    cv = over(shadow(mm, 6, .85, 3, 6), cv); return over(L, cv), mm


def stump(cv, i, c, B, rng, length=.32):
    """a torn-off loop: the root stays, ending in a ragged raw cut that bleeds"""
    rr = random.Random(100 + i); pts = path(rr, *c)
    n = max(4, int(len(pts) * length)); pts = pts[:n]
    w0 = RIBS[i][0]; hh, mm, cr = ribbon_maps(pts, w0 * 1.05, w0 * .95, 9)
    tip = pts[-1]; cut = bump(tip[0], tip[1], w0 * 1.3) * mm
    alb = cmix(cmul(B['ivory'], 1 - cr * .8), B['raw'], ss(.05, .5, cut))
    alb = cmul(alb, 1 - ss(.5, .9, cut) * .7)
    L = wet(alb, hh * .3 - cut * .2, mm, detail=B['det'], k=30, dk=3.0, ao=1.6, sss=.6, spec=.3, film=mm * .7, amb=.2)
    cv = over(shadow(mm, 6, .85, 3, 6), cv); cv = over(L, cv)
    # what hangs off the cut: a short torn tag and a run of blood
    tg = outside_tatters(rng, [tip], (26, 60), (5, 9)); return over(tg, cv)


def crown(cv, q, B):
    """the scolex reared on its neck at the sneeze point, hook crown facing the player. fl opens the hooks and the pit"""
    fl = q['fl']; sx, sy = SNZ[0] + 26, SNZ[1] - 2; ivory, raw, rawd, det = B['ivory'], B['raw'], B['rawd'], B['det']
    neck = path(random.Random(3), (250, 190), (200, 150), (160, 200), (sx + 10, sy), n=20, wob=1)
    neck = bendpath(neck, q['ph'] + .4, 5, 1.0, 1)
    nh, nm, ncr = ribbon_maps(neck, 24 + 4 * max(0, fl), 20 + 3 * max(0, fl), seg=8, ph=q['ph'], wave=.12 + .1 * max(0, fl))
    cv = over(shadow(nm, 6, .85, 3, 6), cv)
    cv = over(wet(cmul(ivory, 1 - ncr * .8), nh * .36, nm, detail=det, k=30, dk=3.0, ao=1.6, sss=.42, spec=.14, film=nm * .4, amb=.2), cv)
    hr = 60 + 10 * max(0, fl) - 6 * max(0, -fl)
    hm = polys([rpoly(random.Random(8), sx, sy, hr, hr * .86, 18, j=.1, ang=.3)], soft=1.2)
    hh = dome(hm, 14, 4) * 1.1
    sk = random.Random(2); cups = [(sx + 8 + math.cos(a) * hr * .66, sy + math.sin(a) * hr * .62) for a in (.75, 5.5, 1.5, 4.8)]
    cm = polys([rpoly(sk, x, y, 12, 11, 12, j=.1) for x, y in cups], soft=1.2)
    halb = cmul(cmix(ivory, raw, .35 + .25 * q['wound']), 1 - cm * .92)
    hh = hh + cl(blur(cm, 5) * 2.2) * (1 - cm) * .2 - cm * .3
    ro = bump(sx - 8, sy, 40, 36); hh = hh + ro * .5
    # the rostellum is raw red and the pit black: the focal that survives at 52 px. The pit gapes on the flare, puckers shut on a clench
    pr = max(5.0, 22 + 14 * fl)
    pit = polys([rpoly(sk, sx - 8, sy, pr, pr * .9, 12, j=.2)], soft=1)
    halb = cmix(halb, col((.58, .04, .04)), cl(ro * 1.6) ** 1.2); halb = cmul(halb, 1 - pit * .97); hh = hh - pit * .3
    cv = over(shadow(hm, 7, .8, 3, 5), cv); cv = over(wet(halb, hh, hm, detail=rawd, k=48, dk=1.2, ao=2.2, sss=.4, spec=.6, film=hm * .6, amb=.15), cv)
    # hooks: two rings of curved ivory thorns; they lie back along the head when clenched, splay forward when flared
    hooks = []; ir = random.Random(9); N = 11; f2 = max(-1.0, fl)
    for ring, (rad, ln, wd) in enumerate(((30, 46 + 26 * f2, 13), (25, 28 + 12 * f2, 8))):
        for i in range(N):
            a = i / N * 6.283 + ring * .2 + ir.uniform(-.1, .1)
            if ir.random() < .16: continue
            b = a + (.55 - .35 * f2) * ir.uniform(.7, 1.2); L_ = max(8.0, ln * ir.uniform(.55, 1.2))
            x0, y0 = sx - 8 + math.cos(a) * rad, sy + math.sin(a) * rad * .92
            x1, y1 = x0 + math.cos(a) * L_ * .55, y0 + math.sin(a) * L_ * .55
            x2, y2 = x1 + math.cos(b) * L_ * .5, y1 + math.sin(b) * L_ * .5; x3, y3 = x2 + math.cos(b + .8) * L_ * .22, y2 + math.sin(b + .8) * L_ * .22
            hooks.append((bez((x0, y0), (x1, y1), (x2, y2), (x3, y3), 10), wd, .9))
    kh, km = vtubes(S, hooks, steps=4)
    cv = over(shadow(km, 3, .8, 1, 2), cv)
    kt = cmix(col((.86, .78, .60)), col((.20, .06, .05)), ss(.5, .72, fbm(ir, 18, S, 3)) * .8)
    if q['wound'] or q['hurt'] or q['spit']: kt = cmix(kt, col((.36, .02, .03)), ss(.5, .7, fbm(random.Random(19), 14, S, 3)) * min(1.0, .35 * q['wound'] + .5 * q['hurt'] + .4 * q['spit']))
    cv = over(wet(kt, kh * .5, km, k=14, sss=.1, sss_col=(.5, .1, .05), spec=.6, glint=.9, amb=.42, rim=.03), cv)
    return cv, (sx, sy)


def vent(cv, q, B, rng):
    """the birth vent: a round puncture torn in the gut wall, rim swollen and raw, black inside. On the heave the rim swells and
    reddens and pale larval heads crowd the dark; never a slit, no lips, no folds (D46)"""
    v, sw, gu = q['vent'], q['swell'], q['gush']
    vr = 30 + 30 * v - 12 * q['hurt']
    rimr = vr * (1.6 + .25 * sw)
    rm = polys([rpoly(random.Random(41), VX, VY, rimr, rimr * .94, 22, j=.2)], soft=2)
    rm = rm * ss(.4, .55, fbm(random.Random(42), 22, S, 3) + blur(rm, 6) * .6)   # a torn, crumbling edge, not a clean collar
    hole = polys([rpoly(random.Random(43), VX, VY, vr, vr * .92, 16, j=.22)], soft=1.2)
    collar = cl(blur(hole, 8) * 2.6) * (1 - hole)
    hh = bump(VX, VY, rimr, rimr * .94) * .7 + collar * (.35 + .3 * sw) - hole * .9 + (fbm(random.Random(44), 16, S, 3) - .5) * .25
    alb = cmix(cmul(B['raw'], .6 + .25 * sw), col((.40 + .1 * sw, .04, .04)), collar * (.4 + .4 * sw))
    alb = cmul(alb, 1 - ss(.2, .9, hole) * .985)
    cv = over(shadow(rm, 7, .9, 3, 5), cv)
    cv = over(wet(alb, hh, mx(rm, hole), detail=B['rawd'], k=40, dk=2.4, ao=2.4, sss=.7, spec=.5, film=mx(rm, hole) * (.6 + .4 * sw), amb=.14), cv)
    if sw > .3 and not gu:
        # crowding in the dark: blunt pale heads pressing at the opening
        r = random.Random(45); n = 2 + int(3 * sw)
        items = [(VX + r.uniform(-.45, .45) * vr, VY + r.uniform(-.4, .4) * vr, r.uniform(0, 6.28), vr * r.uniform(.5, .8), vr * .22, r.uniform(-.6, .6)) for _ in range(n)]
        Lg, mg = grubs(rng, items); clip = ss(.3, .7, hole)
        Lg = dict(rgb=cmul(Lg['rgb'], clip * (.6 + .4 * sw)), a=Lg['a'] * clip)
        cv = over(Lg, cv)
    return cv


def gutwound(cv, q, B, rng):
    """the gut split open behind the knot. A black cavity with raw red walls, a few distinct larvae and clot in the dark, blood
    running out over the lower lip. Replaces the concept's flat tan larva fill"""
    w, die = q['wound'], q['die']
    wid = (34 if w == 1 else 64) + 50 * die
    wt = tear(random.Random(61), wobble(random.Random(62), bez((350, 160), (310, 245), (268, 320), (214, 440 + 40 * die), 16), 7), wid, .32) * B['gm']
    if die: wt = mx(wt, tear(random.Random(63), wobble(random.Random(64), bez((150, 220), (210, 300), (300, 330), (420, 380), 14), 6), 40 * die, .4) * B['gm'])
    lip = cl(blur(wt, 9) * 2.2) * (1 - wt) * B['gm']
    deep = ss(.25, .85, blur(wt, 7)) * wt
    alb = cmix(B['raw'], cmul(B['raw'], .1), deep); alb = cmul(alb, 1 - deep * .9)
    hh = lip * .5 - deep * .8 + (fbm(random.Random(65), 20, S, 3) - .5) * .2
    m = mx(wt, lip * .9)
    cv = over(wet(alb, hh, m, detail=B['rawd'], k=36, dk=3, ao=3, sss=.8, spec=.55, film=m * .8, amb=.1), cv)
    # what is inside: a handful of separate larvae, half sunk in the black, each with its own shadow. Never a fill
    r = random.Random(66); n = 3 + 3 * w + int(6 * die); items = []
    for _ in range(n):
        u = r.uniform(.1, .9); x = 350 + (214 - 350) * u + r.uniform(-.4, .4) * wid; y = 160 + (440 - 160) * u + r.uniform(-14, 14)
        items.append((x, y, r.uniform(0, 6.28), r.uniform(26, 42), r.uniform(7, 10), r.uniform(-.9, .9)))
    Lg, mg = grubs(rng, items, colr=(.50, .40, .32)); vis = ss(.1, .6, blur(wt, 3))
    Lg = dict(rgb=cmul(Lg['rgb'], vis * (.55 + .45 * (1 - deep))), a=Lg['a'] * vis)
    cv = over(dict(rgb=(const(0, S),) * 3, a=shadow(mg, 4, .9, 2, 3)['a'] * vis), cv); cv = over(Lg, cv)
    # clot: dark glossy lumps between them
    cl_ = polys([rpoly(r, r.uniform(230, 340), r.uniform(200, 420), r.uniform(10, 20), r.uniform(8, 16), 10, j=.35) for _ in range(4 + 4 * w)], soft=1.5) * vis
    cv = over(wet(col((.16, .0, .01)), blur(cl_, 3) * .6, cl_, k=12, sss=.2, spec=.9, glint=1, film=cl_, amb=.15), cv)
    # blood: the split bleeds down out of its lower end, more with each stage
    cv = over(ropes(r, [(222, 420 + 30 * die), (250, 380)][:1 + (w > 1)], length=(60 + 40 * w, 110 + 60 * w), w=(7, 11), colr=(.30, .015, .02), bloody=1, web=0), cv)
    return cv


def paint(q0):
    q = dict(ph=0.0, vent=.2, swell=0.0, gush=0.0, fl=0.0, spit=0.0, hurt=0.0, wound=0, die=0.0); q.update(q0)
    B = base(); rng = random.Random(304 + int(q['wound']) * 7); cv = canvas(S)
    w, die = q['wound'], q['die']; gm = B['gm']
    # ruptured gut: a dark torn sleeve at the core, under everything so the ribbons bury it; it heaves with the swell
    galb = cmul(B['raw'], .5 + .06 * q['swell'])
    ghe = B['ghe'] * (1 + .4 * q['swell'])
    Lg = wet(galb, ghe, gm, detail=B['rawd'], k=56, dk=2.8, ao=2.5, sss=.6 + .15 * q['swell'], spec=.4 + .2 * q['swell'], film=gm * .7, amb=.12)
    # trailing mucus and blood ropes first, behind: grey-brown slime, never lime
    cv = over(ropes(random.Random(305), [(150, 430), (235, 470), (330, 400)], length=(100, 170), w=(11, 16), colr=(.36, .30, .22), bloody=.5 + .2 * w, web=1), cv)
    cv = over(Lg, cv)
    if w or die: cv = gutwound(cv, q, B, rng)
    cv = vent(cv, q, B, rng)
    drop = DROP[w] if not die else DROP[2] + ((6, 7) if die > .5 else ())
    for i, (w0, w1, c) in enumerate(RIBS):
        if i in drop:
            if w and i not in (3,): cv = stump(cv, i, c, B, rng, .3 if i % 2 else .22)
            continue
        rr = random.Random(100 + i); pts = path(rr, *c)
        if die:  # unravelling: the loose ends sag and the knot loosens downward
            pts = [(x + (x - 260) * .12 * die, y + ((y - 120) / 500.0) ** 2 * 90 * die) for x, y in pts]
        cv, _ = ribbon(cv, i, pts, w0, w1, q, B)
    cv, (sx, sy) = crown(cv, q, B)
    if q['vent'] > .5 or q['gush']:
        # the ribbon end tearing out of the vent: stretched, wet, raw at the root, with blood off the rim
        L_ = 40 + 90 * q['vent'] + 80 * q['gush']
        pts = path(random.Random(1), (VX + 4, VY), (VX - 26, VY + 6), (VX - 48, VY + 40), (VX - 34 - 10 * q['gush'], VY + L_ + 20), n=20)
        pts = bendpath(pts, q['ph'], 10, 1.4, 1)
        hh, mm, cr = ribbon_maps(pts, 18, 9, seg=8, ph=q['ph'], wave=.2)
        root = bump(VX, VY, 40) * mm
        cv = over(shadow(mm, 6, .8, 3, 6), cv)
        cv = over(wet(cmix(cmul(B['ivory'], 1 - cr * .8), B['blood'], root * .8), hh * .36, mm, detail=B['det'], k=30, dk=3.0, sss=.5, spec=.2, film=mm * .6, amb=.2), cv)
    if q['gush']:
        g = q['gush']; rr = random.Random(5)
        items = [(VX - rr.uniform(16, 30 + 70 * g), VY + rr.uniform(-28, 64 * g), rr.uniform(1.6, 4.4), rr.uniform(30, 46), rr.uniform(9, 12), rr.uniform(-.9, .9)) for _ in range(3 + int(5 * g))]
        Lgr, mgr = grubs(rng, items); cv = over(shadow(mgr, 3, .8, 1, 2), cv); cv = over(Lgr, cv)
        cv = over(spatter(rng, (VX - 40, VY + 16), int(16 + 18 * g), 40 + 50 * g, colr=(.32, .02, .025), rmin=3, rmax=7), cv)
        cv = over(spatter(rng, (VX - 30, VY + 10), 10, 50, colr=(.30, .26, .18), rmin=3, rmax=6), cv)
    if q['spit']:
        cv = over(spatter(rng, (sx - 60, sy), 30, 46, colr=(.38, .32, .2), rmin=3, rmax=6), cv)
        cv = over(spatter(rng, (sx - 40, sy + 6), 12, 30, colr=(.34, .02, .03), rmin=2, rmax=5), cv)
        cv = over(ropes(rng, [(sx - 20, sy + 10), (sx - 34, sy - 6)], length=(50, 80), w=(8, 11), colr=(.38, .32, .2), bloody=.4, web=0, lean=-.7), cv)
    elif q['fl'] > .5:
        # the crown wells up before it throws: strings of mucus between the hooks
        cv = over(ropes(rng, [(sx - 22, sy + 12)], length=(30, 50), w=(6, 8), colr=(.38, .32, .2), bloody=.3, web=0, lean=-.4), cv)
    if q['hurt']: cv = over(spatter(rng, (300, 260), 18 + 8 * w, 130, rmin=2, rmax=6), cv)
    if w: cv = over(spatter(random.Random(70 + w), (280, 280), 8 * w, 150, colr=(.26, .01, .02), rmin=2, rmax=5), cv)
    if die:
        cv = over(spatter(rng, (OX, OY), int(30 + 40 * die), 120 + 140 * die, rmin=3, rmax=9), cv)
        cv = over(outside_tatters(rng, [(170, 420), (280, 450), (360, 420)], (60 + 80 * die, 120 + 100 * die)), cv)
    return to_pil(cv)


if __name__ == '__main__':
    import time
    t0 = time.time(); im = paint(dict(sys.argv[2:] and json.loads(sys.argv[2]) or {})); print('paint', round(time.time() - t0, 2), 's')
    im.save(sys.argv[1] if len(sys.argv) > 1 else '/dev/null', 'PNG')
