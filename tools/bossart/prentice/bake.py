#!/usr/bin/env python3
"""THE BUTCHER'S APPRENTICE, Matt's pick c2 Grown Into the Blade, baked for the game. Run: python3 -I tools/bossart/prentice/bake.py
An adult carcass starved down to ribs and a knot of dried gut, hung on a hook through the skull; its fractured upper arm has
splintered into a pitted iron blade that is most of its silhouette. Never a child: adult ribs, no big head, no small round body.
Writes src/sprites/boss/prentice.png + .json. Origin is the boss's (0,0); the cleaver pivot is the sim's (-8,-6).
Lists: idle<w> (6 breaths) spit<w> (3 mouth frames) hurt<w> for wound stage w = 0, 1, 2; cap (the joint over the blade root);
blade (24 angles, e.ba -2.2 .. -4.05: every angle the sim ever sets); tell (4 heat levels x 4 angles near -2.4); die (7 frames).
The blade is painted once in its own frame, then its albedo, height and masks are rotated to each angle and LIT THERE, so the light
stays put while the iron turns (rotating a lit sprite turns its light with it; rotating pixels live smears them)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
from bake import Baker, bend, pad, smooth
AFF = Image.Transform.AFFINE

# ---- the baked canvas: 86 x 120 game px at 8x, boss origin at (60, 60) game. Room for every blade angle and the dead blade's drop
K8 = 8
E = (688, 960); OE = (480, 480)
AT_ = (OE[0] - OX, OE[1] - OY)           # where the body canvas S lands in E
PV = (-8, -6)                            # the sim's cleaver pivot (enemies/mid/prentice.ts sx, sy)
PS = G(*PV)                              # pivot on the body canvas
PE = (OE[0] + PV[0] * K8, OE[1] + PV[1] * K8)
DX = -40                                 # the concept's body, moved 5 game px left so its mouth sits on the sim's spit point (-4,-24)
SH = (352, 146)                          # the shoulder the broken humerus leaves from

# ======================================================================= body
def paint_body(q):
    R = lambda k: random.Random(2200 + k)
    dmg, hurt, mo, die = q.get('dmg', 0), q.get('hurt', 0), q.get('mouth', 0), q.get('die', 0)
    cv = canvas(S)
    body = blob(R(1), S, 328 + DX * 0, 338, 66, 128, rough=.42, lobes=6, ang=.12)
    chest = blob(R(2), S, 316, 170, 72, 96, rough=.40, lobes=6, ang=-.25)
    head = blob(R(3), S, 266, 92, 42, 34, rough=.36, lobes=6, ang=-.55)
    m = mx(mx(body, chest), head)
    if dmg >= 2: m = m * (1 - blob(R(4), S, 332, 450, 56 + 20 * die, 54 + 30 * die, rough=.4, lobes=4))
    pm = tex('path_368.jpg', R(5), crop=(.25, .1, .9, .9), amp=30, cells=7); bb, dd = tissue(pm, (.024,.003,.005), (.36,.024,.028), (.72,.28,.20), contrast=1.5, keep=.08)
    pc = tex('carcass_180.jpg', R(6), crop=(.30, .1, .62, .9), amp=20, cells=6); b2 = grade(rgbT(pc), (.018,.006,.006), (.27,.04,.03), (.62,.20,.12), contrast=1.5, keep=.08); d2 = highpass(lumaT(pc), 12, 2.2)
    pat = ss(.42, .60, fbm(R(7), 4, S, 4)); base = cmix(bb, b2, pat); det = mix(dd, d2, pat)
    # ribs under dried skin: a height field only, the body is starved down to them. Adult ribs: long, many, sprung
    rp = []; rr = R(8)
    for i, (y, l) in enumerate([(158, 1), (196, .7), (232, 1), (262, .45), (306, .9), (352, .6), (384, .35)]):
        y += rr.uniform(-6, 6); x1 = 384 - 118 * l; rp.append((bez((384, y - 14), (356, y - 10), (x1 + 30, y + 4), (x1, y + 26 + rr.uniform(-8, 8)), 12), rr.uniform(6, 9), rr.uniform(3, 6)))
    rh, rm = tubes(S, rp); h = dome(m, 26, 7) * .9 + rh * .22 * m - ridged(R(9), 8, S, 3) * .06 * m
    base = cmix(base, (.26, .15, .10), blur(rh, 1) * ss(.55, .95, rh) * .2)
    tear = const(0, S)
    if dmg >= 1: tear = blob(R(10), S, 320, 322, 44 + 30 * die + 6 * (dmg - 1), 88 + 50 * die + 10 * (dmg - 1), rough=.35, lobes=4, ang=.1) * m
    h = h - blur(tear, 3) * .4 + ring(tear, 7) * .14; base = cmix(base, (.60, .07, .06), cl(ring(tear, 7)))
    sock = blob(R(11), S, 272, 72, 11, 8, rough=.3, lobes=3); h = h - blur(sock, 2) * .3; base = cmul(base, 1 - sock * .97)
    if hurt: base = cmix(base, (.50, .03, .03), ss(.5, .8, fbm(R(50), 7, S, 3)) * m * .55 * hurt)
    Bd = flesh(base, h, m, det, film=film_map(R(12), S, m, 6) * .6, spec=.2, key=1.45)
    # dried gut hanging below; it lengthens as the belly gives way
    gr = R(13); of = []
    for x in [312, 340, 290, 356, 306][:2 + dmg * 2 if not die else 5]:
        of += gutpath(gr, x, 440 + gr.uniform(-10, 10), gr.uniform(-8, 8), 26 + dmg * 12 + die * 34, n=2 + dmg + int(die * 3), w=(6, 11), wob=16)
    O, om = limb(R(14), of, 'path_203.jpg', dict(shadow=(.015,.003,.005), mid=(.16,.03,.04), hi=(.44,.2,.18)), amt=.4, k=18); cv = over(O, cv)
    # the hook: an iron shaft from the chain down into the skull (the live chain meets it at (0,-20)), its point out through the jaw
    hk_h, hk_m = tubes(S, [(bez((290, 20), (292, 40), (288, 60), (282, 84), 10), 7, 6)])
    cv = over(metal(R(15), hk_m, hk_h * .8, 'rust_331.jpg', crop=(.25, .15, .85, .9), pal=((.02,.015,.012),(.24,.15,.10),(.60,.44,.32))), cv)
    cv = over(shadow(m, 6, .5, 2, 4), cv); cv = over(Bd, cv)
    if dmg:
        cv = over(dict(rgb=cmul((.01, .001, .002), tear), a=tear), cv)
        g = []
        for i in range(3 + dmg * 2 + int(die * 4)): g += gutpath(gr, gr.uniform(300, 350), gr.uniform(270, 380 + die * 40), gr.uniform(-20, 20), 24 + die * 30, n=2, w=(12, 18), wob=20)
        G_, gm = limb(R(17), g, 'path_203.jpg', dict(shadow=(.03,.004,.008), mid=(.32,.05,.06), hi=(.66,.34,.30)), amt=.3, k=18, film=const(.7, S))
        keep = cl(tear * 2) if not die else mx(cl(tear * 2), ss(.0, .3, (Y - 300) * (1 / 200)) * die)   # dying: the gut falls out past the lip
        cv = over(dict(rgb=cmul(G_['rgb'], keep), a=gm * keep), cv)
    hk2_h, hk2_m = tubes(S, [(bez((256, 104), (246, 104), (236, 98), (232, 88), 8), 5, 1.5)])   # the point, out through the jaw
    cv = over(metal(R(16), hk2_m, hk2_h, 'rust_331.jpg', pal=((.02,.015,.012),(.30,.18,.12),(.70,.52,.38)), glint=.9), cv)
    # mouth: a torn hole in a dried head, turned toward the blade. Fire inside when it spits
    gapm = rough(strokes([(bez((296, 94), (276, 92), (258, 96), (238, 104 + mo * 6), 8), 3 + mo * 5, 5 + mo * 11)]), R(18), .6, 22, 1.2, .35, .5)
    cv = hotmouth(cv, gapm, mo, R(39))
    # ---- the static upper arm: a broad, flat, fractured humerus from the shoulder down to the break at the pivot, gripped by torn muscle
    D = math.hypot(PS[0] - SH[0], PS[1] - SH[1]); dx_, dy_ = (PS[0] - SH[0]) / D, (PS[1] - SH[1]) / D; px_, py_ = -dy_, dx_
    Q = lambda t, n: (SH[0] + dx_ * D * t + px_ * n, SH[1] + dy_ * D * t + py_ * n)
    slab = polymask(S, [Q(*p) for p in [(0, -30), (.45, -24), (.80, -30), (1.08, -26), (.96, -14), (1.12, -4), (1.0, 4), (1.10, 16), (.92, 20), (1.04, 30), (.70, 26), (.40, 25), (0, 34)]], soft=.8)
    slab = slab * ss(.24, .32, fbm(R(29), 18, S, 2) + .12)
    pb = tex('shell_60.jpg', R(30), amp=12, cells=6); bbn = grade(rgbT(pb), (.10,.07,.045), (.46,.37,.24), (.80,.73,.55), contrast=1.5, keep=.0); dbn = highpass(lumaT(pb), 9, 2.4)
    if die: bbn = cmix(bbn, (.32, .03, .03), ss(.6, 1.1, (X - PS[0]) * (-1 / 60) + 1) * die)   # raw where the blade tore off
    cr = R(43); cracks = []
    for n0 in (-20, -7, 7, 19):
        pts = [Q(.05 + i * .15, n0 + cr.uniform(-5, 5)) for i in range(7)]; cracks.append((pts, 2.6, 1.2))
    _, crm = tubes(S, cracks); crm = crm * slab
    hs = slab * .42 + (fbm(R(44), 6, S, 3) - .5) * .12 * slab - blur(crm, 1) * .16
    Bn = wet(cmul(bbn, 1 - crm * .92), blur(hs, 1), slab, detail=dbn, k=22, dk=4, ao=5, sss=.08, spec=.2, shin=10, glint=.2, rim=.08, rim_col=HOT)
    cv = over(shadow(slab, 5, .7, 2, 4), cv); cv = over(Bn, cv)
    fan = None
    for n0, t1, wd in [(-26, .55, 18), (-6, .9, 12), (22, .75, 14)]:
        o = Q(.02, n0 * .6); e = Q(t1, n0 * .8)
        qm = rough(polymask(S, [(o[0] + px_ * wd, o[1] + py_ * wd), (o[0] - px_ * wd, o[1] - py_ * wd), e], soft=1), R(45 + wd), .75, 20, 1.5, .36, .48)
        fan = qm if fan is None else mx(fan, qm)
    cr_ = R(46); cap = strokes([(bez((SH[0] + cr_.uniform(-6, 18), SH[1] - 22 + j * 14), (SH[0] - 10, SH[1] + j * 9), (SH[0] - 34, SH[1] + 18 + j * 6), Q(cr_.uniform(.3, .55), (j - 1.5) * 12), 10), 14 - j * 2, 4) for j in range(4)])
    cap = rough(cap, R(47), .8, 18, 2, .36, .46)
    MM = mx(fan, cap)
    pc2 = tex('meat_146.jpg', R(32), crop=(.3, .25, .95, .95), amp=20, cells=6); cb, cd = tissue(pc2, (.022,.002,.004), (.32,.02,.024), (.68,.22,.16), contrast=1.5)
    Cr = flesh(cb, dome(MM, 9, 3) + (fbm(R(41), 12, S, 3) - .5) * .22 * MM, MM, cd, film=film_map(R(42), S, MM, 6), k=24, sss=.5)
    cv = over(shadow(MM, 4, .65, 2, 4), cv); cv = over(Cr, cv)
    if hurt:
        spr, _ = spray(R(33), 310, 300, n=30, spread=50); cv = over(spr, cv); cv = over(runs(R(34), [(300, 290), (332, 320), (320, 350)], 120, 6), cv)
    if dmg >= 1: cv = over(runs(R(52), [(300 + i * 13, 300 + (i % 2) * 40) for i in range(2 + dmg * 2)], 110 + 40 * dmg, 5, col=(.30, .01, .015)), cv)
    if dmg >= 2: spr, _ = spray(R(35), 310, 340, n=40, spread=90, r=(3, 9)); cv = over(spr, cv); cv = over(runs(R(36), [(310 + i * 9, 340 + (i % 3) * 30) for i in range(6)], 150, 7), cv)
    if die:
        spr, _ = spray(R(53), 320, 330, n=int(30 + 60 * die), spread=70 + 60 * die, r=(3, 10), col=(.34, .015, .018)); cv = over(spr, cv)
    return to_pil(cv)

def paint_cap():
    """the break: torn muscle wrapped over the joint and splinters of the humerus standing out of it. Drawn over the blade root"""
    R = lambda k: random.Random(2600 + k); cv = canvas(S)
    sp = []
    for a, L in [(-2.4, 24), (2.7, 18), (.9, 15)]:
        sp.append(([(PS[0] + math.cos(a) * 8, PS[1] + math.sin(a) * 8), (PS[0] + math.cos(a) * L, PS[1] + math.sin(a) * L)], 4.5, .6))
    sh_, sm = tubes(S, sp)
    pb = tex('shell_60.jpg', R(1), amp=12, cells=6)
    cv = over(wet(grade(rgbT(pb), (.08,.05,.035), (.34,.26,.17), (.66,.56,.42), contrast=1.4, keep=0), sh_ * .6, sm, k=16, sss=.05, spec=.3, shin=12, rim=.1, rim_col=HOT), cv)
    rr = R(2); wr = []
    for j in range(5):   # torn strips wound round the break, not a ball
        a0 = rr.uniform(0, 6.28); a1 = a0 + rr.uniform(1.6, 2.6); r0 = rr.uniform(9, 17)
        wr.append(([(PS[0] + math.cos(a0 + (a1 - a0) * i / 8) * r0 * (1 + .25 * math.sin(i)), PS[1] + math.sin(a0 + (a1 - a0) * i / 8) * r0 * .8) for i in range(9)], rr.uniform(5, 8), rr.uniform(1.5, 3)))
    mm = rough(strokes(wr), R(3), .7, 18, 1.5, .38, .48)
    pc2 = tex('meat_146.jpg', R(4), crop=(.3, .25, .95, .95), amp=20, cells=6); cb, cd = tissue(pc2, (.03,.002,.004), (.36,.02,.024), (.72,.24,.17), contrast=1.5)
    cv = over(shadow(mm, 3, .7, 1, 3), cv)
    cv = over(flesh(cb, dome(mm, 5, 2) * .6 + (fbm(R(5), 14, S, 3) - .5) * .3 * mm, mm, cd, film=film_map(R(6), S, mm, 7), k=22, sss=.6), cv)
    return to_pil(cv)

# ======================================================================= the blade, painted in its own frame
# local canvas: blade along +x from the pivot, edge up (-y), spine down. 60 x 28 game px; the pivot at local (6, 18) game
LS = (480, 224); LP = (48, 144)
LX, LY = coords(LS)
BL, BW, U0 = 344, 160, 56                # blade length, width, where the iron starts past the pivot (hero px)
HAND = (LP[0] + U0, LP[1])
SP_, ED_ = -BW * .28, BW * .72           # spine and edge, across the blade from the pivot line (edge side positive)

def lfbm(rng, c, o=4, aspect=1.0): return fbm(rng, c, LS, o, aspect=aspect)
def lpoly(pts, soft=1.0): return polymask(LS, pts, soft=soft)

def blade_maps(heat):
    """everything the blade is, in its own frame, unlit: albedo, height, detail, masks and the tints laid on after lighting"""
    R = lambda k: random.Random(3300 + k)
    rng = R(19)
    P = lambda a, b: (HAND[0] + a, HAND[1] - b)
    pts = [P(4, SP_)]
    for i in range(1, 8): pts.append(P(4 + (BL - 4) * i / 8, SP_ + rng.uniform(-BW * .014, BW * .014)))
    pts += [P(BL - BL * .04, SP_ + BW * .02), P(BL, SP_ + BW * .16), P(BL + rng.uniform(-3, 3), SP_ + BW * .6), P(BL - BL * .05, ED_ - BW * .22 * .3)]
    N = 26; cut = {rng.randrange(1, N - 1): rng.uniform(.5, 1.0) for _ in range(11)}
    for i in range(1, N):
        f = 1 - i / N; b = ED_ - BW * .22 * .3 * f ** 3 - (cut.get(i, 0) * BW * .07) + rng.uniform(-BW * .006, BW * .006)
        pts.append(P(4 + (BL * .95 - 4) * f, b))
    pts += [P(4, ED_), P(-2, ED_ * .55)]
    m = lpoly(pts, .7)
    V = cl(((LY - HAND[1]) * -1 - SP_) * (1 / (ED_ - SP_))); U = cl((LX - HAND[0]) * (1 / BL))
    m = m * (1 - blob(R(37), LS, HAND[0] + BL * 1.08, HAND[1] + 46, 34, 44, rough=.5, lobes=6)) * ss(.30, .36, lfbm(R(38), 12, 3) + (1 - ss(.0, .06, V)) * -.2 + ss(.0, .05, V) * .4)
    holes = ss(.70, .735, lfbm(R(20), 10, 2)) * ss(.08, .22, V) * (1 - ss(.72, .80, V))
    M = m * (1 - holes)
    pr = tex('rust_107.jpg', R(22), crop=(0, .05, 1, .98), amp=12, cells=6, rot=90, size=LS)
    br = grade(rgbT(pr), (.012,.010,.010), (.12,.075,.06), (.42,.25,.17), contrast=1.8, keep=.10); dr = highpass(lumaT(pr), 14, 2.2)
    pr2 = tex('rust_331.jpg', R(23), crop=(.28, .15, .78, .9), amp=14, cells=6, size=LS); d2r = highpass(lumaT(pr2), 10, 2.0)
    hb = M * .5 + ss(.0, .06, V) * .12 - ss(.66, 1.0, V) * .34 * M + (lfbm(R(24), 3, 3) - .5) * .30 * M + ss(.5, .75, lfbm(R(25), 9, 3)) * .04
    edge = ss(.91, .96, V) * M; bev = ss(.56, .90, V) * M
    streak = ss(.40, .60, lfbm(R(26), 5, 4, aspect=.5))
    tb = bev * cl(streak + .25) * .95
    te = edge * (.55 + .45 * ss(.3, .55, lfbm(R(27), 22, 2)))
    th = bev * .5 * ss(.1, .7, U) * heat
    # the splintered end of the humerus, fused across the blade's root: long shards running onto the iron
    sl = lpoly([(30, 116), (70, 110), (104, 100), (156, 92), (126, 116), (178, 126), (134, 138), (172, 158), (118, 160), (80, 172), (30, 170)], .8)
    sl = sl * ss(.24, .32, lfbm(R(29), 18, 2) + .12)
    pb = tex('shell_60.jpg', R(30), amp=12, cells=6, size=LS); bbn = grade(rgbT(pb), (.10,.07,.045), (.46,.37,.24), (.80,.73,.55), contrast=1.5, keep=.0); dbn = highpass(lumaT(pb), 9, 2.4)
    cr = R(43); cracks = []
    for y0 in (118, 132, 148, 160):
        cracks.append(([(34 + i * 22, y0 + cr.uniform(-5, 5)) for i in range(7)], 2.6, 1.2))
    _, crm = tubes(LS, cracks); crm = crm * sl
    hs = sl * .42 + (lfbm(R(44), 6, 3) - .5) * .12 * sl - blur(crm, 1) * .16
    # torn muscle: frayed flat strips from the break, biting onto the blade either side of the bone
    fan = None
    for off, ext, wd in [(-50, 26, 22), (-38, 96, 14), (34, 118, 16), (52, 40, 20), (66, 8, 18)]:
        e = (HAND[0] + ext, HAND[1] - off); o = (LP[0] + 6, LP[1] - off * .35)
        qm = ss(.36, .48, blur(lpoly([(o[0], o[1] + wd), (o[0], o[1] - wd), e], soft=1), 1.5) + (lfbm(R(45 + ext), 20, 3) - .5) * .75) * ss(.02, .10, blur(lpoly([(o[0], o[1] + wd), (o[0], o[1] - wd), e], soft=1), 8))
        fan = qm if fan is None else mx(fan, qm)
    pc2 = tex('meat_146.jpg', R(32), crop=(.3, .25, .95, .95), amp=20, cells=6, size=LS); cb, cd = tissue(pc2, (.022,.002,.004), (.32,.02,.024), (.68,.22,.16), contrast=1.5)
    fh = dome(fan, 9, 3) + (lfbm(R(41), 12, 3) - .5) * .22 * fan
    ffilm = ss(.48, .68, lfbm(R(42), 6, 4)) * fan
    return dict(M=M, br=br, hb=blur(hb, .8), det=mix(dr, d2r, .4), tb=tb, te=te, th=th,
                sl=sl, bn=cmul(bbn, 1 - crm * .92), hs=blur(hs, 1), dbn=dbn, fan=fan, cb=cb, cd=cd, fh=fh, ffilm=ffilm, heat=heat)

def rot(t, ang, off=(0, 0)):
    """a local map turned to angle ang (canvas radians, the sim's e.ba) about the pivot, on the baked canvas E"""
    c, s = math.cos(ang), math.sin(ang); px, py = PE[0] + off[0], PE[1] + off[1]
    data = (c, s, LP[0] - c * px - s * py, -s, c, LP[1] + s * px - c * py)
    return T(t.im.transform(E, AFF, data, BIC, fillcolor=0))

def blade_layer(mp, ang, off=(0, 0)):
    """the blade lit at angle ang: the light comes from the same place at every angle"""
    r = lambda t: rot(t, ang, off); r3 = lambda c3: tuple(r(q) for q in c3)
    M = cl(r(mp['M']))
    Bl = wet(r3(mp['br']), r(mp['hb']), M, detail=r(mp['det']), k=20, dk=1.9, ao=5, sss=0, spec=.5, shin=9, glint=.28, rim=.2, rim_col=HOT)
    heat = mp['heat']
    col = cmix(Bl['rgb'], cmul((.44, .016, .02), M), r(mp['tb']))
    col = cmix(col, cmul((.74 + heat * .2, .50 - heat * .46, .42 - heat * .40), M), cl(r(mp['te']) * (1 + heat * .4)))
    if heat: col = cadd(col, cmul((.95, .06, .02), r(mp['th'])))
    cv = over(shadow(M, 9, .5, 3, 6), canvas(E)); cv = over(dict(rgb=col, a=M), cv)
    sl = cl(r(mp['sl']))
    cv = over(shadow(sl, 5, .7, 2, 4), cv)
    cv = over(wet(r3(mp['bn']), r(mp['hs']), sl, detail=r(mp['dbn']), k=22, dk=4, ao=5, sss=.08, spec=.2, shin=10, glint=.2, rim=.08, rim_col=HOT), cv)
    fan = cl(r(mp['fan']))
    cv = over(shadow(fan, 4, .65, 2, 4), cv)
    cv = over(flesh(r3(mp['cb']), r(mp['fh']), fan, r(mp['cd']), film=r(mp['ffilm']), k=24, sss=.5), cv)
    return cv

# ======================================================================= motion
def breathe(im, f, sway):
    """the starved chest heaves and the gut sways; the hooked head and the arm's break hold still (the cap and the blade sit there)"""
    def fn(x, y):
        gx, gy = (x - OE[0]) / K8, (y - OE[1]) / K8
        keep = smooth(4, 12, math.hypot(gx - PV[0], gy - PV[1])) * smooth(-24, -16, gy)
        c = math.exp(-((gx - 4) ** 2 / 70 + (gy + 8) ** 2 / 140))
        dx = (gx - 4) * .07 * f * c + sway * smooth(16, 34, gy) * (gy - 16) * .09
        dy = -.7 * f * c + .4 * f * smooth(10, 30, gy)
        return (dx * K8 * keep, dy * K8 * keep)
    return bend(im, fn)
def slump(im, k):
    """dying: it sags off the hook, the belly and gut stretch down"""
    def fn(x, y):
        gy = (y - OE[1]) / K8
        return (0, k * k * 7 * K8 * smooth(-22, 30, gy))
    return bend(im, fn)

BLADE_A = [-2.2 - i * 1.85 / 23 for i in range(24)]   # matches render/gross/mid/prentice.ts A0, AN, NA
def main():
    b = Baker('prentice', E, (86, 120), OE)
    P = lambda im: pad(im, E, AT_)
    for w in range(3):
        q = dict(dmg=w)
        idle = P(paint_body(q))
        for i in range(6): b.add(f'idle{w}', breathe(idle, i / 5, (i / 5 - .5) * .8))
        for i, mo in enumerate((.35, .7, 1.0)): b.add(f'spit{w}', breathe(P(paint_body(dict(q, mouth=mo))), .3 + .1 * i, .2))
        b.add(f'hurt{w}', breathe(P(paint_body(dict(q, hurt=1))), .6, -.3))
        print('body', w, flush=True)
    capim = P(paint_cap()); b.add('cap', capim)
    mp = blade_maps(0)
    for a in BLADE_A: b.add('blade', to_pil(blade_layer(mp, a)))
    print('blade', flush=True)
    for hv in (.25, .5, .75, 1.0):
        mh = blade_maps(hv)
        for a in BLADE_A[:4]: b.add('tell', to_pil(blade_layer(mh, a)))
    print('tell', flush=True)
    # the death: the arm drops, the blade tears out of the break and falls away, the gut lets go and it sags off the hook
    ANG = [-2.3, -2.85, -3.5, -4.1, -4.25, -4.35, -4.4]; DROP = [(0, 0), (0, 0), (0, 0), (-4, 16), (-10, 48), (-16, 80), (-22, 104)]
    for k in range(7):
        body = slump(P(paint_body(dict(dmg=2, hurt=1, die=k / 6))), k / 6)
        cv = from_pil(body)
        cv = over(blade_layer(mp, ANG[k], DROP[k]), cv)
        if k < 3: cv = over(from_pil(capim), cv)
        b.add('die', to_pil(cv))
    b.save(1024)

if __name__ == '__main__':
    import time; t0 = time.time()
    if len(sys.argv) > 1 and sys.argv[1] == 'probe':
        # quick look: one body, one blade angle, timing
        mp = blade_maps(float(sys.argv[4]) if len(sys.argv) > 4 else 0); t1 = time.time(); L = blade_layer(mp, float(sys.argv[3]) if len(sys.argv) > 3 else -2.3); print('blade', time.time() - t1)
        cv = over(L, from_pil(pad(paint_body(dict(dmg=0)), E, AT_))); cv = over(from_pil(pad(paint_cap(), E, AT_)), cv)
        to_pil(cv).save(sys.argv[2]); print(time.time() - t0)
    else:
        main(); print(round(time.time() - t0), 's')
