"""THE BURNING BUTCHER, Matt's pick c1 The Split Side: the Phase 1 generator ported to paint the game's states.
paint_body(q): the carcass without its cleaver arm and without the chains above the hooks (render/enemies.ts draws those live).
paint_arm(a, hot, limp): the cleaver arm alone at screen angle a (radians, the sim's e.ba), pivot (-10,-10).
q keys: stage 0..3 (0 whole, 1 torn, 2 chain snapped + flank open + bowel out, 3 ruined), mouth 0..1, hook 'tel'|'out',
hurt, die 0..1 (the hook tearing out, the bowel letting go), arm (die frames only: paint the limp arm in)."""
from common import *

# boss-local anchors, game px. Hooks sit at the live chains' ends (render/enemies.ts: e.x -+ 14, e.y - 30)
HA = (-14, -30); HB = (14, -30)
PIV = (-10, -10)                 # cleaver pivot, sim: sx = e.x - 10, sy = e.y - 10
MOUTH = (-6, -35)                # spit origin, sim (-6,-34): the bore's lower lip
HOOKO = (10, -8)                 # hook throw origin, sim (+10,-8)
SNAP_TILT = -6                   # degrees the body swings on the left hook once the right chain goes


def s_(n): return R(100 + n)


def gash(gm, raw2, det2, fresh=.6):
    """an opened cut: raw grain sunk below the lips, wet and darker at the bottom, never a flat fill"""
    lip = gm * (1 - ss(.35, .9, blur(gm, 5)))
    col = cmix(cmul(raw2, .55), C((.30, .01, .015)), const(fresh * .5, S))
    col = cmix(col, C((.03, .0, .003)), ss(.5, .95, blur(gm, 6)) * .8)
    return wet(col, lip * .5 + blur(gm, 2) * .1, gm, detail=det2, k=10, dk=3, ao=3, sss=.3, spec=.6, shin=44, glint=.9, film=gm)


def body(q):
    stg = q.get('stage', 0); die = q.get('die', 0); hu = q.get('hurt', 0); mo = q.get('mouth', 0)
    wd = stg >= 2 or die > 0             # flank open
    X, Y = coords(S)
    outl = [(23, -40), (23, -8), (24, 22), (22, 44), (12, 50), (5, 46), (-6, 53), (-15, 43), (-22, 31), (-15, 18), (-18, 10), (-29, 3),
            (-24, -7), (-27, -17), (-20, -27), (-12, -31), (-2, -30), (8, -42)]
    M = rough(shape(outl, it=1), s_(1), c=20, amt=.42, r=5)
    saw = ss(OX + 23.6 * K, OX + 22.9 * K, X + (Y - OY) * .022); M = M * saw
    if wd: M = M * (1 - rough(shape([(-32, -4), (-13, -5), (-7, 6), (-9, 15), (-21, 20), (-34, 12)]), s_(2), c=12, amt=.45))
    if stg >= 3 or die:
        M = M * (1 - rough(shape([(-32, 24), (-12, 26), (-6, 36), (-12, 42), (-32, 50)]), s_(3), c=10, amt=.5))
    if die > .3:
        M = M * (1 - rough(shape([(-32, 14), (-3, 16), (6, 30), (-2, 38), (-32, 46)]), s_(3), c=10, amt=.5))
        M = M * (1 - rough(shape([(-32, -38), (-15, -36), (-17, -20), (-32, -14)]), s_(4), c=10, amt=.5))
    if die > .15:
        # the left hook rips up through the shoulder: a ragged slot from the hook to the top edge, widening
        k = min(1, (die - .15) / .5)
        M = M * (1 - rough(shape([(HA[0] - 2 - 3 * k, HA[1] - 8), (HA[0] + 2 + 3 * k, HA[1] - 8), (HA[0] + 3 + 2 * k, HA[1] + 4 + 6 * k), (HA[0] - 3 - 2 * k, HA[1] + 4 + 6 * k)]), s_(5), c=16, amt=.5))
    if q.get('snap') or stg >= 2 or die:
        # the right hook tore out when its chain went: a bitten notch at the top of the sawn side
        M = M * (1 - rough(shape([(HB[0] - 3, HB[1] - 14), (HB[0] + 4, HB[1] - 14), (HB[0] + 3, HB[1] + 1), (HB[0] - 2, HB[1] + 3)]), s_(6), c=16, amt=.5))
    rgb, det = phT('carcass_183.jpg', (.08, .05, .34, .86), seed=11, amp=20, cells=8, hp=20, gain=2.4)
    rgb2, det2 = phT('meat_146.jpg', (.1, .35, .9, .98), seed=12, amp=26, cells=8, hp=20, gain=2.4)
    raw = grade(rgb, (.04, .004, .006), (.33, .022, .024), (.80, .52, .40), contrast=1.5, keep=.08)
    raw2 = grade(rgb2, (.03, .003, .005), (.26, .014, .018), (.58, .12, .10), contrast=1.6, keep=.05)
    pat = ss(.42, .6, fbm(s_(5), 3, S, 3)); base = cmix(raw, raw2, pat); dt = mix(det, det2, pat)
    # chest cavity darker than meat: intercostal muscle in shadow, so the bone reads
    cav = rough(shape([(6, -30), (-9, -27), (-20, -14), (-21, 1), (-12, 12), (3, 14), (6, 8)]), s_(6), c=12, amt=.3, r=8, lo=.44, hi=.6)
    if wd: cav = mx(cav, rough(shape([(6, 6), (-20, 6), (-24, 22), (-3, 28), (6, 24)]), s_(7), c=12, amt=.3, r=8, lo=.44, hi=.6))
    base = cmix(base, cmul(base, .24), cav * .94)
    hm = const(0, S)
    for (x, y, a_, b_, ang), n in [((-8, 33, 11, 14, .3), 30), ((3, 27, 7, 16, -.1), 31), ((-10, 44, 8, 7, .5), 32), ((-8, 18, 9, 5, .2), 33)]:
        c = P(x, y); hm = mx(hm, blob(R(n), S, c[0], c[1], a_ * K, b_ * K, rough=.2, lobes=4, ang=ang, edge=9) * .26)
    # char round the ragged side: thick burnt hide, cracked, hot in the cracks
    inner = blur(M, 30); chr_ = (1 - ss(.62, .92, inner + (fbm(s_(8), 6, S, 4) - .5) * .55)) * ss(OX + 12 * K, OX + 1 * K, X)
    leather, ldet = phT('meat_148.jpg', (.2, .3, .8, .95), seed=13, amp=18, cells=7, hp=12, gain=3)
    chb = grade(leather, (.005, .004, .004), (.038, .026, .024), (.15, .09, .07), contrast=1.7, keep=.02)
    base = cmix(base, chb, chr_); dt = mix(dt, ldet, chr_)
    cr = ridged(s_(9), 8, S, 3); seam = ss(.84, .97, cr) * chr_ * ss(.05, .4, inner)
    # ribs live IN the body's height field: the meat rises round them, bone shows where it has been stripped
    ribs = []; rr = s_(10); n_ = 8
    for i in range(n_):
        y0 = -27 + i * 5.4 + rr.uniform(-1.1, 1.1); xe = -17 - rr.uniform(0, 6) - 3 * math.sin(i / n_ * 3.1)
        if i >= 6: xe = -8 + rr.uniform(-2, 2)
        if stg == 1 and i in (6, 7): xe = -4
        if wd and i in (5, 6, 7): xe = -1
        if (stg >= 3 or die) and i in (0, 3): xe = 1
        ribs.append((bez(P(5, y0), P(-3, y0 - 4.5), P(xe * .65, y0 + .5), P(xe, y0 + 7 + i * .5), 20), rr.uniform(10, 14), rr.uniform(6, 9), 1.0))
    rh, rm = tubes(S, ribs, steps=5); rm = rm * M
    bone, bdet = boneT(21, .85)
    strip = ss(.40, .62, fbm(s_(11), 7, S, 3) + (blur(M, 30) - .7) * -.4)
    bare = rm * (1 - strip * .92)
    base = cmix(base, bone, bare)
    base = cmix(base, C((.42, .08, .07)), rm * strip * .55)
    # the spine, sagittal cut: vertebral bodies, pale discs, the open canal with cord, fins of spinous process cut by the saw
    rr = s_(14); bodies = []; fins = []; y = -41.0; i = 0; brk = None
    while y < 44:
        hh = 6.6 + rr.uniform(-.6, .9)
        if (die > .3 or stg >= 3) and i == 6: brk = y
        else:
            bodies.append([(4.4 + rr.uniform(-.7, .7), y + .8), (3.4 + rr.uniform(-.5, .5), y + hh * .5), (4.4 + rr.uniform(-.7, .7), y + hh - .8), (12.6, y + hh - .2), (13.4, y + hh * .5), (12.6, y + .2)])
            fins.append([(15.6, y + 1.2), (15.3, y + hh * .55), (18, y + hh + 1.8), (24, y + hh + 3.0), (24, y + hh * .7), (19, y + 1.2)])
        y += hh + 1.5; i += 1

    def mk(polys, it=1, soft=1.1):
        im = Image.new('L', S, 0); d = ImageDraw.Draw(im)
        for pl in polys: d.polygon(chaikin(Pn(pl), it), fill=255)
        return blur(T(im.convert('F')) * (1 / 255), soft)
    vm = mk(bodies) * M; fm = mk(fins) * M
    canal = shape([(13.9, -42), (15.2, -42), (15.3, 46), (13.9, 46)], it=0, soft=1.2) * M
    cordM = rough(shape([(14.1, -42), (14.8, -42), (14.8, 20), (14.2, 20)], it=0), s_(19), c=26, amt=.4, r=2)
    disc = shape([(3.5, -42), (13.4, -42), (13.4, 46), (3.5, 46)], it=0, soft=1.2) * M * (1 - vm)
    if brk is not None: disc = disc * (1 - shape([(2, brk), (16, brk), (16, brk + 8), (2, brk + 8)], it=0))
    allb = cl(vm + fm)
    vb, vd = boneT(22, 1.0); vb, pr = porous(s_(15), vb, allb, .6)
    stain = ss(.46, .66, fbm(s_(16), 5, S, 4)); vb = cmix(vb, C((.32, .05, .04)), stain * (.5 + .2 * min(stg, 2)))
    base = cmix(base, vb, allb)
    base = cmix(base, C((.46, .36, .30)), disc * .85)
    base = cmix(base, C((.006, .001, .002)), canal)
    base = cmix(base, C((.30, .05, .06)), canal * cordM * .8)
    # the shoulder socket the cleaver arm's meat sits in (the arm is its own baked list, drawn over this)
    sock = blob(R(77), S, *P(*PIV), 5.5 * K, 5 * K, rough=.25, lobes=5, edge=12) * M
    base = cmix(base, C((.14, .008, .01)), sock * .8)
    h = dome(M, 40, 8, flat=.1) * .72 - cav * .2 - seam * .05 + chr_ * .10 + hm * (1 - cav) - sock * .15
    h = h + blur(rm, 1.2) * .14 + blur(vm, 3) * .22 + blur(fm, 3) * .14 - canal * .2 - pr * allb * .03
    dd = mix(dt, vd, allb)
    L = wet(base, h, M, detail=dd, k=24, dk=4.5, ao=6, sss=.42, spec=.30, glint=.8, film=film_map(s_(12), S, M * (1 - allb), 5), rim=.3, rim_col=(.85, .28, .07))
    cv = emit(L, seam * .9)
    # neck stump: strap meat rising to a torn windpipe, the bore is the mouth
    nm = limb([(0, -21), (-2, -27), (-4, -31), (MOUTH[0], MOUTH[1] - 2)], [5.6, 4.2, 3.5, 3.3], seed=16, amt=.34)
    nb = grade(rgb2, (.04, .004, .006), (.34, .03, .03), (.62, .20, .16), contrast=1.5, keep=.05)
    rings = Image.new('L', S, 0); d = ImageDraw.Draw(rings); pts = bez(P(-2, -24), P(-3, -28), P(-4, -31), P(MOUTH[0], MOUTH[1] - 1), 8)
    for j, qq in enumerate(pts): d.line((qq[0] - 24, qq[1] + 4, qq[0] + 24, qq[1] - 6), fill=200, width=6)
    rt = blur(T(rings.convert('F')) * (1 / 255), 1.8) * limb([(-2, -23), (-4, -30), (MOUTH[0], MOUTH[1] - 1.5)], [3.6, 3.6, 3.6])
    nb = cmix(nb, C((.60, .48, .36)), rt * .8)
    nm = nm * ss(OY - 19 * K, OY - 26 * K, Y)
    nL = wet(nb, dome(nm, 12, 3) * .6 + rt * .08, nm, detail=det2, k=16, dk=3, sss=.5, spec=.4, glint=.8, rim=.3, rim_col=(.85, .28, .07))
    cv = cast(cv, nm, 8, .8, 3, 7); cv = over(nL, cv)
    bx, by = P(MOUTH[0], MOUTH[1] - 2); r0 = 17 + mo * 9
    lipm = blob(s_(17), S, bx, by, r0 + 10, (r0 + 10) * .7, rough=.2, lobes=6, ang=-.3, edge=2)
    lL = wet(C((.56, .40, .30)), blur(lipm, 3) * .4, lipm, detail=vd, k=12, dk=2, sss=.5, spec=.4); cv = over(lL, cv)
    bore = blob(s_(17), S, bx, by, r0, r0 * .68, rough=.2, lobes=6, ang=-.3, edge=2)
    bl = dict(rgb=cmul(C((.008, .0, .0)), bore), a=bore)
    if mo: bl = emit(bl, bore * mo * .9)
    cv = over(bl, cv)
    # hooks bite through; flesh already bleeding from them
    if not (q.get('snap') or stg >= 2 or die):
        hk, hm_ = hookL((P(*HB)[0], P(*HB)[1] - 6), (P(*HB)[0] - 6, P(*HB)[1] + 40)); cv = cast(cv, hm_, 4, .8, 3, 4); cv = over(hk, cv)
    if die < .55:
        hk, hm_ = hookL((P(*HA)[0], P(*HA)[1] - 6), (P(*HA)[0] + 10, P(*HA)[1] + 34 + die * 60), seed=6); cv = cast(cv, hm_, 4, .8, 3, 4); cv = over(hk, cv)
    st_ = [P(*p) for p in [(-12, -6), (-3, 2), (1, 12), (-15, 14), (-2, 22), (-9, 30), (-6, 40), (1, 45), (8, 40), (-14, 36), (9, -14), (10, 6), (HA[0] + 1, HA[1] + 3), (HB[0] - 1, HB[1] + 3)]]
    b = bloodruns(s_(30), st_, maxlen=120 + 40 * stg, w=4.0 + stg * .6); cv = over(clipL(b, cl(cv['a'] + ss(OY + 30 * K, OY + 44 * K, Y))), cv)
    if stg == 1:
        # torn: a deep cleft opened under the ribs, the meat parting but nothing out yet
        gm = rough(shape([(-24, 8), (-6, 4), (0, 9), (-10, 14), (-24, 15)]), s_(40), c=20, amt=.5, r=3, lo=.44, hi=.56) * cv['a']
        cv = cast(cv, gm, 3, .7, -2, -2); cv = over(gash(gm, raw2, det2), cv)
        cv = over(bloodruns(s_(41), [P(-20, 12), P(-12, 12), P(-5, 11)], maxlen=150, w=5), cv)
    if hu:
        sp = spatter(s_(31), P(-3, 0), 80, 190, rmax=8) * cv['a']; cv = over(wet(bloodbase(s_(32)), sp * .4, sp, **BLOOD), cv)
        gm = rough(shape([(-18, -6), (1, -8), (5, -3), (-7, 2), (-20, 2)]), s_(33), c=20, amt=.5, r=3, lo=.44, hi=.56) * cv['a']
        cv = cast(cv, gm, 3, .6, -2, -2); cv = over(gash(gm, raw2, det2, .9), cv)
        cv = over(bloodruns(s_(34), [P(-15, 0), P(-8, 1), P(-2, 0), P(2, -1)], maxlen=120, w=5), cv)
    if q.get('hook') == 'out':
        # the thrown chain comes out of the meat: a torn hole in the vertebrae, pumping
        hb = blob(s_(42), S, *P(*HOOKO), 3.2 * K, 2.6 * K, rough=.4, lobes=6, edge=2) * cv['a']
        cv = cast(cv, hb, 3, .8, 1, 2); cv = over(dict(rgb=cmul(C((.05, .0, .004)), hb), a=hb), cv)
        cv = over(bloodruns(s_(43), [P(HOOKO[0] - 1, HOOKO[1] + 2), P(HOOKO[0] + 2, HOOKO[1] + 2)], maxlen=160, w=5), cv)
    if wd:
        rr = s_(35); dp = 0 if (stg >= 3 or die) else 100; dl = die * 260
        ps = gutrope(rr, *P(-7, 5), 400 - dp + dl, sway=30, w=25, seg=7) + gutrope(rr, *P(-1, 7), 320 - dp + dl * .8, sway=30, w=21, seg=6) + gutrope(rr, *P(-14, 8), 260 - dp + dl * .6, sway=26, w=18, seg=6)
        g, gm = gutsL(rr, ps, seed=41); cv = cast(cv, gm, 8, .85, 3, 6); cv = over(g, cv)
    if stg >= 3 or die:
        rr = s_(36); dl = die * 200
        ps = gutrope(rr, *P(-18, 10), 260 + dl, sway=36, w=30, seg=7) + gutrope(rr, *P(-10, 22), 190 + dl, sway=30, w=26, seg=6)
        g, gm = gutsL(rr, ps, seed=42); cv = cast(cv, gm, 8, .85, 3, 6); cv = over(g, cv)
        sp = spatter(s_(37), P(-2, 4), 160 + int(160 * die), 330 + 100 * die, rmax=10) * cv['a']; cv = over(wet(bloodbase(s_(38)), sp * .4, sp, **BLOOD), cv)
        cv = over(bloodruns(s_(39), [P(x, y) for x, y in [(-20, 6), (-14, 18), (-6, 26), (2, 30), (9, 20), (16, 28), (21, 8), (14, -6)]], maxlen=170 + 120 * die, w=6 + die), cv)
    if die > .15:
        # meat torn at the hook slot: raw lips and a run of blood down from it
        cv = over(bloodruns(s_(44), [P(HA[0] - 2, HA[1] + 6), P(HA[0] + 2, HA[1] + 8), P(HA[0], HA[1] + 10)], maxlen=200, w=6), cv)
    if q.get('hook') == 'tel':
        cv = hookthrow(cv, dict(hook=1), tip=(22, -40))
    if q.get('arm') is not None:
        cv = over(arm(q['arm'], 0, limp=True), cv)
    return cv


ARM_U = [(0, 0), (5, -1.2), (9.5, -2.6), (14.5, -2.2), (19, -1.4)]   # shoulder .. hand, along the arm (u) and across it (v), game px


def arm(a, hot=0.0, limp=False):
    """the foreleg: raw meat at the shoulder, stripped to bone by the wrist, the bone grown through the cleaver's tang.
    One rigid piece about the pivot, painted per angle so the light stays put (never rotated as pixels)"""
    ca, sa = math.cos(a), math.sin(a)
    def g(u, v): return (PIV[0] + u * ca - v * sa, PIV[1] + u * sa + v * ca)
    sho, upm, el, fa, hand = [g(u, v) for u, v in ARM_U]
    bang = -math.degrees(a + .14)                               # blade a touch off the forearm, the y-up degrees blade_poly wants
    rgb2, det2 = phT('meat_146.jpg', (.1, .35, .9, .98), seed=12, amp=26, cells=8, hp=20, gain=2.4)
    nb = grade(rgb2, (.04, .004, .006), (.34, .03, .03), (.62, .20, .16), contrast=1.5, keep=.05)
    bl_, bm, ax, q = blade_layer(hand, bang, L=24, W=14, seed=9, hot=hot, bloody=.6 if not limp else .9)
    sp = q(.40, .03); sp = ((sp[0] - OX) / K, (sp[1] - OY) / K)  # the bone spur runs up the blade: fused, not held
    bo = limb([el, fa, hand, sp], [(2.8, 2.8), (1.9, 1.9), (3.3, 3.0), (.5, .5)], seed=18, amt=.12)
    bb, bd = boneT(23, 1.0); bb, _ = porous(s_(19), bb, bo, .3)
    boL = wet(bb, dome(bo, 6, 2) * .7, bo, detail=bd, k=14, dk=3, ao=3, sss=.3, spec=.34, glint=.8, rim=.35, rim_col=(.9, .35, .1))
    am = limb([sho, upm, el], [(5.8, 6.2), (4.4, 4.8), (2.4, 2.2)], seed=19, amt=.5)
    amL = wet(nb, dome(am, 10, 3) * .8, am, detail=det2, k=16, dk=3.5, ao=4, sss=.5, spec=.36, glint=.8, rim=.32, rim_col=(.9, .35, .1))
    cv = canvas(S)
    cv = over(bl_, cv); cv = cast(cv, bo, 3, .6, 2, 3); cv = over(boL, cv); cv = cast(cv, am, 3, .6, 2, 3); cv = over(amL, cv)
    # blood from where the meat ends on the bone, hanging off the blade's spine
    st_ = [P(*el), P(*fa), P(*g(4, 2))]
    cv = over(clipL(bloodruns(s_(50), st_, maxlen=60, w=3.5), cv['a']), cv)
    return cv


def paint_body(q): return to_pil(body(q))
def paint_arm(a, hot=0.0): return to_pil(arm(a, hot))
