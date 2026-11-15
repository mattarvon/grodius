"""Sprite prep for THE KEEPSAKE as a stage boss (design: the keepsake-boss proposal, section 4; D46/D53 imply-only).

Source: Matt Arvon's own photographs of his own unmarked antique vinyl doll head (D7: he owns the doll and the photos).
The photos are NOT in the repo (assets-raw/ is git-ignored and the repo is public); only the baked PNG ships. Without them
this script prints a message and exits cleanly: the committed atlas is the source of truth for the game.

It reuses the midboss pipeline (tools/prep_keepsake.py: the cut-out, the bald dome rebuilt from the forehead's vinyl, the
socket transplant for the blink, the grime, mould, seam, rouge, harsh top light and the brain wound) on the same work
canvas. That canvas is 816x986 work px, and at the boss's 2.15x it is exactly one 104x124 boss frame, at about 7.85 work
px per game px. On top of the midboss it adds:

  - TILTS. Every layer is pre-rotated at work resolution about the boss origin (between the eyes) and then downsampled. It
    is never rotated at runtime, because that shimmers on the Fold. The vinyl is RE-LIT after the turn: the top light
    stays on top of the screen and doesn't turn with the head. Tilt is in canvas degrees (+ = clockwise on screen), so
    -32 puts the crown toward the ship (screen left).
  - CRACK STATES, as 0 whole, 1 hairline, 2 split, 3 split open. The crack runs from the wound down the forehead to the
    player-side (screen-left) brow, then down the temple, and never through a socket, so the eye overlays fit every
    state. "Split open" shows ship meat inside the gap (wet, pink-grey, strands bridging it). It shows no bone and no
    teeth: it's mechanism plus the MERIDIAN's tissue, not remains.
  - EYE OVERLAYS (open, half, shut, empty) per tilt. The open stare has a hard catchlight so it snaps (studio note).
    The screen-right eye stays milky with a ring, and the rouge still shows under the grime.
  - WOUND OVERLAYS (seat, proud, gape, brain) per tilt, with the fork baked in for seat and proud. The fork is
    now a clean silver fork with a flared terminal and a bright spine, not the ornate handle (studio note).
  - PARTS. The sleep-eye rocker is the real doll mechanism: two glass eyes on an axle, an inverted-V bridle up to the
    wire and a lead weight on a bent arm. It has no cross shape. Its iris comes from the front photo. It's baked at 5
    swing angles, with the lids open and shut. The crier is a perforated tin voice box with a paper bellows, whole and
    broken. There's the big fork (thrown and boomerang) and the mobile fork (dim, and the drop tell). The die list is
    the split-open head tipping onto its side.

Layering at runtime, all at the same boss origin: face<c>[tilt] -> eye_<state>[tilt] -> wound_<state>[tilt]. The face
frames already carry half-lidded eyes and the seated wound with no fork, so a face frame alone is a complete head.

Run:  python -I tools/prep_keepsake_boss.py [preview.png]
      -> src/sprites/boss/keepsake-boss.png + .json  (the baked-atlas format of render/gross/baked.ts: bf(c, 'keepsake-boss', ...))
         tools/keepsake-boss-art.json                (the geometry contract: lists, tilts, anchors per tilt)
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'bossart'))
import prep_keepsake as pk  # noqa: E402  the midboss pipeline: same photos, same work canvas
from bake import Baker  # noqa: E402     the shared shelf-pack + PNG8 writer for src/sprites/boss

KEY = 'keepsake-boss'
OUT_DIR = os.path.join(HERE, '..', 'src', 'sprites', 'boss')
GW, GH = 104, 124                 # the reference head frame (design section 2.1), game px
S = pk.WW / GW                    # work px per game px (~7.85)
PAD = 220                         # the padded hero canvas, game px: room for a 32 deg tilt plus the fork, and the 90 deg die
HERO = round(PAD * S)
HO = HERO // 2                    # the boss origin in hero px (centre)
WOX, WOY = pk.OX * pk.K * pk.Q, pk.OY * pk.K * pk.Q   # the origin in work px (408, 527)
DX, DY = int(HO - WOX), int(HO - WOY)                  # work canvas -> hero canvas offset
TILTS = [-32, -16, 0, 16, 32]
DIE = [48, 66, 82, 90]
SWING = [-24, -12, 0, 12, 24]
CRACKS = ['whole', 'hairline', 'split', 'open']
EYES = ['open', 'half', 'shut', 'empty']
WOUNDS = ['seat', 'proud', 'gape', 'brain']

# the crack's path in thumb px (the midboss's measuring space): from the wound's lower-left rim down the forehead to the
# player-side brow, then down the temple. It stays clear of the eye overlays' masks
CRACK = [(276, 312), (263, 342), (248, 373), (231, 402), (210, 425), (184, 436), (160, 445), (143, 466), (137, 497),
         (141, 530), (150, 560)]
WIRE_T = (206, 428)               # where the rocker's wire comes out of the split (thumb)
CRIER_T = (150, 456)              # suggested crier seat, in the open split at the temple (thumb)


def t2g(tx, ty):
    """thumb px -> game px from the boss origin (tilt 0)"""
    return ((tx - pk.CX0) * pk.Q / S, (ty - pk.CY0) * pk.Q / S)


def rotp(p, deg):
    """rotate a game-px point about the origin by a canvas angle (+ = clockwise on screen, y down)"""
    a = math.radians(deg)
    return (p[0] * math.cos(a) - p[1] * math.sin(a), p[0] * math.sin(a) + p[1] * math.cos(a))


# ---------------- canvas helpers ----------------
def to_img(rgb, al):
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), np.clip(al, 0, 1)]) * 255).astype(np.uint8), 'RGBA')


def padw(im):
    """a work-canvas RGBA onto the hero canvas, the origin at the centre"""
    o = Image.new('RGBA', (HERO, HERO), (0, 0, 0, 0))
    o.paste(im, (DX, DY))
    return o


def padf(a):
    o = np.zeros((HERO, HERO), np.float32)
    o[DY:DY + a.shape[0], DX:DX + a.shape[1]] = a
    return o


def rot_im(im, deg, center=(HO, HO)):
    return im if deg == 0 else im.rotate(-deg, resample=Image.BICUBIC, center=center)


def rot_f(a, deg):
    if deg == 0:
        return a
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').rotate(-deg, resample=Image.BILINEAR, center=(HO, HO)))


# ---------------- the crack ----------------
def polyline_dist(pts_w):
    """distance (work px) from every work pixel to the polyline, and the arc-length fraction at the nearest point"""
    best = np.full((pk.WH, pk.WW), 1e9, np.float32)
    sat = np.zeros((pk.WH, pk.WW), np.float32)
    low = np.zeros((pk.WH, pk.WW), np.float32)
    lens = [math.dist(a, b) for a, b in zip(pts_w, pts_w[1:])]
    tot, acc = sum(lens), 0.0
    for (x0, y0), (x1, y1), L in zip(pts_w, pts_w[1:], lens):
        vx, vy = x1 - x0, y1 - y0
        t = np.clip(((pk.XX - x0) * vx + (pk.YY - y0) * vy) / (L * L), 0, 1)
        d = np.hypot(pk.XX - (x0 + t * vx), pk.YY - (y0 + t * vy))
        m = d < best
        best[m] = d[m]
        sat[m] = ((acc + t * L) / tot)[m]
        # which side of the crack: 1 on the lower side (its wall faces up, into the top light)
        side = (vx * (pk.YY - y0) - vy * (pk.XX - x0)) * (1 if vx >= 0 else -1)
        low[m] = (side > 0)[m]
        acc += L
    return best, sat, low


def crack_lines(du, c, rng):
    """the hairline crack(s), painted under the light (as the midboss's)"""
    def crack(pts, wd):
        du.line(pk.P([(x + 1.2, y + 1) for x, y in pts]), fill=(250, 235, 210, 90), width=max(1, int(wd * pk.Q * .7)))
        du.line(pk.P(pts), fill=(25, 10, 8, 235), width=max(1, int(wd * pk.Q)))
    if c == 0:   # whole: only the old stress lines at the wound's rim
        crack([CRACK[0], (CRACK[0][0] - 5, CRACK[0][1] + 14)], 1.6)
        crack([(318, 306), (326, 318), (324, 328)], 1.4)
        return
    crack(CRACK[:6] if c == 1 else CRACK, 2.6)
    crack([CRACK[2], (CRACK[2][0] + 18, CRACK[2][1] + 9), (CRACK[2][0] + 25, CRACK[2][1] + 22)], 1.6)
    crack([CRACK[4], (CRACK[4][0] + 10, CRACK[4][1] - 22), (CRACK[4][0] + 24, CRACK[4][1] - 30)], 1.3)
    if c >= 2:   # it keeps spreading: a branch across the brow toward the nose, short of the socket mask
        crack([CRACK[5], (CRACK[5][0] + 30, CRACK[5][1] - 6), (CRACK[5][0] + 58, CRACK[5][1] - 2)], 1.4)
        crack([CRACK[8], (CRACK[8][0] + 16, CRACK[8][1] + 6)], 1.2)


def split(img, c):
    """the split (c 2) or split open (c 3) vinyl along CRACK, painted after the light. Returns img and the gap mask"""
    pts = [pk.w(x, y) for x, y in CRACK]
    d, s, low = polyline_dist(pts)
    low = pk.blur(low, 1.5)
    if c == 2:
        hw = 3.5 + 2.5 * pk.sstep(0, .2, s) * (1 - pk.sstep(.6, 1, s))
    else:
        hw = 20 * (.45 + .55 * pk.sstep(0, .15, s)) * (1 - .7 * pk.sstep(.5, 1, s))
    gap = pk.sstep(hw + 1.2, hw - 1.2, d)
    rim = np.clip(pk.sstep(hw + 4.5, hw + 1.5, d) - gap, 0, 1) * (1 - low)    # the cut edge of the upper lip
    shade = np.clip(pk.sstep(hw + 16, hw + 2, d) - gap - rim, 0, 1) * (.5 + .5 * low)
    img = img * (1 - .45 * shade[..., None])
    img = img * (1 - rim[..., None]) + np.array([.93, .86, .70], np.float32) * .95 * rim[..., None]
    if c == 2:
        inner = np.array([.07, .012, .02], np.float32)
        return img * (1 - gap[..., None]) + inner * gap[..., None], gap
    # split open: ship meat in the gap. Deep (dark) under the lifted vinyl, lit wet tissue in the middle
    depth = np.clip(1 - d / np.maximum(hw, 1), 0, 1)
    n1, n2 = pk.vnoise(3.2 * pk.Q, 61), pk.vnoise(1.6 * pk.Q, 62)
    folds = 1 - pk.sstep(0, .09, np.abs(n1 - .5))
    meat = np.array([.52, .22, .25], np.float32) * (.55 + .5 * n2)[..., None]
    meat = meat * (1 - .5 * folds)[..., None] + np.array([.24, .05, .08], np.float32) * (.5 * folds)[..., None]
    # concave: black down the middle, the lower wall lit where the top light falls in, the upper wall in shadow
    wall = low * pk.sstep(.05, .55, 1 - depth)
    meat = meat * (.08 + .85 * wall + .25 * pk.sstep(.6, .9, n2) * depth)[..., None]
    gloss = (pk.sstep(.86, .97, n2) * wall)[..., None]
    meat = meat + gloss * np.array([.5, .38, .38], np.float32)
    # strands of wet tissue bridging the gap
    L = pk.layer()
    dl = ImageDraw.Draw(L)
    for si in (2, 3, 4, 6, 7):
        (x0, y0), (x1, y1) = pts[si], pts[si + 1]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        nx, ny = -(y1 - y0), x1 - x0
        nl = math.hypot(nx, ny)
        nx, ny = nx / nl, ny / nl
        r = 24
        dl.line([(mx - nx * r, my - ny * r + 3), (mx, my + 6), (mx + nx * r, my + ny * r + 3)],
                fill=(196, 128, 128, 210), width=3)
    st = pk.arr(L)
    sa = st[..., 3] * pk.sstep(hw + 2, hw - 2, d)
    meat = meat * (1 - sa[..., None]) + st[..., :3] * sa[..., None]
    return img * (1 - gap[..., None]) + meat * gap[..., None], gap


# ---------------- the painted vinyl (the midboss's, with the crack states) ----------------
def paint_details(rng, c):
    under, wet = pk.layer(), pk.layer()
    du, dw_ = ImageDraw.Draw(under), ImageDraw.Draw(wet)
    seam = [(118 + i * 4, 405 - 112 * math.sin(math.pi * i / 81) ** .55 - 4 * math.sin(i * .23) - 2 * math.sin(i * .61 + 1)) for i in range(82)]
    glue = pk.layer()
    dg = ImageDraw.Draw(glue)
    for _ in range(9):
        i = int(rng.integers(6, 76))
        x, y = seam[i]
        rx, ry = rng.uniform(10, 20), rng.uniform(5, 9)
        pts = [(x + math.cos(a) * rx * rng.uniform(.6, 1.2), y - 9 + math.sin(a) * ry * rng.uniform(.6, 1.2))
               for a in np.linspace(0, math.tau, 9)[:-1]]
        dg.polygon(pk.P(pts), fill=(140, 100, 36, int(rng.uniform(60, 100))))
    for (x0, y0), (x1, y1) in zip(seam, seam[1:]):
        dg.line(pk.P([(x0, y0 + 1), (x1, y1 + 1)]), fill=(70, 46, 24, 90), width=7 * pk.Q)
    under.alpha_composite(glue.filter(ImageFilter.GaussianBlur(3 * pk.Q)))
    for (x0, y0), (x1, y1) in zip(seam, seam[1:]):
        du.line(pk.P([(x0, y0), (x1, y1)]), fill=(40, 26, 16, 170), width=int(1.6 * pk.Q))
    for i, ang, n, ln in ((5, -2.4, 7, 40), (33, -1.9, 4, 20), (60, -1.1, 5, 24), (78, -.5, 6, 34)):
        x, y = seam[i]
        for _ in range(n):
            a = ang + rng.uniform(-.3, .3)
            L = ln * rng.uniform(.6, 1.1)
            pts, px, py = [], x + rng.uniform(-3, 3), y
            for _s in range(10):
                a += rng.uniform(-.3, .32)
                px += math.cos(a) * L / 10
                py += math.sin(a) * L / 10
                pts.append((px, py))
            col = (int(rng.uniform(110, 150)), int(rng.uniform(92, 118)), int(rng.uniform(60, 78)), 210)
            du.line(pk.P([(x, y)] + pts), fill=col, width=max(1, int(1.1 * pk.Q)))
    # mould, as on Matt's doll: clustered blooms with satellites, dense round the chin and jaw, sparse higher up.
    # (cx, cy, spread, specks, bloom) in thumb px. Never an even stipple: it reads as a dot grid at boss scale
    mould = pk.layer()
    dm = ImageDraw.Draw(mould)
    stain = pk.layer()
    ds = ImageDraw.Draw(stain)
    for cx, cy, sp, n, bl in ((272, 652, 20, 26, 14), (306, 664, 16, 18, 10), (246, 640, 12, 10, 8), (196, 634, 16, 12, 10),
                              (372, 626, 12, 9, 8), (166, 594, 10, 6, 7), (290, 680, 22, 14, 0), (378, 552, 7, 4, 0),
                              (228, 392, 6, 3, 0)):
        if bl:
            ds.ellipse(pk.P([(cx - bl * 1.4, cy - bl), (cx + bl * 1.4, cy + bl)]), fill=(52, 58, 28, 70))
        for k in range(n):
            core = k < n * .55
            ang = rng.uniform(0, math.tau)
            dist = abs(rng.normal(0, sp * .35)) if core else sp * (.5 + rng.exponential(.6))
            x, y = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist * .7
            r = (1.6 + 4.2 * rng.random() ** 3) * (1 if core else .7)
            sq = rng.uniform(.6, 1.0)
            dm.ellipse(pk.P([(x - r, y - r * sq), (x + r, y + r * sq)]), fill=(26, 20, 12, int(rng.uniform(150, 235))))
    under.alpha_composite(stain.filter(ImageFilter.GaussianBlur(5 * pk.Q)))
    under.alpha_composite(mould.filter(ImageFilter.GaussianBlur(.5 * pk.Q)))
    crack_lines(du, c, np.random.default_rng(91))
    for x0, y0, x1, y1 in ((271, 603, 273, 611), (291, 601, 289, 609), (282, 618, 284, 625), (298, 617, 296, 623)):
        du.line(pk.P([(x0, y0), (x1, y1)]), fill=(40, 8, 10, 170), width=max(1, int(1.1 * pk.Q)))
    du.line(pk.P([(262, 613), (285, 616), (308, 612)]), fill=(30, 5, 8, 160), width=int(1.5 * pk.Q))

    def trickle(x, y, length, w0, col, seed, drift=0):
        r2 = np.random.default_rng(seed)
        pts = [(x, y)]
        for _ in range(int(length / 6)):
            x += r2.uniform(-1.6, 1.6) + drift
            y += 6
            pts.append((x, y))
        for i, ((x0, y0), (x1, y1)) in enumerate(zip(pts, pts[1:])):
            wd = w0 * (1 - .6 * i / len(pts)) * r2.uniform(.75, 1.15)
            dw_.line(pk.P([(x0, y0), (x1, y1)]), fill=col, width=max(1, int(wd * pk.Q)))
        bx, by = pts[-1]
        dw_.ellipse(pk.P([(bx - w0 * .4, by - w0 * .3), (bx + w0 * .4, by + w0 * .6)]), fill=col)
        for (x0, y0), (x1, y1) in list(zip(pts, pts[1:]))[1::3]:
            dw_.line(pk.P([(x0 - w0 * .2, y0), (x1 - w0 * .2, y1)]), fill=(230, 140, 130, 70), width=1)
    blood = (82, 4, 10, 235)
    seeps = [(-26, 60, 5), (-8, 36, 4), (16, 80, 5.5), (30, 30, 4)] + ([(-40, 110, 6), (24, 120, 6)] if c >= 1 else [])
    for i, (dx, ln, wd) in enumerate(seeps):
        trickle(pk.WOUND[0] + dx, pk.WOUND[1] + 12, ln, wd, blood, 40 + i)
    trickle(222, 520, 64, 4.2, (55, 8, 16, 220), 7, -.1)
    trickle(309, 616, 34, 3.4, (50, 6, 12, 220), 9, .15)
    if c >= 3:  # the split bleeds down the temple and off the jaw
        trickle(141, 528, 120, 5.5, (78, 5, 12, 235), 71, .12)
        trickle(146, 470, 40, 3.5, (70, 5, 12, 220), 72, -.15)
    dw_.line(pk.P([(282, 607), (294, 606)]), fill=(255, 220, 210, 90), width=max(1, int(1.2 * pk.Q)))
    return under, wet


# ---------------- the head ----------------
class Head:
    """the shared, state-independent pieces of the head on the work canvas (the midboss's head_frames, split up)"""

    def __init__(s, d):
        s.ph_open = pk.load(d, pk.F_OPEN)
        s.ph_half = pk.load(d, pk.F_HALF, (pk.HALF_ROT, pk.HALF_C))
        s.ph_shut = pk.load(d, pk.F_SHUT)
        base = pk.arr(pk.crop_work(s.ph_open))
        s.base = base
        s.a, s.h = pk.silhouette()
        s.keep = keep = pk.face_keep(base)
        fy0, fy1 = pk.w(0, 372)[1], pk.w(0, 420)[1]
        fx0, fx1 = pk.w(240, 0)[0], pk.w(330, 0)[0]
        albedo = np.median(base[int(fy0):int(fy1), int(fx0):int(fx1)].reshape(-1, 3), 0)
        s.albedo = albedo
        dome = albedo * (.93 + .14 * pk.vnoise(70, 3)[..., None])
        s.face = base * keep[..., None] + dome * (1 - keep[..., None])
        ph = s.ph_open
        stump_im = pk.arr(pk.crop_work(ph.transform(ph.size, Image.AFFINE, (1, 0, 0, 0, 1, 60), resample=Image.BICUBIC)))
        st = Image.new('L', (pk.WW, pk.WH), 0)
        ImageDraw.Draw(st).polygon(pk.P([(196, 610), (366, 610), (368, 690), (356, 704), (282, 709), (208, 704), (196, 690)]), fill=255)
        s.st_a = pk.arr(st.filter(ImageFilter.GaussianBlur(1.2)))
        s.stump = stump_im * (.55 + .45 * pk.sstep(pk.w(0, 700)[1], pk.w(0, 640)[1], pk.YY))[..., None] * np.array([.92, .86, .74], np.float32)
        s.eyes = pk.socket_boxes()
        s.dif, s.spec, s.rim = pk.light(s.h, s.a)
        rs = np.random.default_rng(22)
        streak = Image.fromarray((rs.random((4, 26)) * 255).astype(np.uint8)).resize((pk.WW, pk.WH), Image.BICUBIC)
        stains = .6 * pk.blur(pk.vnoise(45, 21), 10 * pk.Q) + .4 * pk.blur(pk.arr(streak), 6 * pk.Q)
        s.stains = (stains - stains.min()) / (np.ptp(stains) + 1e-6)
        s.rouge = pk.blur(np.maximum(pk.ell_a(186, 590, 50, 40, 40), pk.ell_a(382, 590, 50, 40, 40)), 14 * pk.Q) * keep * .8
        lum0 = base.mean(-1)
        cz = np.clip(pk.blur(lum0, 9) - pk.blur(lum0, 2.2) - .012, 0, .2)
        where = np.maximum.reduce([pk.ell_a(270, 562, 20, 12, 10), pk.ell_a(305, 564, 20, 12, 10), pk.ell_a(258, 616, 16, 12, 10),
                                   pk.ell_a(312, 614, 16, 12, 10), pk.ell_a(285, 635, 40, 12, 12), pk.ell_a(285, 662, 70, 16, 14)])
        s.crease = pk.blur(cz * (.35 + .65 * where), 1.5)[..., None] * keep[..., None]
        # the eye overlays' mask: the transplant's reach plus the margin, one ellipse per socket (thumb)
        m = np.zeros((pk.WH, pk.WW), np.float32)
        for cx, cy, rx, ry in s.eyes:
            m = np.maximum(m, pk.ell_a(cx, cy, rx * 1.13 + 7, ry * 1.2 + 7, 2))
        s.eyemask = m
        # the photo's own surface, put back after the grade: at 7.8x supersampling the downsample averages the real
        # vinyl away and it reads airbrushed. Fine texture (pores, lid creases, mould pits) from a high-pass of the
        # photo, and its local sheen (the real cheek and brow highlights). The sockets are left out (the blink swaps them)
        nm = keep * (1 - pk.sstep(.1, .6, m))
        s.detail = ((lum0 - pk.blur(lum0, 3.5)) * nm)[..., None]
        s.sheen = (np.clip(pk.blur(lum0, 2) - pk.blur(lum0, 16) - .01, 0, .2) * nm)[..., None]

    def compose(s, c, eye):
        """one full head on the work canvas: crack state c, eye state eye. Returns (RGBA, exclusion mask for the re-light)"""
        under, wet = paint_details(np.random.default_rng(77), c)
        eyes = s.eyes
        if eye in ('open', 'empty'):
            img = pk.transplant(s.face, s.ph_open, pk.EYES_OPEN, pk.EYES_OPEN, s.face)
        elif eye == 'half':
            img = pk.transplant(s.face, s.ph_half, pk.EYES_HALF, pk.EYES_OPEN, s.face)
        else:
            img = pk.transplant(s.face, s.ph_shut, pk.EYES_SHUT, pk.EYES_OPEN, s.face)
        raw = img
        sock = np.zeros((pk.WH, pk.WW), np.float32)
        for cx, cy, rx, ry in eyes:
            sock = np.maximum(sock, pk.ell_a(cx, cy, rx * .93, ry * .93, 3))
        G = sock * pk.sstep(.07, .0, raw[..., 0] - raw[..., 2])
        img = pk.over(img, under)
        for cx, cy, rx, ry in eyes:
            ring = np.clip(pk.ell_a(cx, cy + ry * .55, rx * 1.3, ry * 1.25, 10) - pk.ell_a(cx, cy, rx * 1.04, ry * 1.04, 3), 0, 1)
            ring *= pk.sstep(cy * pk.Q, (cy + ry) * pk.Q, pk.YY + (pk.CY0 - pk.OY * pk.K) * pk.Q)
            img = img * (1 - .4 * ring[..., None]) + np.array([.24, .12, .17], np.float32) * .4 * ring[..., None]
        img = img - s.crease * np.array([2.2, 2.6, 3.0], np.float32)
        lum = img @ np.array([.3, .59, .11], np.float32)
        ivory = lum[..., None] * np.array([1.06, .95, .66], np.float32)
        mix = (.5 * (1 - s.rouge) * (1 - G))[..., None]
        img = img * (1 - mix) + ivory * mix
        img = img + (s.rouge * 1.1)[..., None] * np.array([.08, -.022, -.018], np.float32)  # the rosy cheeks, kept
        img = img * (1 - .22 * pk.sstep(.45, .85, s.stains)[..., None] * np.array([.0, .25, .6], np.float32))
        img = img * (1 + .07 * s.keep)[..., None]
        img = img * (.6 + .62 * s.dif)[..., None]
        img = img + s.spec[..., None] * .38 * np.array([1, .97, .9], np.float32)
        img = img + s.detail * 2.4 + s.sheen * np.array([2.2, 2.1, 1.9], np.float32)
        img = img * (1 - .4 * s.rim)[..., None]
        lum = img @ np.array([.3, .59, .11], np.float32)
        sh = (1 - pk.sstep(.1, .45, lum))[..., None]
        img = img * (1 - .35 * sh) + np.array([.13, .15, .11], np.float32) * .35 * sh
        # the glass
        rl = raw @ np.array([.3, .59, .11], np.float32)
        E = np.clip((rl[..., None] + (raw - rl[..., None]) * 2.5) * 1.25, 0, 1)
        for i, (cx, cy, rx, ry) in enumerate(eyes):
            ir = ry * .98
            limb = np.clip(pk.ell_a(cx, cy, ir, ir, 3) - pk.ell_a(cx, cy, ir * .8, ir * .8, 4), 0, 1)
            E = E * (1 - .55 * limb[..., None])
            if i == 1 and eye in ('open', 'half'):   # the milky eye with its ring
                milk = pk.ell_a(cx + 1, cy, ir * .78, ir * .78, 6) * .5
                E = E * (1 - milk[..., None]) + np.array([.74, .8, .84], np.float32) * milk[..., None]
                iring = np.clip(pk.ell_a(cx, cy, ir * .8, ir * .8, 3) - pk.ell_a(cx, cy, ir * .62, ir * .62, 3), 0, 1) * .5
                E = E * (1 - iring[..., None]) + np.array([.45, .55, .64], np.float32) * iring[..., None]
                ghost = pk.ell_a(cx + 1, cy + 1, ir * .3, ir * .3, 5) * .5
                E = E * (1 - ghost[..., None]) + np.array([.25, .27, .3], np.float32) * ghost[..., None]
        X = G.copy()
        if eye == 'empty':
            img = s.holes(img, G)
            X = np.maximum(X, s.holemask(G))
        else:
            img = img * (1 - G[..., None]) + E * G[..., None]
        if eye == 'open':   # the catchlight: a hard white pin plus a small second, so the stare snaps
            for i, (cx, cy, rx, ry) in enumerate(eyes):
                k = .85 if i == 1 else 1
                pin = pk.ell_a(cx - rx * .28, cy - ry * .36, 7.5, 7.5, 1.2) * k
                img = img * (1 - pin[..., None]) + pin[..., None]
                pin2 = pk.ell_a(cx + rx * .22, cy + ry * .18, 3.2, 3.2, 1.2) * .7 * k
                img = img * (1 - pin2[..., None]) + pin2[..., None]
        img = pk.over(img, wet)
        if c >= 2:
            img, gap = split(img, c)
            X = np.maximum(X, gap)
        alpha = s.a
        col = img * alpha[..., None] + s.stump * (s.st_a[..., None] * (1 - alpha[..., None]))
        alpha = np.maximum(alpha, s.st_a * (1 - alpha) + alpha)
        col = col / np.maximum(alpha[..., None], 1e-4)
        return to_img(col, alpha), X

    def holemask(s, G):
        """the opening the glass eye filled: the open photo's glass, closed up and smoothed"""
        m = np.zeros((pk.WH, pk.WW), np.float32)
        for cx, cy, rx, ry in s.eyes:
            m = np.maximum(m, pk.ell_a(cx, cy + ry * .04, rx * .9, ry * .8, 3))
        return np.clip(np.maximum(pk.sstep(.25, .6, pk.blur(G, 4)), m * .0) * m * 1.0 + m * pk.sstep(.2, .4, pk.blur(G, 6)), 0, 1)

    def holes(s, img, G):
        """the empty sockets: the mechanism is out, so these are holes in the vinyl into the dark (a lit inner wall at the
        bottom where the top light falls in, a dim wet glimpse of ship tissue at the back)"""
        hm = s.holemask(G)
        out = img.copy()
        for cx, cy, rx, ry in s.eyes:
            x, y = pk.w(cx, cy)
            v = (pk.YY - y) / (ry * pk.Q)                     # -1 top .. +1 bottom of the socket
            wall = pk.sstep(.35, .95, v) * (1 - pk.sstep(.95, 1.25, v))
            back = pk.ell_a(cx, cy - ry * .15, rx * .45, ry * .4, 14)
            col = np.array([.02, .008, .012], np.float32) + back[..., None] * np.array([.07, .015, .02], np.float32)
            col = col + (wall * .55)[..., None] * np.array([.62, .52, .40], np.float32)
            glint = pk.ell_a(cx - rx * .2, cy + ry * .1, 2, 4, 1.5) * .2
            col = col + glint[..., None] * np.array([.9, .7, .7], np.float32)
            sel = (np.abs(pk.XX - x) < rx * pk.Q * 1.2)[..., None]
            out = np.where(sel, out * (1 - hm[..., None]) + col * hm[..., None], out)
        return out


# ---------------- the wound ----------------
def wound(gaping, rng, sc=1.0):
    """pk.wound, scalable: sc 1 is the midboss's split (seat, proud, gape), sc > 1 the phase-3 brain"""
    wx, wy = pk.WOUND
    L = pk.layer()
    d = ImageDraw.Draw(L)

    def star(rx, ry, jag, n):
        pts = []
        for i in range(n):
            t = i / n * math.tau
            k = 1 + (rng.uniform(-jag, jag) if i % 2 else rng.uniform(0, jag))
            pts.append((wx + math.cos(t) * rx * k, wy + 4 * sc + math.sin(t) * ry * k))
        return pts
    d.polygon(pk.P(star(46 * sc, 22 * sc, .3, 20)), fill=(150, 112, 84, 255) if sc > 1 else (200, 172, 128, 255))
    d.polygon(pk.P(star(41 * sc, 18 * sc, .35, 20)), fill=(26, 4, 8, 255))
    sp = pk.arr(L)
    lobes = [(-24, -2, 17, 13), (-6, -10, 19, 15), (16, -7, 18, 14), (31, 3, 12, 10), (-33, 6, 11, 9), (4, 4, 16, 11)]
    if sc > 1:
        lobes += [(-14, 12, 14, 9), (22, 12, 13, 9)]
    hmax = np.zeros((pk.WH, pk.WW), np.float32)
    cov = np.zeros((pk.WH, pk.WW), np.float32)
    for dx, dy, rx, ry in lobes:
        dx, dy, rx, ry = dx * sc, dy * sc, rx * sc, ry * sc
        u = pk.ell_u(wx + dx, wy + dy, rx, ry)
        hmax = np.maximum(hmax, np.sqrt(np.clip(1 - u * u, 0, 1)))
        cov = np.maximum(cov, pk.ell_a(wx + dx, wy + dy, rx, ry, 1.2))
    n1, n2 = pk.vnoise(4.5 * pk.Q, 31), pk.vnoise(2.5 * pk.Q, 32)
    folds = 1 - pk.sstep(.0, .07, np.abs(n1 - .5))
    col = np.array([.72, .50, .52], np.float32) * (.45 + .6 * hmax)[..., None]
    col = col * (1 - .55 * folds)[..., None] + np.array([.30, .10, .14], np.float32) * (.55 * folds)[..., None]
    col *= (.4 + .6 * pk.sstep(0, .3, hmax))[..., None]
    gy, gx = np.gradient(hmax * 12 * pk.Q)
    nn = np.stack([-gx, -gy, np.ones_like(hmax)], -1)
    nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
    H = np.array([-.14, -.43, .89], np.float32)
    H /= np.linalg.norm(H)
    gloss = np.clip((nn * H).sum(-1), 0, 1) ** 24 * (.6 + .4 * n2)
    col = col + gloss[..., None] * (.4 if sc > 1 else .75)
    if sc > 1:
        col = col * np.array([.82, .62, .64], np.float32)
    if gaping:
        r0 = 14 * (1.25 if sc > 1 else 1)
        hole = np.clip(pk.ell_a(wx, wy + 2, r0, r0 * .86, 1.5) * (.75 + .5 * pk.vnoise(3 * pk.Q, 33)), 0, 1)
        rimr = np.clip(pk.ell_a(wx, wy + 2, r0 * 1.36, r0 * 1.14, 3) - hole, 0, 1)
        col = col * (1 - rimr[..., None] * .8) + np.array([.42, .03, .06], np.float32) * rimr[..., None] * .8
        col = col * (1 - hole[..., None]) + np.array([.06, 0, .01], np.float32) * hole[..., None]
        cov = np.maximum(cov, pk.ell_a(wx, wy + 2, r0 * 1.36, r0 * 1.14, 2))
    else:
        slot = pk.ell_a(wx, wy + 1, 9, 5, 1.5)
        col = col * (1 - slot[..., None]) + np.array([.08, 0, .02], np.float32) * slot[..., None]
    rgb = sp[..., :3] * (1 - cov[..., None]) + col * cov[..., None]
    al = np.maximum(sp[..., 3], cov)
    return to_img(rgb, al)


# ---------------- the fork ----------------
FORK_G = (15, 50, 38)    # the big fork: game w, h, entry y (where it goes into the skull: the tine roots stay above it)
MFORK_G = (11, 46)       # a mobile fork, tines down, hung from its top


def paint_fork(gw, gh, blood_from=None, bright=1.0, seed=4):
    """a clean silver dinner fork, tines down, drawn on the game-px grid (at S hero px per game px) so its four tines
    survive the downsample: each tine is whole game px wide with a 1 px gap that the dark outline fills, a neck that
    flares out to the tines, a slim handle with a bright spine, a flared rounded terminal. blood_from: game y below
    which it's red. Returns RGBA (hero px)"""
    s = S
    Wd, Hd = round(gw * s), round(gh * s)
    tw = 2 if gw >= 14 else 1                     # tine width, game px; gaps are 1
    span = 4 * tw + 3
    c0 = (gw - span) // 2
    mid = c0 + span / 2                           # the centre line, game px
    hwid = 3 if gw >= 14 else 3                   # handle width
    twid = 7 if gw >= 14 else 5                   # terminal width
    yt, yh, yn, yk = .15 * gh, .48 * gh, .6 * gh, gh   # terminal end, handle end, neck end (tine roots), tips
    m = Image.new('L', (Wd, Hd), 0)
    d = ImageDraw.Draw(m)
    X = lambda gx: gx * s
    Y = lambda gy: gy * s
    # terminal: flared and rounded at the top, narrowing into the handle
    d.ellipse((X(mid - twid / 2), Y(0), X(mid + twid / 2), Y(yt * .8)), fill=255)
    d.polygon([(X(mid - twid / 2), Y(yt * .4)), (X(mid + twid / 2), Y(yt * .4)), (X(mid + hwid / 2), Y(yt + 1)), (X(mid - hwid / 2), Y(yt + 1))], fill=255)
    d.rectangle((X(mid - hwid / 2), Y(yt), X(mid + hwid / 2) - 1, Y(yh)), fill=255)
    # the neck flares out to the full tine span
    d.polygon([(X(mid - hwid / 2), Y(yh)), (X(mid + hwid / 2), Y(yh)), (X(c0 + span), Y(yn)), (X(c0), Y(yn))], fill=255)
    for i in range(4):
        x0 = c0 + i * (tw + 1)
        d.rectangle((X(x0), Y(yn - .5), X(x0 + tw) - 1, Y(yk - 1.2)), fill=255)
        d.polygon([(X(x0), Y(yk - 1.2)), (X(x0 + tw) - 1, Y(yk - 1.2)), (X(x0 + tw / 2), Y(yk) - 1)], fill=255)
    ma = np.asarray(m).astype(np.float32) / 255
    yy, xx = np.mgrid[0:Hd, 0:Wd].astype(np.float32)
    u = (xx - X(mid)) / X(span / 2)
    col = np.zeros((Hd, Wd, 3), np.float32) + np.array([.50, .52, .56], np.float32)
    col *= (1 - .35 * np.clip(np.abs(u), 0, 1) ** 2)[..., None]
    # a highlight down each tine, so the four read as four
    for i in range(4):
        tx = X(c0 + i * (tw + 1) + tw * .35)
        th = np.clip(1 - np.abs(xx - tx) / (.45 * s), 0, 1) * (yy > Y(yn))
        col = col * (1 - .8 * th[..., None]) + np.array([.95, .96, .97], np.float32) * .8 * th[..., None]
    # the bright spine down the handle and the terminal
    spine = np.clip(1 - np.abs(xx - X(mid - .2)) / (.5 * s), 0, 1) * pk.sstep(Y(.5), Y(1.5), yy) * pk.sstep(Y(yn), Y(yh), yy)
    col = col * (1 - spine[..., None]) + np.array([.98, .98, .96], np.float32) * spine[..., None]
    col = col * bright
    tarn = pk.vnoise_small(Wd, Hd, 10, seed)
    tk = .2 * pk.sstep(.6, .9, tarn)[..., None]
    col = col * (1 - tk) + col * np.array([.62, .58, .48], np.float32) * tk
    if blood_from is not None:
        bl = pk.sstep(blood_from * s - 6, blood_from * s + 26, yy) * (.7 + .3 * pk.vnoise_small(Wd, Hd, 6, 9))
        col = col * (1 - bl[..., None] * .82) + np.array([.42, .03, .06], np.float32) * bl[..., None] * .82
    ol = np.asarray(Image.fromarray((ma * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15))).astype(np.float32) / 255
    rgb = col * ma[..., None] + np.array([.03, .03, .04], np.float32) * (1 - ma[..., None])
    return to_img(np.clip(rgb, 0, 1), np.maximum(ma, ol * .95))


def fork_overlay(fork_im, rise_g):
    """the big fork standing in the slot (as the midboss's `wedged`): a slight lean, tines and neck buried below the
    slot, drawn on the hero canvas at tilt 0"""
    sx, sy = pk.w(*pk.WOUND)
    sx, sy = sx + DX, sy + pk.Q + DY
    o = Image.new('RGBA', (HERO, HERO), (0, 0, 0, 0))
    fx = round(sx - fork_im.width / 2)
    fy = round(sy - FORK_G[2] * S - rise_g * S)
    o.paste(fork_im, (fx, fy))
    o = o.rotate(-math.degrees(.14), resample=Image.BICUBIC, center=(sx, sy))
    a = np.asarray(o).copy()
    a[int(sy):, :, 3] = 0
    return Image.fromarray(a, 'RGBA'), (sx, sy)


# ---------------- the rocker (sleep-eye mechanism) ----------------
ROCK_G = (76, 64)
ROCK_ATTACH = (38, 4)    # game px in the rocker's canvas: the wire's end (frames are offset from here)
ROCK_EYE = 18.25         # eye centres at (+-ROCK_EYE, 22) from the attach point: the face's socket spacing
ROCK_R = 10.5


def paint_rocker(head, shut):
    s = S
    Wd, Hd = round(ROCK_G[0] * s), round(ROCK_G[1] * s)
    ax, ay = ROCK_ATTACH[0] * s, ROCK_ATTACH[1] * s
    img = Image.new('RGBA', (Wd, Hd), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    wire = (150, 150, 140, 255)
    ey = ay + 22 * s
    exs = [ax - ROCK_EYE * s, ax + ROCK_EYE * s]
    R = ROCK_R * s
    # the axle (behind), the bridle up to the wire (an inverted V, never a cross), the bent arm down to the lead weight
    d.line([(exs[0] - R - 6 * s * .3, ey), (exs[1] + R + 6 * s * .3, ey)], fill=(110, 108, 100, 255), width=int(1.3 * s))
    for ex in (exs[0] - R - 1.5 * s, exs[1] + R + 1.5 * s):
        d.line([(ax, ay), (ex, ey)], fill=wire, width=int(.9 * s))
    d.ellipse((ax - 1.6 * s, ay - 1.6 * s, ax + 1.6 * s, ay + 1.6 * s), outline=wire, width=int(.8 * s))
    arm = [(ax - 2 * s, ey), (ax - 3 * s, ey + 8 * s), (ax - 1 * s, ey + 16 * s), (ax + 3 * s, ey + 21 * s)]
    d.line(arm, fill=(120, 118, 110, 255), width=int(1.2 * s), joint='curve')
    a = np.asarray(img).astype(np.float32) / 255
    yy, xx = np.mgrid[0:Hd, 0:Wd].astype(np.float32)
    rgb, al = a[..., :3].copy(), a[..., 3].copy()
    # the lead weight: a crude dull lump
    wx, wy, wrx, wry = ax + 4 * s, ey + 26 * s, 5.5 * s, 6.2 * s
    u = np.sqrt(((xx - wx) / wrx) ** 2 + ((yy - wy) / wry) ** 2 * (1 + .25 * np.sin(np.arctan2(yy - wy, xx - wx) * 3)))
    wm = np.clip((1 - u) * 6, 0, 1)
    nz = np.sqrt(np.clip(1 - u * u, 0, 1))
    lit = np.clip(.35 - .45 * (xx - wx) / wrx * .5 - .6 * (yy - wy) / wry * .5 + .5 * nz, 0, 1)
    lead = np.array([.30, .31, .34], np.float32) * (.45 + .8 * lit)[..., None] * (.85 + .3 * pk.vnoise_small(Wd, Hd, 9, 12))[..., None]
    rgb = rgb * (1 - wm[..., None]) + lead * wm[..., None]
    al = np.maximum(al, wm)
    # the iris: the doll's own, from the front photo (the screen-left eye), as a disk texture
    ph = head.ph_open
    cx, cy = 210 * 2, 492.5 * 2
    ir_src = 26 * 2
    iris_tex = np.asarray(ph.crop((round(cx - ir_src), round(cy - ir_src), round(cx + ir_src), round(cy + ir_src)))
                          .resize((round(2 * R * .62), round(2 * R * .62)), Image.LANCZOS)).astype(np.float32) / 255
    lidc = np.clip(head.albedo * np.array([1.0, .93, .74], np.float32), 0, 1)
    lash = Image.new('RGBA', (Wd, Hd), (0, 0, 0, 0))
    dl = ImageDraw.Draw(lash)
    for i, ex in enumerate(exs):
        dx, dy = (xx - ex) / R, (yy - ey) / R
        r2 = dx * dx + dy * dy
        ball = np.clip((1 - np.sqrt(r2)) * R / 1.5, 0, 1)
        nz = np.sqrt(np.clip(1 - r2, 0, 1))
        L = np.array([-.35, -.7, .62])
        L = L / np.linalg.norm(L)
        dif = np.clip(dx * L[0] + dy * L[1] + nz * L[2], 0, 1)
        spec = np.clip(dif, 0, 1) ** 40
        col = np.array([.86, .83, .74], np.float32) * (.3 + .8 * dif)[..., None]
        # the iris disk, its limbal ring, the milky one on the right
        ri = .62
        tx = ((dx / ri + 1) / 2 * (iris_tex.shape[1] - 1)).clip(0, iris_tex.shape[1] - 1).astype(int)
        ty = ((dy / ri + 1) / 2 * (iris_tex.shape[0] - 1)).clip(0, iris_tex.shape[0] - 1).astype(int)
        irm = np.clip((ri - np.sqrt(r2)) * R / 1.2, 0, 1)
        icol = iris_tex[ty, tx]
        il = icol @ np.array([.3, .59, .11], np.float32)
        icol = np.clip((il[..., None] + (icol - il[..., None]) * 1.6) * 1.25, 0, 1)
        limb = np.clip((np.sqrt(r2) - ri * .8) / (ri * .2), 0, 1) * irm
        icol = icol * (1 - .55 * limb[..., None])
        if i == 1:
            milk = np.clip((ri * .8 - np.sqrt(r2)) * R / 3, 0, 1) * .5
            icol = icol * (1 - milk[..., None]) + np.array([.74, .8, .84], np.float32) * milk[..., None]
        col = col * (1 - irm[..., None]) + icol * (.55 + .5 * dif)[..., None] * irm[..., None]
        # the lid shell: it covers the top of the ball (open) or comes down over the iris (shut)
        l0 = (.42 if shut else -.6)
        lidm = np.clip((l0 + .12 * dx * dx - dy) * R / 1.2, 0, 1) * ball
        lcol = lidc * (.35 + .8 * dif)[..., None]
        edge = np.clip(1 - np.abs(l0 + .12 * dx * dx - dy) * R / 1.6, 0, 1) * ball
        col = col * (1 - lidm[..., None]) + lcol * lidm[..., None]
        col = col * (1 - .7 * edge[..., None])
        col = col + spec[..., None] * .8 * (1 - lidm[..., None])
        if not shut:   # the catchlight
            pin = np.clip((.16 - np.hypot(dx + .3, dy + .12)) * R / 1.2, 0, 1)
            col = col * (1 - pin[..., None]) + pin[..., None]
        rgb = rgb * (1 - ball[..., None]) + col * ball[..., None]
        al = np.maximum(al, ball)
        # lashes on the lid's edge: up when open, down when shut
        for k in range(11):
            t = -.85 + 1.7 * k / 10
            px, py = ex + t * R, ey + (l0 + .12 * t * t) * R
            if t * t + (l0 + .12 * t * t) ** 2 > 1.02:
                continue
            ang = (-math.pi / 2 + t * .7) if not shut else (math.pi / 2 + t * .5)
            ln = (3.6 if not shut else 4.2) * s * (1 - .3 * abs(t))
            dl.line([(px, py), (px + math.cos(ang) * ln, py + math.sin(ang) * ln)], fill=(38, 22, 16, 235), width=max(2, int(.45 * s)))
    la = np.asarray(lash).astype(np.float32) / 255
    rgb = rgb * (1 - la[..., 3:4]) + la[..., :3] * la[..., 3:4]
    al = np.maximum(al, la[..., 3])
    out = to_img(rgb, al)
    ol = out.getchannel('A').filter(ImageFilter.MaxFilter(9))
    bg = Image.new('RGBA', out.size, (8, 6, 8, 0))
    bg.putalpha(ol.point(lambda v: int(v * .85)))
    bg.alpha_composite(out)
    return bg


# ---------------- the crier (voice box) ----------------
CRIER_G = (34, 28)


def paint_crier(broken):
    s = S
    Wd, Hd = round(CRIER_G[0] * s), round(CRIER_G[1] * s)
    yy, xx = np.mgrid[0:Hd, 0:Wd].astype(np.float32)
    cx, cy = Wd / 2, Hd / 2
    rgb = np.zeros((Hd, Wd, 3), np.float32)
    al = np.zeros((Hd, Wd), np.float32)
    rng = np.random.default_rng(5 + broken)
    # the bellows at the back (right): paper pleats, tapering
    bx0, bx1 = cx + 3 * s, cx + 14 * s
    t = np.clip((xx - bx0) / (bx1 - bx0), 0, 1)
    bry = (9.5 - 3 * t) * s
    bm = ((xx >= bx0) & (xx <= bx1) & (np.abs(yy - cy) <= bry)).astype(np.float32)
    pleat = .5 + .5 * np.sin((xx - bx0) / (1.55 * s) * math.pi)
    paper = np.array([.66, .56, .40], np.float32) * (.45 + .6 * pleat)[..., None] * (1 - .35 * (np.abs(yy - cy) / np.maximum(bry, 1)) ** 2)[..., None]
    if broken:   # torn: a ragged dark tear and a hanging flap
        tear = (np.abs(yy - cy - 2 * s + 3 * s * np.sin(xx / (2.2 * s))) < 1.8 * s) & (xx > bx0 + 2 * s)
        bm = bm * (1 - .0 * tear)
        paper = np.where(tear[..., None], np.array([.06, .02, .03], np.float32), paper)
        flap = ((xx > bx1 - 3 * s) & (xx < bx1 + 1 * s) & (yy > cy + 4 * s) & (yy < cy + 12.5 * s)).astype(np.float32)
        bm = np.maximum(bm, flap)
        paper = np.where((flap > 0)[..., None], np.array([.5, .42, .3], np.float32) * (.7 + .3 * pleat)[..., None], paper)
    rgb = rgb * (1 - bm[..., None]) + paper * bm[..., None]
    al = np.maximum(al, bm)
    # the tin body
    tx0, tx1, ry = cx - 9 * s, cx + 4 * s, 10.5 * s
    body = ((xx >= tx0) & (xx <= tx1) & (np.abs(yy - cy) <= ry)).astype(np.float32)
    v = (yy - cy) / ry
    tin = np.array([.56, .52, .42], np.float32) * (.5 + .55 * np.clip(1 - np.abs(v + .35) * 1.4, 0, 1) ** 1.5)[..., None]
    rust = pk.sstep(.55, .85, pk.vnoise_small(Wd, Hd, int(3 * s), 8 + broken))
    tin = tin * (1 - .6 * rust[..., None]) + np.array([.40, .18, .08], np.float32) * .6 * rust[..., None]
    for rx_ in (tx0 + 4 * s, tx1 - 2 * s):   # rolled rims
        rb = np.clip(1 - np.abs(xx - rx_) / (.6 * s), 0, 1) * body
        tin = tin * (1 - .5 * rb[..., None])
    rgb = rgb * (1 - body[..., None]) + tin * body[..., None]
    al = np.maximum(al, body)
    # the front cap (left), facing out of the split: a perforated grille
    ex_, erx = tx0, 6 * s
    u = np.sqrt(((xx - ex_) / erx) ** 2 + ((yy - cy) / ry) ** 2)
    cap = np.clip((1 - u) * 8, 0, 1)
    capc = np.array([.62, .58, .46], np.float32) * (.55 + .5 * np.clip(-(yy - cy) / ry * .6 + .5, 0, 1))[..., None]
    capc = capc * (1 - .5 * rust[..., None]) + np.array([.42, .2, .1], np.float32) * .5 * rust[..., None]
    ring = np.clip(1 - np.abs(u - .9) / .08, 0, 1)
    capc = capc * (1 - .45 * ring[..., None])
    holes = np.zeros((Hd, Wd), np.float32)
    for rr, n in ((0, 1), (.42, 6), (.74, 10)):
        for k in range(n):
            a = k / n * math.tau + rr
            hx, hy = ex_ + math.cos(a) * rr * erx, cy + math.sin(a) * rr * ry
            holes = np.maximum(holes, np.clip((1.05 * s - np.hypot(xx - hx, (yy - hy) * .9)) / (.4 * s), 0, 1))
    capc = capc * (1 - holes[..., None]) + np.array([.04, .02, .02], np.float32) * holes[..., None]
    if broken:   # stove in: a ragged hole through the grille, the rim bent
        pts = [(ex_ + math.cos(a) * erx * rng.uniform(.35, .7), cy + math.sin(a) * ry * rng.uniform(.35, .65)) for a in np.linspace(0, math.tau, 13)[:-1]]
        hm = Image.new('L', (Wd, Hd), 0)
        ImageDraw.Draw(hm).polygon(pts, fill=255)
        hmm = np.asarray(hm.filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
        dent = np.clip(pk.sstep(.0, .5, hmm) * 1.0, 0, 1)
        capc = capc * (1 - .5 * np.clip(pk.blur(hmm, 6) * 2, 0, 1)[..., None])
        capc = capc * (1 - dent[..., None]) + np.array([.10, .02, .03], np.float32) * dent[..., None]
    rgb = rgb * (1 - cap[..., None]) + capc * cap[..., None]
    al = np.maximum(al, cap)
    out = to_img(rgb, al)
    if broken:   # the reed's spring poking out of the hole, and a smear of the tissue it was packed in
        d = ImageDraw.Draw(out)
        pts = [(ex_ - k * .9 * s + math.cos(k * 1.7) * 1.6 * s, cy - 1 * s + math.sin(k * 1.7) * 1.6 * s) for k in range(9)]
        d.line(pts, fill=(170, 165, 150, 255), width=int(.55 * s))
        d.ellipse((tx0 - 3 * s, cy + 5 * s, tx0 + 5 * s, cy + 9 * s), fill=(110, 30, 38, 220))
    ol = out.getchannel('A').filter(ImageFilter.MaxFilter(9))
    bg = Image.new('RGBA', out.size, (8, 6, 8, 0))
    bg.putalpha(ol.point(lambda v: int(v * .85)))
    bg.alpha_composite(out)
    return bg


# ---------------- the bake ----------------
class Lighter:
    """re-light per tilt: the vinyl's top light stays on top of the screen when the head turns"""

    def __init__(s, head):
        s.h, s.a = padf(head.h), padf(head.a)
        s.dif0, s.spec0 = padf(head.dif), padf(head.spec)
        s.cache = {}

    def get(s, deg):
        if deg not in s.cache:
            hr, ar = rot_f(s.h, deg), rot_f(s.a, deg)
            dif1, spec1, _ = pk.light(hr, ar)
            dif0, spec0 = rot_f(s.dif0, deg), rot_f(s.spec0, deg)
            corr = np.clip((.6 + .62 * dif1) / (.6 + .62 * dif0), .7, 1.5)
            sd = .32 * (spec1 - spec0)
            s.cache[deg] = (corr, sd, ar)
        return s.cache[deg]

    def apply(s, im, X, deg):
        if deg == 0:
            return im
        corr, sd, ar = s.get(deg)
        Xr = rot_f(padf(X), deg)
        vin = np.clip(ar, 0, 1) * (1 - np.clip(Xr, 0, 1))
        a = np.asarray(im).astype(np.float32) / 255
        rgb = a[..., :3] * (1 + (vin * (corr - 1))[..., None]) + (vin * sd)[..., None] * np.array([1, .97, .9], np.float32)
        return to_img(rgb, a[..., 3])


def mask_im(im, m):
    a = np.asarray(im).copy()
    a[..., 3] = (a[..., 3].astype(np.float32) * np.clip(m, 0, 1)).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def add_part(bk, name, hero, game, origin_hero):
    """Baker.add for a part with its own canvas and origin (same downsample, alpha cut and offsets)"""
    p = hero.convert('RGBa').resize(game, Image.LANCZOS).convert('RGBA')
    r, g, b, a = p.split()
    rgb = Image.merge('RGB', (r, g, b))
    if bk.unsharp:
        rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=bk.unsharp, threshold=2))
    rgb.putalpha(a.point(lambda v: 255 if v >= bk.cut else 0))
    bb = rgb.getchannel('A').getbbox() or (0, 0, 1, 1)
    sp = rgb.crop(bb)
    kx, ky = game[0] / hero.width, game[1] / hero.height
    if name not in bk.frames:
        bk.frames[name] = []
        bk.names.append(name)
    bk.frames[name].append((sp, bb[0] - round(origin_hero[0] * kx), bb[1] - round(origin_hero[1] * ky)))


def bake(d):
    head = Head(d)
    lit = Lighter(head)
    bk = Baker(KEY, (HERO, HERO), (PAD, PAD), (HO, HO), colors=256, alpha_cut=96, unsharp=60)
    # the layers at tilt 0, on the hero canvas
    faces, Xs = [], []
    for c in range(4):
        im, X = head.compose(c, 'half')
        faces.append(padw(im))
        Xs.append(X)
        print(f'  face {CRACKS[c]}')
    eyes = {}
    for e in EYES:
        im, X = head.compose(0, e)
        eyes[e] = (padw(mask_im(im, head.eyemask)), X)
        print(f'  eyes {e}')
    w_seat = padw(wound(False, np.random.default_rng(5)))
    w_gape = padw(wound(True, np.random.default_rng(5)))
    w_brain = padw(wound(True, np.random.default_rng(5), 1.45))
    fork_big = paint_fork(*FORK_G[:2], blood_from=FORK_G[2] - 1)
    f_seat, slot = fork_overlay(fork_big, 0)
    f_proud, _ = fork_overlay(fork_big, 9)
    def wl(wim, fk=None):
        o = wim.copy()
        if fk is not None:
            pool = Image.new('RGBA', o.size, (0, 0, 0, 0))
            ImageDraw.Draw(pool).ellipse((slot[0] - 3.2 * S, slot[1] - 1.6 * S, slot[0] + 3.2 * S, slot[1] + 1.4 * S), fill=(70, 4, 10, 235))
            o.alpha_composite(pool)
            o.alpha_composite(fk)
        return o
    wounds = {'seat': wl(w_seat, f_seat), 'proud': wl(w_seat, f_proud), 'gape': wl(w_gape), 'brain': wl(w_brain)}
    seat_nofork = w_seat

    # face<c>: the head with half-lidded eyes and the seated wound (no fork) - complete on its own
    for c in range(4):
        for t in TILTS:
            f = lit.apply(rot_im(faces[c], t), Xs[c], t)
            f.alpha_composite(rot_im(seat_nofork, t))
            bk.add(f'face{c}', f)
    for e in EYES:
        im, X = eyes[e]
        for t in TILTS:
            bk.add(f'eye_{e}', lit.apply(rot_im(im, t), X, t))
    for k in WOUNDS:
        for t in TILTS:
            bk.add(f'wound_{k}', rot_im(wounds[k], t))
    # die: split open, empty sockets, the brain, tipping onto its side (crown away from the ship)
    fd = faces[3].copy()
    ed, Xe = eyes['empty']
    fd.alpha_composite(ed)
    fd.alpha_composite(w_brain)
    Xd = np.maximum(Xs[3], Xe)
    for t in DIE:
        bk.add('die', lit.apply(rot_im(fd, t), Xd, t))
    # parts
    for shut in (False, True):
        r = paint_rocker(head, shut)
        att = (ROCK_ATTACH[0] * S, ROCK_ATTACH[1] * S)
        for sw in SWING:
            add_part(bk, 'rocker_shut' if shut else 'rocker_open', rot_im(r, sw, att), ROCK_G, att)
    for br in (False, True):
        add_part(bk, 'crier', paint_crier(br), CRIER_G, (CRIER_G[0] * S / 2, CRIER_G[1] * S / 2))
    fb = paint_fork(*FORK_G[:2], blood_from=FORK_G[2] + 6)
    add_part(bk, 'fork', fb, FORK_G[:2], (fb.width / 2, fb.height / 2))
    for br in (1.0, 1.35):
        mf = paint_fork(*MFORK_G, bright=br, seed=6)
        add_part(bk, 'mfork', mf, MFORK_G, (mf.width / 2, 0))
    lay = save_atlas(bk)
    return head, lay


RARE = 56   # palette entries reserved for the rare colours (the blue glass, blood, the meat, silver)


def save_atlas(bk):
    """Baker.save with a two-part palette: a median cut of the whole sheet is dominated by tan vinyl and merges the
    small blue irises into grey, so RARE entries come from a separate median cut of the off-vinyl pixels only"""
    import hashlib
    cells, order = {}, []
    hs = lambda sp: hashlib.sha1(sp.tobytes() + bytes(str(sp.size), 'ascii')).hexdigest()
    for n in bk.names:
        for sp, _, _ in bk.frames[n]:
            h = hs(sp)
            if h not in cells:
                cells[h] = None
                order.append((h, sp))
    order.sort(key=lambda q: -q[1].height)
    x = y = shelf = W = H = 0
    for h, sp in order:
        if x + sp.width > 1024:
            x, y, shelf = 0, y + shelf + 1, 0
        cells[h] = (x, y)
        x += sp.width + 1
        shelf = max(shelf, sp.height)
        W, H = max(W, x), max(H, y + shelf)
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for h, sp in order:
        sheet.paste(sp, cells[h])
    a = np.asarray(sheet).astype(np.int32)
    op = a[..., 3] > 0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    rare = op & ((b > r + 6) | (r > g * 1.7 + 10) | ((np.abs(r - b) < 12) & (np.abs(g - b) < 12) & (r > 120)))
    px = a[rare][:, :3].astype(np.uint8)
    main = sheet.convert('RGB').quantize(colors=255 - RARE, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = main.getpalette()[:3 * (255 - RARE)]
    pal += [0] * (3 * (255 - RARE) - len(pal))
    if len(px):
        side = int(math.ceil(math.sqrt(len(px))))
        buf = np.zeros((side * side, 3), np.uint8)
        buf[:len(px)] = px
        buf[len(px):] = px[0]
        rq = Image.fromarray(buf.reshape(side, side, 3)).quantize(colors=RARE, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        rp = rq.getpalette()[:3 * RARE]
        pal += rp + [0] * (3 * RARE - len(rp))
    else:
        pal += [0] * (3 * RARE)
    pim = Image.new('P', (1, 1))
    pim.putpalette(pal + [0, 0, 0])
    q = sheet.convert('RGB').quantize(palette=pim, dither=Image.Dither.NONE)
    q.putpalette(pal + [0, 0, 0])
    q.paste(255, mask=sheet.getchannel('A').point(lambda v: 255 if v == 0 else 0))
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, KEY + '.png')
    q.save(path, transparency=255, optimize=True)
    lay = dict(w=W, h=H, f={})
    for n in bk.names:
        lay['f'][n] = [[*cells[hs(sp)], sp.width, sp.height, ox, oy] for sp, ox, oy in bk.frames[n]]
    json.dump(lay, open(os.path.join(OUT_DIR, KEY + '.json'), 'w'), separators=(',', ':'))
    print(f'{KEY}: {W}x{H} atlas, {len(order)} cells, {sum(len(v) for v in bk.frames.values())} frames, '
          f'{os.path.getsize(path) // 1024} KB')
    return lay


def anchors(lay):
    """the geometry contract, measured from the bake: per tilt, the points the fight and the renderer need"""
    wound_c = t2g(*pk.WOUND)
    slot = t2g(pk.WOUND[0], pk.WOUND[1] + pk.K)            # the midboss's slot: wy + 1 midboss px
    eyes = [t2g(cx, cy) for cx, cy, _, _ in pk.socket_boxes()]
    wire, crier = t2g(*WIRE_T), t2g(*CRIER_T)
    fork_dir = (math.sin(.14), -math.cos(.14))             # handle-up direction of the seated fork at tilt 0
    rows = lay['f']
    per = []
    for i, t in enumerate(TILTS):
        r = rows['face0'][i]
        a = math.radians(t)
        fd = (fork_dir[0] * math.cos(a) - fork_dir[1] * math.sin(a), fork_dir[0] * math.sin(a) + fork_dir[1] * math.cos(a))
        rnd = lambda p: [round(p[0], 1), round(p[1], 1)]
        per.append({
            'tilt': t,
            'bbox': [r[4], r[5], r[2], r[3]],
            'wound': rnd(rotp(wound_c, t)),
            'slot': rnd(rotp(slot, t)),
            'forkUp': [round(fd[0], 3), round(fd[1], 3)],
            'eyeL': rnd(rotp(eyes[0], t)), 'eyeR': rnd(rotp(eyes[1], t)),
            'wire': rnd(rotp(wire, t)), 'crier': rnd(rotp(crier, t)),
        })
    return per


def write_manifest(lay, per, base_rows):
    f = lay['f']
    man = {
        '_doc': 'THE KEEPSAKE stage boss: the geometry contract for src/sprites/boss/keepsake-boss.{png,json} (written by '
                'tools/prep_keepsake_boss.py). Units: game px from the boss origin (between the eyes at tilt 0). Tilt: '
                'canvas degrees, + = clockwise on screen, so -32 puts the crown toward the ship (screen left). Every '
                'head layer is baked rotated about the origin and drawn at the origin: bf(c, key, list, tiltIndex, e.x, e.y). '
                'Draw order: face<c> -> eye_<state> -> wound_<state>. face<c> alone is a complete head (half-lidded, '
                'seated wound with no fork).',
        'key': KEY,
        'atlas': f'src/sprites/boss/{KEY}.png', 'layout': f'src/sprites/boss/{KEY}.json',
        'atlasSize': [lay['w'], lay['h']],
        'frame': {'size': [GW, GH], 'origin': [52, 67], 'note': 'the reference head box at tilt 0; atlas frames are cropped '
                  'to their pixels with offsets from the origin, so read sizes from the layout, not from here'},
        'tilts': TILTS,
        'lists': {
            'face0': 'crack WHOLE (phase 1), one frame per tilt', 'face1': 'HAIRLINE (phase 2)',
            'face2': 'SPLIT (the 2->3 transition)', 'face3': 'SPLIT OPEN (phase 3: ship meat in the gap)',
            'eye_open': 'the stare: an attack is coming (catchlight)', 'eye_half': 'dozing (same as the face frames)',
            'eye_shut': 'shut', 'eye_empty': 'phase 3: the mechanism fell out, empty sockets',
            'wound_seat': 'the fork seated in the split', 'wound_proud': 'the tell: the fork pushed up 9 px',
            'wound_gape': 'the fork out (boomerang / window)', 'wound_brain': 'phase 3: the larger brain, gaping, no fork',
            'die': f'split open, empty sockets, the brain, tipping onto its side at tilts {DIE}',
            'rocker_open': f'the sleep-eye mechanism at swing angles {SWING} (canvas deg about its attach point), lids open',
            'rocker_shut': 'the same, lids shut (the death clack: PUT TO BED)',
            'crier': '[0] whole, [1] broken; origin at its centre',
            'fork': 'the big fork (thrown / boomerang), tines down, origin at its centre; rotate at runtime (it spins)',
            'mfork': '[0] a hanging mobile fork, [1] the drop tell (brighter); origin at the top centre (the thread)',
        },
        'counts': {k: len(v) for k, v in f.items()},
        'perTilt': per,
        'base': base_rows,
        'crown': {'line': -28, 'line3': -12, 'top': -52,
                  'note': 'ANGLE: full damage at head-local y <= line (phases 1-2) or line3 (phase 3, the split exposes '
                          'more). top is the crown at tilt 0. Head-local = screen rotated by -tilt about the origin'},
        'fork': {'size': list(FORK_G[:2]), 'entry': FORK_G[2], 'lean': .14,
                 'note': 'wound_seat/proud have it baked in. entry: px from the fork\'s top where it goes into the skull'},
        'rocker': {'attach': 'frame offsets are from the wire end; draw the wire from perTilt.wire to it',
                   'eyes': [[-ROCK_EYE, 22], [ROCK_EYE, 22]], 'r': ROCK_R, 'weight': [4, 48], 'swing': SWING},
        'mfork': {'size': list(MFORK_G)},
        'crier': {'size': list(CRIER_G)},
        'source': 'photos by Matt Arvon of his own unmarked antique doll (D7/D53); not in the repo',
    }
    with open(os.path.join(HERE, 'keepsake-boss-art.json'), 'w') as fh:
        json.dump(man, fh, indent=1)
    return man


def base_points(lay):
    """the lowest opaque point of each face0 tilt and die frame (rest it on the floor: e.y = floor - base.y)"""
    im = Image.open(os.path.join(HERE, '..', 'src', 'sprites', 'boss', KEY + '.png')).convert('RGBA')
    out = {}
    for name in ('face0', 'die'):
        rows = []
        for r in lay['f'][name]:
            a = np.asarray(im.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])))[..., 3]
            ys = np.where(a.max(1) > 0)[0]
            yb = ys[-1]
            xs = np.where(a[yb] > 0)[0]
            rows.append([round(float(r[4] + xs.mean()), 1), int(r[5] + yb + 1)])
        out[name] = rows
    return out


# ---------------- preview ----------------
def preview(path, lay):
    atlas = Image.open(os.path.join(HERE, '..', 'src', 'sprites', 'boss', KEY + '.png')).convert('RGBA')
    F = lay['f']

    def blit(dst, name, i, x, y, z=1):
        r = F[name][i % len(F[name])]
        sp = atlas.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
        if z != 1:
            sp = sp.resize((sp.width * z, sp.height * z), Image.NEAREST)
        dst.alpha_composite(sp, (round(x + r[4] * z), round(y + r[5] * z)))

    def head(dst, x, y, c, e, wd, ti, z):
        blit(dst, f'face{c}', ti, x, y, z)
        blit(dst, f'eye_{e}', ti, x, y, z)
        blit(dst, f'wound_{wd}', ti, x, y, z)

    Wd = 1700
    sheet = Image.new('RGBA', (Wd, 2140), (16, 11, 13, 255))
    dr = ImageDraw.Draw(sheet)
    def label(x, y, s):
        dr.text((x, y), s, fill=(230, 220, 210, 255))
    z = 2
    # row 1: the four crack states x five tilts, as phase 1 dozing would draw them (eyes half, fork seated)
    label(10, 6, 'FACE x TILT (crack state rows: whole / hairline / split / open; tilts -32 -16 0 +16 +32), drawn with eye_half + wound_seat, 2x')
    for c in range(4):
        for ti in range(5):
            x, y = 130 + ti * 300, 130 + c * 250
            e = 'half' if c < 2 else 'empty'
            wd = 'seat' if c < 3 else 'brain'
            head(sheet, x, y, c, e, wd, ti, z)
        label(4, 130 + c * 250, CRACKS[c])
    # row 2: the phase reads, tilt 0, 3x
    y0 = 1150
    label(10, y0 - 22, 'PHASE READS, 3x: doze / tell (eyes open, fork proud) / boomerang (gape) / AWAKE tilted to the ship, open / CRACKED + rocker + crier / death')
    z = 3
    reads = [(0, 'half', 'seat', 2), (0, 'open', 'proud', 2), (1, 'open', 'gape', 2), (1, 'open', 'seat', 0), (3, 'empty', 'brain', 2)]
    for i, (c, e, wd, ti) in enumerate(reads):
        x = 170 + i * 320
        head(sheet, x, y0 + 200, c, e, wd, ti, z)
    # the rocker hanging in front of the phase-3 face, the crier in the split
    x = 170 + 4 * 320
    man = json.load(open(os.path.join(HERE, 'keepsake-boss-art.json')))
    wv = man['perTilt'][2]['wire']
    ax, ay = x + wv[0] * z + 10 * z, y0 + 200 + wv[1] * z + 36 * z
    dr.line((x + wv[0] * z, y0 + 200 + wv[1] * z, ax, ay), fill=(160, 160, 150, 255), width=2)
    blit(sheet, 'rocker_open', 3, ax, ay, z)
    cv = man['perTilt'][2]['crier']
    blit(sheet, 'crier', 0, x + cv[0] * z, y0 + 200 + cv[1] * z, z)
    blit(sheet, 'die', 3, 1600, y0 + 260, 2)
    # row 3: parts at 3x
    y1 = 1640
    label(10, y1 - 22, 'PARTS 3x: rocker open (5 swings) / rocker shut / crier whole, broken / big fork / mobile fork, tell / die frames 2x')
    x = 40
    for k in range(5):
        blit(sheet, 'rocker_open', k, x + 40 + k * 120, y1 + 10, 2)
    for k in range(5):
        blit(sheet, 'rocker_shut', k, x + 40 + k * 120, y1 + 160, 2)
    blit(sheet, 'crier', 0, 720, y1 + 60, 3)
    blit(sheet, 'crier', 1, 840, y1 + 60, 3)
    blit(sheet, 'fork', 0, 950, y1 + 110, 3)
    blit(sheet, 'mfork', 0, 1010, y1 + 10, 3)
    blit(sheet, 'mfork', 1, 1060, y1 + 10, 3)
    for k in range(4):
        blit(sheet, 'die', k, 1150 + k * 140, y1 + 200, 2)
    # a mock playfield at 1x then 2x (the Fold shows ~4.5x of 480x254), the boss on the floor at x W-120
    pf = Image.new('RGBA', (480, 254), (40, 24, 28, 255))
    pd = ImageDraw.Draw(pf)
    pd.rectangle((0, 230, 480, 254), fill=(70, 40, 40, 255))
    pd.rectangle((0, 0, 480, 14), fill=(60, 34, 36, 255))
    base0 = man['base']['face0'][2][1]
    head(pf, 360, 230 - base0, 1, 'open', 'seat', 0, 1)
    pd.polygon([(60, 120), (76, 126), (60, 132)], fill=(120, 200, 230, 255))
    for k, fx in enumerate((300, 330, 380, 410)):
        pd.line((fx, 14, fx, 30 + k * 4), fill=(200, 200, 200, 120))
        blit(pf, 'mfork', 0, fx, 30 + k * 4)
    pf.alpha_composite(Image.new('RGBA', (1, 1)), (0, 0))
    big = pf.resize((960, 508), Image.NEAREST)
    out = Image.new('RGBA', (Wd, sheet.height + 540), (16, 11, 13, 255))
    out.alpha_composite(sheet)
    out.alpha_composite(big, (10, sheet.height + 20))
    ImageDraw.Draw(out).text((980, sheet.height + 30), 'mock playfield 480x254 at 2x (AWAKE, tilted to the ship, eyes open),\n'
                             'the Fold shows ~4.5x; mobile forks hung over the crown', fill=(230, 220, 210, 255))
    out.save(path)


def main():
    d = pk.find_photos()
    if not d:
        print('prep_keepsake_boss: source photos not found (assets-raw/keepsake is git-ignored and not in the public repo);'
              f' the committed src/sprites/boss/{KEY}.png stands. Nothing to do.')
        return 0
    _, lay = bake(d)
    per = anchors(lay)
    bases = base_points(lay)
    write_manifest(lay, per, bases)
    print('manifest: tools/keepsake-boss-art.json')
    if len(sys.argv) > 1:
        preview(sys.argv[1], lay)
        print('preview:', sys.argv[1])
    return 0


if __name__ == '__main__':
    sys.exit(main())
