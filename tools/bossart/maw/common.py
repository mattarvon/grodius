"""THE MAW painter (Matt's pick c1 Lamprey Disc), shared by tools/bossart/maw/bake.py. Own copy of the helpers; the lane's kit
(tools/bossart/bosskit.py) is imported, never edited. Photos: the kit's library (assets-raw/bossart/tex) plus two in
assets-raw/bossart/dl: maw_open_wide.jpg (USFWS 'Open wide', CC BY 2.0, the oral disc) and Matt's CC0 teeth plate (teeth.py).
Hero canvas 736x608 = 8 x a 92x76 game box; boss (0,0) sits at hero (384,304). Mouth (-14,0), hit r24 (enemies/update.ts).
Variants differ in anatomy: orbit whole and dark red; acid eaten (bitten rim, receded gums, ulcers, bleached); snot buried
(hagfish slime sheet, glazed teeth, swollen and sagging)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bosskit import *
from teeth import teeth
S = (736, 608); W, H = S; K = 8.0; OX, OY = 384, 304
GS = (92, 76)
DL = os.path.join(os.path.dirname(TEX), 'dl')
X, Y = coords(S)
def gp(x, y): return (OX + x * K, OY + y * K)
MOUTH = gp(-14, 0)
DISC = gp(-17.5, 0)
PORES = [(-4.5, 2.6, 1.05), (-1.2, 3.3, .95), (2.4, 3.6, 1.0), (5.6, 4.4, .85), (9.1, 4.6, .9), (12.2, 5.4, .75), (15.0, 5.6, .7)]   # lamprey gill pores along the flank
WOUND = (8, -12)                                                             # the 50% wound (update.ts gib/geyser)
V = dict(
    orbit=dict(hull=((.05, .008, .01), (.30, .05, .045), (.62, .22, .16)), ph='angler_45.jpg', det='meat_146.jpg',
               disc=[(0, (.012, .0, .004)), (.22, (.14, .006, .02)), (.45, (.42, .035, .05)), (.66, (.64, .17, .13)), (.86, (.80, .55, .42))],
               tooth=((.14, .09, .035), (.60, .50, .30), (.86, .78, .56)), H=1.0, droop=.09, sss=(.6, .02, .03)),
    acid=dict(hull=((.13, .09, .09), (.46, .38, .36), (.74, .68, .62)), ph='path_197.jpg', det='path_197.jpg',
              disc=[(0, (.02, .004, .006)), (.22, (.20, .07, .08)), (.45, (.50, .30, .30)), (.66, (.70, .55, .50)), (.86, (.86, .80, .72))],
              tooth=((.20, .14, .07), (.64, .56, .40), (.88, .84, .70)), H=.9, droop=.07, sss=(.5, .08, .08)),
    snot=dict(hull=((.06, .016, .012), (.30, .09, .05), (.56, .27, .17)), ph='angler_45.jpg', det='path_192.jpg',
              disc=[(0, (.012, .002, .002)), (.22, (.14, .03, .02)), (.45, (.38, .10, .06)), (.66, (.58, .28, .18)), (.86, (.76, .62, .46))],
              tooth=((.18, .14, .06), (.58, .52, .34), (.82, .78, .58)), H=1.05, droop=.15, sss=(.5, .05, .02)),
)
SLIME = (.50, .46, .42)   # grey-yellow, never lime (D39)
_ph = {}
def P(name, crop=None, rot=0, mirror=False, size=S):
    k = (name, crop, rot, mirror, size)
    if k not in _ph:
        if name.startswith('dl:'):
            im = Image.open(os.path.join(DL, name[3:])).convert('RGB')
            if crop: im = im.crop((int(crop[0] * im.width), int(crop[1] * im.height), int(crop[2] * im.width), int(crop[3] * im.height)))
            _ph[k] = ImageOps.fit(im, size, BIC)
        else: _ph[k] = photo(name, size, crop=crop, rot=rot, mirror=mirror)
    return _ph[k]
def ramp(t, stops):
    col = tuple(const(c, t.size) for c in stops[0][1])
    for i in range(1, len(stops)):
        col = cmix(col, stops[i][1], ss(stops[i - 1][0], stops[i][0], t))
    return col
def tmap(t, fn):
    """per-pixel python map of a T (no numpy): only for the few static fields"""
    im = Image.new('F', t.size); im.putdata([fn(v) for v in t.im.getdata()]); return T(im)
def ellip(cx, cy, rx, ry, rough=0., rng=None, c=6):
    d = (((X - cx) * (1 / rx)) ** 2.0 + ((Y - cy) * (1 / ry)) ** 2.0) ** .5
    if rough: d = d + (fbm(rng, c, S, 3) - .5) * rough
    return d
def holes(rng, spots, rough=.5, lobes=7):
    t = const(0, S)
    for x, y, rx, ry in spots: t = mx(t, blob(rng, S, x, y, rx, ry, rough=rough, lobes=lobes))
    return t
def runs(rng, starts, maxlen=120, w=5., col=(.30, .012, .02)):
    """blood running down the skin: tapering, beading, wandering"""
    paths = []
    for x, y in starts:
        L = rng.uniform(.3, 1) * maxlen; xx, yy = x, y; pts = [(x, y)]
        for i in range(10): xx += rng.uniform(-3, 3); yy += L / 10; pts.append((xx, yy))
        paths.append((pts, w * rng.uniform(.6, 1.1), w * rng.uniform(.12, .4)))
    h, m = tubes(S, paths); return wet(tuple(const(c, S) for c in col), h * .7, m, k=10, sss=.1, spec=.8, glint=1, film=m), m

# ------------------------------------------------------------------ the hull (body behind the disc)
KN = [(-15, 20.5), (-7, 23.5), (1, 23.8), (9, 21.0), (17, 16.5), (24, 12.5), (31, 9.5)]
def prof(x, Hk):
    for (x0, h0), (x1, h1) in zip(KN, KN[1:]):
        if x <= x1: t = max(0, (x - x0) / (x1 - x0)); return (h0 + (h1 - h0) * t) * Hk
    return KN[-1][1] * Hk
_hs = {}
def hull_static(v):
    """the variant's hull mask, form height, albedo and detail: everything that does not move between frames"""
    if v in _hs: return _hs[v]
    c = V[v]; rng = random.Random(901 + len(v))
    top = []; bot = []
    for i in range(48):
        x = -15 + i * 46 / 47; d = max(0, x + 7) * c['droop']; hh = prof(x, c['H'])
        top.append(gp(x, -hh + d * .6)); bot.append(gp(x, hh * 1.02 + d))
    poly = polymask(S, top + [gp(33, KN[-1][1] * .1 + 3)] + bot[::-1], soft=2)
    m = ss(.32, .62, blur(poly, 9) + (fbm(rng, 5, S, 4) - .5) * .9)
    # the torn rear: whole bites out of the tail end, never a clean cap
    m = m * (1 - holes(rng, [(*gp(32, -5), 30, 26), (*gp(30, 6), 26, 34), (*gp(26, 13), 22, 18)], .6))
    if v == 'acid':  # rim eaten in bites, the outline notched
        m = m * (1 - holes(rng, [(*gp(-2, -24), 34, 20), (*gp(12, -21), 26, 22), (*gp(5, 24), 38, 20), (*gp(19, 17), 26, 22), (*gp(-10, 22), 24, 16)], .7, 9))
    Xg = (X - OX) * (1 / K)
    # myomeres: the W-shaped muscle blocks of a lamprey's flank, crawling with peristalsis in the idle frames
    ph = Xg * .95 + absT(Y - OY) * (.06 / K * 8) + fbm(rng, 8, S, 3) * 2.2
    band = tmap(ph, lambda q: math.sin(q))
    form = (dome(m, 40, 10) * .7 + blur(m, 90) * .55) * 2.2
    h = form + band * .035 * ss(-10, 0, Xg) + ridged(rng, 9, S, 3) * .03
    # the dorsal crest and keel: a fold above and below so the profile is not a ball
    h = h + ss(.0, .2, m) * .0
    ph1 = warp(P(c['ph'], crop=(.1, .1, .9, .9)), rng, 24, 8); ph2 = warp(P(c['det']), rng, 20, 8)
    det = highpass(lumaT(ph2), 9, 2.4)
    alb = grade(rgbT(ph1), *c['hull'], contrast=1.4, keep=.04)
    if v != 'acid':
        alb = cmix(alb, (const(.30, S), const(.03, S), const(.04, S)), ss(.55, .75, fbm(rng, 5, S, 4)) * .35)
        vn = veinnet(rng, S, m, n=26, w0=2.4, branch=.08); h = h + vn * .05
        alb = cmix(alb, (const(.16, S), const(.015, S), const(.05, S)), vn * .8)
    else:
        # bleached: fish-belly pale with bruised pink blooms and dead grey patches
        alb = cmix(alb, (const(.62, S), const(.36, S), const(.36, S)), ss(.55, .78, fbm(rng, 6, S, 4)) * .55)
        alb = cmix(alb, (const(.30, S), const(.30, S), const(.27, S)), ss(.6, .8, fbm(rng, 11, S, 3)) * .5)
    # countershading: darker dorsum, a lighter belly, as on the real fish
    alb = cmul(alb, ss(-30, 22, (Y - OY) * (1 / K)) * .3 + .8)
    _hs[v] = dict(m=m, h=h, alb=alb, det=det, rng_seed=rng.random())
    return _hs[v]

def hull(v, w, pore=.5, hurt=0., die=0.):
    c = V[v]; hs = hull_static(v); m, h, alb = hs['m'], hs['h'], hs['alb']
    rng = random.Random(77 + w); wr = random.Random(500 + w)
    raw = grade(rgbT(P('meat_146.jpg', crop=(.38, .2, .98, .95))), (.10, .004, .006), (.46, .03, .03), (.82, .26, .2), contrast=1.5, keep=.02)
    # gill pores: puckered holes that open and close with the breath; hurt clenches them
    po = pore * (1 - hurt)
    for i, (x, y, r) in enumerate(PORES):
        cx, cy = gp(x, y); R = r * K
        d = ellip(cx, cy, R * .95, R * 1.5, .5, random.Random(i), 3)
        rim = (1 - ss(0, .45, absT(d - 1.0))) * m
        inner = ss(.45 + .4 * po, .15 + .2 * po, d) * m
        h = h + rim * .1 - inner * .25
        alb = cmix(alb, (const(.012, S), const(.0, S), const(.004, S)), inner * (.6 + .4 * po))
        alb = cmix(alb, (const(.62, S), const(.16, S), const(.13, S)) if v != 'acid' else (const(.62, S), const(.24, S), const(.24, S)), rim * .2)
    # ulcers (acid): black pits with raw rims; near the edge they go right through (alpha)
    cut = const(0, S)
    if v == 'acid':
        ur = random.Random(331)
        U = [(-7, -15, 3.4, 1.6), (4, -17, 1.6, 1.1), (15, -9, 2.8, 2.0), (21, 5, 1.3, 1.0), (1, 14, 4.0, 1.8), (13, 12, 1.5, 2.4), (-9, 13, 1.2, .9), (24, -6, 1.8, 1.2), (7, -2, 1.0, 1.4)]
        for i, (x, y, rx_, ry_) in enumerate(U[:6 + 2 * w]):
            cx, cy = gp(x, y); u = blob(ur, S, cx, cy, rx_ * K, ry_ * K, rough=.9, lobes=4, ang=ur.uniform(-1, 1))
            lip = cl(blur(u, 9) * 2.0) * (1 - u)
            alb = cmix(alb, (const(.54, S), const(.13, S), const(.14, S)), lip * .8); h = h + lip * .1 - u * .3
            deep = ss(.2, .9, blur(u, 7))   # an ulcer is a crater, raw red going down to black, not a punched dot
            alb = cmix(alb, cmix((const(.30, S), const(.03, S), const(.04, S)), (const(.015, S), const(.0, S), const(.006, S)), deep), u)
        cut = holes(ur, [(*gp(22, -9), 14, 10), (*gp(-3, 21), 16, 9), (*gp(27, 7), 12, 12)] + ([(*gp(14, 15), 14, 10)] if w else []), .6)
    # wounds: the 50% tear at (+8,-12) (stage 1), the flank split and the tail tear (stage 2)
    tear = const(0, S)
    if w >= 1 or die:
        sp = [(*gp(*WOUND), (4.6 + 1.6 * (w >= 2)) * K, (3.6 + 1.2 * (w >= 2)) * K)]
        if w >= 2: sp += [(*gp(12, 4), 5 * K, 2.4 * K), (*gp(24, -2), 3 * K, 3.6 * K)]
        if die: sp += [(*gp(6, 4), (4 + 14 * die) * K, (2 + 6 * die) * K)]
        tear = holes(wr, sp, 1.0, 5) * m
    if tear is not None:
        tlip = cl(blur(tear, 8) * 2.2) * (1 - tear) * m
        alb = cmix(alb, raw, tlip); h = h + tlip * .06
        # inside the tear: dark cavity, raw muscle walls, two pale cartilage bars (a lamprey has no bone)
        inside = tear
        cav = cmix(raw, (const(.04, S), const(.0, S), const(.006, S)), ss(.2, .9, blur(tear, 10)))
        alb = cmix(alb, cav, inside)
        h = h - blur(inside, 6) * .16
        if w >= 1 or die:
            bx, by = gp(*WOUND); bars = [(bez((bx - 26, by - 10), (bx - 8, by - 20), (bx + 10, by - 14), (bx + 28, by + 2), 20), 4.5, 3)]
            hb, mb = tubes(S, bars); mb = mb * inside
            alb = cmix(alb, (const(.36, S), const(.20, S), const(.17, S)), mb * .7); h = h + hb * inside * .08
    if hurt: alb = cmix(alb, (const(.46, S), const(.03, S), const(.03, S)), m * .35 * hurt)
    mm = m * (1 - cut)
    film = film_map(rng, S, mm, 6, .45, .65)
    L = wet(alb, h, mm, detail=hs['det'], k=24, dk=3.4, ao=5, sss=.6, sss_col=c['sss'], film=film, spec=.32, rim=.06,
            rim_col=(.25, .5, .48) if v == 'acid' else (.35, .3, .4))
    return L, mm, tear

def hangers(v, w, die=0.):
    """what trails off the torn rear and the belly: orbit torn vessels, acid threads, snot slime drapes"""
    rng = random.Random(61 + 7 * w)
    if v == 'orbit':
        roots = [(29, 2, 15, 3.4), (30, -4, 12, 2.6), (27, 8, 13, 3.0), (31, 5, 9, 2.0)] + ([(10, 20, 9, 2.2)] if w else [])
        paths = []
        for x, y, L, wd in roots:
            x0, y0 = gp(x, y); L *= K * (1 + .6 * die)
            paths.append((bez((x0, y0), (x0 + L * .35, y0 + L * .2), (x0 + L * .45, y0 + L * .75), (x0 + L * .3 + rng.uniform(-14, 14), y0 + L * 1.2), 24), wd * K * .5, wd * K * .08))
        h, m = tubes(S, paths)
        sheath = ss(.35, .9, h)
        col = cmix((const(.34, S), const(.20, S), const(.19, S)), (const(.17, S), const(.01, S), const(.025, S)), sheath)
        return wet(col, h, m, k=12, sss=.4, spec=.5, film=m, shin=40.), m
    if v == 'acid':
        paths = []
        for i in range(9):
            x0, y0 = gp(rng.uniform(-6, 30), 0); y0 = gp(0, prof((x0 - OX) / K, .9) * .95)[1] + rng.uniform(-6, 4)
            L = rng.uniform(4, 12) * K * (1 + die)
            paths.append((bez((x0, y0), (x0 + rng.uniform(-8, 8), y0 + L * .4), (x0 + rng.uniform(-12, 12), y0 + L * .7), (x0 + rng.uniform(-14, 14), y0 + L), 16), rng.uniform(2, 3.4), .5))
        h, m = tubes(S, paths)
        return wet((const(.52, S), const(.42, S), const(.38, S)), h, m, k=10, sss=.3, spec=.6, film=m), m
    return None, None   # snot: its drapes go on over the slime sheet (snot_drapes)

# ------------------------------------------------------------------ the disc, painted frontal then foreshortened
def _rim_d(tcx, th, Rr):
    s = math.sin(th); c = math.cos(th)
    return -tcx * c + math.sqrt(max(0, Rr * Rr - tcx * tcx * s * s))
RINGS = [(.04, 13, 2.0, 'small'), (.32, 15, 2.7, 'big'), (.62, 17, 3.2, 'big'), (.86, 22, 1.7, 'small')]
def disc(v, w, jaw=0., spew=0., hurt=0., die=0., tearoff=0.):
    """the oral disc: photo papillae, four rings of engraved teeth seated in the gums, the throat. Returns (layer, mask)
    in hero space. jaw 0..1 (e.jaw): dilates the disc, opens the throat, the teeth erect and flare outward"""
    c = V[v]; rng = random.Random(4100 + w); wr = random.Random(4200)
    ry = 21.5 * K * (1 + .07 * jaw); rx = 9.6 * K * (1 + .20 * jaw)
    R0 = int(ry); F = 2 * R0
    cxh = DISC[0] - jaw * .8 * K; cyh = DISC[1]
    sq = ry / rx
    tcx = (MOUTH[0] - cxh) * sq * .55         # throat centre in frontal px (the disc is oblique: the hole sits back)
    rt = (5.4 + 6.6 * jaw + 2 * spew) * K
    FX, FY = coords((F, F)); U = FX - R0; Vv = FY - R0
    rr = (U * U + Vv * Vv) ** .5 * (1 / R0)
    fz = (F, F)
    # disc photo (USFWS lamprey disc), luminance mapped to the variant's gum palette
    ph = Image.open(os.path.join(DL, 'maw_open_wide.jpg')).convert('RGB').crop((213, 240, 557, 584))
    ph = warp(ph.resize((int(F * (1 + .1 * jaw)),) * 2, LAN), random.Random(7), 10, 8)
    ph = ImageOps.fit(ph, fz, BIC)
    l = cl((lumaT(ph) - .1) * 1.5)
    alb = ramp(l, c['disc'])
    det = highpass(lumaT(ph), 6, 2.6)
    # height: rolled lip, a face sloping down into the throat
    tq = (((U - tcx) * (1 / rt)) ** 2.0 + (Vv * (1 / rt)) ** 2.0) ** .5
    noise = fbm(rng, 9, fz, 3)
    throat = ss(1.08, .9, tq + (noise - .5) * .25)
    lip = 1 - ss(0, .09 + .03 * jaw, absT(rr - .93))
    face = ss(.9, 2.6, tq) * .25
    hd = lip * .32 + face + ss(.6, 1.0, lumaT(ph)) * .04
    # teeth
    TT = teeth(); big = [t for t in TT if t['area'] > 2000] or TT[:8]; small = [t for t in TT if t not in big] or TT
    TM = Image.new('L', fz, 0); TI = Image.new('L', fz, 0); TG = Image.new('L', fz, 0)
    rcv = 1.35 if v == 'acid' else 1.0     # receded gums: the teeth stand out longer, roots bare
    tr = random.Random(55)
    for f, n, size, kind in RINGS:
        pool = big if kind == 'big' else small
        for i in range(n):
            if v == 'acid' and tr.random() < .18 + .1 * w: tr.random(); continue   # lost teeth
            th = (i + .5 * (f > .3) + tr.uniform(-.2, .2)) / n * math.tau
            Rr = R0 * .88; d0 = _rim_d(tcx, th, Rr); dr = rt + (f + .08 * jaw * (1 - f)) * max(0, d0 - rt)
            px = R0 + tcx + math.cos(th) * dr; py = R0 + math.sin(th) * dr
            if (px - R0) ** 2 + (py - R0) ** 2 > (R0 * .9) ** 2: continue
            inward = math.atan2(-math.sin(th), -math.cos(th))
            ang = inward if jaw < .5 else inward + math.pi
            L = size * K * rcv * tr.uniform(.8, 1.15) * (1 - .5 * math.sin(jaw * math.pi))
            if L < 4: continue
            t = pool[tr.randrange(len(pool))]
            tw = max(3, int(L / t['ar'] * (1.0 if kind == 'big' else 1.3))); th_ = max(4, int(L))
            mk = t['mask'].resize((tw, th_), LAN); ik = t['ink'].resize((tw, th_), LAN)
            if kind == 'small' or v == 'snot':   # the inner rings filed to points
                tp = Image.new('L', (tw, th_), 0); ImageDraw.Draw(tp).polygon([(0, th_), (tw * .5, 0), (tw, th_)], fill=255)
                mk = ImageChops.multiply(mk, tp.filter(ImageFilter.GaussianBlur(.6)))
            gr = Image.linear_gradient('L').resize((tw, th_)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)  # 255 crown .. 0 root
            deg = math.degrees(math.atan2(-math.sin(ang), math.cos(ang))) - 90
            mk = mk.rotate(deg, BIC, expand=True); ik = ik.rotate(deg, BIC, expand=True, fillcolor=255); gr = gr.rotate(deg, BIC, expand=True)
            # centre of the rotated tooth: root sunk in the gum at (px,py), crown along ang
            ccx = px + math.cos(ang) * L * (.32 if v != 'acid' else .22); ccy = py + math.sin(ang) * L * (.32 if v != 'acid' else .22)
            at = (int(ccx - mk.width / 2), int(ccy - mk.height / 2))
            TM.paste(255, at, mk); TI.paste(ik, at, mk); TG.paste(gr, at, mk)
    tm = T(TM.convert('F')) * (1 / 255); ti = T(TI.convert('F')) * (1 / 255); tg = T(TG.convert('F')) * (1 / 255)
    tm = tm * (1 - throat * .9) * ss(1.0, .9, rr)
    # seat them: gum swells up round each root (receded in acid: a dark gap instead), the tooth shares the disc's height
    gum = cl(blur(tm, 5) * 2.2) * (1 - tm)
    if v == 'acid': hd = hd - gum * .05; alb = cmix(alb, (const(.05, fz), const(.01, fz), const(.012, fz)), gum * .6)
    else: hd = hd + gum * .09; alb = cmix(alb, (const(.40, fz), const(.04, fz), const(.06, fz)), gum * .35)
    ht = blur(tm, 2.2) * .22 + tm * .05 + (ti - .5) * .06 * tm    # engraving lines become grooves
    hd = hd + ht
    ta = grade((ti, ti, ti), *c['tooth'], contrast=1.3, keep=0)
    ta = cmul(ta, .75 + .35 * tg)
    if v == 'acid': ta = cmix(ta, (const(.30, fz), const(.20, fz), const(.10, fz)), (1 - ss(.15, .5, tg)) * .8)  # bare roots
    if v == 'orbit': ta = cmix(ta, (const(.30, fz), const(.02, fz), const(.03, fz)), (1 - ss(.0, .4, tg)) * .5)   # blood at the gumline
    alb = cmix(alb, ta, tm)
    # throat: black, ring folds going down, and what is coming up in it
    folds = tmap(tq, lambda q: math.sin(q * 9.0)) * ss(.0, .9, tq) * (1 - ss(.9, 1.0, tq))
    hd = hd - throat * .25 + folds * .02 * throat
    alb = cmix(alb, (const(.012, fz), const(.0, fz), const(.004, fz)), throat * (1 - folds * .25))
    lvl = jaw * .55 + spew
    if lvl > .05:
        sv = .9 - 1.5 * min(1, lvl); fl = throat * ss(sv - .08, sv + .08, Vv * (1 / rt))   # the surface rises with the retch
        alb = cmix(alb, (const(.22, fz), const(.012, fz), const(.016, fz)), fl * .9); hd = hd + fl * .03
    if hurt: alb = cmix(alb, (const(.5, fz), const(.04, fz), const(.04, fz)), (1 - tm) * .35 * hurt)
    dm = ss(1.0, .95, rr + (fbm(wr, 6, fz, 3) - .5) * .13)
    alb = cmix(alb, (const(.56, fz), const(.05, fz), const(.06, fz)), lip * (1 - tm) * .55)   # the inflamed rim: the disc's edge reads at game size
    if v == 'acid':   # the rim eaten through in bites
        bites = Image.new('L', fz, 0); dd = ImageDraw.Draw(bites); br = random.Random(88 + w)
        for i in range(5 + 2 * w):
            a = br.uniform(0, math.tau); r = br.uniform(.08, .15) * R0
            bx, by = R0 + math.cos(a) * R0 * .98, R0 + math.sin(a) * R0 * .98; dd.ellipse((bx - r, by - r * 1.2, bx + r, by + r * 1.2), fill=255)
        dm = dm * (1 - T(bites.filter(ImageFilter.GaussianBlur(3)).convert('F')) * (1 / 255))
    if tearoff:   # the death: a split through the disc that widens as it rips off
        sl = absT(U * .3 + Vv - R0 * .1 + (noise - .5) * R0 * .5)
        dm = dm * ss(R0 * .02, R0 * (.02 + .12 * tearoff), sl)
    film = film_map(rng, fz, dm, 7, .4, .6) if v != 'snot' else dm
    Lf = wet(alb, hd, dm, detail=det, k=20, dk=2.6, ao=6, sss=.5, sss_col=c['sss'], film=film, spec=.35 if v != 'snot' else .55,
             shin=36., rim=.05)
    if v == 'snot':   # a glaze of slime over the whole disc and its teeth
        gl = dm * (.08 + .14 * fbm(rng, 5, fz, 3)) * (1 - throat * .8)
        Lf = over(wet((const(SLIME[0], fz), const(SLIME[1], fz), const(SLIME[2], fz)), blur(hd, 3), gl, k=14, spec=.9, glint=1.2, film=dm, sss=0), Lf)
    # foreshorten frontal -> oblique and seat it at the disc centre
    im = to_pil(Lf).resize((max(2, int(2 * rx)), F), LAN)
    o = Image.new('RGBA', S, (0, 0, 0, 0)); o.paste(im, (int(cxh - rx), int(cyh - ry)), im)
    lay = from_pil(o)
    if spew:   # the gush: dark blood and black bile thrown out of the throat toward the player
        sr = random.Random(9); mx_, my_ = MOUTH[0] - 2 * K, MOUTH[1]
        pp = []
        for i in range(5):
            a = math.pi + sr.uniform(-.35, .35); L = (14 + 10 * spew) * K * sr.uniform(.6, 1.0)
            pp.append((bez((mx_, my_), (mx_ + math.cos(a) * L * .3, my_ + math.sin(a) * L * .3 - 6), (mx_ + math.cos(a) * L * .7, my_ + math.sin(a) * L * .7), (mx_ + math.cos(a) * L, my_ + math.sin(a) * L + 14), 18), sr.uniform(28, 44) * spew, 8))
        hg, mg = tubes(S, pp)
        lay = over(wet((const(.26, S), const(.012, S), const(.02, S)), hg, mg, k=8, spec=.9, sss=.2, film=mg), lay)
    return lay, lay['a']

# ------------------------------------------------------------------ the whole body
_hc = {}
def body(v, w, pore=.5, jaw=0., spew=0., hurt=0., die=0.):
    rng = random.Random(3 + w)
    Lh, mh, tear = hull(v, w, pore, hurt, die)
    Lg, mg = hangers(v, w, die)
    cv = canvas(S)
    if Lg: cv = over(Lg, cv)
    cv = over(Lh, cv)
    Lf, mf = fin(v, w); cv = over(Lf, cv)
    # blood from the wounds runs down the flank, more with each stage
    if w or hurt or die:
        st = [gp(*WOUND)] * (w > 0) + [gp(rng.uniform(-6, 26), rng.uniform(-14, 14)) for _ in range(int(2 * w + 3 * hurt + 8 * die))]
        st = [p for p in st if p]
        if st:
            Lb, mb = runs(rng, st, 90 + 120 * die, 5 + 2 * die, (.30, .012, .02) if v != 'acid' else (.36, .03, .03))
            cv = over(dict(rgb=tuple(q * mh for q in Lb['rgb']), a=Lb['a'] * mh), cv)
    if die > .3:   # guts sliding out of the flank split, hanging below
        gr = random.Random(12); pp = []
        for i in range(4):
            x0, y0 = gp(4 + i * 3, 6); L = (6 + 20 * die) * K * gr.uniform(.6, 1)
            pp.append((bez((x0, y0), (x0 + gr.uniform(-50, 50), y0 + L * .3), (x0 + gr.uniform(-60, 60), y0 + L * .6), (x0 + gr.uniform(-30, 30), y0 + L), 24), gr.uniform(13, 19), 10))
        hg, mg2 = tubes(S, pp)
        gc = (const(.40, S), const(.06, S), const(.07, S)) if v != 'acid' else (const(.62, S), const(.40, S), const(.38, S))
        cv = over(wet(gc, hg, mg2, k=14, sss=.5, spec=.6, film=mg2), over(shadow(mg2, 6, .6, 3, 5), cv))
    # the disc and its shadow on the collar
    if die < .3:
        Ld, md = disc(v, w, jaw, spew, hurt, die, tearoff=die / .3 if die else 0)
        cv = over(shadow(md, 9, .7, 7, 3), cv); cv = over(Ld, cv)
    else:   # torn away: the raw stump of the head and the gullet hole where it was
        sr = random.Random(21); st = blob(sr, S, *gp(-12, 0), 6.5 * K, 18 * K, rough=.9, lobes=4)
        hole = blob(sr, S, *gp(-12, 0), 3 * K, 6 * K, rough=.4, lobes=5) * st
        raw = grade(rgbT(P('meat_146.jpg', crop=(.38, .2, .98, .95))), (.12, .004, .006), (.50, .03, .03), (.84, .30, .22), contrast=1.5, keep=.02)
        if v == 'acid': raw = cmix(raw, (const(.62, S), const(.50, S), const(.46, S)), .4)
        raw = cmix(raw, (const(.01, S), const(.0, S), const(.004, S)), hole)
        cv = over(wet(raw, blur(st, 8) * .4 - hole * .2, st, k=14, sss=.5, spec=.6, film=st), cv)
    if v == 'snot':
        cv = slime_sheet(cv, mx(mh, md) if die < .3 else mh, die)
        cv = over(snot_drapes(w, die), cv)
    return cv

def slime_sheet(cv, mh, die=0.):
    """the hagfish sheet: a translucent grey-yellow layer over the whole form that swells past the outline and hangs lower"""
    rng = random.Random(808)
    sw = cl(blur(mh, 22) * 1.9)
    sw = mx(sw, mx(sh(sw, 0, 22) * .8, mx(sh(sw, 0, 44) * .6, sh(sw, 0, 66) * .4)))   # it sags: the sheet hangs below the body
    Yg = (Y - OY) * (1 / K)
    sheet = cl(blur(sw, 6)) * (1 - ss(30, 40 + 8 * die, Yg)) * ss(.2, .6, fbm(rng, 9, S, 3, aspect=.35) + .25)
    th = ss(.35, .75, fbm(rng, 6, S, 4, aspect=.3))   # streaky, running downward
    a = sheet * (.24 + .30 * th)
    # beyond the body the sheet must reach the atlas alpha cut (96/255) to swell the silhouette: thicker there
    a = mx(a, (sheet - mh) * ss(.1, .5, sheet) * .8)
    h = blur(sheet, 10) * .5 + th * .06
    L = wet((const(SLIME[0], S), const(SLIME[1], S), const(SLIME[2], S)), h, a, k=16, sss=.05, spec=.9, glint=1.4, film=sheet, shin=50.)
    return over(L, cv)

def fin(v, w):
    """the torn dorsal fin over the rear half: thin membrane on rays, ragged, so the profile is a fish and not a ball"""
    rng = random.Random(71 + w); top = []
    for i in range(15):
        x = 6 + i * 1.7; base = -prof(x, V[v]['H']) + max(0, x + 7) * V[v]['droop'] * .6
        ht = math.sin(min(1, i / 13) * math.pi) ** .7 * (6.5 if v != 'acid' else 5) * rng.uniform(.55, 1.1)
        top.append((x, base + 2.5, base - ht))
    poly = [gp(x, b) for x, b, _ in top] [::-1] + [gp(x, t) for x, _, t in top]
    m = polymask(S, poly, soft=1.5) * ss(.2, .4, fbm(rng, 9, S, 3, aspect=.6) + .3 - .3 * (v == 'acid'))
    m = m * (1 - holes(rng, [(*gp(14, top[5][2] + 1), 12, 18), (*gp(23, top[10][2] + 1), 9, 14)] if v != 'snot' else [], .7))
    rays = [(bez(gp(x, b), gp(x + .8, (b + t) / 2), gp(x + 1.6, t + 1), gp(x + 2, t), 8), 3.2, 1.0) for x, b, t in top[1:-1:2]]
    hr, mr = tubes(S, rays); mr = mr * (.35 if v != 'acid' else 1)
    mm = mx(m, mr * .9)
    col = (const(.26, S), const(.03, S), const(.04, S)) if v != 'acid' else (const(.56, S), const(.46, S), const(.44, S))
    col = cmix(col, (const(.10, S), const(.005, S), const(.01, S)) if v != 'acid' else (const(.40, S), const(.30, S), const(.28, S)), mr)
    return wet(col, blur(mm, 3) * .3 + hr * .25, mm, k=16, sss=.9, sss_col=(.5, .03, .04), spec=.4, film=mm), mm

def snot_drapes(w, die=0.):
    """hagfish slime hanging under the belly: ropes sagging between points on the skin with a thin veil above each, the veil
    holed and stretched; loops and webs, never cones or blocks"""
    rng = random.Random(61 + 7 * w); pts = []
    for i in range(6):
        x = -9 + i * 6.4 + rng.uniform(-1.2, 1.2); pts.append(gp(x, prof(x, 1.05) * 1.0 + max(0, x + 7) * .15 - 2.5))
    paths = []; veil = Image.new('L', (W * 2, H * 2), 0); d = ImageDraw.Draw(veil)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        sag = rng.uniform(6, 13) * K * (1 + .6 * die); mx_ = (x0 + x1) / 2 + rng.uniform(-8, 8); my_ = max(y0, y1) + sag
        cur = bez((x0, y0), (x0 + (mx_ - x0) * .4, my_ * .9 + y0 * .1), (x1 + (mx_ - x1) * .4, my_ * .9 + y1 * .1), (x1, y1), 24)
        paths.append((cur, rng.uniform(5, 8), rng.uniform(5, 8), .35))
        d.polygon([(x * 2, y * 2) for x, y in cur], fill=255)
    h, m = tubes(S, paths)
    vm = T(veil.resize(S, LAN).convert('F')) * (1 / 255) * ss(.25, .45, fbm(rng, 12, S, 3, aspect=.4) + .15)
    a = mx(m * .75, vm * .85)
    return wet((const(SLIME[0] * .62, S), const(SLIME[1] * .56, S), const(SLIME[2] * .44, S)), h * .5 + vm * .3, a * .9, k=10, spec=.6, glint=1.0, film=mx(m, vm), sss=.1, sss_col=(.4, .25, .15))

def _old_snot_drapes(w, die=0.):
    rng = random.Random(61 + 7 * w); paths = []
    for i in range(7):
        x = -8 + i * 5.6 + rng.uniform(-1.5, 1.5); x0, y0 = gp(x, prof(x, 1.05) + max(0, x + 7) * .15 - 2)
        L = rng.uniform(5, 12) * K * (1 + .5 * die); wd = rng.uniform(1.8, 3.2) * K
        paths.append((bez((x0, y0), (x0 + rng.uniform(-6, 6), y0 + L * .35), (x0 + rng.uniform(-10, 10), y0 + L * .7), (x0 + rng.uniform(-10, 10), y0 + L), 20), wd, 2.0))
    h, m = tubes(S, paths)
    m = m * ss(.25, .45, fbm(rng, 14, S, 3, aspect=.3) + .1)
    return wet((const(SLIME[0] * .9, S), const(SLIME[1] * .9, S), const(SLIME[2] * .85, S)), h, m * .85, k=12, spec=.9, glint=1.2, film=m, sss=.05)
