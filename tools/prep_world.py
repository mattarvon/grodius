"""World art prep (run from the repo root: python tools/prep_world.py). Three OpenGameArt CC0 picks -> game assets:

  src/img/triton.png          Planet T (krislachowski) cut out of its starfield, graded to Triton's icy pinkish grey
  src/img/tex-derelict.png    sci-fi wall tiles (mieki256, Enemy sprite pack) built into a 128px seamless hull-plate
                              tile and pre-eaten by tex-flesh through a tileable noise mask
  src/sprites/crystal-{l,m,s}@6.png   Magic Fence pillars (qwedeath), hue-shifted to ice, vein turned to frozen blood
"""
import os
import sys
import random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite_prep import *  # noqa
from sprite_prep import SRC, HERE
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter
import math

IMG = os.path.join(HERE, '..', 'src', 'img')
PREP = os.path.join(HERE, '..', 'assets-raw', 'upgrade', 'prep')
os.makedirs(PREP, exist_ok=True)


def big(im, name, k=6):
    bg = Image.new('RGBA', im.size, (12, 8, 9, 255))
    bg.alpha_composite(im.convert('RGBA'))
    bg.resize((im.width * k, im.height * k), Image.NEAREST).save(os.path.join(PREP, name + '.png'))


# ---------------- Triton ----------------
def triton(D=28, PAD=9):
    im = Image.open(os.path.join(SRC, 'alien/planet-t-0/1368635432912_0.jpg')).convert('RGB')
    cx, cy, r = 1547, 1494, 893  # the disc, measured on the source
    S = 8  # supersample, then one LANCZOS step down
    full = D + 2 * PAD
    crop = im.crop((cx - r, cy - r, cx + r, cy + r)).resize((D * S, D * S), Image.LANCZOS)
    # grade: grey it out, lift it, push toward Triton's pale pinkish grey (nitrogen frost, pink-ish south cap)
    g = ImageEnhance.Color(crop).enhance(.2)
    g = g.point(lambda v: int(255 * (v / 255) ** .5))  # lift the eclipsed face so the frost shows
    g = ImageEnhance.Contrast(g).enhance(1.15)
    g = ImageEnhance.Brightness(g).enhance(.92)
    r_, g_, b_ = g.split()
    g = Image.merge('RGB', (r_.point(lambda v: min(255, v * 1.04 + 4)), g_.point(lambda v: min(255, v * .97 + 2)), b_.point(lambda v: min(255, v * 1.02 + 8))))
    disc = Image.new('RGBA', (full * S, full * S), (0, 0, 0, 0))
    mask = Image.new('L', (D * S, D * S), 0)
    ImageDraw.Draw(mask).ellipse((1, 1, D * S - 2, D * S - 2), fill=255)
    disc.paste(g, (PAD * S, PAD * S), mask)
    # the eclipse rim glow: a soft halo, strongest up-left where the sun sits behind it (as in the source)
    halo = Image.new('RGBA', disc.size, (0, 0, 0, 0))
    hp = halo.load()
    c0 = full * S / 2
    R0 = D * S / 2
    for y in range(full * S):
        for x in range(full * S):
            dx, dy = x - c0, y - c0
            d = math.hypot(dx, dy)
            if d < R0 - S:
                continue
            t = max(0., 1 - (d - R0) / (PAD * S * .95))
            side = .35 + .65 * max(0., (-dx - dy * .6) / (d + 1e-6))
            a = (t ** 2.2) * side
            if d < R0:
                a = 1.0 * side
            hp[x, y] = (214, 226, 248, int(255 * min(1, a * .85)))
    out = Image.alpha_composite(halo, disc)
    # a thin bright limb on the lit side over the disc edge
    rim = Image.new('RGBA', disc.size, (0, 0, 0, 0))
    ImageDraw.Draw(rim).arc((PAD * S, PAD * S, (PAD + D) * S - 1, (PAD + D) * S - 1), 150, 285, fill=(244, 238, 250, 230), width=S)
    out = Image.alpha_composite(out, rim.filter(ImageFilter.GaussianBlur(S * .4)))
    out = out.resize((full * 2, full * 2), Image.LANCZOS).resize((full, full), Image.LANCZOS)
    out.save(os.path.join(IMG, 'triton.png'), optimize=True)
    big(out, 'triton', 8)
    print('triton.png', out.size, os.path.getsize(os.path.join(IMG, 'triton.png')), 'B')


# ---------------- derelict hull plate, being eaten ----------------
def tile_noise(n, cells, seed):
    """tileable value noise, n px, `cells` lattice cells, 0..255"""
    rnd = random.Random(seed)
    g = [[rnd.random() for _ in range(cells)] for _ in range(cells)]
    small = Image.new('L', (cells * 3, cells * 3))
    for y in range(cells * 3):
        for x in range(cells * 3):
            small.putpixel((x, y), int(255 * g[y % cells][x % cells]))
    up = small.resize((n * 3, n * 3), Image.BICUBIC)
    return up.crop((n, n, 2 * n, 2 * n))


def derelict():
    sheet = Image.open(os.path.join(SRC, 'shmup/enemy-sprite/scifi_bg_chip2_0.png')).convert('RGBA')
    N = 128
    t = Image.new('RGBA', (N, N), (12, 15, 19, 255))
    blue1 = sheet.crop((192, 192, 320, 320)).resize((64, 64), Image.LANCZOS)
    blue2 = sheet.crop((192, 320, 320, 448)).resize((64, 64), Image.LANCZOS)
    grate = sheet.crop((128, 0, 192, 64)).resize((32, 32), Image.LANCZOS)   # the hatch / vent grate
    goldA = sheet.crop((64, 0, 128, 64)).resize((32, 32), Image.LANCZOS)
    goldB = sheet.crop((192, 0, 256, 64)).resize((32, 32), Image.LANCZOS)
    pipe = sheet.crop((0, 400, 64, 432)).resize((64, 32), Image.LANCZOS)     # horizontal pipe section
    t.alpha_composite(blue1, (0, 0))
    t.alpha_composite(blue2, (64, 64))
    for (im, x, y) in [(goldA, 64, 0), (grate, 96, 0), (goldB, 64, 32), (grate, 0, 64), (goldB, 32, 64), (goldA, 0, 96)]:
        t.alpha_composite(im, (x, y))
    t.alpha_composite(pipe, (64, 32 + 0))  # runs over the gold row
    # a vertical pipe stub (rotate the horizontal one)
    t.alpha_composite(pipe.rotate(90, expand=True).resize((16, 64), Image.LANCZOS), (40, 64))
    # grade: grimy, dark, cold; the gold reads as tarnished brass, the blue as dead console steel
    t = grade(t, sat=.5, contrast=1.2, dark=.95, tint=(150, 160, 175), tint_k=.35)
    rgb = t.convert('RGB')
    # grime: dark noise multiply + rust/blood streaks running down
    grime = tile_noise(N, 8, 3).point(lambda v: 150 + v * 105 // 255)
    rgb = ImageChops.multiply(rgb, Image.merge('RGB', (grime, grime, grime)))
    rnd = random.Random(7)
    d = ImageDraw.Draw(rgb)
    for _ in range(14):
        x, y, l = rnd.randrange(N), rnd.randrange(N), rnd.randrange(6, 30)
        for k in range(l):
            px = rgb.getpixel((x, (y + k) % N))
            d.point((x, (y + k) % N), fill=(min(255, px[0] + 22), px[1] // 2, px[2] // 2))
    # flesh grows over the plate: tex-flesh through a tileable noise mask, a dark wet rim where it meets metal
    flesh = Image.open(os.path.join(IMG, 'tex-flesh.png')).convert('RGB')
    n = ImageChops.add(tile_noise(N, 4, 11), tile_noise(N, 8, 12), scale=2)
    n = ImageChops.add(n, tile_noise(N, 16, 13).point(lambda v: v // 3), scale=1)
    th = 156
    m = n.point(lambda v: 255 if v > th + 8 else (0 if v < th - 8 else (v - th + 8) * 16))
    rim = n.point(lambda v: 255 if th - 22 < v <= th + 2 else 0).filter(ImageFilter.GaussianBlur(1))
    shadow = Image.new('RGB', (N, N), (16, 2, 4))
    rgb = Image.composite(shadow, rgb, rim.point(lambda v: v * 3 // 4))
    rgb = Image.composite(flesh, rgb, m)
    # bulging highlight on the flesh nearest the metal (thickest edge)
    hi = n.point(lambda v: 90 if th + 6 < v < th + 14 else 0).filter(ImageFilter.GaussianBlur(.6))
    rgb = Image.composite(Image.new('RGB', (N, N), (190, 90, 80)), rgb, hi)
    rgb.save(os.path.join(IMG, 'tex-derelict.png'), optimize=True)
    big(rgb.convert('RGBA'), 'tex-derelict', 4)
    tiled = Image.new('RGB', (N * 3, N * 2))
    for i in range(3):
        for j in range(2):
            tiled.paste(rgb, (i * N, j * N))
    tiled.resize((N * 6, N * 4), Image.NEAREST).save(os.path.join(PREP, 'tex-derelict-tiled.png'))
    print('tex-derelict.png', os.path.getsize(os.path.join(IMG, 'tex-derelict.png')), 'B')


# ---------------- ice crystals ----------------
def crystals():
    xs = [(90, 330), (420, 680), (750, 975), (1050, 1310), (1370, 1610), (1670, 1950)]
    fr = [box('tentacle/magic-fence/MagicFence.png', (x0, 60, x1 - x0, 860)) for x0, x1 in xs]
    out = []
    for f in fr:
        px = f.load()
        for y in range(f.height):
            for x in range(f.width):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if g > 120 and b > 120 and r < 160:  # the glowing cyan vein -> frozen blood
                    if a < 70:
                        px[x, y] = (0, 0, 0, 0)  # drop the soft halo
                    else:
                        k = (g + b) / 510
                        px[x, y] = (int(150 + 80 * k), int(8 + 20 * k), int(22 + 30 * k), 255)
                else:  # purple glass -> ice: hue toward cyan-blue, then lift
                    lum = (r + g + b) / 3
                    t = min(1, max(0, (b - 100) / 155))  # how lit this facet is
                    nr = int(70 + lum * .9 + t * 120)
                    ng = int(105 + lum * 1.1 + t * 120)
                    nb = int(135 + lum * 1.1 + t * 100)
                    if r < 30 and b < 60:  # the dark inner seams / outline
                        nr, ng, nb = 8, 22, 46
                    px[x, y] = (min(255, nr), min(255, ng), min(255, nb), a)
        out.append(f)
    for name, h in [('crystal-l', 44), ('crystal-m', 30), ('crystal-s', 18)]:
        save(name, fit([f.copy() for f in out], h=h))
        p = preview(name, 4)
    print('crystals done')


if __name__ == '__main__':
    what = sys.argv[1:] or ['triton', 'derelict', 'crystals']
    for w in what:
        globals()[w]()
