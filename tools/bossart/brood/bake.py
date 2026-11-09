#!/usr/bin/env python3
"""THE BROOD MOTHER, Matt's pick c3 Tapeworm Knot, baked for the game. Run: python3 -I tools/bossart/brood/bake.py
Writes src/sprites/boss/brood.png + .json. Origin is the boss's (0,0). Lists, for w = wound stage 0, 1, 2:
  idle<w>  6  peristalsis loop: contraction rings roll along every ribbon, the crown opens and closes a little
  heave<w> 4  the 44f birth heave: gut swells to 1.1x, the vent dilates, larval heads crowd it, a ribbon end starts out
  gush<w>  3  the birth: ribbon end and larvae pour from the vent, the swell lets go
  snz<w>   4  the 26f sneeze tell: the crown rears back and its hooks flare open, the pit gapes
  spit<w>  2  the release: crown thrust at the player, mucus thrown
  hurt<w>  1  flinch: crown clenched, rings squeezed, fresh blood
  die      8  the knot tears open and unravels, the gut empties, everything sags (the split halves play it as they tumble)"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from paint import paint, S, OX, OY, SNZ
from bake import Baker, bend, pad, smooth
# the hero is 52x62 game px; padded to 60x70 so the heave's 1.1x and the death's sag have room. Origin at boss (0,0)
E = (600, 700); AT_ = (40, 40); O = (OX + AT_[0], OY + AT_[1]); CX, CY = SNZ[0] + 26 + AT_[0], SNZ[1] - 2 + AT_[1]
def P(q): return pad(paint(q), E, AT_)
def scale(im, k):
    """the heave: everything swells about the gut, as the old art's 1 + .1 * bul scale did"""
    return bend(im, lambda x, y: ((x - O[0]) * k, (y - O[1]) * k)) if k else im
def rear(im, dx, dy=0.0):
    """move the crown and the front of its neck alone: rear back (dx > 0) on the tell, thrust at the player on the spit"""
    def fn(x, y):
        r = math.hypot(x - CX, y - CY) / 130; f = smooth(1, .25, r); return (dx * f, dy * f)
    return bend(im, fn)
def main():
    b = Baker('brood', E, (60, 70), O, colors=200)
    for w in (0, 1, 2):
        q = dict(wound=w)
        for i in range(6):
            ph = i / 6; b.add(f'idle{w}', P(dict(q, ph=ph, fl=.25 * math.sin(ph * 6.283) - .1)))
        for i in range(4):
            k = (i + 1) / 4; b.add(f'heave{w}', scale(P(dict(q, ph=i * .17, vent=.2 + .8 * k, swell=k)), .1 * k))
        for i in range(3):
            k = 1 - i * .35; b.add(f'gush{w}', scale(P(dict(q, ph=.5 + i * .17, vent=1, swell=k, gush=1 - i * .2)), .1 * k))
        for i in range(4):
            k = (i + 1) / 4; b.add(f'snz{w}', rear(P(dict(q, ph=i * .25, fl=-.2 + 1.2 * k)), 10 * k, -4 * k))
        for i in range(2):
            b.add(f'spit{w}', rear(P(dict(q, ph=.3 + i * .3, fl=1, spit=1)), -12 + 5 * i, 2))
        b.add(f'hurt{w}', P(dict(q, ph=.2, fl=-1, hurt=1)))
    for i in range(8):
        k = i / 7; v = P(dict(wound=2, die=.15 + .85 * k, hurt=1, fl=-1 + .4 * k, vent=1, ph=i * .1))
        def slump(x, y, k=k):
            d = max(0.0, (y - 80) / 620)
            return ((x - O[0]) * .08 * k * d, k * k * 70 * (.3 + d))
        b.add('die', bend(v, slump))
    b.save(1024)
if __name__ == '__main__':
    main()
