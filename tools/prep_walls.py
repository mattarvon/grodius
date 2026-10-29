"""Wall enemies: eye turret + ceiling womb (Top-Down Tentacle Creature, Sean Noonan, CC0) and the wall crawler
(Earwig top-down, Scarcz, CC-BY 4.0). Run from the repo root: python tools/prep_walls.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite_prep import *
from PIL import Image

TC = 'tentacle/top-down-tentacle-creature/'
EW = 'bug/earwig-top-down/earwig_animation/Earwig animation/'


def purple_to_meat(im, shift=75):
    """rotate only the purple skin (hue ~220-320 deg) toward bruised crimson; the red veins and the cream
    teeth / eye white keep their colour"""
    a = im.getchannel('A')
    h, s, v = im.convert('RGB').convert('HSV').split()
    lo, hi, d = int(220 / 360 * 255), int(320 / 360 * 255), int(shift / 360 * 255)
    hp, sp = h.load(), s.load()
    for y in range(im.height):
        for x in range(im.width):
            if lo <= hp[x, y] <= hi and sp[x, y] > 20:
                hp[x, y] = (hp[x, y] + d) % 256
    out = Image.merge('HSV', (h, s, v)).convert('RGBA')
    out.putalpha(a)
    return out


def outline(frames, rgb=(18, 3, 5)):
    """1 px dark rim so the art holds up on busy walls (snot, acid)"""
    from PIL import ImageFilter
    out = []
    for f in frames:
        f2 = Image.new('RGBA', (f.width + 2, f.height + 2), (0, 0, 0, 0))
        f2.paste(f, (1, 1))
        rim = f2.getchannel('A').filter(ImageFilter.MaxFilter(3))
        o = Image.new('RGBA', f2.size, rgb + (255,))
        o.putalpha(rim)
        o.alpha_composite(f2)
        out.append(o)
    return out


def flesh(f):
    # purple starfish -> bruised, wet meat, then darker with a blood multiply
    return grade(purple_to_meat(f), sat=1.1, contrast=1.2, dark=.85, tint=(240, 150, 140), tint_k=.25)


# eye turret: 8 frames of the eye variant
eye = [flesh(f) for f in grid(TC + 'monster_flesh_eye_sheet.png', 3, 3, take=range(8))]
save('walleye', outline(fit(eye, h=28)))
# ceiling womb: the teeth variant, same grade so they read as one species
teeth = [flesh(f) for f in grid(TC + 'monster_flesh_teeth_sheet.png', 3, 3, take=range(8))]
save('womb', outline(fit(teeth, h=30)))

# crawler: the earwig walk cycle (6x8 sheet, 43 frames), head up -> rotate so the head leads left along the wall
ew = grid(EW + 'Earwig animation.png', 6, 8, take=range(0, 43, 2))
ew = rot90(ew, 1)
ew = [grade(f, hue=-30, sat=1.25, contrast=1.5, bright=1.3, tint=(235, 105, 100), tint_k=.5) for f in ew]
ew = fit(ew, w=36, alpha_cut=70)
ew = [f.crop((8, 0, f.width, f.height)) for f in ew]  # drop the antennae: at this size they read as a black smudge
save('earwig', outline(ew))

for n in ('walleye', 'womb', 'earwig'):
    preview(n)
