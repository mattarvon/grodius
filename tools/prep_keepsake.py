"""Sprite prep for THE KEEPSAKE, the ship-pool ANGLE midboss (src/render/gross/mid/keepsake.ts; D53).

Source: Matt Arvon's own photographs of his own unmarked antique vinyl doll head (D7: he owns the doll and the photos).
The photos are NOT in the repo (assets-raw/ is git-ignored and the repo is public); only the baked PNGs ship. Without
them this script prints a message and exits cleanly: the committed PNGs are the source of truth for the game.

Matt's art direction (2026-11-15): face forward, no wig, "creepy as shit", imply only (no child figure, face, handprint
or name tag: the doll is just a doll). So:

  - ONE cut-out, from the front photo (eyes open). The wig is removed, not cut round: the face is kept where the photo
    shows bare vinyl (a skin-vs-hair colour test inside a hand-placed face prior), and the bald dome above and behind it
    is rebuilt from the forehead's own vinyl colour, lit as a sphere. No hair edge is ever cut, so the silhouette is
    an analytic shape (cranium + chubby jowls + wooden stump) with an anti-aliased edge.
  - the blink: the sockets of the half-lidded and eyes-shut photos are transplanted into the front photo's sockets,
    each socket's bbox mapped onto the front one's (the half-lidded photo is levelled first), colour-matched to the
    face round it. So the three frames share one silhouette and never shift (hand-held photos do).
  - creep, painted: yellowed sun-faded vinyl with stains, grime in the creases, mould specks spreading, a too-wide
    stare (the eyes x1.14) with one clouded iris, sunken shadow under the lids, the old wig cap's seam with glue
    residue and a few glued-on tufts, a hairline crack from the wound down toward the player-side eye, blood seeping
    from the wound, a dark trickle from a tear duct and a mouth corner, cracked lips; harsh top light.
  - the wound: the vinyl split open at the crown with brain bulging out (pink-grey, wet) round a slot the fork sits in
    (frames 0-2), or gaping with the fork gone (frames 3-5, phase 2's boomerang). The fork itself is its own sprite,
    drawn live by the renderer so its handle can rise on the tell and leave on the boomerang.

Geometry: the boss origin (e.x, e.y) is at frame pixel (OX, OY). The crown top is game y -24, the wound (KEEP.wx, wy) =
(2, -24) sits in the split, the face hit-zone line (y > -13) runs across the upper forehead, the head is ~40 px wide
(KEEP.r 22, roster fit hw 22), the chin at +20, the stump's end at about +25.

Run:  python -I tools/prep_keepsake.py [preview.png]
      -> src/sprites/keepsake@6.png  (48x58 frames: 0 open, 1 half, 2 shut with the fork's slot; 3-5 the same, gaping)
         src/sprites/keepsake-fork.png (the ornate silver fork, tines down)
"""
import os
import sys
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(HERE, '..', 'src', 'sprites')
def _main_checkout():
    """the main checkout's root when run from a git worktree (its assets-raw holds the photos), else None"""
    try:
        import subprocess
        common = subprocess.run(['git', 'rev-parse', '--git-common-dir'], cwd=HERE, capture_output=True, text=True).stdout.strip()
        return os.path.dirname(os.path.abspath(os.path.join(HERE, common))) if common else None
    except Exception:
        return None


# the photos are Matt's own and git-ignored: KEEPSAKE_PHOTOS, this checkout's assets-raw, or the main checkout's
CANDIDATES = [os.environ.get('KEEPSAKE_PHOTOS', ''), os.path.join(HERE, '..', 'assets-raw', 'keepsake'),
              os.path.join(_main_checkout() or HERE, 'assets-raw', 'keepsake')]
F_OPEN, F_HALF, F_SHUT = 'doll-front-eyes-open.jpg', '3782-front-half-lidded.jpg', '3777-front-eyes-shut-a.jpg'

# ---- geometry. Coordinates below are "thumb" px: the photo at 1/4 size (563 x 1000), where they were measured
FW, FH = 48, 58          # frame size, game px
OX, OY = 24, 31          # the boss origin inside a frame
K = 8.5                  # thumb px per game px
CX0, CY0 = 281, 489      # the thumb point at the boss origin (between the eyes)
Q = 2                    # work at 2x thumb (1/2 the photo)
WW, WH = round(FW * K * Q), round(FH * K * Q)
EYES_OPEN = [(173, 466, 246, 517), (316, 467, 389.5, 516)]    # socket bboxes, front photo (x0, y0, x1, y1)
EYES_HALF = [(90, 380, 198, 470), (319, 376, 451, 486)]       # half-lidded, after levelling by HALF_ROT about HALF_C
HALF_ROT, HALF_C = 18.88, (140, 426)
EYES_SHUT = [(177.5, 475, 252.5, 526), (330, 484, 407.5, 537)]
WIDEN = 1.14             # the stare: eyes a touch too big
WOUND = (CX0 + 2 * K, CY0 - 23.6 * K)   # KEEP.wx, wy in thumb px


def w(tx, ty):
    """thumb px -> work px"""
    return ((tx - CX0) * Q + OX * K * Q, (ty - CY0) * Q + OY * K * Q)


def find_photos():
    for d in CANDIDATES:
        if d and os.path.isfile(os.path.join(d, F_OPEN)):
            return d
    return None


def load(d, name, rot=None):
    """a photo at half size (2x thumb), as float RGB 0..1, optionally levelled"""
    im = ImageOps.exif_transpose(Image.open(os.path.join(d, name))).convert('RGB')
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    if rot:
        im = im.rotate(rot[0], resample=Image.BICUBIC, center=(rot[1][0] * 2, rot[1][1] * 2))
    return im


def crop_work(im):
    """the work canvas cut from a half-size photo: thumb point (CX0, CY0) lands at the boss origin"""
    x0, y0 = (CX0 - OX * K) * 2, (CY0 - OY * K) * 2
    return im.crop((round(x0), round(y0), round(x0) + WW, round(y0) + WH))


def arr(im):
    return np.asarray(im).astype(np.float32) / 255


# ---------------- numpy helpers ----------------
def _box(a, r, axis):
    if r < 1:
        return a
    n = a.shape[axis]
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis)
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return (hi - lo) / (2 * r + 1)


def blur(a, s):
    """~gaussian blur, sigma s px (three box passes per axis)"""
    r = max(1, int(round(math.sqrt(12 * s * s / 3 + 1) / 2 - .5)))
    for _ in range(3):
        a = _box(_box(a, r, 0), r, 1)
    return a


def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


YY, XX = np.mgrid[0:WH, 0:WW].astype(np.float32)


def ell_u(cx, cy, rx, ry):
    """normalised radius of an ellipse given in thumb px"""
    x, y = w(cx, cy)
    return np.sqrt(((XX - x) / (rx * Q)) ** 2 + ((YY - y) / (ry * Q)) ** 2)


def ell_a(cx, cy, rx, ry, feather=1.2):
    """anti-aliased ellipse coverage, feather in work px"""
    u = ell_u(cx, cy, rx, ry)
    return np.clip(.5 - (u - 1) * min(rx, ry) * Q / feather, 0, 1)


def vnoise(scale, seed):
    """smooth value noise 0..1 over the work canvas, cell `scale` work px"""
    rng = np.random.default_rng(seed)
    gh, gw = int(WH / scale) + 3, int(WW / scale) + 3
    g = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8))
    g = g.resize((round(gw * scale), round(gh * scale)), Image.BICUBIC).crop((0, 0, WW, WH))
    return np.asarray(g).astype(np.float32) / 255


def layer():
    return Image.new('RGBA', (WW, WH), (0, 0, 0, 0))


def over(base, lay):
    """alpha-composite a PIL RGBA layer over a float RGB array"""
    l = arr(lay)
    a = l[..., 3:4]
    return base * (1 - a) + l[..., :3] * a


def P(pts):
    return [w(x, y) for x, y in pts]


# ---------------- the head ----------------
def silhouette():
    """cranium + chubby jowls (the bald head) as one smooth shape, and its height field for the lighting"""
    d1 = (ell_u(281, 455, 170, 170) - 1) * 170 * Q
    d2 = (ell_u(283, 560, 158, 100) - 1) * 100 * Q
    k = 70.0 * Q  # smooth min: the jowls swell out of the skull, no ledge
    hh = np.clip(.5 + .5 * (d2 - d1) / k, 0, 1)
    dd = d2 * (1 - hh) + d1 * hh - k * hh * (1 - hh)
    a = np.clip(.5 - dd / 1.2, 0, 1)
    s_in, R = np.clip(-dd, 0, None), 175.0 * Q
    h = np.sqrt(np.clip(s_in * (2 * R - s_in), 0, None))
    return a, h


def face_keep(ph):
    """where the photo shows bare vinyl (not wig): a face prior, and a skin-vs-hair test (hair's blue/red is lower)"""
    r, g, b = ph[..., 0], ph[..., 1], ph[..., 2]
    skin = sstep(.47, .56, b / np.maximum(r, 1e-3)) * sstep(.25, .4, r)
    prior = np.clip(1.6 - ell_u(282, 520, 160, 178) * 1.6, 0, 1) * sstep(335, 360, (YY / Q + CY0 - OY * K))
    core = ell_a(282, 545, 125, 118, 30)
    k = np.maximum(core, prior * skin)
    k = blur(k, 5)
    k = sstep(.35, .7, k)
    return blur(k, 3)


def transplant(base, src_im, src_boxes, dst_boxes, gain_ref):
    """paste each socket of src (a half-size PIL photo) into base, its bbox mapped onto the dst bbox, colour-matched"""
    out = base.copy()
    for sb, db in zip(src_boxes, dst_boxes):
        dcx, dcy = (db[0] + db[2]) / 2, (db[1] + db[3]) / 2
        dw, dh = (db[2] - db[0]) * WIDEN, (db[3] - db[1]) * WIDEN
        # work px -> src half-size px: dst bbox (widened) onto src bbox
        x0, y0 = w(dcx - dw / 2, dcy - dh / 2)
        sx = (sb[2] - sb[0]) * 2 / (dw * Q)
        sy = (sb[3] - sb[1]) * 2 / (dh * Q)
        coef = (sx, 0, sb[0] * 2 - x0 * sx, 0, sy, sb[1] * 2 - y0 * sy)
        warped = arr(src_im.transform((WW, WH), Image.AFFINE, coef, resample=Image.BICUBIC))
        m = ell_a(dcx, dcy, dw / 2 * 1.13, dh / 2 * 1.2, 7)
        ring = ell_a(dcx, dcy, dw / 2 * 1.5, dh / 2 * 1.7, 2) - ell_a(dcx, dcy, dw / 2 * 1.2, dh / 2 * 1.3, 2)
        ring = np.clip(ring, 0, 1)[..., None]
        mean_src = (warped * ring).sum((0, 1)) / max(1, ring.sum())
        mean_dst = (gain_ref * ring).sum((0, 1)) / max(1, ring.sum())
        warped = np.clip(warped * (mean_dst / np.maximum(mean_src, 1e-3)), 0, 1)
        out = out * (1 - m[..., None]) + warped * m[..., None]
    return out


def socket_boxes(scale=WIDEN):
    res = []
    for db in EYES_OPEN:
        cx, cy = (db[0] + db[2]) / 2, (db[1] + db[3]) / 2
        res.append((cx, cy, (db[2] - db[0]) * scale / 2, (db[3] - db[1]) * scale / 2))
    return res


def cloud_iris(img, eye, k=.55):
    """the right eye's iris milked over: a cataract"""
    cx, cy, rx, ry = eye
    m = ell_a(cx + 1, cy, rx * .62, ry * .95, 4)
    n = vnoise(6, 17)[..., None]
    milk = np.array([.66, .70, .68], np.float32) * (.85 + .3 * n)
    return img * (1 - m[..., None] * k) + milk * m[..., None] * k


def paint_details(rng, gaping):
    """everything painted on the vinyl, as RGBA layers (under the lighting) + wet ones (over it)"""
    under, wet = layer(), layer()
    du, dw_ = ImageDraw.Draw(under), ImageDraw.Draw(wet)
    # the old wig cap's seam, grime packed in it, glue residue above it
    seam = [(118 + i * 4, 405 - 112 * math.sin(math.pi * i / 81) ** .55 - 4 * math.sin(i * .23) - 2 * math.sin(i * .61 + 1)) for i in range(82)]
    glue = layer()
    dg = ImageDraw.Draw(glue)
    for _ in range(9):
        i = int(rng.integers(6, 76))
        x, y = seam[i]
        rx, ry = rng.uniform(10, 20), rng.uniform(5, 9)
        pts = [(x + math.cos(a) * rx * rng.uniform(.6, 1.2), y - 9 + math.sin(a) * ry * rng.uniform(.6, 1.2))
               for a in np.linspace(0, math.tau, 9)[:-1]]
        dg.polygon(P(pts), fill=(140, 100, 36, int(rng.uniform(60, 100))))
    for (x0, y0), (x1, y1) in zip(seam, seam[1:]):
        dg.line(P([(x0, y0 + 1), (x1, y1 + 1)]), fill=(70, 46, 24, 90), width=7 * Q)
    under.alpha_composite(glue.filter(ImageFilter.GaussianBlur(3 * Q)))
    for (x0, y0), (x1, y1) in zip(seam, seam[1:]):
        du.line(P([(x0, y0), (x1, y1)]), fill=(40, 26, 16, 170), width=int(1.6 * Q))
    # a few glued-on tufts left behind on the seam: thin, dead, one sticking out past the temple
    for i, ang, n, ln in ((5, -2.4, 7, 40), (33, -1.9, 4, 20), (60, -1.1, 5, 24), (78, -.5, 6, 34)):
        x, y = seam[i]
        for k in range(n):
            a = ang + rng.uniform(-.3, .3)
            L = ln * rng.uniform(.6, 1.1)
            pts, px, py = [], x + rng.uniform(-3, 3), y
            for s in range(10):
                a += rng.uniform(-.3, .32)
                px += math.cos(a) * L / 10
                py += math.sin(a) * L / 10
                pts.append((px, py))
            col = (int(rng.uniform(110, 150)), int(rng.uniform(92, 118)), int(rng.uniform(60, 78)), 210)
            du.line(P([(x, y)] + pts), fill=col, width=max(1, int(1.1 * Q)))
    # mould specks spreading: cheeks, chin, under the eyes, neck
    for cx, cy, sp, n in ((170, 600, 26, 40), (268, 655, 30, 45), (215, 545, 22, 22), (360, 548, 18, 16),
                          (412, 565, 16, 14), (300, 662, 26, 26), (150, 520, 14, 10), (240, 630, 12, 10)):
        for _ in range(n):
            x, y = cx + rng.normal(0, sp), cy + rng.normal(0, sp * .6)
            r = rng.uniform(.8, 2.6)
            du.ellipse(P([(x - r, y - r), (x + r, y + r)]), fill=(18, 22, 12, int(rng.uniform(150, 240))))
    # the crack: from the split down the forehead toward the player-side eye, with a branch
    def crack(pts, wd):
        du.line(P([(x + 1.2, y + 1) for x, y in pts]), fill=(250, 235, 210, 90), width=max(1, int(wd * Q * .7)))
        du.line(P(pts), fill=(25, 10, 8, 235), width=max(1, int(wd * Q)))
    c, x, y = [(WOUND[0] - 22, WOUND[1] + 18)], WOUND[0] - 22, WOUND[1] + 18
    while y < 450:
        x += rng.uniform(-13, -2)
        y += rng.uniform(8, 14)
        c.append((x, y))
    crack(c, 2.6)
    crack([c[5], (c[5][0] + 16, c[5][1] + 10), (c[5][0] + 22, c[5][1] + 24)], 1.6)
    crack([c[9], (c[9][0] - 18, c[9][1] + 6), (c[9][0] - 30, c[9][1] + 4)], 1.4)
    # the lips: cracked, dark in the seam
    for x0, y0, x1, y1 in ((271, 603, 273, 611), (291, 601, 289, 609), (282, 618, 284, 625), (298, 617, 296, 623)):
        du.line(P([(x0, y0), (x1, y1)]), fill=(40, 8, 10, 170), width=max(1, int(1.1 * Q)))
    du.line(P([(262, 613), (285, 616), (308, 612)]), fill=(30, 5, 8, 160), width=int(1.5 * Q))

    # ---- wet things, over the lighting ----
    def trickle(x, y, length, w0, col, seed, drift=0):
        r2 = np.random.default_rng(seed)
        pts = [(x, y)]
        for _ in range(int(length / 6)):
            x += r2.uniform(-1.6, 1.6) + drift
            y += 6
            pts.append((x, y))
        for i, ((x0, y0), (x1, y1)) in enumerate(zip(pts, pts[1:])):
            wd = w0 * (1 - .6 * i / len(pts)) * r2.uniform(.75, 1.15)
            dw_.line(P([(x0, y0), (x1, y1)]), fill=col, width=max(1, int(wd * Q)))
        bx, by = pts[-1]
        dw_.ellipse(P([(bx - w0 * .4, by - w0 * .3), (bx + w0 * .4, by + w0 * .6)]), fill=col)
        for (x0, y0), (x1, y1) in list(zip(pts, pts[1:]))[1::3]:
            dw_.line(P([(x0 - w0 * .2, y0), (x1 - w0 * .2, y1)]), fill=(230, 140, 130, 70), width=1)
    blood = (82, 4, 10, 235)
    seeps = [(-26, 60, 5), (-8, 36, 4), (16, 80, 5.5), (30, 30, 4)] + ([(-40, 110, 6), (4, 135, 7), (24, 120, 6)] if gaping else [])
    for i, (dx, ln, wd) in enumerate(seeps):
        trickle(WOUND[0] + dx, WOUND[1] + 12, ln, wd, blood, 40 + i)
    trickle(222, 520, 64, 4.2, (55, 8, 16, 220), 7, -.1)    # over the lower lid
    trickle(309, 616, 34, 3.4, (50, 6, 12, 220), 9, .15)   # a mouth corner
    # wet glints: the lips, the glass
    dw_.line(P([(282, 607), (294, 606)]), fill=(255, 220, 210, 90), width=max(1, int(1.2 * Q)))  # wet on the lip
    return under, wet


def wound(gaping, rng):
    """the split in the crown and the brain bulging out of it, lit on its own (wet, glossy); returns (RGBA layer, alpha).
    Kept round and ragged, never a horizontal slit with red rims: that reads as a mouth"""
    wx, wy = WOUND
    # the torn vinyl lip (lifted, pale) and the dark split under the brain
    L = layer()
    d = ImageDraw.Draw(L)
    def star(rx, ry, jag, n):
        pts = []
        for i in range(n):
            t = i / n * math.tau
            k = 1 + (rng.uniform(-jag, jag) if i % 2 else rng.uniform(0, jag))
            pts.append((wx + math.cos(t) * rx * k, wy + 4 + math.sin(t) * ry * k))
        return pts
    d.polygon(P(star(46, 22, .3, 20)), fill=(200, 172, 128, 255))
    d.polygon(P(star(41, 18, .35, 20)), fill=(26, 4, 8, 255))
    sp = arr(L)
    # the brain: lobes as little domes, folds from a noise ridge, its own gloss
    lobes = [(-24, -2, 17, 13), (-6, -10, 19, 15), (16, -7, 18, 14), (31, 3, 12, 10), (-33, 6, 11, 9), (4, 4, 16, 11)]
    hmax = np.zeros((WH, WW), np.float32)
    cov = np.zeros((WH, WW), np.float32)
    for dx, dy, rx, ry in lobes:
        u = ell_u(wx + dx, wy + dy, rx, ry)
        hmax = np.maximum(hmax, np.sqrt(np.clip(1 - u * u, 0, 1)))
        cov = np.maximum(cov, ell_a(wx + dx, wy + dy, rx, ry, 1.2))
    n1, n2 = vnoise(4.5 * Q, 31), vnoise(2.5 * Q, 32)
    folds = 1 - sstep(.0, .07, np.abs(n1 - .5))
    col = np.array([.72, .50, .52], np.float32) * (.45 + .6 * hmax)[..., None]
    col = col * (1 - .55 * folds)[..., None] + np.array([.30, .10, .14], np.float32) * (.55 * folds)[..., None]
    col *= (.4 + .6 * sstep(0, .3, hmax))[..., None]  # dark between the lobes
    gy, gx = np.gradient(hmax * 12 * Q)
    nn = np.stack([-gx, -gy, np.ones_like(hmax)], -1)
    nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
    H = np.array([-.14, -.43, .89], np.float32)
    H /= np.linalg.norm(H)
    gloss = np.clip((nn * H).sum(-1), 0, 1) ** 24 * (.6 + .4 * n2)
    col = col + gloss[..., None] * .75
    # blood pooled in the split, round the slot or the hole
    if gaping:
        hole = np.clip(ell_a(wx, wy + 2, 14, 12, 1.5) * (.75 + .5 * vnoise(3 * Q, 33)), 0, 1)
        rimr = np.clip(ell_a(wx, wy + 2, 19, 16, 3) - hole, 0, 1)
        col = col * (1 - rimr[..., None] * .8) + np.array([.42, .03, .06], np.float32) * rimr[..., None] * .8
        col = col * (1 - hole[..., None]) + np.array([.06, 0, .01], np.float32) * hole[..., None]
        cov = np.maximum(cov, ell_a(wx, wy + 2, 19, 16, 2))
    else:
        slot = ell_a(wx, wy + 1, 9, 5, 1.5)
        col = col * (1 - slot[..., None]) + np.array([.08, 0, .02], np.float32) * slot[..., None]
    rgb = sp[..., :3] * (1 - cov[..., None]) + col * cov[..., None]
    al = np.maximum(sp[..., 3], cov)
    out = Image.fromarray((np.dstack([np.clip(rgb, 0, 1), al]) * 255).astype(np.uint8), 'RGBA')
    return out, al


def light(h, a):
    """harsh top light on the height field: diffuse multiplier and a vinyl sheen"""
    gy, gx = np.gradient(blur(h, 3))
    n = np.stack([-gx, -gy, np.ones_like(h) * 1.0], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    L = np.array([-.28, -.86, .42], np.float32)
    L /= np.linalg.norm(L)
    dif = np.clip((n * L).sum(-1), 0, 1)
    H = L + np.array([0, 0, 1], np.float32)
    H /= np.linalg.norm(H)
    spec = np.clip((n * H).sum(-1), 0, 1) ** 38
    rim = sstep(.0, .5, a) * (1 - sstep(.0, .35, n[..., 2]))  # edge occlusion
    return dif, spec, rim


def head_frames(d):
    rng = np.random.default_rng(1129)
    ph_open = load(d, F_OPEN)
    base = arr(crop_work(ph_open))
    a, h = silhouette()
    keep = face_keep(base)
    # the rebuilt dome: the forehead's own vinyl, unlit-ish, with slow variation
    fy0, fy1 = w(0, 372)[1], w(0, 420)[1]
    fx0, fx1 = w(240, 0)[0], w(330, 0)[0]
    albedo = np.median(base[int(fy0):int(fy1), int(fx0):int(fx1)].reshape(-1, 3), 0)
    vn = vnoise(70, 3)[..., None]
    dome = albedo * (.93 + .14 * vn)
    face = base * keep[..., None] + dome * (1 - keep[..., None])
    # the stump: the photo's wooden neck, lifted 30 px so it ends at ~+25, under the jowls
    stump_im = arr(crop_work(ph_open.transform(ph_open.size, Image.AFFINE, (1, 0, 0, 0, 1, 60), resample=Image.BICUBIC)))
    st = Image.new('L', (WW, WH), 0)
    ImageDraw.Draw(st).polygon(P([(196, 610), (366, 610), (368, 690), (356, 704), (282, 709), (208, 704), (196, 690)]), fill=255)
    st_a = arr(st.filter(ImageFilter.GaussianBlur(1.2)))
    stump = stump_im * (.55 + .45 * sstep(w(0, 700)[1], w(0, 640)[1], YY))[..., None] * np.array([.92, .86, .74], np.float32)

    eyes = socket_boxes()
    ph_half = load(d, F_HALF, (HALF_ROT, HALF_C))
    ph_shut = load(d, F_SHUT)
    dif, spec, rim = light(h, a)
    # stains: soft blooms plus tidemarks that ran down the curve (vertical streaks), never square patches
    rs = np.random.default_rng(22)
    streak = Image.fromarray((rs.random((4, 26)) * 255).astype(np.uint8)).resize((WW, WH), Image.BICUBIC)
    stains = .6 * blur(vnoise(45, 21), 10 * Q) + .4 * blur(arr(streak), 6 * Q)
    stains = (stains - stains.min()) / (np.ptp(stains) + 1e-6)
    rouge = blur(np.maximum(ell_a(186, 590, 50, 40, 40), ell_a(382, 590, 50, 40, 40)), 14 * Q) * keep * .8
    # grime in the real creases only (nostrils, mouth corners, under the lip and chin), from a band-pass of the
    # photo so its JPEG blocking never gets amplified into a grid
    lum0 = base.mean(-1)
    cz = np.clip(blur(lum0, 9) - blur(lum0, 2.2) - .012, 0, .2)
    where = np.maximum.reduce([ell_a(270, 562, 20, 12, 10), ell_a(305, 564, 20, 12, 10), ell_a(258, 616, 16, 12, 10),
                               ell_a(312, 614, 16, 12, 10), ell_a(285, 635, 40, 12, 12), ell_a(285, 662, 70, 16, 14)])
    crease = blur(cz * (.35 + .65 * where), 1.5)[..., None] * keep[..., None]
    out = []
    for gaping in (False, True):
        under, wet = paint_details(np.random.default_rng(77), gaping)
        wl, wa = wound(gaping, np.random.default_rng(5))
        for fi, (im, boxes) in enumerate(((None, None), (ph_half, EYES_HALF), (ph_shut, EYES_SHUT))):
            if im is None:
                img = transplant(face, ph_open, EYES_OPEN, EYES_OPEN, face)
            else:
                img = transplant(face, im, boxes, EYES_OPEN, face)
            raw = img
            # the glass: inside a socket, whatever is not lid vinyl (blue iris, pupil, the lash line)
            sock = np.zeros((WH, WW), np.float32)
            for cx, cy, rx, ry in eyes:
                sock = np.maximum(sock, ell_a(cx, cy, rx * .93, ry * .93, 3))
            G = sock * sstep(.07, .0, raw[..., 0] - raw[..., 2])
            img = over(img, under)
            # sunken sockets: a bruise-dark crescent under each eye
            for cx, cy, rx, ry in eyes:
                ring = np.clip(ell_a(cx, cy + ry * .55, rx * 1.3, ry * 1.25, 10) - ell_a(cx, cy, rx * 1.04, ry * 1.04, 3), 0, 1)
                ring *= sstep(cy * Q, (cy + ry) * Q, YY + (CY0 - OY * K) * Q)
                img = img * (1 - .4 * ring[..., None]) + np.array([.24, .12, .17], np.float32) * .4 * ring[..., None]
            # grime in the creases
            img = img - crease * np.array([2.2, 2.6, 3.0], np.float32)
            # yellowed, sun-faded vinyl (lids too): desaturate toward old ivory, stain it
            lum = img @ np.array([.3, .59, .11], np.float32)
            ivory = lum[..., None] * np.array([1.06, .95, .66], np.float32)
            mix = (.5 * (1 - rouge) * (1 - G))[..., None]
            img = img * (1 - mix) + ivory * mix
            # the rouge still there under the rot: a sickly flush on the cheeks
            img = img + (rouge * .9)[..., None] * np.array([.075, -.02, -.015], np.float32)
            img = img * (1 - .22 * sstep(.45, .85, stains)[..., None] * np.array([.0, .25, .6], np.float32))
            img = img * (1 + .07 * keep)[..., None]
            # the light: harsh from above, the face falls into shadow below the brow
            img = img * (.6 + .62 * dif)[..., None]
            img = img + spec[..., None] * .32 * np.array([1, .97, .9], np.float32)
            img = img * (1 - .4 * rim)[..., None]
            # sickly shadows: the dark end leans green-grey
            lum = img @ np.array([.3, .59, .11], np.float32)
            sh = (1 - sstep(.1, .45, lum))[..., None]
            img = img * (1 - .35 * sh) + np.array([.13, .15, .11], np.float32) * .35 * sh
            # the glass, last: bright saturated blue, a dark limbal ring, a hard pinprick; the right iris milked over
            rl = raw @ np.array([.3, .59, .11], np.float32)
            E = np.clip((rl[..., None] + (raw - rl[..., None]) * 1.9) * 1.3, 0, 1)
            for i, (cx, cy, rx, ry) in enumerate(eyes):
                ir = ry * .98
                limb = np.clip(ell_a(cx, cy, ir, ir, 3) - ell_a(cx, cy, ir * .8, ir * .8, 4), 0, 1)
                E = E * (1 - .55 * limb[..., None])
                if i == 1 and fi < 2:
                    milk = ell_a(cx + 1, cy, ir * .78, ir * .78, 6) * .5
                    E = E * (1 - milk[..., None]) + np.array([.74, .8, .84], np.float32) * milk[..., None]
                    iring = np.clip(ell_a(cx, cy, ir * .8, ir * .8, 3) - ell_a(cx, cy, ir * .62, ir * .62, 3), 0, 1) * .45
                    E = E * (1 - iring[..., None]) + np.array([.45, .55, .64], np.float32) * iring[..., None]
                    ghost = ell_a(cx + 1, cy + 1, ir * .3, ir * .3, 5) * .5  # the pupil, just visible through the film
                    E = E * (1 - ghost[..., None]) + np.array([.25, .27, .3], np.float32) * ghost[..., None]
            img = img * (1 - G[..., None]) + E * G[..., None]
            if fi == 0:
                for cx, cy, rx, ry in eyes:
                    pin = ell_a(cx - rx * .3, cy - ry * .38, 4.5, 4.5, 1.5)
                    img = img * (1 - pin[..., None]) + pin[..., None]
            img = over(img, wet)
            img = over(img, wl)
            alpha = np.maximum(a, wa)
            col = img * alpha[..., None] + stump * (st_a[..., None] * (1 - alpha[..., None]))
            alpha = np.maximum(alpha, st_a * (1 - alpha) + alpha)
            col = col / np.maximum(alpha[..., None], 1e-4)
            rgba = np.dstack([np.clip(col, 0, 1), alpha])
            out.append(Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA'))
    return out, base, keep


def to_game(im, size=(FW, FH)):
    """premultiplied two-step Lanczos down to game px, a light unsharp, a crisp-ish alpha (soft 1 px edge kept)"""
    p = im.convert('RGBa')
    p = p.resize((size[0] * 2, size[1] * 2), Image.LANCZOS).resize(size, Image.LANCZOS).convert('RGBA')
    r, g, b, al = p.split()
    rgb = Image.merge('RGB', (r, g, b)).filter(ImageFilter.UnsharpMask(radius=1, percent=55, threshold=2))
    rgb.putalpha(al.point(lambda v: 0 if v < 40 else 255 if v > 215 else v))
    return rgb


# ---------------- the fork ----------------
FORK_W, FORK_H = 7, 32  # game px; tines at the bottom. Its entry point into the head: (FORK_W/2, FORK_ENTRY)
FORK_ENTRY = 15


def fork():
    """an ornate silver dinner fork, painted at 8x: fiddle-and-shell handle, engraved scrolls, tarnish, blood on the tines"""
    s = 8
    Wd, Hd = FORK_W * s, FORK_H * s
    m = Image.new('L', (Wd, Hd), 0)
    d = ImageDraw.Draw(m)
    cx = Wd / 2
    # handle: a shell end, a waisted fiddle, the neck
    prof = [(0, 1.6), (6, 2.7), (16, 3.0), (30, 2.6), (44, 2.0), (60, 1.35), (80, .95), (100, .85), (118, .95),
            (128, 1.5), (140, 2.4), (150, 2.6)]
    left = [(cx - r * s * 1.0, y * s / 5) for y, r in prof]
    right = [(cx + r * s * 1.0, y * s / 5) for y, r in reversed(prof)]
    d.polygon(left + right, fill=255)
    d.ellipse((cx - 3.0 * s, 0, cx + 3.0 * s, 4.2 * s), fill=255)
    # tines
    ty0 = 150 * s / 5 - 2
    for i in range(4):
        x = cx - 2.4 * s + i * 1.6 * s
        d.rounded_rectangle((x - .45 * s, ty0, x + .45 * s, Hd - 2), radius=.4 * s, fill=255)
    ma = np.asarray(m).astype(np.float32) / 255
    yy, xx = np.mgrid[0:Hd, 0:Wd].astype(np.float32)
    # silver: a cylindrical sheen across, cooler in the dark
    u = (xx - cx) / (3.0 * s)
    sheen = np.clip(1 - np.abs(u + .25) * 1.6, 0, 1) ** 2
    col = np.zeros((Hd, Wd, 3), np.float32) + np.array([.42, .44, .48], np.float32)
    col += sheen[..., None] * np.array([.55, .55, .52], np.float32)
    col *= (1 - .45 * np.clip(np.abs(u), 0, 1) ** 2)[..., None]
    img = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))
    dd = ImageDraw.Draw(img)
    # engraved scrolls on the shell end and the fiddle
    for k, (y0, r) in enumerate(((5, 1.4), (12, 1.6), (20, 1.2))):
        dd.arc((cx - r * s, y0 * s / 5 * 2, cx + r * s, (y0 * s / 5 * 2) + r * s * 1.4), 200 + 40 * k, 520 + 40 * k,
               fill=(40, 42, 50), width=3)
    dd.line((cx, 2 * s, cx, 11 * s), fill=(60, 62, 70), width=2)
    for y in (6.5 * s, 9 * s):
        dd.line((cx - 1.8 * s, y, cx + 1.8 * s, y + 1.4 * s), fill=(235, 238, 240), width=2)
    # tarnish and blood: the buried half is red to the bridge
    col = np.asarray(img).astype(np.float32) / 255
    tarn = vnoise_small(Wd, Hd, 10, 4)
    tk = .3 * sstep(.55, .9, tarn)[..., None]
    col = col * (1 - tk) + col * np.array([.62, .58, .48], np.float32) * tk
    bl = sstep(FORK_ENTRY * s - 6, FORK_ENTRY * s + 18, yy) * (.7 + .3 * vnoise_small(Wd, Hd, 6, 9))
    col = col * (1 - bl[..., None] * .8) + np.array([.42, .03, .06], np.float32) * bl[..., None] * .8
    # outline: near-black, so it reads on any biome
    ol = np.asarray(Image.fromarray((ma * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))).astype(np.float32) / 255
    rgb = col * ma[..., None] + np.array([.03, .03, .04], np.float32) * (1 - ma[..., None])
    rgba = np.dstack([rgb, np.maximum(ma, ol * .95)])
    big = Image.fromarray((np.clip(rgba, 0, 1) * 255).astype(np.uint8), 'RGBA')
    return to_game(big, (FORK_W, FORK_H)), big


def vnoise_small(Wd, Hd, sc, seed):
    rng = np.random.default_rng(seed)
    g = Image.fromarray((rng.random((Hd // sc + 3, Wd // sc + 3)) * 255).astype(np.uint8))
    g = g.resize(((Wd // sc + 3) * sc, (Hd // sc + 3) * sc), Image.BICUBIC).crop((0, 0, Wd, Hd))
    return np.asarray(g).astype(np.float32) / 255


# ---------------- preview ----------------
def preview(path, frames, fk, base, keep):
    Z = 6
    bg = (14, 10, 12)
    cols = 6
    sheet = Image.new('RGB', (cols * (FW * Z + 8) + 8, FH * Z + 8 + 150 + 260), bg)
    labels = ['open', 'half', 'shut', 'open/gape', 'half/gape', 'shut/gape']
    dr = ImageDraw.Draw(sheet)
    for i, f in enumerate(frames):
        x = 8 + i * (FW * Z + 8)
        big = f.resize((FW * Z, FH * Z), Image.NEAREST)
        sheet.paste(big, (x, 8), big)
        if i < 3:  # the fork in the wound, as the renderer places it (KEEP.wx, wy, the slot)
            fz = fk.resize((FORK_W * Z, FORK_H * Z), Image.NEAREST)
            fx = x + (OX + 2) * Z - FORK_W * Z // 2
            fy = 8 + (OY - 24 + 1) * Z - FORK_ENTRY * Z
            clip = Image.new('L', fz.size, 0)
            ImageDraw.Draw(clip).rectangle((0, 0, fz.width, FORK_ENTRY * Z), fill=255)
            m = Image.fromarray(np.minimum(np.asarray(fz)[..., 3], np.asarray(clip)))
            sheet.paste(fz, (fx, fy), m)
        dr.text((x + 4, 10), labels[i], fill=(220, 220, 220))
        # the hit-zone line (y = -13): full damage at or above
        yl = 8 + (OY - 13) * Z
        dr.line((x, yl, x + FW * Z, yl), fill=(255, 60, 40))
    # 1x, as in game, on two backdrops
    y1 = FH * Z + 20
    for j, b in enumerate(((14, 10, 12), (60, 70, 40))):
        for i, f in enumerate(frames):
            tile = Image.new('RGB', (FW + 4, FH + 4), b)
            tile.paste(f, (2, 2), f)
            sheet.paste(tile.resize(((FW + 4) * 2, (FH + 4) * 2), Image.NEAREST), (8 + i * 110 + j * 0, y1 + j * 0))
        y1 += 0
        break
    # the cut-out at work res: the photo, the face-keep mask, frame 0 at work res
    y2 = FH * Z + 160
    th = 250
    for i, im in enumerate((Image.fromarray((base * 255).astype(np.uint8)),
                            Image.fromarray((keep * 255).astype(np.uint8)).convert('RGB'))):
        t = im.resize((round(im.width * th / im.height), th), Image.LANCZOS)
        sheet.paste(t, (8 + i * 220, y2))
    sheet.save(path)


def main():
    d = find_photos()
    if not d:
        print('prep_keepsake: source photos not found (assets-raw/keepsake is git-ignored and not in the public repo);'
              ' the committed src/sprites/keepsake@6.png and keepsake-fork.png stand. Nothing to do.')
        return 0
    big, base, keep = head_frames(d)
    frames = [to_game(f) for f in big]
    strip = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * FW, 0))
    os.makedirs(DST, exist_ok=True)
    strip.save(os.path.join(DST, f'keepsake@{len(frames)}.png'), optimize=True)
    fk, _ = fork()
    fk.save(os.path.join(DST, 'keepsake-fork.png'), optimize=True)
    print(f'keepsake@{len(frames)}.png: {len(frames)} frames of {FW}x{FH}, origin ({OX}, {OY}); '
          f'keepsake-fork.png {FORK_W}x{FORK_H}, entry y {FORK_ENTRY}')
    if len(sys.argv) > 1:
        preview(sys.argv[1], frames, fk, base, keep)
        big[0].save(sys.argv[1].replace('.png', '-work0.png'))
        print('preview:', sys.argv[1])
    return 0


if __name__ == '__main__':
    sys.exit(main())
