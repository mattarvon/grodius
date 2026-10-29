"""FX sprite prep: hit sparks, death explosions and real irises (see tools/sprite_prep.py).

    python tools/prep_fx.py            -> src/sprites/{hit_blood,hit_fire,hit_ice,hit_acid,hit_snot}@8.png
                                          src/sprites/{boom_s@30,boom_m@10,boom_ring@7}.png
                                          src/sprites/{iris_grey.png,pupil@4.png}

Sources (assets-raw/sprites, credited in CREDITS.md):
  zombie/sparks-fire-ice-blood/sparks.png  Sparks (Fire, Ice, Blood), Clint Bellanger, CC-BY 3.0
      256x384 = 4 cols x 6 rows of 64x64 frames: rows 0-1 blood, 2-3 fire, 4-5 ice; each row is a 4-frame burst.
  alien/space-sprites-0/Sprites_0.png       Space Sprites (Daniel Cook's Tyrian / Hard Vacuum art), CC-BY 3.0
      y=160 / 272 / 288: 16x16 x10 small explosions; y=176: 32x32 x10 fireball; y=320: 32x32 x7 fire ring.
  eye/eyeballs/eyeball_parts/eyeball_Parts  Eyeballs, sunburn, CC-BY 3.0
      iris_desaturated.png (grey iris, no pupil, centred on 255.5) + pupil_{round,beast,amphibian,fish}.png.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite_prep import *  # noqa: E402,F401
from sprite_prep import _open  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

SPARKS = 'zombie/sparks-fire-ice-blood/sparks.png'
TYR = 'alien/space-sprites-0/Sprites_0.png'
EYE = 'eye/eyeballs/eyeball_parts/eyeball_Parts/'


def ramp(im, stops, keep=0.0, gain=1.0):
    """gradient map: luminance -> colour along stops [(t, (r,g,b)), ...]; keep = how much of the original colour stays"""
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            t = min(1.0, (0.3 * r + 0.55 * g + 0.15 * b) / 255 * gain)
            k = 0
            while k < len(stops) - 2 and stops[k + 1][0] < t:
                k += 1
            (t0, c0), (t1, c1) = stops[k], stops[k + 1]
            f = max(0.0, min(1.0, (t - t0) / (t1 - t0)))
            c = [c0[i] + (c1[i] - c0[i]) * f for i in range(3)]
            o = (r, g, b)
            px[x, y] = tuple(int(c[i] * (1 - keep) + o[i] * keep) for i in range(3)) + (a,)
    return im


def maxdown(f, k=2):
    """downscale by k keeping each particle (max-pool): a LANCZOS shrink turns 2 px sparks into grey mush"""
    blank = Image.new('RGBA', f.size, (0, 0, 0, 0))
    f = Image.composite(f, blank, f.getchannel('A').point(lambda v: 255 if v else 0))  # clear RGB under alpha 0 (it's white)
    f = f.filter(ImageFilter.MaxFilter(k + 1))
    return f.resize((f.width // k, f.height // k), Image.NEAREST)


# ---------------- hit sparks: 2 bursts x 4 frames per set, 32x32 frames, centre = burst origin ----------------
def sparks():
    rows = grid(SPARKS, cols=4, rows=6)  # 24 frames, row-major
    sets = {'blood': rows[0:8], 'fire': rows[8:16], 'ice': rows[16:24]}
    BLOOD = [(0, (40, 0, 6)), (.3, (120, 4, 14)), (.55, (200, 18, 24)), (.8, (255, 90, 70)), (1, (255, 210, 190))]
    ACID = [(0, (4, 30, 24)), (.3, (14, 110, 90)), (.55, (40, 200, 160)), (.8, (120, 245, 210)), (1, (230, 255, 240))]
    SNOT = [(0, (40, 26, 4)), (.3, (120, 90, 20)), (.55, (200, 172, 58)), (.8, (242, 224, 138)), (1, (255, 250, 220))]
    out = {
        'blood': [ramp(f, BLOOD, gain=1.9) for f in sets['blood']],
        'fire': [grade(f, sat=1.1, contrast=1.1) for f in sets['fire']],
        'ice': [grade(f, sat=.9, bright=1.1) for f in sets['ice']],
        'acid': [ramp(f, ACID, gain=1.9) for f in sets['blood']],
        'snot': [ramp(f, SNOT, gain=1.9) for f in sets['blood']],
    }
    for k, fr in out.items():
        save('hit_' + k, [maxdown(f) for f in fr])
        preview('hit_' + k)


# ---------------- explosions: sick, bloody fire ----------------
SICK = [(0, (14, 0, 3)), (.18, (60, 2, 8)), (.38, (130, 10, 14)), (.58, (200, 40, 18)), (.76, (240, 120, 40)),
        (.9, (236, 214, 110)), (1, (226, 240, 170))]


def sick(fr, keep=.25):
    return [ramp(f, SICK, keep=keep) for f in fr]


def booms():
    sm = []
    for y in (160, 272, 288):  # three 10-frame small pops (16x16)
        sm += [box(TYR, (x * 16, y, 16, 16)) for x in range(10)]
    save('boom_s', sick(sm))
    preview('boom_s')
    md = [box(TYR, (x * 32, 176, 32, 32)) for x in range(10)]
    save('boom_m', sick(md))
    preview('boom_m')
    rg = [box(TYR, (x * 32, 320, 32, 32)) for x in range(7)]
    save('boom_ring', sick(rg, keep=.15))
    preview('boom_ring')


# ---------------- irises: one grey iris (tinted per colour at runtime) + 4 pupil shapes, same 272 px frame ----------------
def irises():
    c, h = 255.5, 136
    bx = (int(c - h + .5), int(c - h + .5), int(c + h + .5), int(c + h + .5))
    iris = _open(EYE + 'iris_desaturated.png').convert('RGBA').crop(bx)
    save('iris_grey', [iris])
    pupils = [_open(EYE + f'pupil_{n}.png').convert('RGBA').crop(bx) for n in ('round', 'beast', 'amphibian', 'fish')]
    save('pupil', pupils)


if __name__ == '__main__':
    sparks()
    booms()
    irises()
