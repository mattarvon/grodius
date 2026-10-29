"""Sprite prep for the three new enemies (run from the repo root: python tools/prep_newenemies.py).

  slime-idle / slime-move / slime-spit  the Sinus snot slime      Blob Sprite, Woostar (CC0)
  mutant-walk / mutant-hurl / mutant-die the hulking mutant        Zombie - Fully Animated, Cethiel (CC0)
  sentry                                 MERIDIAN security drone  Enemy sprite (type D), mieki256 (CC0)

Every animation of one enemy is cropped to one shared box and scaled by one factor, so the strips stay registered
(drawn with ax .5 / ay 1: feet on the surface). The zombie sheets are 384x288 cells (not 341: the 8192-wide sheets
hold 21 columns and ~14 rows), row-major, the last row partly empty; only non-empty cells are used.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageFilter
from sprite_prep import _open, keyout, save, preview

# ---------------- helpers ----------------
def cells(path, cw, ch):
    im = _open(path).convert('RGBA')
    out = []
    for r in range(im.height // ch):
        for c in range(im.width // cw):
            f = im.crop((c * cw, r * ch, c * cw + cw, r * ch + ch))
            if f.getchannel('A').getbbox():
                out.append(f)
    return out


def union_box(groups, pad=1):
    bbs = [f.getbbox() for g in groups for f in g if f.getbbox()]
    x0, y0 = min(b[0] for b in bbs), min(b[1] for b in bbs)
    x1, y1 = max(b[2] for b in bbs), max(b[3] for b in bbs)
    return (x0 - pad, y0 - pad, x1 + pad, y1 + pad)


def scale(frames, box, k, alpha_cut=110, sharpen=60):
    """crop to the shared box, scale by k (two-step LANCZOS + light unsharp for big downscales), harden alpha"""
    out = []
    for f in frames:
        f = f.crop(box)
        tw, th = max(1, round(f.width * k)), max(1, round(f.height * k))
        if k < .5:
            f = f.resize((tw * 2, th * 2), Image.LANCZOS)
        f = f.resize((tw, th), Image.LANCZOS)
        if sharpen:
            f = f.filter(ImageFilter.UnsharpMask(radius=1, percent=sharpen, threshold=2))
        f.putalpha(f.getchannel('A').point(lambda v: 255 if v >= alpha_cut else 0))
        out.append(f)
    return out


def remap(im, fn):
    """per-pixel recolour in numpy: fn(rgb float array 0..1, hsv-ish helpers) -> rgb"""
    a = np.asarray(im).astype(np.float32) / 255
    rgb = fn(a[..., :3])
    a[..., :3] = np.clip(rgb, 0, 1)
    return Image.fromarray((a * 255 + .5).astype(np.uint8), 'RGBA')


def lum(rgb):
    return (rgb[..., 0] * .3 + rgb[..., 1] * .59 + rgb[..., 2] * .11)[..., None]


# ---------------- 1. snot slime ----------------
# Flat 5-colour pixel art on a grey card with a dark ground line. Palette-swap to mucus before scaling:
# body = sick yellow-green snot, light rim = wet pale slime, mid = deeper green, eyes = dark clot.
B = 'blob/blob-sprite/'
# The Sinus itself is ochre and yellow, so the slime goes a hard, wet snot-green to stand off it, with a clot-dark rim.
SLIME = {(35, 240, 35): (128, 190, 30), (128, 255, 128): (214, 250, 120), (64, 212, 64): (78, 132, 18),
         (0, 73, 26): (34, 10, 6), (253, 253, 253): (250, 246, 210)}


def outline(frames, col=(22, 34, 6)):
    """a 1 px dark rim around the art (after scaling), so it reads against busy terrain"""
    out = []
    for f in frames:
        a = f.getchannel('A')
        grown = a.filter(ImageFilter.MaxFilter(3))
        rim = Image.new('RGBA', f.size, col + (255,))
        rim.putalpha(grown)
        rim.alpha_composite(f)
        out.append(rim)
    return out


def slime_pal(f):
    f = keyout(keyout(f, (154, 138, 150), 6), (77, 69, 75), 6)  # grey card + the drawn ground line/shadow
    px = f.load()
    for y in range(f.height):
        for x in range(f.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in SLIME:
                px[x, y] = SLIME[(r, g, b)] + (a,)
    return f


def despeck(f, min_px=12):
    """drop small detached bits (the sheet's own spit pellets: the game fires real ones)"""
    a = np.asarray(f.getchannel('A')) > 0
    seen = np.zeros_like(a)
    px = f.load()
    for y0 in range(f.height):
        for x0 in range(f.width):
            if not a[y0, x0] or seen[y0, x0]:
                continue
            comp, st = [], [(x0, y0)]
            seen[y0, x0] = True
            while st:
                x, y = st.pop()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < f.width and 0 <= ny < f.height and a[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        st.append((nx, ny))
            if len(comp) < min_px:
                for x, y in comp:
                    px[x, y] = (0, 0, 0, 0)
    return f


def blob(name, n):
    im = _open(B + name).convert('RGBA')
    return [despeck(slime_pal(im.crop((i * 80, 0, i * 80 + 80, 80)))) for i in range(n)]


idle, move, spit = blob('blob idle.png', 8), blob('blob move.png', 8), blob('blob attack.png', 10)
box = union_box([idle, spit], pad=2)  # the hop (move) is re-registered on its own box below
k = .58  # the blob is ~52 px wide at 1x: ~30 px in game, a fat floor enemy
save('slime-idle', outline(scale(idle, box, k, sharpen=0)))
save('slime-spit', outline(scale(spit, box, k, sharpen=0)))
mb = union_box([move], pad=2)
save('slime-move', outline(scale(move, mb, k, sharpen=0)))

# ---------------- 2. hulking mutant ----------------
Z = 'zombie/zombie-fully-animated/zombie_-_fully_animated/Zombie - Fully Animated/Zombie - '


def mutant_grade(rgb):
    """green-skinned zombie -> bruised, blood-slicked meat: hue the greens toward raw flesh, stain the shirt"""
    L = lum(rgb)
    r, g, b = rgb[..., 0:1], rgb[..., 1:2], rgb[..., 2:3]
    green = np.clip((g - np.maximum(r, b)) * 6, 0, 1)  # how green this pixel is
    L = L ** .8  # lift the 3D render's deep shadows: it has to read on a near-black playfield
    flesh = np.concatenate([L * 1.75 + .08, L * .92 + .02, L * .82], -1)  # raw, bruised flesh
    grey = np.concatenate([L * 1.15 + .03, L * .86, L * .8], -1)  # shirt and trousers: dirty, blood-browned
    return flesh * green + grey * (1 - green)


walk = cells(Z + 'Walk - Small.png', 384, 288)
hurl = cells(Z + 'Attack 1 - Small.png', 384, 288)
die = cells(Z + 'Death - Small.png', 384, 288)
walk = [walk[round(i * 97 / 10)] for i in range(10)]  # one full stride is 97 frames
hurl = [hurl[i] for i in (0, 8, 16, 22, 28, 34, 40, 46, 54, 66)]  # rear up 0-4, swing 5-7, recover 8-9
die = [die[i] for i in (0, 16, 32, 48, 64, 80, 96, 104)]  # the stagger (the halves fly while it plays)
groups = [walk, hurl, die]
box = union_box(groups)
k = 40 / 150  # the walking body is ~150 px tall: ~40 px in game, the biggest regular enemy
for name, g in zip(('mutant-walk', 'mutant-hurl', 'mutant-die'), groups):
    g = [remap(f, mutant_grade) for f in g]
    save(name, [f.transpose(Image.FLIP_LEFT_RIGHT) for f in scale(g, box, k)])  # walks left, at the ship

# ---------------- 3. MERIDIAN security drone ----------------
def sentry_grade(rgb):
    """chrome pod -> grimy gunmetal with an oily-rust cast; the red eye stays hot"""
    L = lum(rgb)
    r, g, b = rgb[..., 0:1], rgb[..., 1:2], rgb[..., 2:3]
    red = np.clip((r - np.maximum(g, b)) * 3, 0, 1)
    metal = np.concatenate([L * .78 + .02, L * .74, L * .76], -1) ** 1.15
    eye = np.concatenate([np.minimum(1, r * 1.1), g * .5, b * .45], -1)
    return metal * (1 - red) + eye * red


im = _open('shmup/enemy-sprite/enemy_type_d_spritesheet_64x64x8.png').convert('RGBA')
pod = [remap(im.crop((i * 64, 0, i * 64 + 64, 64)), sentry_grade) for i in range(8)]
save('sentry', scale(pod, union_box([pod]), 20 / 58))  # ~20 px across

for n in ('slime-idle', 'slime-move', 'slime-spit', 'mutant-walk', 'mutant-hurl', 'mutant-die', 'sentry'):
    preview(n)
