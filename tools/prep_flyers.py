"""Flyer sprites: swarm drone -> wasp, hatchling -> floating eyeball, drifting corpse -> frozen zombie crew.
Run from the repo root:  python tools/prep_flyers.py
Writes src/sprites/wasp@25.png, eyeball@4.png, corpse@8.png and previews in assets-raw/upgrade/prep/.
Credits: wasp = Tiamalt (CC-BY 3.0), Floating Eyeball = OwlishMedia (CC0), Zombie Character Pack = Soluna Software (CC0).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite_prep import *  # noqa
from PIL import Image, ImageFilter


def px_map(im, fn):
    """per-pixel recolour: fn(r, g, b, a) -> (r, g, b, a)"""
    im = im.copy()
    p = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p[x, y] = fn(*p[x, y])
    return im


def cl(v):
    return max(0, min(255, int(v)))


# ---------------- wasp (drone) ----------------
# The source wasp hangs diagonally (head up-left, abdomen down-right) under a huge translucent wing. Rotate it so the
# abdomen trails out behind (right), then split body from wing after scaling: the body is hardened opaque, the wing is
# kept as a faint 1-px membrane so it buzzes without dwarfing the body.
ROT, BODY = float(os.environ.get("WROT", 0)), float(os.environ.get("WBODY", 19))


def wasp():
    fr = files('bug/wasp/WASP_FRAMES/wasp1_*.png')
    fr = [f.rotate(ROT, resample=Image.BICUBIC, expand=True) for f in fr]

    def isbody(r, g, b, a):  # opaque and not the reddish wing membrane / veins
        return a > 200 and not (r > g + 25 and r > b)
    # union box of the body only (wing ignored) so the scale is set by the body
    bbs = []
    for f in fr:
        m = Image.new('L', f.size, 0)
        mp, fp = m.load(), f.load()
        for y in range(f.height):
            for x in range(f.width):
                if isbody(*fp[x, y]):
                    mp[x, y] = 255
        bbs.append(m.getbbox())
    x0, y0 = min(b[0] for b in bbs), min(b[1] for b in bbs)
    x1, y1 = max(b[2] for b in bbs), max(b[3] for b in bbs)
    WING = 34  # source px of wing kept above the body; the rest of the big membrane is cut
    fr = [f.crop((x0 - 4, y0 - WING, x1 + 4, y1 + 2)) for f in fr]
    k = BODY / max(x1 - x0, y1 - y0)  # body size in game px, longest side
    tw, th = round(fr[0].width * k), round(fr[0].height * k)
    out = []
    for f in fr:
        # body and wing scaled separately: the body hard and posterised, the wing a faint membrane over it
        body = px_map(f, lambda r, g, b, a: (r, g, b, a) if isbody(r, g, b, a) or (a > 120 and r + g + b < 150) else (0, 0, 0, 0))
        wing = px_map(f, lambda r, g, b, a: (0, 0, 0, 0) if isbody(r, g, b, a) else (r, g, b, a))
        body = body.resize((tw * 3, th * 3), Image.LANCZOS).resize((tw, th), Image.LANCZOS)
        wing = wing.resize((tw * 3, th * 3), Image.LANCZOS).resize((tw, th), Image.LANCZOS)

        def bod(r, g, b, a):
            if a < 110:
                return (0, 0, 0, 0)
            r, g, b = r * 255 / a, g * 255 / a, b * 255 / a  # un-premultiply-ish
            lum = (r + g + b) / 3
            if lum < 60:
                return (30, 34, 14, 255)      # wet black band
            if lum < 110:
                return (96, 112, 26, 255)     # shadowed chitin
            if lum < 165:
                return (150, 170, 40, 255)    # sick yellow-green
            return (198, 212, 92, 255)        # highlight
        body = px_map(body, bod)

        def wng(r, g, b, a):
            if a < 22:
                return (0, 0, 0, 0)
            if a > 60 and (r + g + b) * 255 / a < 200:  # legs and feelers: dark, not membrane
                return (34, 22, 14, 210)
            return (168, 176, 132, 64)
        wing = px_map(wing, wng)
        # fade the membrane out toward its cut tip so it reads as a blur of wingbeat, not a slab
        wa = wing.getchannel('A').load()
        for y in range(th):
            f_ = min(1, (y + 1) / (th * .55))
            for x in range(tw):
                wa_ = wa[x, y]
                if wa_:
                    wa[x, y] = int(wa_ * f_)
        wing.putalpha(Image.frombytes('L', (tw, th), bytes(wa[x, y] for y in range(th) for x in range(tw))))
        # 1-px wet-black outline round the body so it holds against the dark playfield
        ol = Image.new('RGBA', body.size, (0, 0, 0, 0))
        bp, op = body.load(), ol.load()
        for y in range(th):
            for x in range(tw):
                if bp[x, y][3]:
                    continue
                if any(0 <= x + dx < tw and 0 <= y + dy < th and bp[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    op[x, y] = (20, 12, 8, 255)
        wing.alpha_composite(ol)
        wing.alpha_composite(body)
        out.append(wing)
    return out


# ---------------- eyeball (hatchling) ----------------
# Faces right with the optic nerve trailing left. Hatchlings mostly fly left, so the saved strip is mirrored (iris left,
# nerve trailing right); fromLeft hatchlings mirror it back in render. The drop shadow under each frame is cut off.
def eyeball():
    fr = grid('eye/floating-eyeball-0/eyeball.png', cols=4)
    fr = [f.crop((0, 0, 64, 46)) for f in fr]

    def rec(r, g, b, a):
        if a < 60:
            return (0, 0, 0, 0)
        if b > r + 30 and b > g:  # blue iris -> jaundiced yellow-amber, a sick dead look
            v = b / 255
            return (cl(200 * v + 20), cl(150 * v + 10), cl(30 * v), a)
        if r > 150 and g > 150 and b > 140:  # sclera: yellowed, dimmed
            return (cl(r * .86), cl(g * .78), cl(b * .62), a)
        if r > g + 50:  # veins / nerve: darker arterial red
            return (cl(r * .78), cl(g * .35), cl(b * .35), a)
        return (cl(r * .8), cl(g * .7), cl(b * .65), a)
    fr = [px_map(f, rec) for f in fr]
    fr = fit(fr, h=11)
    return flip(fr)


# ---------------- corpse ----------------
# Four crew variants x 2 frames (idle, twitch): civilian woman (floating dress pose), civilian man (arms flung up),
# zombie cop, zombie male. Graded to the frozen blue-grey of the old corpse, wounds kept as dark red.
ZP = 'zombie/zombie-character-pack/Zombie4CharPack/'


def corpse():
    civ = grid(ZP + 'CivilianSheet.png', cols=8, rows=2)
    cop = grid(ZP + 'ZombieCopSheet.png', cols=8, rows=2)
    hz = grid(ZP + 'HeroFemaleZombMaleSheet.png', cols=8, rows=3)
    picks = [civ[0], civ[3], civ[6], civ[9], cop[0], cop[4], hz[0], hz[3]]

    def ice(r, g, b, a):
        if a < 60:
            return (0, 0, 0, 0)
        if r > g + 45 and r > b + 35:  # wounds / blood: frozen dark red
            return (cl(r * .5 + 12), cl(g * .2 + 2), cl(b * .25 + 6), 255)
        lum = .3 * r + .55 * g + .15 * b
        # icy blue-grey: luminance mapped onto a cold ramp, a little of the original hue kept
        t = lum / 255
        ir, ig, ib = 34 + 150 * t, 44 + 165 * t, 58 + 175 * t
        return (cl(ir * .82 + r * .12), cl(ig * .82 + g * .12), cl(ib * .85 + b * .1), 255)
    picks = [px_map(f, ice) for f in picks]
    return fit(picks, h=25)


if __name__ == '__main__':
    save('wasp', wasp())
    print(preview('wasp'))
    save('eyeball', eyeball())
    print(preview('eyeball'))
    save('corpse', corpse())
    print(preview('corpse'))
