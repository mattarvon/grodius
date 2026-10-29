"""Screen art for the hype-voice comms portraits, the game-over demon and the Infirmary poster.
Run from the repo root: python tools/prep_screens.py  ->  src/sprites/hface@18.png, creep@16.png, poster@6.png

  hface   modular Reticulan portraits (surt, CC0): every voice clip gets its own alien, built from the sheet's separate
          body / cranium / face (or helmet) parts and palette-swapped from cute pink to something you'd find in a drain:
          sickly skin, lesions, veins, bloodshot eyes. 3 frames per face: jaw shut, half, wide (the face part below the
          mouth row drops and the gap becomes a gullet). Frame = face * 3 + jaw. Face order = FACES below, mirrored in
          src/render/hype.ts (VOICE).
  creep   Animated Creepy Thing (Charlie, CC0): the GIF's 8-frame eye-glow cycle twice over, graded blood red with the
          eyes pushed to a hot toxic glow, and the lower jaw dropped 0-3 px across the 16 frames so it chews.
  poster  Zombie Take Away (CiderCorpse, OGA-BY 3.0): the 9x-upscaled GIF read back at its native 174x225 pixels, then
          halved with a box filter (legible "HUMANFLESH / EAT HERE"), bottom trimmed to fit the shop wall, a little grime.
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite_prep import *  # noqa
from PIL import Image

# ---------------- reticulan comms faces ----------------
SHEET = 'alien/modular-reticulan-portraits/reticulan_portraits.png'
SK = [(183, 0, 183), (255, 104, 255), (255, 183, 255)]          # skin dark, mid, light
EY = [(0, 0, 183), (0, 104, 255), (0, 183, 255), (255, 255, 255)]  # eye dark, mid, light, glint
CL = [(104, 0, 0), (183, 0, 0), (255, 104, 104), (255, 0, 0)]      # cloth
OT = [(0, 104, 104), (104, 104, 104), (183, 183, 183)]             # other (goggle lens, metal)
EYES_RED = [(96, 0, 4), (190, 22, 18), (255, 150, 90), (255, 236, 168)]
CLOTH_GORE = [(52, 6, 6), (110, 16, 12), (170, 64, 44), (200, 30, 20)]
LENS_SICK = [(86, 96, 18), (92, 88, 80), (150, 146, 126)]

# key (clip file stem), cranium col, face col (-1 = helmet), body col, skin (dark, mid, light), gore extras
FACES = [
    ('hell-yeah', 2, 4, 2, [(104, 84, 22), (168, 150, 62), (214, 202, 124)], 'veins'),       # SGT. SLAB: jaundiced brain-wrinkle brute
    ('shamalama', 5, 5, 0, [(56, 76, 48), (104, 126, 80), (150, 170, 118)], 'sores'),        # third eye, gangrene green
    ('sfriend', 0, 0, 1, [(86, 50, 72), (140, 106, 112), (186, 162, 142)], 'bruise'),        # the surf babe's handler: bruised
    ('stop-killing-me', 1, 2, 0, [(56, 66, 86), (100, 112, 130), (146, 156, 166)], 'corpse'),  # every 5th corpse: eyeless, drowned
    ('keyster-easter', 0, -1, 2, [(96, 40, 30), (150, 80, 60), (196, 130, 100)], 'helmet'),  # boss reward: the gas-mask officer
    ('lesley-yeah-baby', 6, 1, 1, [(124, 46, 28), (190, 104, 70), (228, 164, 116)], 'sores'),  # four-eyed, boiled
]
CROP = (8, 0, 56, 52)  # 48 x 52: cranium to the top of the shoulders


def cell(col, row_y):
    return box(SHEET, (col * 64, row_y, 64, 64))


def remap(im, skin):
    m = {}
    for a, b in zip(SK, skin): m[a] = b
    for a, b in zip(EY, EYES_RED): m[a] = b
    for a, b in zip(CL, CLOTH_GORE): m[a] = b
    for a, b in zip(OT, LENS_SICK): m[a] = b
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in m: px[x, y] = m[(r, g, b)] + (255,)
    return im


def skin_at(px, x, y, skin, w, h):
    """True if (x, y) and its 4 neighbours are skin (not outline, not eye): somewhere a sore can go"""
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        if not (0 <= x + dx < w and 0 <= y + dy < h): return False
        p = px[x + dx, y + dy]
        if p[3] == 0 or p[:3] not in skin[1:]: return False
    return True


def gore(im, skin, kind, seed, ymax=64):
    rnd = random.Random(seed)
    px = im.load()
    w, h = im.size
    dark, mid, light = skin
    vein = (150, 34, 44)
    if kind in ('sores', 'bruise', 'veins', 'corpse'):
        n = {'sores': 7, 'bruise': 5, 'veins': 3, 'corpse': 4}[kind]
        tries = 0
        while n and tries < 4000:
            tries += 1
            x, y = rnd.randrange(w), rnd.randrange(ymax)
            if not skin_at(px, x, y, skin, w, h): continue
            if kind == 'bruise':  # purple-yellow blotch
                for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1), (-1, 0)):
                    if skin_at(px, x + dx, y + dy, skin, w, h) or (dx, dy) == (0, 0): px[x + dx, y + dy] = (88, 44, 92, 255)
                px[x, y] = (150, 140, 60, 255)
            else:  # weeping sore: dark rim, pus centre
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): px[x + dx, y + dy] = dark + (255,)
                px[x, y] = (226, 206, 84, 255) if kind != 'corpse' else (120, 14, 20, 255)
            n -= 1
    if kind in ('veins', 'sores', 'bruise'):  # throbbing veins across the cranium
        for _ in range(4 if kind == 'veins' else 2):
            for tries in range(400):
                x, y = rnd.randrange(w), rnd.randrange(4, 22)
                if skin_at(px, x, y, skin, w, h): break
            for _ in range(rnd.randrange(5, 10)):
                if not skin_at(px, x, y, skin, w, h): break
                px[x, y] = vein + (255,)
                x += rnd.choice((-1, 0, 1)); y += rnd.choice((0, 1, 1))
    # bloodshot: veins into the eye whites
    for y in range(h):
        for x in range(w):
            if px[x, y][:3] == EYES_RED[3] and rnd.random() < .35: px[x, y] = (232, 70, 60, 255)
            elif px[x, y][:3] == EYES_RED[2] and rnd.random() < .25: px[x, y] = (210, 40, 34, 255)
    return im


def jaw(face, split, d, cx=None):
    """drop everything below row `split` by d px; the gap is a gullet with the cheeks carried down beside it"""
    if d == 0: return face.copy()
    w, h = face.size
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(face.crop((0, 0, w, split + 1)), (0, 0))
    low = face.crop((0, split + 1, w, h - d))
    out.alpha_composite(low, (0, split + 1 + d))
    src, dst = face.load(), out.load()
    xs = [x for x in range(w) if src[x, split][3]]
    if not xs: return out
    xl, xr = xs[0], xs[-1]
    if cx is None:
        inner = [x for x in range(xl + 1, xr) if src[x, split][:3] == (0, 0, 0)]
        cx = (inner[0] + inner[-1]) / 2 if inner else (xl + xr) / 2
    for k in range(1, d + 1):
        y = split + k
        for x in range(xl, xr + 1):
            if x in (xl, xr): dst[x, y] = (0, 0, 0, 255)
            elif abs(x + .5 - cx) <= 2 + d * .6: dst[x, y] = (40, 0, 4, 255) if k < d or d == 1 else (90, 6, 10, 255)
            else: dst[x, y] = src[x, split]
    # teeth on the upper lip once it's wide, a string of drool down the middle
    if d >= 2:
        for tx in (int(cx - 1.5), int(cx + 1.5)):
            if xl < tx < xr: dst[tx, split + 1] = (214, 200, 150, 255)
        dst[int(cx), split + d] = (200, 30, 26, 255)
    return out


def build_faces():
    out = []
    for i, (key, cr, fc, bd, skin, kind) in enumerate(FACES):
        body = remap(cell(bd, 128), skin)
        head = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        if fc >= 0:
            head.alpha_composite(remap(cell(cr, 192), skin))
            face = remap(cell(fc, 256), skin)
            split = 41
        else:
            face = remap(cell(0, 320), skin)  # helmet + respirator: the whole head
            split = 36
        gore(head, skin, kind, 100 + i, 26)
        gore(face, skin, kind, 200 + i, 50)
        if kind == 'corpse':  # bled-out eye sockets: two runs from where the eyes were, and a split lip
            fp = face.load()
            for ex in (24, 39):
                for y in range(30, 37 + (ex & 1)):
                    if fp[ex, y][3]: fp[ex, y] = (150, 10, 16, 255) if y < 34 else (96, 4, 8, 255)
        for d in (0, 1, 3):
            f = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            f.alpha_composite(body)
            f.alpha_composite(head)
            f.alpha_composite(jaw(face, split, d, 32 if fc < 0 else None))
            out.append(f.crop(CROP))
    return out


# ---------------- game-over demon ----------------
def build_creep():
    fr = gif('demon/animated-creepy-thing/Creep.gif')
    out = []
    JAW = [0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3, 3, 2, 1]
    for i in range(16):
        f = fr[i % 8].copy()
        px = f.load()
        for y in range(f.height):
            for x in range(f.width):
                r, g, b, a = px[x, y]
                if not a: continue
                if g > r + 30:  # the eye glow: green -> molten yellow-orange
                    v = g / 255
                    px[x, y] = (255, int(80 + 175 * v * v), int(40 * v * v * v), a)
                else:  # bone greys -> blood: shadows nearly black-red, highlights raw meat
                    v = (r + g + b) / 765
                    px[x, y] = (int(28 + 227 * v ** .85), int(4 + 130 * v ** 2.6), int(6 + 100 * v ** 3), a)
        out.append(jaw_creep(f, JAW[i]))
    return out


def jaw_creep(f, d, split=88):
    w, h = f.size
    o = Image.new('RGBA', (w, h + 3), (0, 0, 0, 0))
    o.paste(f.crop((0, 0, w, split)), (0, 0))
    src = f.load()
    dst = o.load()
    for k in range(d):  # gullet between the fangs; outside the grin the skull just stretches
        for x in range(w):
            if not src[x, split][3]: continue
            dst[x, split + k] = ((26, 0, 2, 255) if k < d - 1 else (90, 6, 8, 255)) if 37 <= x <= 61 and src[x, split - 1][3] else src[x, split]
    o.alpha_composite(f.crop((0, split, w, h)), (0, split + d))
    return o


# ---------------- infirmary poster ----------------
def build_poster():
    fr = gif('eye/zombie-take-away/pixel ZOMBIE VERY BIGgif.gif')
    out = []
    for f in fr:
        n = f.convert('RGB').resize((174, 225), Image.NEAREST)  # the art is exactly 9x: back to its real pixels
        n = n.crop((0, 0, 174, 196)).resize((87, 98), Image.BOX)  # half size, hand cropped at the wrist
        n = grade(n.convert('RGBA'), sat=.92, dark=.92, contrast=1.06)
        px = n.load()
        rnd = random.Random(7)
        for y in range(n.height):  # grime: darken toward the edges, water stain, a torn bottom-right corner
            for x in range(n.width):
                e = min(x, y, n.width - 1 - x, n.height - 1 - y)
                k = .72 + .28 * min(1, e / 6)
                if 60 < y and (x - 14) ** 2 / 90 + (y - 84) ** 2 / 30 < 1: k *= .8
                r, g, b, a = px[x, y]
                px[x, y] = (int(r * k), int(g * k * .96), int(b * k * .9), a)
        for y in range(n.height - 9, n.height):
            for x in range(n.width - 13, n.width):
                if (x - (n.width - 13)) + (y - (n.height - 9)) * 1.4 > 9 + rnd.random() * 2: px[x, y] = (0, 0, 0, 0)
        out.append(n)
    return out


if __name__ == '__main__':
    save('hface', build_faces()); preview('hface', 5)
    save('creep', build_creep()); preview('creep', 3)
    save('poster', build_poster()); preview('poster', 3)
