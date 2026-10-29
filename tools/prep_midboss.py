"""Sprite prep for THE SQUIDFUCKED SAUCER, the Open Orbit midboss (src/render/gross/ufo.ts).

Source: The_Scientist___'s CC0 "Alien Bosses" set, Infested UFO Boss: InfUFO_1/_2/_3.png, three damage states of a
saucer smothered in tentacles, each a 2x9 sheet of 160x40 frames (17 used). The source is flat, bright cartoon art
(hot magenta tentacles, lime-green hull, cyan dome), so it is repainted here before the code-drawn grime goes on:

  - per-region hue remap: magenta/pink tentacles -> raw-meat red, lime hull -> pus / bile, cyan dome -> murky
    cataract glass, the pink eye-orb -> a bloodshot, yellowed eyeball
  - desaturate + darken everything, crush the highlights
  - stable mottling (rot, bruising) to break up the flat fills, and an edge occlusion so it reads as a lump, not a sticker
  - then sprite_prep.fit() to in-game size (120 px wide) and a final grade() pass

Run:  python tools/prep_midboss.py      -> src/sprites/ufo1@17.png, ufo2@17.png, ufo3@17.png (+ previews)
"""
import sys, os, colorsys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite_prep import grid, fit, grade, save, preview  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

SRC = 'tentacle/alien-boss-set/Alien Bosses/Infested UFO Boss/InfUFO_{}.png'
W_GAME = 120  # in-game width (px). The playfield is 480 wide.


def _h(x, y, k=0):
    """stable hash noise 0..1 (no RNG, same output every run)"""
    v = math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453
    return v - math.floor(v)


def _vn(x, y, s, k=0):
    """value noise at scale s"""
    gx, gy = x / s, y / s
    x0, y0 = math.floor(gx), math.floor(gy)
    fx, fy = gx - x0, gy - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _h(x0, y0, k), _h(x0 + 1, y0, k)
    c, d = _h(x0, y0 + 1, k), _h(x0 + 1, y0 + 1, k)
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy


def repaint(im, dmg):
    """the darker, wetter repaint of one 160x40 frame; dmg 0..2 (sheet 1..3) rots it further"""
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    alpha = im.getchannel('A')
    # distance-ish to the silhouette edge (a blurred alpha) for occlusion
    occ = alpha.filter(ImageFilter.GaussianBlur(2.2)).load()
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    po = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hd = hh * 360
            n1 = _vn(x, y, 3.5, 1)          # fine mottling
            n2 = _vn(x, y, 9, 2)            # bruise patches
            if v < .2:                       # black outline: keep, warm it a hair
                nr, ng, nb = .07, .03, .03
            elif s > .35 and 260 <= hd <= 340:   # magenta / pink tentacles -> raw meat
                lv = v * (.42 + .22 * n1) * (1 - .25 * n2)
                hue = (352 + 10 * (n2 - .5)) / 360
                sat = .62 + .2 * n1
                if v > .95 and s < .6:       # the pink highlights: fat marbling
                    hue, sat, lv = 8 / 360, .35, .55 + .1 * n1
                nr, ng, nb = colorsys.hsv_to_rgb(hue % 1, sat, lv)
            elif s > .3 and 70 <= hd < 170:  # lime hull -> pus, bile, rot
                lv = v * (.34 + .2 * n1) * (1 - .35 * n2)
                hue = (52 + 18 * n2 - 6 * dmg) / 360  # yellow pus .. olive bile
                sat = .5 + .2 * n1
                nr, ng, nb = colorsys.hsv_to_rgb(hue, sat, lv)
                if n2 > .72:                 # necrotic bruising
                    nr, ng, nb = nr * .55 + .06, ng * .4, nb * .45 + .03
            elif 170 <= hd < 240 and s > .1:  # cyan dome -> cataract glass, piss-yellow and filmy
                lv = .28 + .3 * v * (.6 + .4 * n1)
                nr, ng, nb = colorsys.hsv_to_rgb(68 / 360, .28, lv)
            elif s < .3 and v > .8:          # whites (dome glint, eye) -> yellowed
                nr, ng, nb = colorsys.hsv_to_rgb(48 / 360, .22, .72 + .1 * n1)
            else:                            # pale pinks (the eye-orb) -> bloodshot, sick
                lv = v * (.55 + .15 * n1)
                nr, ng, nb = colorsys.hsv_to_rgb(5 / 360, .42 + .2 * n2, lv)
            # edge occlusion: darker toward the rim of the silhouette, a lump instead of a sticker
            o = occ[x, y] / 255
            k = .45 + .55 * min(1, max(0, (o - .35) / .65))
            # the underside sits in shadow (the light comes from above)
            k *= 1 - .35 * max(0, (y - h * .55) / (h * .45))
            po[x, y] = (int(min(1, nr * k) * 255), int(min(1, ng * k) * 255), int(min(1, nb * k) * 255), a)
    return out


def main():
    for n in (1, 2, 3):
        fr = grid(SRC.format(n), cols=2, rows=9, take=slice(0, 17))
        fr = [repaint(f, n - 1) for f in fr]
        fr = fit(fr, w=W_GAME)
        fr = [grade(f, sat=.9, contrast=1.12, dark=.95) for f in fr]
        save(f'ufo{n}', fr)
        print(preview(f'ufo{n}', scale=5))


if __name__ == '__main__':
    main()
