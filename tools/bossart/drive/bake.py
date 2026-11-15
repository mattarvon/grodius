#!/usr/bin/env python3
"""THE GRAVITY DRIVE, Matt's pick c3 Spine Wheel, baked for the game. Run: python3 -I tools/bossart/drive/bake.py
Writes src/sprites/boss/drive.png + drive.json (frame lists, plus the wheel's layout under 'L' for src/render/gross/drive.ts).
One spine curled on itself: its vertebrae turn with the sim's outer ring (b.ra), each one baked at A angles and lit from the
fixed light at every angle; ribs snap by wound stage; fused knuckles round the socket counter-turn (b.rb); three shoulder blades
sit on the sim's plate points; the eye is a globe and a gaze-baked iris; the tentacles are spinal cord built from segments.
The wall, heart and lung stay still and carry the wound stages. Lists:
  v<p> r<p> (A angles each), knob, socket, lid (6, closed->open), globe (s0 s1 s2 h0 h1 h2 glow), iris_<i|a|t|f> (9 gazes),
  eyeb (3, the burst), pl<i> (d0 d1 d2), pf<i> (8 tumble), ps<i> (scar), heart<w> lung<w> (3 beats), heartd,
  wall<w> walld0 walld1 (tiles), cord0..2 (16 angles over 180), fray stump (32 angles), shard (2 x 32)."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *
from bake import Baker, bend, OUT
SEED = 303
A = 28          # angles per turning part: 12.9 deg, a spike tip is off by 3 px at most (32 put the atlas past 400 KB)

class DB(Baker):
    """Baker for parts: any canvas size (a multiple of P), any pivot; and tiles for the big still layers"""
    def spr(s, im):
        gs = (im.width // P, im.height // P)
        p = im.convert('RGBa').resize(gs, LAN).convert('RGBA'); r, g_, b, a = p.split(); rgb = Image.merge('RGB', (r, g_, b))
        rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=s.unsharp, threshold=2))
        rgb.putalpha(a.point(lambda v: 255 if v >= s.cut else 0)); return rgb
    def put(s, name, sp, ox, oy):
        if name not in s.frames: s.frames[name] = []; s.names.append(name)
        s.frames[name].append((sp, ox, oy))
    def addp(s, name, im, pivot):
        """im painted round pivot (hero px): the frame's (ox, oy) is from the pivot"""
        sp = s.spr(im); bb = sp.getchannel('A').getbbox() or (0, 0, 1, 1)
        s.put(name, sp.crop(bb), bb[0] - pivot[0] // P, bb[1] - pivot[1] // P)
    def tiles(s, name, im, tw=34, th=32):
        """a full-canvas still layer cut into tiles: a tile a wound never reached is byte-identical in every stage and is stored once"""
        sp = s.spr(im); ox, oy = CX // P, CY // P
        for y in range(0, sp.height, th):
            for x in range(0, sp.width, tw):
                t = sp.crop((x, y, min(sp.width, x + tw), min(sp.height, y + th))); bb = t.getchannel('A').getbbox()
                if bb: s.put(name, t.crop(bb), x + bb[0] - ox, y + bb[1] - oy)
        if name not in s.frames: s.put(name, Image.new('RGBA', (1, 1)), 0, 0)

def L(pc, u, v): return (pc + u * P, pc + v * P)

# ---------------------------------------------------------------- the spine
def layout():
    """vertebrae along the spine, ring-local angle (deg, screen), radius (game px), proto, gun. Guns sit on the sim's 8 fire
    points (k * 45 deg): the bullets leave their hollow tips. The missing arc is 0..45: no fire point falls in it"""
    rng = random.Random(SEED); V = []
    for i in range(22):
        th = 45 + i * 15; t = (th - 45) / 315; gun = (th % 45 == 0)
        if not gun: th += rng.uniform(-2.5, 2.5)
        a = math.radians(th); r = 66 + 5 * math.sin(a * 2 + .7) + 3 * math.sin(a * 5) - ss_(.8, 1, t) * 8
        s = 1.25 - abs(t - .3) * 1.05
        sz = 0 if s > 1.02 else (1 if s > .78 else 2)
        p = (3 + sz) if gun else sz
        V.append([round(th, 2), round(r, 1), p, 1 if gun else 0])
    # ribs on every other vertebra, bending either way; snap: the wound stage at which it breaks (0 = broken already, 3 never)
    snaps = [0, 2, 1, 3, 0, 1, 2, 3, 1, 2, 0]; R_ = []
    for j, i in enumerate(range(0, 21, 2)):
        R_.append([i, j % 2, snaps[j]])
    # the fused knuckles round the socket: uneven angle, radius and size
    K = []; th = 0
    while th < 350:
        K.append([round(th, 1), round(rng.uniform(31, 39), 1), rng.randrange(6)]); th += rng.uniform(19, 31)
    return V, R_, K
VPROTO = [(1.2, 0, 1), (.9, 0, 3), (.66, 0, 5), (1.18, 1, 7), (.92, 1, 8), (.64, 1, 9)]
VC = 280; VP = (VC // 2, VC // 2)
def vert_maps(s, gun, seed):
    """one vertebra round its centre, +x pointing out of the wheel: body block, spinous process (a hollow gun spur on the 8
    fire points), a transverse spur, and the red cord and disc tissue threaded behind"""
    rng = random.Random(seed); C = (VC, VC); pc = VC // 2; j = lambda: rng.uniform(-.7, .7)
    rd = 8 + 7 * s; w = 5.4 + 2.4 * s
    Q = lambda u, v: L(pc, u + j() * .6, v + j() * .6)
    polys = [[Q(-rd*.9, -w*.86), Q(-rd*.4, -w), Q(rd*.5, -w*.96), Q(rd*.75, -w*.42), Q(rd*.75, w*.42), Q(rd*.5, w*.96), Q(-rd*.4, w), Q(-rd*.9, w*.86)]]
    bx = rng.uniform(-2.2, 2.2)
    if gun:
        tip = 27.5; polys.append([Q(rd*.55, -w*.5), Q((rd*.55 + tip) / 2, bx * .5 - 2.2), Q(tip, bx - .6), Q(tip + 1, bx + .7), Q((rd*.55 + tip) / 2, bx * .5 + 2.4), Q(rd*.55, w*.5)])
    else:
        ln = rng.uniform(7, 15) * (.7 + .4 * s); polys.append([Q(rd*.6, -w*.4), Q(rd*.6 + ln, bx - .8), Q(rd*.6 + ln + .5, bx + .5), Q(rd*.6, w*.4)])
    sd = rng.choice((-1, 1))
    polys.append([Q(-1, sd*w*.8), Q(-2.5, sd*(w + 6.5*s)), Q(.8, sd*(w + 5.5*s)), Q(2.5, sd*w*.4)])
    vm = blur(pmask(lambda d, k: [d.polygon([(x * k, y * k) for x, y in p], fill=255) for p in polys], C), 1)
    balb, bdet = tissue(rng, 'shell_60.jpg', BONE, C, contrast=1.5, keep=.04, amp=8, cells=4, hp=10, gain=2.4, crop=(rng.uniform(.05, .4), rng.uniform(.05, .3), .95, .75))
    stain = ss(.46, .7, fbm(rng, 5, C, 3)); bb = cmix(balb, (.17,.012,.016), stain * .58)
    bb = cmul(bb, .45 + .75 * ss(.1, .7, blur(vm, 7)))
    bh = dome(vm, 14, 3) * .9 + fbm(rng, 12, C, 3) * .05
    if gun:
        # the bore: a raw weeping hollow at r 84 where the shot leaves, the only red in the spur
        bore = blob(rng, C, *L(pc, 18 - (66 - 66), bx * .55), 1.7 * P, 1.4 * P, rough=.2, lobes=3, edge=1.5) * vm
        bb = cmix(bb, (.30,.02,.025), bore); bh = bh - bore * .25
    body = dict(alb=bb, h=bh, m=vm, det=bdet, wet=dict(k=26, dk=3, ao=9, sss=.24, sss_col=(.45,.03,.03), spec=.3, shin=24), film=vm * .3)
    malb, mdet = tissue(rng, 'path_200.jpg', ((.01,.001,.003),(.09,.008,.012),(.24,.05,.05)), C, contrast=1.7, keep=.03, amp=10, cells=4, hp=12, gain=2.8)
    # a dark wet seam between the blocks, flattened: bright round discs here read as beads, and as red bullets
    dh, dm = lumpy([([L(pc, -3, v) for v in range(-13, 14, 2)], 3.4 * P, 3.4 * P)], rng, C, lump=.08, freq=1.1)
    cord = dict(alb=malb, h=dh * .4, m=dm, det=mdet, wet=dict(k=10, dk=4, sss=.35, spec=.25), film=dm * .5)
    return body, cord
def lit_vert(body, cord, deg):
    b = rot_maps(body, deg, VP); c = rot_maps(cord, deg, VP)
    cv = over(light_maps(c), canvas((VC, VC)))
    sd = shadow(b['m'], r=6, k=.85, dx=2, dy=4); cv = over(dict(rgb=sd['rgb'], a=sd['a'] * c['m']), cv)
    return to_pil(over(light_maps(b), cv))
def rib_maps(side, snapped, seed):
    rng = random.Random(seed); C = (VC, VC); pc = VC // 2; bend_ = (1 if side else -1) * rng.uniform(5, 9)
    end = -14 if snapped else -31
    pts = bez(L(pc, -4, 0), L(pc, end * .35, bend_ * .5), L(pc, end * .7, bend_), L(pc, end, bend_ * .7 if not snapped else bend_ * .9), 26)
    rh, rm = lumpy([(pts, 2.9 * P, 1.9 * P)], rng, C, lump=.1, freq=.5)
    balb, bdet = tissue(rng, 'shell_60.jpg', BONE, C, contrast=1.5, keep=.04, amp=8, cells=4, hp=10, gain=2.4, crop=(.1,.05,.95,.75))
    stain = ss(.46, .7, fbm(rng, 6, C, 3)); alb = cmul(cmix(balb, (.15,.01,.014), stain * .6), .9)
    if snapped:
        ex, ey = pts[-1]; sp = []
        for k in range(5):
            a = math.pi + rng.uniform(-.9, .9); ln = rng.uniform(1.5, 4.5) * P; sp.append([(ex - 2.2 * P * math.sin(a), ey + 2.2 * P * math.cos(a)), (ex + math.cos(a) * ln, ey + math.sin(a) * ln), (ex + 2.2 * P * math.sin(a), ey - 2.2 * P * math.cos(a))])
        spl = blur(pmask(lambda d, k: [d.polygon([(x * k, y * k) for x, y in p], fill=255) for p in sp], C), 1)
        rm = mx(rm, spl); rh = mx(rh, spl * .5)
        marrow = blob(rng, C, ex, ey, 2.0 * P, 1.8 * P, rough=.3, lobes=3, edge=1.5)
        alb = cmix(alb, (.34,.02,.03), marrow)
    return dict(alb=alb, h=rh, m=rm, det=bdet, wet=dict(k=15, dk=2.4, ao=6, sss=.22, spec=.3, shin=26))
def knob(i):
    rng = random.Random(SEED + 400 + i); C = (96, 96); spots = []
    for k in range(rng.randint(2, 4)):
        spots.append((48 + rng.uniform(-12, 12), 48 + rng.uniform(-10, 10), rng.uniform(20, 32) * (1 - k * .12)))
    Hl = domes(spots, C); m = ss(.03, .09, Hl)
    balb, bdet = tissue(rng, 'shell_60.jpg', BONE, C, contrast=1.5, keep=.04, amp=6, cells=3, hp=6, gain=2.4, crop=(.2,.1,.8,.6))
    stain = ss(.4, .7, fbm(rng, 3, C, 3))
    alb = cmul(cmix(balb, (.2,.02,.02), stain * .55), .8)
    return to_pil(wet(alb, Hl * .9 + fbm(rng, 10, C, 3) * .06, m, detail=bdet, k=23, dk=3, ao=9, sss=.3, spec=.3, shin=24))

# ---------------------------------------------------------------- the socket, lids, eye
EC = 320; EP = (EC // 2, EC // 2); ER = 26 * P
def socket():
    rng = random.Random(SEED + 50); C = (EC, EC); pc = EC // 2
    m = blob(rng, C, pc, pc, 35 * P, 34 * P, rough=.18, lobes=6, edge=3)
    X, Y = coords(C); d = ((X - pc) ** 2 + (Y - pc) ** 2) ** .5 * (1 / P)
    lip = ss(23, 27, d) * (1 - ss(29, 34, d + (fbm(rng, 8, C, 3) - .5) * 6))
    alb, det = tissue(rng, 'meat_146.jpg', ((.03,.002,.005),(.26,.02,.022),(.55,.12,.09)), C, contrast=1.5, keep=.05, amp=10, cells=4, hp=8, gain=2.6)
    alb = cmix(col((.012,.002,.004), C), alb, lip * .9 + .1)
    h = lip * .5 + blur(m, 10) * .3 - ss(27, 10, d) * .4
    return to_pil(wet(alb, h, m, detail=det, k=22, dk=6, ao=8, sss=.8, spec=.5, film=lip))
def lids(o):
    """two membranes of raw meat over the eye; o 0 = shut on a ragged slit, 1 = drawn back under the socket's lip"""
    rng = random.Random(SEED + 60); C = (EC, EC); pc = EC // 2
    X, Y = coords(C); x = (X - pc) * (1 / ER); y = (Y - pc) * (1 / ER)
    disc = blob(random.Random(SEED + 61), C, pc, pc, 30 * P, 29.5 * P, rough=.14, lobes=6, edge=3)
    rag = (fbm(random.Random(SEED + 62), 10, C, 3) - .5) * .16
    ap = cl(1 - x * x * 1.05) ** .5 * (o * 1.25 + .02)
    up = ss(-.03, .03, -(y + .06) - ap * 1.05 - rag); lo = ss(-.03, .03, (y + .06) - ap * .9 - rag)
    m = mx(up, lo) * disc
    if o >= 1: m = m * 0
    edge = ss(.0, .14, -(y + .06) - ap * 1.05 - rag) * up; edge2 = ss(0, .14, (y + .06) - ap * .9 - rag) * lo
    rim = (1 - edge) * up + (1 - edge2) * lo
    alb, det = tissue(rng, 'meat_134.jpg', ((.02,.003,.006),(.22,.02,.028),(.56,.25,.20)), C, contrast=1.5, keep=.05, amp=10, cells=4, hp=8, gain=2.6)
    v = veinnet(rng, C, m, n=8, w0=3, seedpts=[(pc - ER, pc), (pc + ER, pc)])
    alb = cmix(alb, (.07,.004,.016), v * .8)
    h = blur(m, 8) * .5 + rim * .35 + blur(v, 1.5) * .12
    return to_pil(wet(cmul(alb, .8), h, m, detail=det, k=20, dk=6, ao=7, sss=.7, spec=.22, film=rim * .6))
IRC = dict(inner=(.62,.34,.08), outer=(.26,.07,.03))  # amber iris: it has to separate from the red tissue round it
GAZES = [(0, 0)] + [(.34 * math.cos(k * math.pi / 4), .34 * math.sin(k * math.pi / 4)) for k in range(8)]
def eyelayer(**kw):
    """an eye() layer, centred on the EC canvas"""
    e = eye(SEED, ER, **kw); bw = e['a'].size[0]; o = (EC - bw) // 2; out = []
    for c in e['rgb'] + (e['a'],):
        im = Image.new('F', (EC, EC), 0.0); im.paste(c.im, (o, o)); out.append(T(im))
    return to_pil(dict(rgb=tuple(out[:3]), a=out[3]))

# ---------------------------------------------------------------- shoulder blades on the plate points
PC_ = 256
PLA = [math.pi - .62, math.pi, math.pi + .62]
def plate_maps(i, dmg):
    rng = random.Random(SEED + 31 + i); C = (PC_, PC_); pc = PC_ // 2; a = PLA[i]
    ca, sa = math.cos(a), math.sin(a); tx, ty = -sa, ca
    Q = lambda u, v: (pc + ca * u * P + tx * v * P, pc + sa * u * P + ty * v * P)
    jit = rng.uniform(-3, 3)
    pts = bez(Q(-15, -7), Q(-4, -16), Q(12, -17 + jit), Q(16, -8), 8) + bez(Q(16, -8), Q(19, 0), Q(17, 8), Q(13, 16 + jit), 8) + bez(Q(13, 16), Q(0, 14), Q(-9, 11), Q(-15, 6), 8)
    pm = polymask(C, pts, soft=1.4)
    rh, rm = lumpy([(bez(Q(-12, -1), Q(-2, -3), Q(7, -6), Q(13, -7), 12), 8, 4)], rng, C, lump=.05, freq=.4)
    balb, bdet = tissue(rng, 'shell_60.jpg', BONE, C, contrast=1.5, keep=.04, amp=8, cells=4, hp=10, gain=2.4, crop=(.1,.05,.95,.75))
    stain = ss(.5, .75, fbm(rng, 5, C, 3)); alb = cmul(cmix(balb, (.17,.012,.016), stain * (.4 + dmg * .5)), 1.0)
    hs = blur(pm, 10) * .7 + blur(pm, 3) * .25 + rh * .35
    # fused at the inner edge: tissue grown over the bone where it meets the hub
    fuse = ss(.0, 1, blur(pmask(lambda d, k: d.ellipse([(Q(-15, 0)[0] - 7 * P) * k, (Q(-15, 0)[1] - 13 * P) * k, (Q(-15, 0)[0] + 7 * P) * k, (Q(-15, 0)[1] + 13 * P) * k], fill=255), C), 6)) * pm
    alb = cmix(alb, (.20,.015,.02), fuse * .8)
    if dmg > 0:
        cr = ss(.84 - dmg * .1, .95, ridged(random.Random(SEED + 90 + i), 3, C, 3)) * pm
        alb = cmix(alb, (.06,.004,.006), cr); hs = hs - cr * .2
    if dmg > .6:
        # split and hanging: a chunk gone, the raw underside showing
        gone = blob(rng, C, *Q(10, rng.choice((-9, 9))), 8 * P, 6 * P, rough=.5, lobes=4) * pm
        pm = pm * (1 - gone)
    return dict(alb=alb, h=hs, m=pm, det=bdet, wet=dict(k=20, dk=3, ao=8, sss=.3, spec=.32, shin=24)), Q
def plate(i, dmg):
    M, Q = plate_maps(i, dmg); rng = random.Random(SEED + 70 + i); cv = over(light_maps(M), canvas((PC_, PC_)))
    if dmg > 0:
        cv = blood(rng, cv, [(Q(rng.uniform(-10, 12), rng.uniform(-12, 12))) for _ in range(int(3 + dmg * 6))], maxlen=40 + dmg * 50, w=2.6, clip=M['m'], size=(PC_, PC_))
    return to_pil(cv), M
def scar(i):
    """where a blade tore off: raw meat with the fibres it pulled"""
    rng = random.Random(SEED + 80 + i); C = (PC_, PC_); pc = PC_ // 2; a = PLA[i]
    m = blob(rng, C, pc - math.cos(a) * 3 * P, pc - math.sin(a) * 3 * P, 12 * P, 10 * P, rough=.5, lobes=5, ang=a)
    alb, det = tissue(rng, 'meat_146.jpg', ((.04,.003,.006),(.34,.025,.03),(.66,.16,.12)), C, contrast=1.5, keep=.1, amp=10, cells=4, hp=8, gain=2.8)
    cv = over(wet(alb, blur(m, 6) * .5 + fbm(rng, 10, C, 3) * .2 * m, m, detail=det, k=24, dk=7, ao=7, sss=.8, spec=.5, film=m), canvas(C))
    cv = hang(rng, cv, [(pc + rng.uniform(-30, 30), pc + rng.uniform(0, 30)) for _ in range(5)], C, maxlen=60, w=4)
    return to_pil(cv)

# ---------------------------------------------------------------- organs and the torn wall behind the wheel
OC = 320; OP = (OC // 2, OC // 2)
HEART = (34, 30); LUNG = (42, -44)
WSP = [(36,-40,25,12,.8), (40,30,27,12,-.2), (84,-20,15,17,0), (30,76,22,10,0), (-20,-54,16,6,0), (80,62,15,10,0)]
def organ(kind, stage, beat, dying=0):
    rng = random.Random(SEED + (1 if kind == 'heart' else 2)); C = (OC, OC); pc = OC // 2
    if kind == 'lung':
        m = blob(rng, C, pc, pc, 36 * P, 34 * P, rough=.3, lobes=5, edge=2)
        alb, det = tissue(rng, 'path_196.jpg', ((.012,.004,.012),(.13,.03,.07),(.40,.17,.22)), C, contrast=1.7, keep=.04, amp=22, hp=6, gain=3.0)
        L_ = wet(alb, dome(m, 24, 6), m, detail=det, k=22, dk=8, ao=7, sss=.3, spec=.3, film=m * .5)
    else:
        m = blob(rng, C, pc, pc, 34 * P, 30 * P, rough=.26, lobes=4, ang=.5, edge=2)
        alb, det = tissue(rng, 'meat_146.jpg', ((.03,.002,.005),(.30,.02,.022),(.62,.13,.10)), C, contrast=1.5, keep=.06, amp=22, hp=10, gain=2.6)
        v = veinnet(rng, C, m, n=9, w0=5, seedpts=[(pc - 4 * P, pc - 16 * P), (pc + 6 * P, pc - 6 * P)])
        L_ = wet(cmix(alb, (.08,.004,.018), v * .8), dome(m, 24, 6) + blur(v, 2) * .12, m, detail=det, k=24, dk=6, ao=7, sss=.6, spec=.5, film=m * .7)
    cv = over(L_, canvas(C)); wr = random.Random(SEED + 20 + stage * 3 + (kind == 'lung'))
    o = HEART if kind == 'heart' else LUNG
    if kind == 'lung': spots = [s for s in [(pc + (36 - o[0]) * P, pc + (-40 - o[1]) * P, 22 * P, 11 * P, .8)] if stage + dying >= 1]
    else: spots = [s for s in [(pc + (40 - o[0]) * P, pc + (30 - o[1]) * P, 22 * P, 11 * P, -.2)] if stage + dying >= 2]
    if dying: spots = [(x, y, rx * 1.6, ry * 1.8, a_) for x, y, rx, ry, a_ in spots] + [(pc + 6 * P, pc + 10 * P, 16 * P, 12 * P, .3)]
    if spots:
        k = 1 + stage * .2
        cv = wound(wr, cv, [(x, y, rx * k, ry * k, a_) for x, y, rx, ry, a_ in spots], body=m, size=C)
        cv = blood(wr, cv, [(x + wr.uniform(-rx, rx), y + ry * .5) for x, y, rx, ry, a_ in spots for _ in range(5 + 4 * stage)], maxlen=120 + 60 * stage, w=4, clip=m, size=C)
    im = to_pil(cv)
    if beat:
        k = (.07 if kind == 'heart' else .045) * beat
        im = bend(im, lambda x, y: (-(x - pc) * k * (1 - min(1, math.hypot(x - pc, y - pc) / (40 * P)) * .3), -(y - pc) * k * (1.15 if kind == 'lung' else .9)))
    return im
_wall = {}
def wall_base():
    if _wall: return _wall
    rng = random.Random(SEED); X, Y = coords(S)
    parts = [(*g(60,-20), 58*P, 76*P, .1), (*g(70,60), 50*P, 46*P, -.2), (*g(112,-70), 40*P, 44*P, 0), (*g(112,20), 30*P, 80*P, 0), (*g(-8,60), 46*P, 30*P, .1), (*g(-10,-52), 40*P, 24*P, 0), (*g(-44,4), 22*P, 44*P, 0)]
    wall = tears(rng, parts, rough=.34, lobes=6); wall = ss(.42, .5, blur(wall, 2) + (fbm(rng, 30, S, 3) - .5) * .4)
    wall = wall * ss(0, 18, Y - 6) * ss(0, 18, S[1] - 6 - Y)
    falb, fdet = tissue(rng, 'meat_134.jpg', ((.02,.003,.006),(.20,.018,.026),(.56,.28,.22)), contrast=1.5, keep=.05, amp=34, hp=12, gain=2.6)
    malb, mdet = tissue(rng, 'path_200.jpg', ((.02,.002,.005),(.20,.012,.018),(.48,.10,.09)), contrast=1.7, keep=.05, amp=28, hp=12, gain=2.8)
    pat = ss(.44, .6, fbm(rng, 4, S, 4)); base = cmix(malb, falb, pat); det = mix(mdet, fdet, pat)
    fold = ridged(rng, 4, S, 3); wh = dome(wall, 40, 8) * .7 + T(warp(fbm(rng, 3, S, 4, aspect=5).im, rng, 40, 8)) * .14 - fold * .07
    base = cmul(base, 1 - fold * .5)
    L_ = wet(base, wh, wall, detail=det, k=24, dk=7, ao=7, sss=.5, film=film_map(rng, S, wall, 6), spec=.3)
    _wall.update(layer=dict(rgb=cmul(L_['rgb'], .62), a=L_['a']), m=wall, malb=malb, mdet=mdet)
    return _wall
def wall(stage, dying=0):
    w = wall_base(); cv = over(w['layer'], canvas(S)); dmg = (.2, .6, .85)[stage] if not dying else (1.0, 1.15)[dying - 1]
    rng = random.Random(SEED + 9 + stage + 10 * dying); n = (2, 4, 6)[stage] if not dying else 6
    k = 1 + dmg * .4; bm = w['m']
    sp = [(*g(x, y), rx * P * k, ry * P * k, a_) for x, y, rx, ry, a_ in WSP[:n]]
    cv = wound(rng, cv, sp, contents=wet(w['malb'], ss(.4, .7, fbm(rng, 9, S, 3)) * .6, Tc(1), detail=w['mdet'], k=20, sss=.7), body=bm)
    cv = blood(rng, cv, [(x + rng.uniform(-rx, rx), y + ry * .6) for x, y, rx, ry, a_ in sp for _ in range(int(3 + dmg * 7))], maxlen=110 + dmg * 200, w=3.2 + dmg * 2.6, clip=bm)
    if dying:
        cv = over(gutcoil(rng, *g(40, 70), n=6 + 3 * dying, r=60, w0=18), cv)
        cv = hang(rng, cv, [g(rng.uniform(-30, 100), rng.uniform(20, 100)) for _ in range(10 * dying)], maxlen=200, w=6)
        if dying > 1:
            cv = bites(rng, cv, [(*g(-44, 10), 90, 120, 0), (*g(100, -96), 120, 70, 0), (*g(110, 96), 90, 70, 0)])
            cv = blood(rng, cv, [g(rng.uniform(-40, 110), rng.uniform(-100, 100)) for _ in range(30)], maxlen=320, w=6, clip=bm)
    return to_pil(cv)

# ---------------------------------------------------------------- cord: the tentacles, built from segments along the sim's points
CC = 96; CP = (CC // 2, CC // 2)
def cord_maps(wd, seed, kind='seg'):
    rng = random.Random(seed); C = (CC, CC); pc = CC // 2
    if kind == 'seg':
        pts = [L(pc, u, 0) for u in (-6, -3, 0, 3, 6)]; paths = [(pts, wd * P, wd * P * .92)]
        for sgn in (-1, 1):  # a root ganglion off each side, as on a real cord
            paths.append(([L(pc, rng.uniform(-2, 2), 0), L(pc, rng.uniform(-1, 2), sgn * wd * .75)], wd * P * .5, wd * P * .42))
    elif kind == 'fray':
        paths = [([L(pc, -5, 0), L(pc, 0, 0)], wd * P, wd * P * .8)]
        for k in range(7):
            a = rng.uniform(-.8, .8); ln = rng.uniform(5, 11); pts = bez(L(pc, -1, 0), L(pc, ln * .4, a * 3), L(pc, ln * .7, a * 6 + rng.uniform(-2, 2)), L(pc, ln, a * ln * .8), 10)
            paths.append((pts, wd * P * .35, .25 * P))
    else:  # stump: where it tears out of the wheel, a bloody collar with roots pulled back
        paths = [([L(pc, -1, 0), L(pc, 6, 0)], wd * P * 1.25, wd * P)]
        for k in range(6):
            a = rng.uniform(-1.2, 1.2); ln = rng.uniform(4, 9); paths.append((bez(L(pc, 1, 0), L(pc, -ln * .4, a * 3), L(pc, -ln * .7, a * 5), L(pc, -ln, a * ln * .7), 8), wd * P * .32, .3 * P))
    h, m = lumpy(paths, rng, C, lump=.14, freq=1.3)
    alb, det = tissue(rng, 'path_202.jpg', ((.10,.03,.04),(.40,.22,.20),(.74,.58,.48)), C, contrast=1.4, keep=.04, amp=6, cells=3, hp=4, gain=2.4)
    vn = veinnet(rng, C, m, n=3, w0=1.4); alb = cmix(alb, (.26,.015,.02), vn * .8)
    if kind == 'stump':
        raw = blob(rng, C, *L(pc, 0, 0), wd * P * 1.4, wd * P * 1.5, rough=.3, lobes=3); alb = cmix(alb, (.32,.02,.03), raw)
    return dict(alb=alb, h=h, m=m, det=det, wet=dict(k=14, dk=3, sss=.6, spec=.42), film=m)
def shard_maps(i):
    rng = random.Random(SEED + 600 + i); C = (CC, CC); pc = CC // 2
    pts = [L(pc, rng.uniform(-7, -4), rng.uniform(-3, -1)), L(pc, rng.uniform(-1, 1), -3), L(pc, rng.uniform(5, 8), rng.uniform(-1, 1)), L(pc, rng.uniform(0, 2), 2.5), L(pc, rng.uniform(-5, -3), rng.uniform(1.5, 3))]
    m = polymask(C, pts, soft=1)
    balb, bdet = tissue(rng, 'shell_60.jpg', BONE, C, contrast=1.5, keep=.04, amp=4, cells=3, hp=4, gain=2.4)
    alb = cmix(balb, (.30,.02,.03), ss(.55, .7, fbm(rng, 3, C, 3)))
    return dict(alb=alb, h=dome(m, 6, 2), m=m, det=bdet, wet=dict(k=20, dk=3, ao=6, sss=.3, spec=.35, shin=24))

def main():
    import time; t0 = time.time()
    V, RB, K = layout()
    b = DB('drive', S, (204, 224), (CX, CY), colors=236)
    # the wheel: every vertebra prototype and rib at A angles
    for p, (s, gun, sd) in enumerate(VPROTO):
        body, cord = vert_maps(s, gun, SEED * 10 + sd)
        for j in range(A): b.addp(f'v{p}', lit_vert(body, cord, j * 360 / A), VP)
    for p in range(4):
        M = rib_maps(p % 2, p >= 2, SEED * 20 + p)
        for j in range(A): b.addp(f'r{p}', to_pil(light_maps(rot_maps(M, j * 360 / A, VP))), VP)
    print('wheel', round(time.time() - t0, 1)); t0 = time.time()
    for i in range(6): b.addp('knob', knob(i), (48, 48))
    b.addp('socket', socket(), EP)
    for o in (0, .15, .35, .55, .78, 1.0): b.addp('lid', lids(o) if o < 1 else lids(.999), EP)
    for st, haem in enumerate((.25, .5, .85)): b.addp('globe', eyelayer(part='globe', haem=haem), EP)
    for st, haem in enumerate((.35, .6, .95)): b.addp('globe', eyelayer(part='globe', haem=haem + .5, veinglow=.25), EP)
    b.addp('globe', eyelayer(part='globe', haem=.45, veinglow=.5), EP)
    for nm, kw in (('i', dict(pupil=.36, **IRC)), ('a', dict(pupil=.24, glow=.12, **IRC)), ('t', dict(pupil=.13, glow=.4, **IRC)), ('f', dict(pupil=.21, glow=.85, **IRC))):
        for gz in GAZES: b.addp('iris_' + nm, eyelayer(part='iris', gaze=gz, **kw), EP)
    for r_ in (.55, 1.0, 1.5): b.addp('eyeb', eyelayer(gaze=(0, .2), pupil=.5, haem=1.4, rupt=r_), EP)
    print('eye', round(time.time() - t0, 1)); t0 = time.time()
    for i in range(3):
        for d in (0, .45, .8): b.addp(f'pl{i}', plate(i, d)[0], (PC_ // 2, PC_ // 2))
        M, _ = plate_maps(i, .8)
        for j in range(8): b.addp(f'pf{i}', to_pil(light_maps(rot_maps(M, j * 45, (PC_ // 2, PC_ // 2)))), (PC_ // 2, PC_ // 2))
        b.addp(f'ps{i}', scar(i), (PC_ // 2, PC_ // 2))
    for w in range(3):
        for bt in (0, .5, 1): b.addp(f'heart{w}', organ('heart', w, bt), OP)
        # the lung breathes until it is torn, then it hangs collapsed
        for bt in ((0, .5, 1) if w == 0 else (.6,)): b.addp(f'lung{w}', organ('lung', w, bt), OP)
    b.addp('heartd', organ('heart', 2, .3, dying=1), OP)
    print('organs', round(time.time() - t0, 1)); t0 = time.time()
    for w in range(3): b.tiles(f'wall{w}', wall(w))
    b.tiles('walld0', wall(2, 1)); b.tiles('walld1', wall(2, 2))
    print('wall', round(time.time() - t0, 1)); t0 = time.time()
    for wi, wd in enumerate((4.2, 3.2, 2.3)):
        M = cord_maps(wd, SEED * 30 + wi)
        for j in range(16): b.addp(f'cord{wi}', to_pil(light_maps(rot_maps(M, j * 180 / 16, CP))), CP)
    for nm in ('fray', 'stump'):
        M = cord_maps(1.8 if nm == 'fray' else 3.0, SEED * 31 + len(nm), nm)
        for j in range(32): b.addp(nm, to_pil(light_maps(rot_maps(M, j * 360 / 32, CP))), CP)
    for i in range(2):
        M = shard_maps(i)
        for j in range(16): b.addp(f'shard{i}', to_pil(light_maps(rot_maps(M, j * 360 / 16, CP))), CP)
    print('cord', round(time.time() - t0, 1))
    lay = b.save(1024)
    lay['L'] = dict(A=A, v=V, rib=RB, knob=K, heart=HEART, lung=LUNG)
    json.dump(lay, open(os.path.join(OUT, 'drive.json'), 'w'), separators=(',', ':'))
if __name__ == '__main__':
    main()
