#!/usr/bin/env python3
"""THE BURNING BUTCHER, Matt's pick c1 The Split Side, baked for the game. Run: python3 -I tools/bossart/butcher/bake.py
Writes src/sprites/boss/butcher.png + .json, read by src/render/gross/butcher.ts. Origin is the boss's (0,0).
Body lists per stage w (0 whole, 1 torn, 2 chain snapped + bowel out, 3 ruined): idle<w> (5 frames, bowel/hem sway from
-1 to +1 with the cavity heaving), spasm<w>, spit<w> (2: bore opening), htel<w> (hook cocked), hook<w> (chain out of the
spine), hurt<w>. Cleaver arm: arm and armh (edge red hot), 24 angles each from A0 by ASTEP, painted per angle about the
pivot (-10,-10). die: 7 frames, the left hook tearing out of the shoulder, the bowel letting go, the carcass tipping."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from paint import *
from bake import Baker, bend, smooth
A0, ASTEP, AN = -4.05, .08, 24          # covers the sim's e.ba: idle -2.3, tell -2.4, the cut down to -3.98
HY = OY - 30 * K                        # hook line in hero px: nothing above it swings


def hang(y): return max(0.0, (y - HY) / (90 * K))


def sway(im, s, heave=0.0, neck=0.0):
    """the carcass on its hooks: the hem and the bowel trail the swing (more the lower they hang), the cavity heaves"""
    cx, cy = P(-8, -6); nx, ny = P(-3, -30)
    def fn(x, y):
        h = hang(y); dx = s * 3.2 * K * h ** 1.7; dy = -abs(s) * .7 * K * h * h
        r = math.hypot(x - cx, y - cy) / (17 * K); g = heave * smooth(1, 0, r) * .05
        dx += (x - cx) * g; dy += (y - cy) * g
        if neck:
            rn = math.hypot(x - nx, (y - ny) * .7) / (10 * K); k = smooth(1, 0, rn); dx += neck * -1.6 * K * k; dy += neck * .8 * K * k
        return (dx, dy)
    return bend(im, fn)


def tilt(im, deg):
    if not deg: return im
    return im.convert('RGBa').rotate(deg, BIC, center=P(*HA)).convert('RGBA')


def main():
    b = Baker('butcher', S, GS, (OX, OY), colors=200)
    for w in range(4):
        q = dict(stage=w); tl = SNAP_TILT if w >= 2 else 0
        idle = paint_body(q)
        for i in range(5):
            s = -1 + i / 2; b.add(f'idle{w}', tilt(sway(idle, s * (1 + .3 * w), heave=(.6, -.3, .9, -.5, .4)[i]), tl))
        b.add(f'spasm{w}', tilt(sway(idle, .2, heave=-1.8, neck=1), tl))
        for m in (.5, 1.0): b.add(f'spit{w}', tilt(sway(paint_body(dict(q, mouth=m)), 0, heave=.8 * m, neck=-.6 * m), tl))
        b.add(f'htel{w}', tilt(paint_body(dict(q, hook='tel')), tl))
        b.add(f'hook{w}', tilt(sway(paint_body(dict(q, hook='out')), .3, heave=-.6), tl))
        b.add(f'hurt{w}', tilt(sway(paint_body(dict(q, hurt=1)), -.4, heave=-1.2, neck=.8), tl))
        print('stage', w, flush=True)
    for i in range(AN):
        a = A0 + i * ASTEP
        b.add('arm', paint_arm(a, 0)); b.add('armh', paint_arm(a, 1.0))
    print('arm', flush=True)
    for i in range(7):
        k = i / 6; v = paint_body(dict(stage=3, die=.1 + .9 * k, hurt=1 if i < 3 else 0, arm=-3.7 - .7 * k))
        v = sway(v, -.6 * k, heave=-1.5 * (1 - k))
        b.add('die', tilt(v, SNAP_TILT - 18 * k ** 1.4))
    b.save(1024)


if __name__ == '__main__':
    main()
