#!/usr/bin/env python3
"""THE BLOATED BITCH (crux), Matt's pick c5 Engorged Frost Leech, baked for the game. Run: python3 -I tools/bossart/crux/bake.py
A blood-gorged leech clamped at both ends to a bent iron stake, the crop distended with frozen blood. Writes
src/sprites/boss/crux.png + .json, read by src/render/gross/crux.ts. Origin is the boss's (0,0); a nail bar's frames are
offset to the bar's own origin (ox = -24 - 7i, oy 0), so the runtime draws each at the bar entity.
Lists, for wound stage w (0 shielded, 1 heart bared, 2 under half hp):
  stake (the iron alone) | idle<w> peristalsis, 6 | fan<w> spike-fan tell, 3 | fanr<w> release, 2 | ring<w> ring tell, 3 |
  ringr<w> release, 2 | hurt<w> flinch, 2 | heart1 heart2 beat, 4 | glob2 neck tell (ph2 globs), 2 | die, 9 |
  nail<i>_<s> bar i at damage stage s (0 whole, 1 bent, 2 tearing out), 2 quiver frames each.
D46: a parasite, nothing female: no teats, no udder, no human form."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
from bake import Baker, bend, pad, smooth

PATH = [(30, 35, 10), (22, 33, 13), (8, 30, 20), (-8, 22, 25), (-14, 5, 26), (-8, -11, 25), (3, -25, 17), (9, -37, 11), (16, -46, 7.5), (22, -51, 6)]
def spline(n=12):
    out = []; P = PATH
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
        for k in range(n):
            t = k / n
            out.append(tuple(.5 * (2 * p1[q] + (p2[q] - p0[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t * t + (3 * p1[q] - p0[q] - 3 * p2[q] + p3[q]) * t ** 3) for q in range(3)))
    out.append(P[-1]); return out
CS = spline()
cx, cy = HEART
# attack sources, boss-local, from enemies/update.ts crux: fan (-26,-4), rings (+-26,+28), ph2 globs (+-10,-50), spiral (0,-6)
FAN_P = (-28, -4); RL_P = (-25, 28); RR_P = (27, 29); GLOB_P = (11, -46)

# ---------------------------------------------------------------- the nails: one geometry shared by the body's holes and the bars
NR = random.Random(606)
NAILS = spike_set(NR, lambda y: G(-26, 0)[0], 4, wid=(9.5, 12))   # bar b = 0 longest; sim bar i = 3 - b
def bar_nails(i): b = 3 - i; return NAILS[b * 4:(b + 1) * 4]
def bar_ox(i): return -24 - 7 * i

_C = {}
def once(key, f):
    if key not in _C: _C[key] = f()
    return _C[key]

def stake_layer():
    rng = random.Random(505)
    sk = rope(wander(rng, G(14, -65), G(24, -47), 8, 4) + wander(rng, G(24, -47), G(38, -6), 10, 4)[1:] + wander(rng, G(38, -6), G(33, 30), 8, 5)[1:] + wander(rng, G(33, 30), G(24, 50), 7, 3)[1:], 19, 13, 1.0, .1, rng, 13)
    ih, im = tubes(S, sk); ra, rd = iron_mat(rng, name='rust_386.jpg', crop=(.1, .1, .9, .9))
    fr = ss(.55, .78, fbm(rng, 24, S, 3)) * im
    ra = cmix(ra, C((.58, .68, .78)), fr * .55)                     # rime in the pits of the iron
    return wet(ra, ih, im, detail=rd, k=13, dk=4, amb=.22, sss=0, spec=.5, glint=1.1, rim=.5, rim_col=(.5, .6, .72))

def body_base():
    """the state-independent body: mask, height, skin albedo, crop, vessels, detail"""
    rng = random.Random(505)
    sp_ = []
    for i in range(0, len(CS) - 1, 2):
        a, b = CS[i], CS[min(i + 2, len(CS) - 1)]
        sp_.append(([G(a[0], a[1]), G(b[0], b[1])], a[2] * 8, b[2] * 8, 1.0))
    bh, bm = tubes(S, sp_, steps=10)
    M = ss(.3, .7, blur(bm, 2.5) + (fbm(rng, 18, S, 3) - .5) * .25)
    im2 = Image.new('L', S, 0); d = ImageDraw.Draw(im2)
    for i in range(0, len(CS) - 1):
        a, b = CS[i], CS[i + 1]; dx, dy = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dy) or 1; nx, ny = -dy / l, dx / l
        steps = 2 if a[2] > 18 else 3
        for s_ in range(steps):
            t = s_ / steps; px = a[0] + dx * t; py = a[1] + dy * t; r = a[2] * 1.1
            q0 = G(px - nx * r, py - ny * r); q2 = G(px + nx * r, py + ny * r); q1 = G(px + dx / l * r * .25, py + dy / l * r * .25)
            d.line(bez(q0, q1, q1, q2, 10), fill=255, width=6 if a[2] < 18 else 5)
    ann = blur(T(im2.convert('F')) * (1 / 255), .9) * M
    crop = blur(blob(random.Random(3), S, cx - 22, cy + 34, 138, 168, rough=.34, lobes=4, ang=.15), 34) * M
    sp1 = tex('leech_234.jpg', rng, crop=(.2, .18, .85, .9), rot=24, wa=22, wc=7); spk = tex('rust_386.jpg', rng, wa=18, wc=7)
    skin = grade(rgbT(spk), (.006, .006, .010), (.045, .040, .050), (.22, .17, .15), contrast=1.8, keep=.03)
    skin = cmix(skin, C((.10, .012, .018)), crop * .45)
    skin = cmul(skin, 1 - ann * .9 * (1 - crop * .6))
    h = blur(bm, 2) * .25 + bh * 1.4 + volume(M, 90, 40, 8, 2.2, .5, .1) - ann * .11 * (1 - crop * .6) + blur(crop, 12) * .4
    v = veinnet(rng, S, crop, n=24, w0=5.5, branch=.12, seedpts=[(cx, cy), (cx - 70, cy + 40), (cx + 50, cy - 40), (cx - 50, cy + 110)])
    det = mix(highpass(lumaT(sp1), 10, 2.4), highpass(lumaT(spk), 7, 2.2), .5)
    clots = lumaT(tex('path_200.jpg', rng, wa=26, wc=8))
    film = film_map(rng, S, M, 7, .55, .75)
    # the nail punctures: every nail of every bar went in here. Under a live bar they hide under its lip; a dead bar leaves them
    hm = Image.new('L', S, 0); dd = ImageDraw.Draw(hm)
    for q in NAILS:
        (rx, ry), r = q[0][0], q[1] * 1.3
        dd.ellipse((rx - r * 1.3, ry - r, rx + r * .9, ry + r), fill=255)
    holes = blur(T(hm.convert('F')) * (1 / 255), 1.2) * M
    return dict(M=M, h=h, skin=skin, crop=crop, v=v, det=det, clots=clots, film=film, ann=ann, holes=holes)

def suckers():
    rng = random.Random(77)
    sk1 = shape(rng, [(16, -55), (24, -58), (29, -52), (27, -47), (19, -46)], 16, 10, 2); sk2 = shape(rng, [(22, 29), (31, 24), (41, 28), (39, 37), (30, 44), (23, 39)], 18, 10, 2)
    return sk1, sk2

def sucker_layer(su, clench=0.0):
    rng = random.Random(78)
    suh = volume(su, 16, 8, 3, .9, .5, .3) * (1 + clench * .3); fold = ridged(rng, 22, S, 2) * su
    return wet(cmul(C((.10, .035, .04)), 1 - fold * (.7 + clench * .2)), suh - fold * .05, su, k=20, dk=3, amb=.12, sss=.4, sss_col=(.45, .02, .03), spec=.8, glint=1.3, film=su * .7, rim=.4, rim_col=(.42, .52, .66))

def rupture(seed, x, y, r, k=1.0):
    """an attack source tearing open: swollen lips round a wet dark hole, the blood in it lit from inside. Returns (layer, swell)"""
    rng = random.Random(seed)
    m = blob(rng, S, x, y, r, r * .8, rough=.45, lobes=5)
    core = blob(rng, S, x - r * .1, y, r * .62, r * .45, rough=.4, lobes=5) * m
    swell = cl(blur(m, r * .9) * 1.6) * (1 - m * .6)
    lip = cl(blur(m, 4) * 2.2) * (1 - core)
    p = tex('path_196.jpg', rng, wa=14, wc=9)
    alb = grade(rgbT(p), (.04, .003, .006), (.34, .02, .03), (.74, .16, .12), contrast=1.6, keep=.02)
    L = wet(alb, blur(lip, 3) * .8 - core * .4, lip, detail=highpass(lumaT(p), 6, 2.4), k=14, sss=.7, sss_col=(.7, .03, .03), spec=.8, film=lip, amb=.12, rim=0)
    hot = blur(core, r * .25) * core
    inner = dict(rgb=(core * .03 + hot * (.75 * k), core * .002 + hot * (.05 * k), core * .004 + hot * (.04 * k)), a=core)
    return over(L, inner), swell

def heart_(seed, x, y, r, beat=1.0, vivid=1.0):
    """the exposed heart: a lopsided lump of muscle with short, dark, clotted vessel stumps (never pale fingers, never a Valentine)"""
    rng = random.Random(seed)
    m = blob(rng, S, x, y + r * .08, r * .92 * beat, r * 1.12 * beat, rough=.17, lobes=3, ang=.42)
    m2 = blob(rng, S, x + r * .5, y - r * .62, r * .42 * beat, r * .36 * beat, rough=.2, lobes=4)
    stumps = []
    for a, l, w in [(-1.95, .55, .26), (-1.15, .38, .2), (-.35, .3, .15)]:
        x0, y0 = x + math.cos(a) * r * .55, y + math.sin(a) * r * .75
        x1, y1 = x0 + math.cos(a + rng.uniform(-.4, .4)) * r * l, y0 + math.sin(a) * r * l
        stumps += rope(bez((x0, y0), (x0 + 4, y0 - 8), (x1 - 6, y1 + 6), (x1, y1), 10), r * w, r * w * 1.25, .7, .2, rng, 4)
    th, tm = tubes(S, stumps)
    M = mx(smooth_union([m, m2], 4), tm)
    p = tex('path_200.jpg', rng, wa=18, wc=8, bul=(x, y, r * 1.6, .7))
    alb = grade(rgbT(p), (.05, .002, .005), (.36 * vivid, .012, .018), (.70, .10, .08), contrast=1.8, keep=.03)
    v = veinnet(rng, S, M, n=9, w0=5, seedpts=[(x + r * .2, y - r * .7), (x - r * .5, y - r * .4), (x, y)])
    alb = cmix(alb, C((.04, .004, .02)), v * .8)
    alb = cmix(alb, C((.16, .02, .03)), tm * .8)
    hh = blur(M, r * .5) * 1.5 + dome(M, r * .38, r * .1) + th * .25 + blur(v, 1.2) * .06 + ss(.5, .8, fbm(rng, 6, S, 3)) * .10 * M
    L = wet(alb, hh, M, detail=highpass(lumaT(p), 10, 2.6), k=24, dk=5, ao=5, amb=.14, key=1.1, sss=.5, sss_col=(.8, .02, .02), spec=.7, film=film_map(rng, S, M, 7), glint=1.3, rim=0)
    # the stump ends: black clot plugs
    ends = Image.new('L', S, 0); d = ImageDraw.Draw(ends)
    for sp in stumps[-1::-4][:3]:
        ex, ey = sp[0][-1]; rr = sp[2] * .8; d.ellipse((ex - rr, ey - rr * .7, ex + rr, ey + rr * .7), fill=255)
    em = blur(T(ends.convert('F')) * (1 / 255), 1.5)
    L = over(dict(rgb=(em * .02, em * .002, em * .004), a=em * .9), L)
    return L, M

def paint(st):
    """one body state -> straight RGBA PIL at S, the stake NOT included (it never bends). st keys: wnd 0/.45/1, tell (fan),
    rtell (rings), frel, rrel, glob, hurt, die 0..1"""
    g = lambda k: st.get(k, 0)
    wnd, die, tell, rtell, hurt = g('wnd'), g('die'), g('tell'), g('rtell'), g('hurt')
    B = once('base', body_base)
    M, h, crop, skin = B['M'], B['h'], B['crop'], B['skin']
    rng = random.Random(909)
    # attack sources: a rupture swelling open in the skin, live blood light in it
    pores = []
    if tell: pores.append((G(*FAN_P), 12 + 20 * tell, .4 + .6 * tell))
    if g('frel'): pores.append((G(*FAN_P), 34, 1.15))
    if rtell: pores += [(G(*RL_P), 10 + 18 * rtell, .4 + .6 * rtell), (G(*RR_P), 9 + 15 * rtell, .4 + .6 * rtell)]
    if g('rrel'): pores += [(G(*RL_P), 30, 1.1), (G(*RR_P), 26, 1.1)]
    if g('glob'): pores.append((G(*GLOB_P), 10 + 14 * g('glob'), .5 + .5 * g('glob')))
    extra = []
    for i, ((x, y), r, k) in enumerate(pores):
        Lp, s2 = rupture(40 + i, x, y, r, k); h = h + s2 * .22; extra.append(Lp)
    h = h - B['holes'] * .3
    if die:
        bite = shape(random.Random(70), [(-24, 18), (4, 12), (26, 26), (20, 52), (-24, 50)], 34, 9) * smooth(0, .25, die)
        burst = cavity(71, cx - 10, cy + 10, 60 + 150 * die, 80 + 170 * die, rough=.7, lobes=7, ang=.2) * M * smooth(.05, .3, die)
        bite = mx(bite, burst)
        M = M * (1 - bite); crop = crop * (1 - bite); h = h * (1 - blur(bite, 10) * .4)
    rc, rcr = once('rime', lambda: rime(4, B['M'], B['h'], .16)); rc = rc * (1 - crop) * .7
    sk = cmix(skin, C((.62, .73, .82)), rc * .7)
    sk = cmix(sk, C((.012, .002, .004)), B['holes'] * .95)
    body = wet(sk, h + rcr * .02, M, detail=B['det'], k=23, dk=5, ao=5, amb=.11, key=1.05, sss=.4, sss_col=(.45, .02, .03), spec=.34, shin=46, glint=1.3, film=B['film'] * M, rim=.34, rim_col=(.42, .52, .66))
    # the crop lit from within: dark blood seen through stretched skin, clots in it, a dark vascular web on top
    gl = 1 + .5 * tell + .25 * rtell + .35 * wnd
    glow = crop * crop * (.10 + ss(.35, .9, blur(B['clots'], 3)) * 1.0) * (1 - B['v'] * .9)
    body = dict(rgb=cadd(body['rgb'], cmul((.30, .006, .012), glow * gl)), a=body['a'])
    sk1, sk2 = suckers()
    su = mx(sk1, sk2) if die < .55 else sk2                         # the oral sucker lets go of the stake as it dies
    cv = canvas(S)
    cv = over(shadow(M, 9, .8, 4, 7), cv); cv = over(body, cv)
    cv = over(shadow(su, 6, .6), cv); cv = over(sucker_layer(su, hurt * .6 + tell * .3), cv)
    if die >= .55:   # the torn-off oral disc, hanging open
        cv = over(sucker_layer(sk1 * 0 + shape(random.Random(79), [(16, -50), (24, -52), (27, -45), (19, -41)], 20, 10, 2), 1), cv)
    if wnd or die:
        w_ = max(wnd, 1 if die else 0)
        rr = 62 + 76 * w_
        cav = cavity(14, cx - 8, cy + 18, rr, rr * 1.35, rough=.6, lobes=8, ang=.2) * M
        cv = over(hole_layer(15, cav, depth=.9), cv)
        rim_ = rim_ring(cav, 10) * M
        torn = grade(rgbT(tex('path_196.jpg', random.Random(16), wa=20, wc=7)), (.10, .004, .006), (.46, .03, .03), (.82, .26, .2), contrast=1.5, keep=.02)
        cv = over(wet(torn, blur(rim_, 3) * .6, rim_, k=12, sss=.5, spec=.6, film=rim_, amb=.15, rim=0), cv)
        n_ = int(5 + 6 * w_ + 10 * die)
        s_, _ = blood_ice(92, [(cx + rng.uniform(-rr, rr) * .7, cy + 18 + rr * rng.uniform(.6, 1.1)) for _ in range(n_)], maxlen=170 + 140 * die, w=(5, 10)); cv = over(s_, cv)
    if die:
        # the heart drops out of the burst crop on its vessels, the gut follows, frozen blood throws in chunks
        hy = cy + 6 + 230 * smooth(.3, 1, die)
        hl, hm = heart_(21, cx - 6, hy, 90, 1 - .15 * die, 1.2); cv = over(shadow(hm, 8, .8, 3, 7), cv)
        vs, _ = strands(18, (cx - 50, cy - 10, cx + 30, hy - 40), 6, w=(5, 9), col=(.30, .03, .04)); cv = over(vs, cv)
        cv = over(hl, cv)
        gl_, gm = guts(42, G(-2, 0)[0], G(0, 16)[1], int(3 + 3 * die), 140 + 260 * die, 26, 130, droop=.4 + .6 * die)
        gl_ = dict(rgb=(gl_['rgb'][0] * .78, gl_['rgb'][1] * .42, gl_['rgb'][2] * .45), a=gl_['a']); cv = over(gl_, cv)   # frozen gut: dark, not salmon
        if die < .85:
            sp = .4 + die
            c_, _ = chunks(43 + int(die * 10), int(10 + 10 * die), (G(-36, 12)[0] - 120 * sp, G(-36, 12)[1] - 60 * sp, G(36, 50)[0] + 100 * sp, G(36, 50)[1] + 40), col=((.01, .005, .008), (.28, .02, .03), (.66, .14, .13))); cv = over(c_, cv)
            ic, _ = chunks(53 + int(die * 10), int(6 + 6 * die), (G(-40, -10)[0] - 90 * sp, G(-40, -10)[1], G(30, 40)[0] + 90 * sp, G(30, 40)[1] + 40), r=(6, 16), col=((.22, .02, .03), (.50, .58, .66), (.84, .92, .97))); cv = over(ic, cv)
        cv = over(spatter(44, *G(-4, 12), 330, int(80 + 120 * die), r=(2, 9)), cv)
    for Lp in extra: cv = over(Lp, cv)
    ic, _ = blood_ice(31, [G(random.Random(i).uniform(-22, 10), random.Random(i + 9).uniform(40, 46)) for i in range(6)] + [G(24, 44), G(28, 44)], maxlen=55 + 50 * wnd, w=(4, 8)); cv = over(ic, cv)
    if g('frel'): cv = over(spatter(33, *G(*FAN_P), 90, 34, bias=(-.6, 0)), cv)
    if g('rrel'): cv = over(spatter(34, *G(*RL_P), 80, 30), cv); cv = over(spatter(35, *G(*RR_P), 80, 30), cv)
    if g('glob'): cv = over(spatter(37, *G(*GLOB_P), 50, 16, bias=(0, -.5)), cv)
    if hurt and wnd: cv = over(spatter(36, *G(-6, 4), 140 + 60 * wnd, int(50 + 50 * wnd)), cv)
    return to_pil(cv)

def heart_view(r, vivid, beat):
    """the exposed heart and the vessels still bridging the cavity, alone, for its own beat list"""
    hl, hm = heart_(21, cx, cy + 6, r, beat, vivid)
    cv = over(shadow(hm, 8, .8, 3, 7), canvas(S)); cv = over(hl, cv)
    sl, _ = strands(17, (cx - 90, cy - 80, cx + 80, cy + 20), 7, col=(.16, .03, .04)); cv = over(sl, cv)
    return to_pil(cv)

def nail_view(i, s, q=0):
    """bar i at damage stage s: whole, bent and bleeding, tearing out. q: a quiver frame (the nails ring under fire)"""
    rng = random.Random(700 + i * 10 + s); sp = []
    for j, (pts, w0, w1, lift) in enumerate(bar_nails(i)):
        (rx, ry), (mx_, my_), (tx, ty) = pts
        # bent: the shank bows down and the head droops; tearing out: pulled half free, a cone of skin dragged with it
        sag = (0, 5, 14)[s] * (1 + .3 * ((j * 7 + i) % 3)) + q * (1.5 + s)
        pull = (0, 0, 16)[s]
        sp.append(([(rx - pull, ry), (mx_ - pull * .5, my_ + sag * .6), (tx, ty + sag)], w0 * 1.1, .7, lift))
    h, m = tubes(S, sp, steps=5)
    alb, det = iron_mat(rng)
    f = ss(.55, .75, fbm(rng, 30, S, 3)) * (1 - .4 * s)
    alb = cmix(alb, C((.66, .78, .88)), f * .5)
    alb = cmix(alb, C((.20, .01, .015)), ss(.5, .8, fbm(rng, 12, S, 3)) * (.15 + .3 * s))   # blood dried on the iron
    L = wet(alb, h, m, detail=det, k=12, dk=3, ao=3, amb=.22, key=1.1, sss=0, spec=.7, shin=26, glint=1.2, rim=.5, rim_col=(.5, .6, .72))
    # the flesh round each entry: a swollen mound of skin puckered round the shank, a black puncture where the iron goes in;
    # tearing out, the skin is dragged out along the shank in a cone
    pm = Image.new('L', S, 0); dp = ImageDraw.Draw(pm); lip = const(0, S)
    for (pts, w0, _, _) in sp:
        rx, ry = pts[0]; r = w0 * (1.5 + .4 * s)
        lip = mx(lip, blob(rng, S, rx - r * .35, ry + rng.uniform(-2, 2), r * 1.7, r * (1.05 + rng.uniform(0, .3)), rough=.55, lobes=7, ang=rng.uniform(-.3, .3)))
        pr = w0 * (.55 + .25 * s); dp.ellipse((rx - pr * 1.2, ry - pr, rx + pr * .6, ry + pr), fill=255)
        if s == 2:
            tx2 = rx - 34; dp.polygon([(rx, ry - 1), (tx2, ry), (rx, ry + 1)], fill=0)
            tent = Image.new('L', S, 0); ImageDraw.Draw(tent).polygon([(rx, ry - r * .8), (tx2, ry - 3), (tx2, ry + 3), (rx, ry + r * .8)], fill=255)
            lip = mx(lip, blur(T(tent.convert('F')) * (1 / 255), 2))
    lm_ = lip
    crease = ridged(rng, 40, S, 2)
    hole = blur(T(pm.convert('F')) * (1 / 255), 1.5) * lip
    torn = grade(rgbT(tex('path_196.jpg', rng, wa=16, wc=9)), (.02, .004, .006), (.16 + .08 * s, .02, .03), (.50, .14, .12), contrast=1.6, keep=.02)
    torn = cmix(torn, C((.03, .03, .04)), (1 - ss(.5, .95, lm_)) * .6 * (2 - s) / 2)   # the rim is still the leech's dark skin
    torn = cmix(torn, C((.008, .001, .003)), hole)
    Lf = wet(cmul(torn, 1 - crease * lip * .5), blur(lip, 7) * 1.2 - hole * .5 - crease * .06, lip, k=16, sss=.45, spec=.6, film=lip * .6, amb=.14, rim=.15, rim_col=(.42, .52, .66))
    cv = over(shadow(lip, 4, .5, 1, 3), canvas(S)); cv = over(Lf, cv)
    cv = over(shadow(m, 3, .6, 2, 5), cv); cv = over(L, cv)
    # frozen runs off each entry, and off the heads once it bleeds through
    st_ = [(p[0][0][0] - 4, p[0][0][1] + 4) for p in sp]
    if s: st_ += [(p[0][2][0] + 6, p[0][2][1] + 2) for p in sp[:1 + s]]
    b_, _ = blood_ice(23 + i, st_[1::2] + st_[len(sp):], maxlen=26 + 30 * s, w=(3, 4 + s)); cv = over(b_, cv)
    if s: cv = over(spatter(60 + i, *sp[1][0][0], 40 + 20 * s, 12 + 10 * s), cv)
    return to_pil(cv)

# ---------------------------------------------------------------- motion
PADL, PADT, PADR, PADB = 160, 48, 64, 240
E = (S[0] + PADL + PADR, S[1] + PADT + PADB); AT = (PADL, PADT)
O = (G(0, 0)[0] + PADL, G(0, 0)[1] + PADT)
def P(x, y): q = G(x, y); return (q[0] + PADL, q[1] + PADT)
HC = P(0, -5)
TAIL = P(31, 33); HEAD = P(21, -52)
def along(u):
    """a point on the body's centreline, u 0 tail .. 1 head"""
    k = min(len(CS) - 1, max(0, int(u * (len(CS) - 1)))); return P(CS[k][0], CS[k][1]), CS[k][2] * 8
def peristalsis(im, f, amp=1.0, sag=0.0):
    """a swallow running from the tail into the crop: a travelling bulge, and the belly sagging between the two clamps"""
    (bx, by), br = along(.12 + f * .5)
    R = br * 1.5; A = .16 * amp
    def fn(x, y):
        dx, dy = x - bx, y - by; k = math.exp(-(dx * dx + dy * dy) / (R * R)) * A
        # the belly hangs between the clamped ends: nothing moves at the suckers
        dt = math.hypot(x - TAIL[0], y - TAIL[1]); dh = math.hypot(x - HEAD[0], y - HEAD[1])
        cl_ = min(1.0, dt / 260) * min(1.0, dh / 300)
        return (dx * k - sag * 5 * cl_, dy * k + sag * 9 * cl_)
    return bend(im, fn)
def crop_pump(im, k):
    """the crop swells round the heart: magnify about it, so the cavity stays centred under the heart sprite"""
    def fn(x, y):
        dx, dy = x - HC[0], y - HC[1]; r = math.hypot(dx / 300, dy / 340); g_ = smooth(1.3, .15, r) * .07 * k
        return (dx * g_, dy * g_)
    return bend(im, fn)
def flinch(im, k):
    """a hit: the body jerks back toward the stake and squeezes"""
    def fn(x, y):
        dh = min(1.0, math.hypot(x - HEAD[0], y - HEAD[1]) / 300) * min(1.0, math.hypot(x - TAIL[0], y - TAIL[1]) / 260)
        return (k * 7 * dh, -(y - HC[1]) * .03 * k * dh)
    return bend(im, fn)
def fall(im, k):
    """death: the head end tears off the stake and swings down from the tail sucker, the burst crop slumping"""
    th = -.75 * smooth(.35, 1, k); sl = smooth(.2, 1, k)
    def fn(x, y):
        dx, dy = x - TAIL[0], y - TAIL[1]; w = min(1.0, math.hypot(dx, dy) / 220); a = -th * w
        sx = TAIL[0] + dx * math.cos(a) - dy * math.sin(a); sy = TAIL[1] + dx * math.sin(a) + dy * math.cos(a)
        sy -= sl * 40 * w   # slump
        return (x - sx, y - sy)
    return bend(im, fn)

def comp(stake, body):
    o = stake.copy(); o.alpha_composite(body); return o

def main():
    b = Baker('crux', E, (E[0] // 8, E[1] // 8), O, colors=200)
    stake = pad(to_pil(stake_layer()), E, AT)
    b.add('stake', stake)
    WND = (0, .45, 1)
    for w, wv in enumerate(WND):
        q = dict(wnd=wv)
        print('stage', w, flush=True)
        base = pad(paint(q), E, AT)
        for i in range(6):
            f = i / 5
            im = peristalsis(base, min(1, f * 1.25), 1 + .2 * w, sag=math.sin(i * 1.1) * .6)
            if i >= 4: im = crop_pump(im, (i - 3) * (1 + .4 * w))
            b.add(f'idle{w}', im)
        for i in range(3): b.add(f'fan{w}', crop_pump(pad(paint(dict(q, tell=(i + 1) / 3)), E, AT), .6 * (i + 1)))
        fr = pad(paint(dict(q, frel=1)), E, AT); b.add(f'fanr{w}', flinch(fr, -.6)); b.add(f'fanr{w}', fr)
        for i in range(3): b.add(f'ring{w}', peristalsis(pad(paint(dict(q, rtell=(i + 1) / 3)), E, AT), .05 * i, 1.4, sag=(i + 1) * .5))
        rr_ = pad(paint(dict(q, rrel=1)), E, AT); b.add(f'ringr{w}', flinch(rr_, .5)); b.add(f'ringr{w}', rr_)
        hu = pad(paint(dict(q, hurt=1)), E, AT); b.add(f'hurt{w}', flinch(hu, 1)); b.add(f'hurt{w}', flinch(hu, .5))
        if w == 2:
            for i in range(2): b.add('glob2', pad(paint(dict(q, glob=.5 + .5 * i)), E, AT))
    for w, (r, vv) in ((1, (58 + 36 * .45, 1.09)), (2, (94, 1.2))):
        for bt in (1.0, 1.1, 1.18, 1.05): b.add(f'heart{w}', pad(heart_view(r, vv, bt), E, AT))
    print('die', flush=True)
    for i in range(9):
        k = i / 8; b.add('die', comp(stake, fall(pad(paint(dict(wnd=1, hurt=1, die=.12 + .88 * k)), E, AT), k)))
    print('nails', flush=True)
    for i in range(4):
        for s in range(3):
            for qv in range(2):
                nm = f'nail{i}_{s}'; b.add(nm, pad(nail_view(i, s, qv), E, AT))
                sp, ox, oy = b.frames[nm][-1]; b.frames[nm][-1] = (sp, ox - bar_ox(i), oy)   # draw at the bar's own origin
    b.save(1024)

if __name__ == '__main__':
    main()
