#!/usr/bin/env python3
"""THE DISSOLVING WOMB, Matt's pick c2 The Torn Placenta, baked for the game. Run: python3 -I tools/bossart/cyst/bake.py
Placenta, cord and membrane only (D46: nothing shaped like a person). Writes src/sprites/boss/cyst.png + .json.
Lists: idle<w> tell<w> gey<w> swell<w> hurt<w> for w = wound stage 0, 1, 2, and die. Origin is the boss's (0,0)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
from bake import Baker, bend, pad, smooth
KK = 22.0
INS = (246, 168)   # where the cord enters the plate
def tree(rng, root, trunks):
    """chorionic vessels: thick trunks leaving the cord insertion, forking outward, tapering. Returns tube paths"""
    out = []
    def go(x, y, a, w, life, depth):
        pts = [(x, y)]
        for i in range(life):
            a += rng.gauss(0, .16); x += math.cos(a) * 15; y += math.sin(a) * 15; pts.append((x, y))
            if depth < 3 and rng.random() < .14 and i > 1:
                go(x, y, a + rng.choice((-1, 1)) * rng.uniform(.5, 1.0), w * .62, int(life * .6), depth + 1)
        out.append((pts, w, w * .2))
    for a, w, l in trunks: go(root[0], root[1], a, w, l, 0)
    return out
def paint(q):
    rng = random.Random(4201); wr = random.Random(4202); sr = random.Random(4203)
    tell, gey, sw, hurt, wound, die = (q.get(n, 0) for n in ('tell', 'gey', 'sw', 'hurt', 'wound', 'die'))
    ph = tissue('path_204.jpg', rng, 26, 9, crop=(.02,.02,.98,.98), bul=(240, 260, 300, .6)); ph2 = tissue('path_201.jpg', rng, 22, 8); ph3 = tissue('meat_146.jpg', rng, 22, 8, crop=(.38,.2,.98,.95))
    det = highpass(lumaT(ph), 12, 2.4); det2 = highpass(lumaT(ph3), 8, 2.0)
    # rod
    rod = polymask(S, [(0, 26), (480, 12), (480, 44), (0, 58)], soft=1.5)
    prust = photo('rust_107.jpg', S, crop=(.2,.2,.8,.5))
    Lrod = wet(grade(rgbT(prust), (.012,.01,.01), (.09,.06,.05), (.32,.2,.14), keep=.15), blur(rod, 6) * .6, rod, detail=highpass(lumaT(prust), 8, 2), k=16, dk=5, sss=0, spec=.15)
    # slab: a flap hanging from the rod, torn on the lower edge, a big bite on the right
    sx = 1 + .05 * sw
    base = polymask(S, [(122, 34), (186, 14), (262, 22), (330, 12), (378, 40), (430, 108), (466, 214), (446, 318), (398, 392), (332, 470), (250, 506), (168, 540), (96, 468), (30, 360), (8, 232), (56, 110)], soft=9)
    m = ss(.32, .6, base + (fbm(rng, 6, S, 4) - .5) * 1.0)
    bites = ragged_holes(rng, S, [(452, 300, 44, 44), (40, 402, 40, 70), (340, 500, 62, 56), (70, 110, 26, 38)], rough=.45, lobes=7)
    m = m * (1 - bites)
    if die: m = m * (1 - ragged_holes(wr, S, [(120, 400, 110 * die, 150 * die), (390, 240, 74 * die, 150 * die), (240, 480, 110 * die, 80 * die)], rough=.5, lobes=6))
    tears = const(0, S); tlip = const(0, S)
    if wound:
        full = ragged_holes(random.Random(204), S, [(92, 230, (34 + 26 * die) * wound, (84 + 40 * die) * wound), (140, 400, (50 + 26 * die) * wound, (40 + 44 * die) * wound), (376, 330, 46 * wound, (72 + 30 * die) * wound)], rough=.7, lobes=7) * m
        tlip = cl(blur(full, 9) * 2.0) * (1 - full) * m
        tears = full; m = m * (1 - full)
    # cotyledons
    vr = random.Random(99); seeds = [(vr.uniform(20, 460), vr.uniform(40, 520)) for _ in range(19)]
    F1, F2, ID = voronoi(99, S, seeds)
    F2w = F2 + (fbm(rng, 18, S, 3) - .5) * 22
    lob = ss(0, 26, F2w)
    h = dome(m, 30, 8) * .7 + lob * .42 * m + ss(.45,.8,fbm(rng, 16, S, 3)) * .08
    # the fold over the rod
    Y = coords(S)[1]; fold = ss(66, 48, Y) * ss(14, 44, Y)
    h = h + fold * .34
    alb = grade(rgbT(ph), (.018,.002,.004), (.15,.007,.013), (.36,.030,.032), contrast=1.5, keep=.02)
    alb = cmix(alb, (const(.012,S), const(.002,S), const(.004,S)), (1 - lob) * .85)
    # white fibrin plaques: the only pale on the surface beyond the vessels
    fib = ss(.62, .8, lumaT(ph2)) * ss(.5, .68, fbm(rng, 7, S, 4)) * m
    alb = cmix(alb, grade(rgbT(ph2), (.20,.11,.10), (.46,.31,.28), (.72,.60,.54), contrast=1.3, keep=.0), fib * .88)
    # vessel tree: raised, sheathed in pale fibrin, converging on the cord
    tr = random.Random(310)
    tp = tree(tr, INS, [(.35, 14, 15), (1.0, 17, 20), (1.75, 16, 22), (2.5, 15, 17), (3.2, 12, 12), (-.25, 12, 13)])
    hv, mv = tubes(S, tp); hv = hv * m; mv = mv * m
    if sw: hv = hv * 1.25
    lob = lob * (1 - .35 * sw)
    h = h + hv * .42
    vc = cmix((const(.44,S), const(.25,S), const(.25,S)), (const(.13,S), const(.016,S), const(.03,S)), ss(.5, .92, hv))
    # trunks are dark blood in a pale sheath: edge pale, core dark: survives at 50 px as a pale tree
    alb = cmix(alb, vc, mv * .95)
    bloodfill = (const(.42,S), const(.012,S), const(.014,S))
    if hurt or sw: alb = cmix(alb, bloodfill, (mv * .9 + (1 - lob) * m * .7) * (hurt * .9 + sw * .55))
    if wound:
        rawc = grade(rgbT(ph3), (.10,.004,.006), (.46,.03,.03), (.82,.26,.2), contrast=1.5, keep=.02)
        alb = cmix(alb, rawc, tlip); h = h + tlip * .12
    film = film_map(rng, S, m, 5, .4, .6)
    L = wet(alb, h, m, detail=det, k=KK, dk=3.2, ao=6, sss=.65, film=film, spec=.15, rim=.04)
    cv = over(fade(shadow(m, 7, .6, 0, 8), 1), canvas(S)); cv = over(Lrod, cv); cv = over(shadow(m, 6, .4), cv)
    # the veil: amnion trailing to the lake in tatters
    vn = fbm(rng, 9, S, 4, aspect=.13)
    vg = random.Random(66)
    veil = tatters(vg, S, [(150, 470, 230, 56), (92, 410, 170, 26), (232, 490, 262, 40), (306, 448, 200, 44), (388, 370, 200, 24), (186, 500, 170, 18)])
    veil = veil * ss(.28, .46, fbm(rng, 16, S, 3, aspect=.3)) * (1 - m)
    alv = grade(rgbT(ph2), (.05,.015,.02), (.20,.09,.10), (.42,.26,.25), keep=0)
    Lv = wet(alv, blur(veil, 3) * .5 + vn * .3, veil, k=KK, dk=2, sss=.5, sss_col=(.3,.03,.04), film=veil, spec=.25)
    cv = over(Lv, cv); cv = over(L, cv)
    # wounds
    # the cord: three vessels twisted round each other, from the insertion up to a cut end at the spout
    cx, cy = SPOUT
    c0 = bez((INS[0], INS[1] + 4), (INS[0] + 24, INS[1] - 30), (cx + 34, cy + 28), (cx, cy), 60)
    # thick jelly first, then the twist
    hj, mj = tubes(S, [(c0, 42, 36)])
    twists = []
    for ph_ in (0, 2.09, 4.19):
        pts = []
        for i, (x, y) in enumerate(c0):
            t = i / 60; pts.append((x + math.cos(t * 16 + ph_) * (28 - 6 * t), y + math.sin(t * 16 + ph_) * 9))
        twists.append((pts, 13, 10))
    ht, mt = tubes(S, twists)
    hc = hj * .9 + ht * .45
    bc = cmix(grade(rgbT(ph2), (.20,.11,.11), (.52,.36,.34), (.80,.66,.60), contrast=1.2, keep=0), (const(.22,S), const(.025,S), const(.05,S)), mt * ss(.2,.8,ht))
    cv = over(shadow(mj, 9, .85, 3, 8), cv)
    Lc = wet(bc, hc, mj, detail=highpass(lumaT(ph2), 6, 2), k=12, dk=2.5, ao=5, sss=.4, spec=.45, film=mj, shin=44.)
    cv = over(Lc, cv)
    op = 1 + .28 * tell + .6 * gey + .1 * sw + .15 * wound
    lm = blob(wr, S, cx, cy, 38 * op, 26 * op, rough=.22, lobes=9, ang=-.3)
    Ll = wet(grade(rgbT(ph3), (.10,.012,.014), (.36,.05,.05), (.62,.16,.14), keep=0), blur(lm, 5) * .9, lm, k=10, spec=.5, film=lm, sss=.3)
    cv = over(Ll, cv)
    hl = blob(wr, S, cx, cy + 1, 25 * op, 15 * op, rough=.4, lobes=8, ang=-.3)
    cv = over(dict(rgb=(hl * .02, hl * .003, hl * .005), a=hl), cv)
    if tell:
        Fh = Image.new('L', S, 0); dd = ImageDraw.Draw(Fh)
        for i in range(18):
            a = sr.uniform(0, 6.28); d = sr.uniform(4, 30); r = sr.uniform(3, 9); xx = cx + math.cos(a) * d; yy = cy + math.sin(a) * d * .55 - 4
            dd.ellipse((xx - r, yy - r, xx + r, yy + r), fill=255)
        fm = blur(T(Fh.convert('F')) * (1 / 255), 1.5)
        cv = over(wet((const(.52,S), const(.3,S), const(.22,S)), fm * .5, ss(.1,.5,fm), k=10, spec=.9, film=fm), cv)
    if gey:
        p = [(bez((cx, cy + 4), (cx + 4, cy - 26), (cx - 6, cy - 50), (cx + 2, 0), 16), 15, 6), (bez((cx - 8, cy), (cx - 24, cy - 26), (cx - 34, cy - 50), (cx - 30, 4), 12), 6, 1.5), (bez((cx + 8, cy), (cx + 26, cy - 24), (cx + 34, cy - 40), (cx + 44, 2), 12), 6, 1.5)]
        hj2, mj2 = tubes(S, p); cv = over(wet((const(.58,S), const(.08,S), const(.08,S)), hj2, mj2, k=7, spec=.9, sss=.2, film=mj2), cv)
    if hurt or wound or die:
        pts = [(sr.uniform(40, 440), sr.uniform(120, 440)) for _ in range(int(4 + 6 * wound + 14 * die))] + [(INS[0] + sr.uniform(-40, 40), INS[1] + 40) for _ in range(3)]
        Lb, _ = blood_runs(sr, S, pts, maxlen=230 + 200 * die, w=6 + 4 * die); cv = over(Lb, cv)
    if die:
        Lg, _ = strands(sr, S, [(sr.uniform(40, 440), sr.uniform(300, 500)) for _ in range(24)], col=(.32,.02,.03), maxlen=300, w=7, sway=22); cv = over(Lg, cv)
    Ls, _ = strands(random.Random(12), S, [(random.Random(i).uniform(70, 410), random.Random(i * 3 + 1).uniform(420, 500)) for i in range(11)], col=(.26,.08,.09), maxlen=250, w=3.2, sway=20)
    cv = over(Ls, cv)
    return to_pil(cv)

# the painted canvas is 50x80 game px: pad it so the swell (1.22x) and the fall have room. 70x90 game px, origin at (35, 35)
E = (672, 864); AT_ = (96, 67); O = (OX + AT_[0], OY + AT_[1])
WOUND = (0, .55, 1)
def breathe(im, f, amp=1.0, sway=0.0):
    """the flap hangs from the rod: nothing moves at the rod, the torn hem and veil most. f 0..1 is the depth of the breath"""
    def fn(x, y):
        d = max(0.0, (y - (O[1] - 250)) / 760); dx = (x - O[0])
        return (dx * .018 * f * amp * math.sin(d * 3.1) + sway * d * d * 34 * math.sin(d * 5 + f * 2.4),
                f * amp * 7 * d - abs(dx) * .004 * f * amp * d)
    return bend(im, fn)
def writhe(im, ph, amp=1.0):
    """the cord alone squirms: a falloff round the spout, phase running along it"""
    cx, cy = SPOUT[0] + AT_[0], SPOUT[1] + AT_[1]
    def fn(x, y):
        r = math.hypot(x - cx, y - cy - 40) / 150; k = max(0.0, 1 - r); k = k * k
        return (math.sin(y * .03 + ph) * 15 * amp * k, math.cos(x * .025 + ph * 1.3) * 7 * amp * k)
    return bend(im, fn)
def swell(im, k):
    """the bloat: round the slab's middle, the rod end stays hung, so it lifts off the bar and bulges"""
    def fn(x, y):
        dx, dy = x - O[0], y - (O[1] - 30); r = math.hypot(dx / 300, dy / 350); g = smooth(1.5, .2, r) * .22 * k * 1.3
        return (dx * g, dy * g * .92)
    return bend(im, fn)
def main():
    b = Baker('cyst', E, (70, 90), O)
    for w, wv in enumerate(WOUND):
        q = dict(wound=wv)
        idle = pad(paint(q), E, AT_)
        for i in range(5): b.add(f'idle{w}', breathe(idle, i / 4, 1.0 + .15 * w, sway=.5 * math.sin(i * .9)))
        tell = pad(paint(dict(q, tell=1)), E, AT_)
        for i in range(4): b.add(f'tell{w}', writhe(tell, i * 1.57, 1.0))
        gey = pad(paint(dict(q, gey=1)), E, AT_)
        for i in range(3): b.add(f'gey{w}', writhe(gey, i * 2.1, .7))
        for i in range(4):
            k = (i + 1) / 4; b.add(f'swell{w}', swell(pad(paint(dict(q, sw=k)), E, AT_), k))
        b.add(f'hurt{w}', breathe(pad(paint(dict(q, hurt=1)), E, AT_), .5))
    # the death: it tears along the lobes, then the plate slides off the rod and folds. The halves carry this list as they tumble
    for i in range(6):
        k = i / 5; v = pad(paint(dict(wound=1, die=.35 + .65 * k, hurt=1)), E, AT_)
        def slide(x, y, k=k):
            d = max(0.0, (y - (O[1] - 250)) / 760)
            return ((x - O[0]) * -.1 * k * d, k * k * 60 * (.4 + d))
        b.add('die', bend(v, slide))
    b.save(512)
if __name__ == '__main__':
    main()
