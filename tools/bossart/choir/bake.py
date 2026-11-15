#!/usr/bin/env python3
"""THE NAIL CHOIR, Matt's pick c3 The Enucleated Eye, baked for the game. Run: python3 -I tools/bossart/choir/bake.py
An eye cut out of its socket: six torn muscles, orbital fat, a trailing nerve, the cornea frosted blind, and it follows you.
Writes src/sprites/boss/choir.png + .json. Origin is the boss's (0,0); the cornea sits on the fan origin (-10, 0).
Lists (w = wound stage 0, 1, 2):
  idle<w>   body, strap twitch + nerve sway (ping-pong)      tell<w>  body, straps drawn tight and trembling
  hurt<w>   body on a hit, fresh slits and blood              g<w>     the globe alone, 16 gaze angles (index = angle / 22.5 deg)
  t<w>      the globe on the tell: pupil blown, blood under the frost, 16 angles   gh<w>  the globe on a hit (one gaze)
  die       7 frames: the globe tears and collapses, straps rip away, frost goes red, it slumps
  bar0/bar1 a nailbar (whole / torn), 4 ripple frames         sing0/sing1  the nails singing, 4 glint levels
The globe lists are cropped to the globe and drawn over the body, so the body frames never move inside the globe (bend falls off
to zero there) and the crop always lands on the same sclera."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
from bake import Baker, bend, pad, smooth

NA = 16                                   # gaze angles
CG = P(-3, -1); R0 = 15.5 * SC            # globe centre and radius (hero px): the hit circle r13 sits under it
# the six straps (c3): (p0, p1, p2, p3, w0, w1). Back ones first, the two that cross the globe are drawn after it
BACK = [(P(3, -13), P(10, -30), P(20, -20), P(27, -36), 30, 20), (P(9, -4), P(26, -5), P(26, -16), P(37, -12), 28, 16),
        (P(-11, -11), P(-20, -20), P(-18, -28), P(-27, -33), 27, 13), (P(-10, 9), P(-24, 12), P(-24, 20), P(-35, 20), 28, 14),
        (P(8, 10), P(13, 24), P(4, 24), P(6, 37), 30, 15)]
FRONT = [(P(-7, -14.5), P(-5, -22), P(1, -26), P(-3, -37), 26, 14), (P(5, 12), P(16, 19), P(16, 26), P(22, 33), 29, 14)]
NERVE = bez(P(10, 6), P(26, 10), P(20, 28), P(30, 40), 26)
TIPS = [s[3] for s in BACK] + [s[3] for s in FRONT] + [NERVE[-1]]

_T = {}
def tissues():
    "the photo albedos and detail maps, graded once"
    if _T: return _T
    r = random.Random(303)
    mus = warp(photo('meat_146.jpg', S, crop=(.3, .2, .95, .98), rot=30), r, 18, 8)
    _T['MU'] = grade(rgbT(mus), (.03, .003, .006), (.26, .018, .02), (.56, .12, .09), contrast=1.7, keep=.05); _T['md'] = highpass(lumaT(mus), 6, 3)
    fat = warp(photo('path_199.jpg', S, crop=(.05, .05, .9, .8)), r, 26, 8)
    _T['FA'] = grade(rgbT(fat), (.09, .05, .025), (.40, .32, .17), (.68, .60, .42), contrast=1.5, keep=.05); _T['fd'] = highpass(lumaT(fat), 9, 2.8)
    cf = warp(photo('path_196.jpg', S), r, 20, 9)
    _T['FA2'] = grade(rgbT(cf), (.10, .04, .03), (.45, .36, .24), (.78, .70, .55), contrast=1.5, keep=.04); _T['fd2'] = highpass(lumaT(cf), 8, 3)
    ner = warp(photo('path_364.jpg', S, crop=(.54, .1, .97, .95), rot=40), r, 18, 8)
    _T['NV'] = grade(rgbT(ner), (.10, .07, .06), (.40, .33, .27), (.74, .66, .55), contrast=1.5, keep=.05); _T['nd'] = highpass(lumaT(ner), 6, 3)
    sclp = warp(photo('path_365.jpg', S, crop=(.1, .15, .85, .8)), r, 14, 9)
    _T['SCL'] = grade(rgbT(sclp), (.07, .025, .02), (.24, .12, .09), (.46, .33, .25), contrast=1.5, keep=.05)   # grey-yellow, dead, never white
    _T['sd'] = highpass(lumaT(sclp), 9, 1.8)
    _T['haze'] = fbm(random.Random(72), 7, S, 4); _T['hn'] = fbm(random.Random(73), 30, S, 3); _T['blot'] = fbm(random.Random(74), 6, S, 4)
    return _T

_IR = {}
def iris(pup):
    if pup not in _IR: _IR[pup] = iris_tex(random.Random(5151), 512, pup, (.30, .20, .13), (.09, .07, .07), (.48, .38, .26))
    return _IR[pup]

def gaze(a): return (.6 * math.cos(a), .6 * math.sin(a), .8)
DEF = 8   # the default gaze, straight at the player's side (180 deg): the body frames carry it

def scene(q):
    """the damage map for a state. q: w wound stage, hurt (a fresh hit), die 0..1"""
    w, hurt, die = q.get('w', 0), q.get('hurt', 0), q.get('die', 0)
    s = Scene(3030 + 7 * w + 3 * hurt)
    if w >= 1: s.tear(9, -11, 5, 2.2, .8, lobes=8); s.tear(12, 8, 6, 2, -.4, lobes=8)     # slit sclera
    if w >= 2: s.tear(6, -8, 9, 6, .9); s.tear(16, 12, 6, 4, .2); s.bite(-30, -16, 6, 5)  # the globe ruptured, a strap end bitten off
    if hurt:
        for x, y, rx, ry, a in ((9, -11, 5, 2.2, .8), (12, 8, 6, 2, -.4), (2, 10, 5, 1.8, .3), (14, -2, 4, 2, 1.2), (-4, 11, 5, 2, -.2))[w * 2: w * 2 + 2 + (w == 2)]:
            s.tear(x, y, rx, ry, a, lobes=8)
    if die:
        k = die; s.tear(4, 3, 12 * k, 12 * k, .2); s.bite(26, -18, 8 * k, 8 * k); s.bite(-20, 22, 8 * k, 7 * k); s.bite(-30, 2, 4 * k, 9 * k)
        if k > .5: s.tear(-12, -6, 6 * k, 9 * k, .5); s.bite(14, 30, 7 * k, 6 * k)
    return s

def build(q):
    """everything that does not depend on the gaze: behind (nerve, fat, back straps, the globe's shadow), the globe prep and
    the front layers (crossing straps, blood). Returns a dict the globe pass re-stacks per angle"""
    T_ = tissues(); s = scene(q); w, hurt, die = q.get('w', 0), q.get('hurt', 0), q.get('die', 0)
    MU, md = T_['MU'], T_['md']
    # optic nerve: the long tail, thick at the globe, twists off down right, cut
    nh, nm = tubes(S, fibres(random.Random(32), NERVE, 24, 15, n=13, fray=.14 + .3 * die, flare=1.2))
    s.add(T_['NV'], nh * .42, nm, det=T_['nd'], sh_r=0, k=16, dk=5, ao=2.5, sss=.5, sss_col=(.5, .02, .03), spec=.3)
    # orbital fat: a greyed lobed mass clinging behind and low, uneven, not a halo
    r = random.Random(31); lobs = []
    for i in range(120):
        ang = r.uniform(-1.3, 2.6); rd = r.uniform(.4, 1.05)
        x = 8 + math.cos(ang) * 19 * rd; y = 4 + math.sin(ang) * 19 * rd
        qq = r.uniform(1.6, 3.8) * SC; px, py = P(x, y); lobs.append(([(px, py), (px + .5, py + .5)], qq, qq))
    lh, fm = tubes(S, lobs, steps=5); lh = blur(lh, 3); fm = rough(fm, r, S, .2, 30, r=2)
    fb = cmix(T_['FA'], T_['FA2'], ss(.4, .6, fbm(r, 5, S, 3))); fb = cmix(fb, (const(.24, S), const(.03, S), const(.03, S)), ss(.5, .1, lh) * .55)
    rm = rime(r, fm, S, .32, c=18)
    if die: fb = cmix(fb, (const(.30, S), const(.02, S), const(.025, S)), cl(rm * 2.4 * die))   # the frost goes red
    fb = frosted(cmix(cmul(fb, .62), (const(.12, S), const(.10, S), const(.10, S)), .3), rm * (1 - die), S)
    s.add(fb, blur(fm, 16) * .3 + lh * .3, fm, det=mix(T_['fd'], T_['fd2'], .5), sh_r=0, k=20, dk=8, ao=3, sss=.5, sss_col=(.46, .03, .03), spec=.32, film=film_map(r, S, fm, 10))
    # back straps: wound 2 has lost one (a torn stump on the globe), dying rips them away one by one
    keep = [1.0] * 5
    if w >= 2: keep[2] = .32
    if die: keep[1] = 1 - .7 * smooth(.15, .4, die); keep[4] = 1 - .7 * smooth(.5, .8, die); keep[2] = .32 * (1 - smooth(.3, .6, die)) + .05
    for i, (a, b, c, d, w0, w1) in enumerate(BACK):
        for L in strap(s, random.Random(40 + i), bez(a, b, c, d, 18), w0, w1, MU, md, keep=keep[i]): s.lay(L)
    # globe prep
    R = R0 * (.97 if w >= 2 else 1)
    dent = [(CG[0] + R * .55, CG[1] - R * .65, R * .5, .14)]
    if die: dent += [(CG[0] + R * .1, CG[1] - R * .1, R * .95, .34 * die), (CG[0] - R * .5, CG[1] + R * .5, R * .6, .2 * die)]
    nz, gm, rr = globe(random.Random(71), CG[0], CG[1], R, lump=.09 + .13 * die, dent=dent, squash=.96 - .22 * die)
    vm = veinnet(random.Random(70), S, gm, n=26 + 10 * w, w0=3.6, branch=.1, seedpts=[(CG[0] + math.cos(a) * R * .92, CG[1] + math.sin(a) * R * .92) for a in [i * .42 for i in range(15)]])
    behind = over(shadow(gm, 12, .95), s.cv)
    # front: the two straps that cross the globe (tendon fans white into the sclera), then blood
    front = []
    fk = [1.0, 1.0]
    if die: fk = [1 - .75 * smooth(.3, .55, die), 1 - .6 * smooth(.6, .9, die)]
    for i, (a, b, c, d, w0, w1) in enumerate(FRONT):
        front += strap(s, random.Random(60 + i), bez(a, b, c, d, 18), w0, w1, MU, md, sh=7, keep=fk[i])
    rr_ = random.Random(80 + w)
    if w >= 1: front.append(runs(rr_, S, [P(8, -9), P(11, -11), P(13, 9), P(9, 10)], 80, 5))
    if w >= 2: front.append(runs(rr_, S, [P(3, -3), P(9, -5), P(15, 14), P(18, 14), P(-30, -15)], 170, 8))
    if hurt: front.append(runs(random.Random(90 + w), S, [P(10, -10), P(13, 8), P(3, 10), P(-3, 11)], 110, 6, col=(.42, .015, .02)))
    if die:
        dr = random.Random(95); front.append(runs(dr, S, [(dr.uniform(P(-14, 0)[0], P(14, 0)[0]), dr.uniform(P(0, -6)[1], P(0, 14)[1])) for _ in range(int(4 + 12 * die))], 120 + 200 * die, 7 + 3 * die))
    return dict(s=s, q=q, behind=behind, front=front, nz=nz, gm=gm, rr=rr, vm=vm, R=R)

def globe_layers(B, ai, tell=0.0):
    """the globe lit at gaze index ai. tell: the pupil blows wide and blood seeps under the frost"""
    T_ = tissues(); s, q = B['s'], B['q']; die = q.get('die', 0); w = q.get('w', 0)
    nz, gm, rr, vm, R = B['nz'], B['gm'], B['rr'], B['vm'], B['R']
    g = gaze(ai / NA * 2 * math.pi)
    fl = tell
    vm2 = blur(vm, 5)
    blotch = ss(.46, .68, T_['blot']) * ss(.2, .95, rr)
    scl = cmix(T_['SCL'], (const(.26, S), const(.022, S), const(.02, S)), cl(blotch * .82 + fl * .42 * ss(.1, .9, rr) + .2 * w * ss(.3, .9, rr)))
    scl = cmix(scl, (const(.32, S), const(.03, S), const(.03, S)), cl(vm2 * (.6 + .25 * fl)))
    scl = cmix(scl, (const(.10, S), const(.006, S), const(.01, S)), vm * .9)
    scl = cmul(scl, 1 - ss(.72, 1.0, rr) * .55)   # limb darkening: no pale disc against the fat
    sa = .60; ic = (CG[0] + g[0] * R * .80, CG[1] + g[1] * R * .80); Rd = R * sa
    pup = .72 if die else .36 + .26 * fl
    ot, pm, im = iris(round(pup, 2))
    ot = project(ot, ic, Rd, g); pm = project(pm, ic, Rd, g); im = project(im, ic, Rd, g)
    I = rgbT(ot); IM = L2T(im) * gm; PM = L2T(pm) * gm
    base = cmix(scl, I, IM); base = cmix(base, (const(.006, S), const(.002, S), const(.003, S)), PM)
    # frost on the cornea: pale milk and feathering cracks, densest off the pupil. It clouds the eye; the black still reads through
    haze = T_['haze']; milk = cl(.42 + (haze - .5) * .9) * IM * (1 - PM * .86)
    r = random.Random(5150); cr = Image.new('L', S, 0); dc = ImageDraw.Draw(cr)
    for i in range(24):
        a = r.uniform(0, 6.283); x, y = ic[0] + math.cos(a) * Rd * .28 * g[2], ic[1] + math.sin(a) * Rd * .3; dirn = a
        for j in range(r.randint(5, 12)):
            dirn += r.gauss(0, .33); nx_ = x + math.cos(dirn) * r.uniform(5, 12) * (g[2] + .25); ny_ = y + math.sin(dirn) * r.uniform(5, 12)
            dc.line((x, y, nx_, ny_), fill=255, width=r.choice((1, 2, 2, 3))); x, y = nx_, ny_
    crT = L2T(cr) * IM
    frost_c = (const(.82 - .5 * die, S), const(.90 - .8 * die, S), const(.94 - .8 * die, S))   # dying: the frost goes red
    base = cmix(base, frost_c, cl(milk * 1.5))
    base = cmix(base, (const(.84 - .4 * die, S), const(.92 - .85 * die, S), const(.98 - .85 * die, S)), crT * .9)
    if fl or die or w >= 2:   # blood seeping under the frost
        base = cmix(base, (const(.28, S), const(.02, S), const(.02, S)), IM * (1 - PM) * ss(.45, .6, haze) * (.55 * max(fl, die, .4 * (w >= 2))))
    h = nz * (R / 22.0) * .72 + (T_['hn'] - .5) * .02 + IM * .06 + vm * .03
    return s.part(base, h, gm, det=T_['sd'], sh_r=0, k=22, dk=2, ao=1.6, sss=.32, sss_col=(.55, .03, .03), spec=.1, shin=90, glint=.6, film=gm * .12, key=s.key * .82)

def compose(B, ai, tell=0.0):
    return stack(stack(B['behind'], globe_layers(B, ai, tell)), B['front'])

def crop_globe(B, cv):
    "the composite masked to the globe: what the runtime draws over the body at this gaze"
    im = to_pil(cv); a = im.getchannel('A'); m = (cl(B['gm']) * 255).im.convert('L').point(lambda v: 255 if v > 127 else 0)
    from PIL import ImageChops
    im.putalpha(ImageChops.multiply(a, m)); return im

# ---------------------------------------------------------------- motion (bend falls to zero over the globe)
def far(x, y):
    r = math.hypot(x - CG[0], y - CG[1]); return smooth(R0 * 1.12, R0 * 2.3, r)

def twitch_fn(f, seed, tense=0.0, amp=1.0):
    """strap twitch and nerve sway. f 0..1 is how far into the motion; each strap starts at its own delay so they never move as one.
    tense pulls every tip in toward the globe (the tell)"""
    rg = random.Random(seed); A = []
    for i, (tx, ty) in enumerate(TIPS):
        d0 = rg.uniform(0, .45); a = rg.uniform(10, 22) * rg.choice((-1, 1)) * amp
        A.append((tx, ty, d0, a))
    def fn(x, y):
        k = far(x, y)
        if k <= 0: return (0.0, 0.0)
        dx = dy = 0.0
        for i, (tx, ty, d0, a) in enumerate(A):
            wgt = math.exp(-((x - tx) ** 2 + (y - ty) ** 2) / (2 * 95 ** 2))
            if wgt < .01: continue
            vx, vy = tx - CG[0], ty - CG[1]; l = math.hypot(vx, vy); vx /= l; vy /= l
            e = smooth(d0, d0 + .55, f) * a
            if i == len(A) - 1: dx += -vy * e * 1.4 * wgt; dy += vx * e * 1.4 * wgt   # the nerve swings wider
            else: dx += -vy * e * wgt; dy += vx * e * wgt
            dx -= vx * tense * 22 * wgt; dy -= vy * tense * 22 * wgt
        return (dx * k, dy * k)
    return fn

def slump(k):
    "dying: it sags and the straps hang"
    def fn(x, y):
        r = math.hypot(x - CG[0], y - CG[1]); f = far(x, y)
        return ((x - CG[0]) * -.04 * k * f, k * k * 26 + r * .22 * k * f)
    return fn

# ---------------------------------------------------------------- the nailbar
BS = (200, 320); BO = (124, 160)
def bp(x, y): return (BO[0] + x * SC, BO[1] + y * SC)
def bar(torn=0, glint=0.0):
    """a torn sheet of tendon and muscle, tacked up with long rusted nails that point at the player"""
    T_ = tissues(); r = random.Random(11); bx, by = BO
    s = Scene(1100, BS)
    if torn: s.tear(.5, -3, 2.2, 5, .3, at=bp); s.bite(2.5, 9, 2.5, 3.5, at=bp)
    y0 = by - 118; pl = [(bx - 20 + r.uniform(-10, 4), y0 + i * 40) for i in range(7)]; pr = [(bx + 22 + r.uniform(-6, 12), y0 + i * 40) for i in range(7)]
    m = ss(.46, .54, blur(polymask(BS, pl + pr[::-1]), 3) + (fbm(r, 14, BS, 4) - .5) * .36)
    ten = warp(photo('path_364.jpg', BS, crop=(.54, .1, .97, .95), rot=80), r, 14, 8)
    b = grade(rgbT(ten), (.10, .07, .06), (.40, .32, .26), (.76, .68, .56), contrast=1.5, keep=.04)
    mus = warp(photo('meat_146.jpg', BS, crop=(.3, .2, .95, .98), rot=30), r, 12, 6)
    MU = grade(rgbT(mus), (.03, .003, .006), (.26, .018, .02), (.56, .12, .09), contrast=1.7, keep=.05)
    b = cmix(b, MU, ss(.4, .6, fbm(r, 4, BS, 3)))
    s.add(b, blur(m, 10) * .42 * m, m, det=highpass(lumaT(mus), 6, 3), sh_r=0, k=20, dk=7, ao=3, sss=.5, sss_col=(.45, .02, .04))
    its = []
    for i in range(5):
        y = by - 98 + i * 48 + r.uniform(-7, 7); its.append((bx + 16, y + r.uniform(-6, 6), bx - 72 + r.uniform(-6, 6), y + r.uniform(-8, 8), 9, r.uniform(-3, 3)))
    if torn: its[3] = (its[3][0], its[3][1], its[3][2] + 30, its[3][3] + 26, 9, 14)   # one nail knocked crooked
    nl, nm = nails(random.Random(12), BS, its, glint, heads=[(i[0], i[1], 12) for i in its], grade_dark=1.5)
    s.lay(shadow(nm, 3, .6, 1, 2)); s.lay(nl)
    rb = random.Random(13)
    s.lay(runs(rb, BS, [(i[0] - 4, i[1] + 6) for i in its[::2]] + ([bp(.5, 0), bp(1, -4)] if torn else []), 60 + 60 * torn, 4))
    return to_pil(s.cv)

def ripple(ph):
    def fn(x, y):
        return (math.sin(y * .028 + ph) * 5 * smooth(-20, 60, x - (BO[0] - 30)), math.cos(x * .03 + ph) * 2)
    return fn

def main():
    b = Baker('choir', S, (90, 100), (OX, OY), colors=200)
    for w in range(3):
        B = build(dict(w=w))
        body = to_pil(compose(B, DEF)); print('stage', w, 'body')
        for i in range(6): b.add(f'idle{w}', bend(body, twitch_fn(i / 5, 500 + w, amp=1 + .25 * w)))
        for i in range(3): b.add(f'tell{w}', bend(body, twitch_fn(.6 + .2 * i, 700 + i * 13 + w, tense=1.0, amp=.55)))
        for ai in range(NA): b.add(f'g{w}', crop_globe(B, compose(B, ai)))
        for ai in range(NA): b.add(f't{w}', crop_globe(B, compose(B, ai, 1.0)))
        H = build(dict(w=w, hurt=1)); hb = compose(H, DEF)
        b.add(f'hurt{w}', to_pil(hb)); b.add(f'gh{w}', crop_globe(H, hb)); print('stage', w, 'done')
    for i in range(7):
        k = i / 6; D = build(dict(w=2, hurt=1, die=.15 + .85 * k))
        b.add('die', bend(to_pil(compose(D, DEF)), slump(k)))
    print('die done')
    for torn in (0, 1):
        im = bar(torn); at = (OX - BO[0], OY - BO[1])
        for i in range(4): b.add(f'bar{torn}', pad(bend(im, ripple(i * 1.57)), S, at))
        for gl in (.35, .6, .85, 1.0): b.add(f'sing{torn}', pad(bar(torn, gl), S, at))
    b.save(1024)

if __name__ == '__main__':
    main()
