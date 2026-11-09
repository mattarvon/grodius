#!/usr/bin/env python3
"""THE SQUIDFUCKED SAUCER, Matt's pick c3 Natural-History Plate, baked for the game. Run: python3 -I tools/bossart/ufo/bake.py
Writes src/sprites/boss/ufo.png + .json (read by src/render/gross/mid/ufo.ts). Origin is the boss's (0,0).
Wound stages s = 0..3 follow the six hull cracks' hp thresholds (paint.STAGE_HP): 0 whole, 1 from .85, 2 from .55, 3 from .3.
Lists:
  idle<s>       6 frames: the disc holds rigid, the arms writhe (bend), a ping-pong the runtime paces with holds and hitches
  hurt<s>       the hit flash: every ivory line runs blood
  tum<i>_<s>    patches over tumour i: rest, swell .25 .5 .75 1, burst crater (the volley)
  hatch<s>      patch over the belly hatch: dilation 0 .25 .5 .75 1 (the brood)
  eye<s>        patch over the eye-core: 9 gazes, index (dy+1)*3+(dx+1); eyeT<s> the same, lids wide and pupil slit (the lash
                tell); eyeB<s> the blink
  die           8 frames: the cracks open, the disc splits down the middle and folds, the arms go slack, the gut spills
Patches are crops of full frames painted with only that part changed, so they sit on the body pixel for pixel; the idle
bend is zero over every patch, so a patch never shows a seam."""
import os, sys, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
from paint import *
from bake import Baker, bend, pad, smooth

HS = (1024, 704)            # hero canvas: the painted 1024x512 plus room below for the death's fall
GAME = (128, 88)
O = (512, 192)
TUM_R = [(-33, -16, -15, 1), (-3, -19, 15, -3), (21, -14, 39, 3)]   # patch rects, game px from the origin
HATCH_R = (8, 7, 18, 17)
EYE_R_ = (-10, -3, 8, 13)
LOOKS = [((dx * .28, dy * .26)) for dy in (-1, 0, 1) for dx in (-1, 0, 1)]


def P(im): return pad(im, HS, (0, 0))


def patch(b, name, hero, rect):
    """crop rect (game px from the origin) out of the full game-size frame and append it to list name"""
    sp = b.sprite(hero)
    x0, y0, x1, y1 = rect
    c = sp.crop((x0 + O[0] // 8, y0 + O[1] // 8, x1 + O[0] // 8, y1 + O[1] // 8))
    if name not in b.frames: b.frames[name] = []; b.names.append(name)
    b.frames[name].append((c, x0, y0))


def arm_w(x, y):
    """how free a pixel is to move: the disc, the eye and the hatch hold still, the hanging arms most free"""
    d = math.hypot(x - HATCH_C[0], y - HATCH_C[1])
    return smooth(300, 430, y) * smooth(60, 140, d)


def writhe(im, f, seed):
    """the arms, slow and heavy: a travelling bend, deeper toward the tips"""
    def fn(x, y):
        w = arm_w(x, y)
        if w <= 0: return (0.0, 0.0)
        a = (f - .5) * 2
        return (math.sin(y * .018 + seed + f * 1.7) * 16 * a * w + math.sin(x * .01 + seed) * 6 * w * f,
                math.cos(x * .016 + seed * 1.3 + f * 2.1) * 9 * a * w)
    return bend(im, fn, 32)


def slack(im, p):
    """the dying arms let go: they drop and straighten"""
    def fn(x, y):
        w = smooth(250, 430, y)
        return ((x - 512) * -.06 * p * w, 70 * p * w)
    return bend(im, fn, 32)


def split(im, p, seed=9):
    """the death's break: the disc parts down the seam and each half folds down on its own outer rim"""
    seam = jag(random.Random(seed), [(SPLIT_X + 6, 0), (SPLIT_X + 6, 110), (SPLIT_X - 4, 200), (SPLIT_X + 4, 290), (SPLIT_X, HS[1])], 10, 5)
    lm = Image.new('L', HS, 0); ImageDraw.Draw(lm).polygon([(0, 0)] + seam + [(0, HS[1])], fill=255)
    rm = Image.eval(lm, lambda v: 255 - v)
    out = Image.new('RGBA', HS, (0, 0, 0, 0))
    for m, pv, ang, dx, dy in ((lm, (90, 200), -19 * p, -26 * p, 40 * p * p), (rm, (930, 200), 15 * p, 30 * p, 52 * p * p)):
        h = Image.new('RGBA', HS, (0, 0, 0, 0)); h.paste(im, (0, 0), m)
        h = h.convert('RGBa').rotate(ang, resample=BIC, center=pv, translate=(dx, dy)).convert('RGBA')
        out.alpha_composite(h)
    return out


def main():
    b = Baker('ufo', HS, GAME, O, colors=48)
    eyes = {}
    for i, lk in enumerate(LOOKS):
        eyes[('n', i)] = to_image_straight(eye_layer(lk, 'n')); eyes[('t', i)] = to_image_straight(eye_layer(lk, 't'))
    eyes[('b', 4)] = to_image_straight(eye_layer(LOOKS[4], 'b'))
    def with_eye(im, k):
        o = im.copy(); o.alpha_composite(eyes[k]); return o
    for s in range(4):
        base = paint(dict(w=s))
        idle = with_eye(base, ('n', 3))
        for i in range(6): b.add(f'idle{s}', P(writhe(idle, i / 5, 1.3 + s)))
        b.add(f'hurt{s}', P(bloody(writhe(idle, .5, 1.3 + s))))
        for k in (0, .25, .5, .75, 1.0):
            v = P(paint(dict(w=s, sw=k, br=k))) if k else P(base)
            for i, r in enumerate(TUM_R): patch(b, f'tum{i}_{s}', v, r)
            patch(b, f'hatch{s}', v, HATCH_R)
        v = P(paint(dict(w=s, cr=1)))
        for i, r in enumerate(TUM_R): patch(b, f'tum{i}_{s}', v, r)
        for m in ('n', 't'):
            for i in range(9): patch(b, f'eye{"T" if m == "t" else ""}{s}', P(with_eye(base, (m, i))), EYE_R_)
        patch(b, f'eyeB{s}', P(with_eye(base, ('b', 4))), EYE_R_)
        print('stage', s, flush=True)
    dead = to_image_straight(eye_layer((0, .2), 'd'))
    for k in range(8):
        p = k / 7
        im = paint(dict(w=3, die=.25 + .75 * p, cr=1 if k > 1 else 0)); im.alpha_composite(dead)
        im = split(P(slack(im, p)), smooth(.1, 1, p))
        g = new_canvas(); guts(g, random.Random(5), .15 + .85 * p, SPLIT_X)
        gi = P(to_image_straight(g))
        gi = gi.transform(HS, Image.Transform.AFFINE, (1, 0, 0, 0, 1, -30 * p * p), BIC)
        im.alpha_composite(gi)
        b.add('die', im)
    b.save(1024)


if __name__ == '__main__':
    main()
