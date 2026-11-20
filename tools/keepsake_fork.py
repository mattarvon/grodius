"""THE KEEPSAKE's forks from a photograph (option C of production/qa/keepsake-forks-art-review-2026-11-20.md).

Source: "Table Fork - Cutlery Set, Walker & Hall, Harry Telford, Birchip Cup, 1926", Museums Victoria, CC BY 4.0
(https://collections.museumsvictoria.com.au/items/2049633; credited in CREDITS.md). It's an antique silver-plate table fork
shot flat on a white sweep. The photo stays in git-ignored assets-raw/openverse/image/fork/; only baked pixels ship.

The photo gives the fork its proportions and its metal: the outline is measured from it column by column (tines 29% of
the length, head 12% wide, a 3% neck, a flared fiddle terminal), and its shading is sampled into each pixel, then
graded from the studio's white sweep into polished steel in a dark, fire-lit room (a dark-mirror curve, a faint warm
cast, the hot speculars kept). Two things are enforced on the game-px grid, because a straight downsample loses them:
  - the tines: four 1 px bars with 1 px gaps (a 7 px head, a little wider than the true 12%, so the four survive);
  - the outline: one dark game px all round, which also fills the gaps.
Angles are baked by rotating at 8x and box-filtering down, never rotated at runtime (the bake's rule: that shimmers).

Used by tools/prep_keepsake_boss.py for every fork 33 px and longer: the fork in the wound (seat / proud, per tilt),
the thrown and boomerang fork (16 spin angles, a glint on the head-up frame), and the hanging mobile fork (dim and its
drop tell, with a lit rim). The 15 px fountain / aimed fork is drawn in code (src/render/fork.ts) in steel stops
sampled here (ramp()).
"""
import math
import os
import subprocess

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTO = os.path.join('assets-raw', 'openverse', 'image', 'fork', 'ov-table-fork-cutlery-set-walker-hall-harry-04b1c7.jpg')
SS = 8                       # work px per game px for the game-res bakes
OUTL = (6, 7, 8)             # the outline: render/fork.ts's near-black


def _main_checkout():
    try:
        common = subprocess.run(['git', 'rev-parse', '--git-common-dir'], cwd=HERE, capture_output=True, text=True).stdout.strip()
        return os.path.dirname(os.path.abspath(os.path.join(HERE, common))) if common else None
    except Exception:
        return None


def find_photo():
    for p in (os.environ.get('KEEPSAKE_FORK_PHOTO', ''), os.path.join(HERE, '..', PHOTO),
              os.path.join(_main_checkout() or HERE, PHOTO)):
        if p and os.path.isfile(p):
            return p
    return None


class Fork:
    """the measured photo: per column, the fork's centre line and width; the photo blurred for sampling"""
    X0, X1 = 230, 2735       # tine tips .. the terminal's end, photo px (the fork lies tines-left)
    ROOT_X = 950             # the slots' roots

    def __init__(self, path):
        ph = Image.open(path).convert('RGB')
        L = np.asarray(ph.convert('L').filter(ImageFilter.MedianFilter(5))).astype(np.float32)
        H, W = L.shape
        bg = np.median(np.concatenate([L[100:160], L[-160:-100]]), 0)   # the sweep, per column, above and below the fork
        d = (bg[None] - L) > 22
        d[:200] = False
        d[720:] = False
        top = np.full(W, np.nan)
        bot = np.full(W, np.nan)
        for x in range(W):
            r = np.nonzero(d[:, x])[0]
            if len(r) > 3:
                top[x], bot[x] = r[0], r[-1]
        w = bot - top
        cen = (top + bot) / 2
        for x in range(self.X0, 1100):          # the shadow under the head inflates its lower edge: cap it at the 12.1% measured
            if w[x] > 303:
                w[x], cen[x] = 303, top[x] + 151
        self.w, self.cen = self._smooth(w), self._smooth(cen)
        self.len = self.X1 - self.X0
        self.vroot = (self.X1 - self.ROOT_X) / self.len
        self.px = np.asarray(ph.filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32) / 255
        self.H = H

    def _smooth(self, a, k=41):
        o = a.copy()
        for x in range(self.X0, self.X1):
            o[x] = np.nanmedian(a[max(self.X0, x - k // 2):min(self.X1, x + k // 2 + 1)])
        return o

    def at(self, v):
        """v 0 (the terminal's end) .. 1 (the tine tips): photo column, width / length, centre row"""
        x = min(max(int(round(self.X1 - v * self.len)), self.X0), self.X1 - 1)
        return x, self.w[x] / self.len, self.cen[x]

    # ---------------- painting ----------------
    def paint(self, L, scale, head=7, tines=4, blood=None, bright=1.0):
        """the fork, vertical, tines down, L game px long, at `scale` px per game px. head: the tine head's width in game
        px (the tines are head / (2 tines - 1) wide, so 7 -> four 1 px tines). Returns RGBA (straight alpha), unoutlined,
        its width (head + 6) game px with the head centred on whole px"""
        Wc = head + 6
        Hh, Wh = int(round(L * scale)), int(round(Wc * scale))
        cx = Wh / 2
        xs = np.arange(Wh) + .5
        m = np.zeros((Hh, Wh), np.float32)
        rgb = np.zeros((Hh, Wh, 3), np.float32)
        cs = np.array([-.75, -.25, .25, .75])           # the photo's four tines, evenly spaced across its head
        for y in range(Hh):
            v = (y + .5) / Hh
            px, wv, pc = self.at(v)
            wp = wv * L
            k = min(1, max(0, (v - .58) / (self.vroot - .58)))
            wp = max(wp, head * k * k * (3 - 2 * k), 1.0)
            if v > self.vroot - .02:
                wp = max(wp, head)
            hw = wp * scale / 2
            u = (xs - cx) / max(hw, 1e-3)
            row = (np.abs(u) <= 1).astype(np.float32)
            uu = u
            if v > self.vroot:                          # the tines: bars and gaps of equal width, pointed over the last 4.5%
                seg = 2 * hw / (2 * tines - 1)
                idx = np.floor((xs - (cx - hw)) / seg).astype(int)
                row *= (idx % 2 == 0)
                tip = (v - .955) / .045
                if tip > 0:
                    tc = cx - hw + (idx // 2 * 2 + .5) * seg
                    row *= (np.abs(xs - tc) <= seg / 2 * (1 - .8 * tip))
                uu = cs[np.argmin(np.abs(u[:, None] * .86 - cs[None]), 1)]
            py = np.clip(pc + uu * self.w[px] / 2 * .9, 0, self.H - 1).astype(int)
            rgb[y] = self.px[py, px]
            if self.vroot - .14 < v < self.vroot + .04:   # the bowl's studio hotspot would bake to a white blob
                rgb[y] *= .86
            m[y] = row
        rgb = self.grade(rgb, m) * bright
        if blood is not None:                           # the tines, wet from the wound: v from `blood` down
            yy = (np.arange(Hh)[:, None] + .5) / Hh
            b = (np.clip((yy - blood) / .06, 0, 1) * .8)[..., None]
            rgb = rgb * (1 - b) + np.array([.42, .03, .06]) * b
        return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), m]) * 255).astype(np.uint8), 'RGBA')

    @staticmethod
    def grade(rgb, m):
        lum = rgb.mean(2)
        sel = lum[m > .5]
        lo, hi = np.percentile(sel, 3), np.percentile(sel, 99.5)
        q = np.clip((lum - lo) / (hi - lo + 1e-6), 0, 1) ** 1.5
        dark, mid, spec = np.array([.17, .14, .13]), np.array([.58, .60, .63]), np.array([.96, .96, .94])
        k = q[..., None]
        lo_ = dark + (mid - dark) * (np.minimum(k, .72) / .72)
        hi_ = mid + (spec - mid) * (np.clip(k - .72, 0, None) / .28) ** 1.4
        c = np.where(k < .72, lo_, hi_) * np.array([1.03, 1.0, .965])   # a faint warm cast: the fire's light on it
        return np.clip(c, 0, 1)


def outline_hero(im, scale):
    """one dark game px round a hero-scale fork (for the wound overlays, which the Baker downsamples)"""
    a = im.getchannel('A')
    k = 2 * int(round(scale)) + 1
    ol = a.filter(ImageFilter.MaxFilter(k))
    base = Image.new('RGBA', im.size, OUTL + (0,))
    base.putalpha(ol.point(lambda v: 245 if v > 0 else 0))
    base.alpha_composite(im)
    return base


def to_game(im, deg=0.0, pad=4):
    """a SS-scale fork -> game px: rotated at SS about its centre (deg, + = clockwise), box-filtered, a hard alpha edge,
    then one dark game px all round. Returns RGBA with the fork's centre at the image centre"""
    side = int(math.ceil(max(im.size) / SS)) + 2 * pad
    S = side * SS
    cv = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ox, oy = (S - im.width) // 2, (S - im.height) // 2
    ox -= ox % SS
    oy -= oy % SS
    cv.paste(im, (ox, oy))
    if deg:
        cv = cv.rotate(-deg, resample=Image.BICUBIC, center=(ox + im.width / 2, oy + im.height / 2))
    a = np.asarray(cv).astype(np.float32) / 255
    al, col = a[..., 3], a[..., :3]
    gh = gw = side

    def box(x):
        return x[:gh * SS, :gw * SS].reshape(gh, SS, gw, SS, *x.shape[2:]).mean((1, 3))
    A = box(al)
    C = box(col * al[..., None]) / np.maximum(A, 1e-4)[..., None]
    Ab = A > .42
    ol = np.asarray(Image.fromarray((Ab * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    out = np.zeros((gh, gw, 4), np.float32)
    out[..., :3] = np.where(Ab[..., None], C, np.array(OUTL) / 255)
    out[..., 3] = (Ab | ol).astype(np.float32)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), 'RGBA').copy(), (ox + im.width / 2) / SS, (oy + im.height / 2) / SS


def rim(img, side=-1, amt=.55):
    """light the steel pixels on one edge (side -1: the left, the top light's side) toward white: the hazard's read"""
    a = np.asarray(img).astype(np.float32)
    st = (a[..., 3] > 0) & (a[..., :3].sum(2) > 3 * 24)
    edge = st & ~np.roll(st, -side, axis=1)
    a[edge, :3] += (255 - a[edge, :3]) * amt
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def glint(img, cx, cy):
    """a star of hot pixels: the head catching the top light"""
    a = img.load()
    for dx, dy, c in ((0, 0, (255, 255, 255)), (-1, 0, (232, 240, 255)), (1, 0, (232, 240, 255)), (0, -1, (232, 240, 255)),
                      (0, 1, (232, 240, 255)), (-2, 0, (190, 205, 230)), (2, 0, (190, 205, 230)), (0, -2, (190, 205, 230)),
                      (0, 2, (190, 205, 230))):
        x, y = int(round(cx + dx)), int(round(cy + dy))
        if 0 <= x < img.width and 0 <= y < img.height:
            a[x, y] = c + (255,)
    return img


def ramp(img):
    """four steel stops (dark / mid / light / specular) from a baked fork's pixels, by luminance quartile: the 15 px
    fork in render/fork.ts uses them so the small forks are the same metal as the big ones"""
    a = np.asarray(img).astype(np.float32)
    px = a[a[..., 3] > 254][:, :3]
    px = px[px.mean(1) > 20]
    lum = px.mean(1)
    out = []
    for lo, hi in ((0, 25), (25, 60), (60, 90), (95, 100)):
        s = px[(lum >= np.percentile(lum, lo)) & (lum <= np.percentile(lum, hi))]
        out.append('#%02x%02x%02x' % tuple(int(round(c)) for c in s.mean(0)))
    return out
