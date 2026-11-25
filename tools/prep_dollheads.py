"""MINI BABY-DOLL HEADS: the common fodder flyer (Matt: "mini baby doll heads"), little cousins of THE KEEPSAKE (D55).

Hand-placed pixel art, drawn here in code (no photo, no outside art): an original first-party sprite. The palette is the
KEEPSAKE's sun-faded vinyl (keepsake@6.png's tones) so the swarm reads as the same toy box. Deterministic: no RNG, so a
re-run bakes byte-identical PNGs.

Content (D46/D55): a vinyl doll HEAD only, hollow (the open neck hole shows the dark inside); no body, hands, child
figure, teeth, bone or skull. Creep comes from the toy itself: grime, a hairline crack across the crown, a dark tear
trickle, painted lashes, and the sleep eyes clacking open.

Art direction: 16x16 game px per frame (sprites are baked at 1x game res, like eyeball@4 / wasp@25), the vinyl dimmed to
~75% of #d6bfa2 so a head never reads as a bright bullet, and a 1 px dark outline round the whole silhouette.

Layout (facing LEFT, the way enemies fly; mirror with sx -1 for a right-flyer):
  dollhead@4.png  4 x 16x16:  0 eyes shut, 1 half-lidded, 2 open (the clack tell), 3 open + tipped face-first ~14 deg
                  with a wet shine on the dome and the eyes (the lunge)
  dollshard@3.png 3 x 5x5:    flat vinyl shard gibs (crown piece, cheek piece with blush, painted-eye piece)
Centre: the head's centre is the frame centre (8, 8): draw with spr(c, 'dollhead', f, x, y) (default anchor .5/.5).

Run:  python -I tools/prep_dollheads.py [contact_sheet.png]
"""
import math
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(HERE, '..', 'src', 'sprites')

W = H = 16
DIM = .75  # the art director's dimming, applied to the whole head (the eye glint excepted)


def hexc(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


# vinyl ramp, light -> dark (undimmed; #d6bfa2 is the base)
VINYL = [hexc(c) for c in ('#f2e2c8', '#d6bfa2', '#b39274', '#86684f', '#523d2e')]
GRIME = hexc('#5a4a30')     # old dirt in the creases, a little green
BLUSH = hexc('#c98d7c')     # faded painted cheek
LIP = hexc('#93424a')       # rosebud lips (closed: no teeth)
LIPD = hexc('#5e2028')
OUT = hexc('#1b100d')       # the outline
HOLE = hexc('#160a09')      # inside the hollow head
HOLER = hexc('#8a6c52')     # the neck hole's cut rim
CRACK = hexc('#3b2820')
TEAR = hexc('#4c1a16')      # a dark trickle from the tear duct
K = hexc('#22140f')         # socket / lash paint
SCL = hexc('#c9c3b6')       # sclera: a dull glassy white, left undimmed so the open stare pops
IRIS = hexc('#5a7d9e')      # painted blue iris
IRISD = hexc('#2f4560')
PUP = hexc('#120c14')
GLINT = (246, 242, 232)     # never dimmed: the eye catches the light


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def head_mask(x, y):
    """the silhouette in head space (game px, origin at the frame centre): a big domed cranium + chubby jowls toward the
    face (left), and the neck stump cut flat at the lower right"""
    cran = ((x - .4) / 6.3) ** 2 + ((y + .9) / 6.0) ** 2 <= 1
    jowl = ((x + .7) / 5.4) ** 2 + ((y - 2.4) / 4.1) ** 2 <= 1
    stump = 0 <= x - .5 <= 4.6 and 3 <= y <= 6.6
    return cran or jowl or stump


def shade(x, y):
    """sphere-lit vinyl from the upper left (the face side)"""
    nx, ny = (x - .1) / 6.6, (y + .3) / 6.6
    nz = math.sqrt(max(0., 1 - nx * nx - ny * ny))
    lx, ly, lz = -.62, -.42, .66
    d = max(0., nx * lx + ny * ly + nz * lz)
    # quantize to the ramp (pixel art: flat bands, no gradients)
    if d > .8:
        return VINYL[0]
    if d > .56:
        return VINYL[1]
    if d > .34:
        return VINYL[2]
    if d > .14:
        return VINYL[3]
    return VINYL[4]


# deterministic grime: a fixed scatter (head px), tinted toward GRIME
GRIME_PX = [(5, 2, .55), (11, 4, .5), (12, 6, .45), (10, 11, .6), (6, 12, .35), (13, 9, .5), (4, 6, .3), (9, 3, .3)]

# eye templates: (dx, dy) -> colour from the eye's top-left. Near eye 3 wide, far eye 2 wide (the face turns left)
L1, L2 = VINYL[2], VINYL[3]  # lids: vinyl, the lower a shade darker
EYES = {
    'shut': {
        'near': ["LLL", "LLL", "KKK", "K.."],
        'far': ["LL", "LL", "KK", ".."],
    },
    'half': {
        'near': ["LLL", "KKK", "IiS", "..."],
        'far': ["LL", "KK", "Ii", ".."],
    },
    'open': {
        'near': ["KKK", "SIG", "SPI", "..."],
        'far': ["KK", "IG", "Pi", ".."],
    },
}
CODE = {'L': L1, 'K': K, 'I': IRIS, 'i': IRISD, 'P': PUP, 'S': SCL, 'G': GLINT}
NEAR_AT, FAR_AT = (6, 7), (2, 7)  # eye top-lefts, frame px


def bake_head(state, shine=False):
    """one 16x16 frame, outline excluded (added after any tilt): list of rows of RGBA"""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = img.load()
    for py in range(H):
        for px in range(W):
            x, y = px + .5 - 8, py + .5 - 8
            # leave the outer ring of the frame for the outline
            if 1 <= px <= 14 and 1 <= py <= 14 and head_mask(x, y):
                p[px, py] = shade(x, y) + (255,)
    # the open neck at the back of the jaw (lower right, trailing): the cut rim and the dark hollow inside
    for (hx, hy, c) in [(12, 12, HOLE), (13, 12, HOLE), (12, 13, HOLE), (13, 13, HOLE), (11, 12, HOLER), (11, 13, HOLER),
                        (12, 11, HOLER), (13, 11, HOLER), (12, 14, HOLER)]:
        if p[hx, hy][3]:
            p[hx, hy] = c + (255,)
    # grime
    for (gx, gy, t) in GRIME_PX:
        if p[gx, gy][3]:
            p[gx, gy] = lerp(p[gx, gy][:3], GRIME, t) + (255,)
    # cheek blush (near cheek, under the near eye; a hint on the far cheek)
    for (bx, by, t) in [(6, 11, .6), (7, 11, .5), (5, 11, .35), (2, 11, .4)]:
        p[bx, by] = lerp(p[bx, by][:3], BLUSH, t) + (255,)
    # button nose (a shadow pixel under the bridge) and closed rosebud lips
    p[3, 10] = lerp(p[3, 10][:3], VINYL[3], .7) + (255,)
    p[3, 12] = LIP + (255,)
    p[4, 12] = LIPD + (255,)
    p[3, 13] = lerp(VINYL[2], LIP, .4) + (255,)
    # a little ear on the far side of the head
    p[11, 8] = VINYL[3] + (255,)
    p[11, 9] = VINYL[4] + (255,)
    # the hairline crack: crown down toward the near eye
    for (cx, cy) in [(9, 2), (9, 3), (8, 4), (8, 5), (9, 6)]:
        p[cx, cy] = CRACK + (255,)
    # faint painted brows, high on the big forehead
    for (bx, by) in [(6, 5), (7, 5), (2, 5)]:
        p[bx, by] = lerp(p[bx, by][:3], VINYL[4], .45) + (255,)
    # eyes
    for which, (ex, ey) in (('near', NEAR_AT), ('far', FAR_AT)):
        for dy, row in enumerate(EYES[state][which]):
            for dx, ch in enumerate(row):
                if ch != '.':
                    p[ex + dx, ey + dy] = CODE[ch] + (255,)
    # a dark tear trickle from the near eye's inner corner
    p[6, 10] = lerp(p[6, 10][:3], TEAR, .75) + (255,)
    p[6, 11] = lerp(p[6, 11][:3], TEAR, .45) + (255,)
    if shine:  # the lunge: a wet highlight on the dome
        p[5, 3] = GLINT + (255,)
        p[6, 3] = VINYL[0] + (255,)
    return img


def dim(img):
    p = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = p[x, y]
            if a and (r, g, b) not in (GLINT, SCL):
                p[x, y] = (round(r * DIM), round(g * DIM), round(b * DIM), a)
    return img


def outline(img):
    """1 px dark outline (4-neighbour) round every opaque pixel"""
    out = img.copy()
    s, o = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            if s[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < img.width and 0 <= ny < img.height and s[nx, ny][3]:
                    o[x, y] = OUT + (255,)
                    break
    return out


def tilt(img, deg):
    """rotate pixel art without smearing it: x8 nearest, rotate nearest about the centre, sample block centres"""
    z = 8
    big = img.resize((img.width * z, img.height * z), Image.NEAREST).rotate(deg, resample=Image.NEAREST,
                                                                             center=(img.width * z / 2, img.height * z / 2))
    b = big.load()
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    o = out.load()
    for y in range(img.height):
        for x in range(img.width):
            o[x, y] = b[x * z + z // 2, y * z + z // 2]
    # keep the ring free for the outline
    for i in range(img.width):
        o[i, 0] = o[i, img.height - 1] = o[0, i] = o[img.width - 1, i] = (0, 0, 0, 0)
    return out


def bake_heads():
    frames = [bake_head('shut'), bake_head('half'), bake_head('open'),
              tilt(bake_head('open', shine=True), 14)]
    strip = Image.new('RGBA', (W * 4, H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(outline(dim(f)), (i * W, 0))
    return strip


# shards: 5x5 flat vinyl pieces. '1'..'4' the ramp, 'b' blush, 'e' iris paint, 'k' lash paint, 'o' outline
SHARDS = [
    [".oo..", "o12o.", "o123o", ".o34o", "..oo."],   # a crown piece, lit edge up-left
    ["..oo.", ".o2bo", "o23bo", "o34o.", ".oo.."],   # a cheek piece with its faded blush
    [".ooo.", "o2kko", "o2e3o", ".o34o", "..o.."],   # a piece with a painted lash and a fleck of iris
]
SCODE = {'1': VINYL[0], '2': VINYL[1], '3': VINYL[2], '4': VINYL[3], 'b': BLUSH, 'e': IRIS, 'k': K, 'o': OUT}


def bake_shards():
    strip = Image.new('RGBA', (5 * len(SHARDS), 5), (0, 0, 0, 0))
    p = strip.load()
    for i, rows in enumerate(SHARDS):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != '.':
                    c = SCODE[ch]
                    if ch != 'o':
                        c = tuple(round(v * DIM) for v in c)
                    p[i * 5 + x, y] = c + (255,)
    return strip


def contact_sheet(heads, shards, path, z=8):
    """heads and shards at x z on a few backdrops (dark, the stage's murk, a mid grey), plus a 1x strip for scale"""
    bgs = [(12, 6, 8), (34, 22, 26), (70, 70, 74)]
    pad = 4
    cw = heads.width * z + pad * 2 + shards.width * z + pad * 2
    ch = (heads.height * z + pad * 2)
    sheet = Image.new('RGBA', (cw + 80, ch * len(bgs)), (0, 0, 0, 255))
    for r, bg in enumerate(bgs):
        tile = Image.new('RGBA', (cw + 80, ch), bg + (255,))
        tile.alpha_composite(heads.resize((heads.width * z, heads.height * z), Image.NEAREST), (pad, pad))
        tile.alpha_composite(shards.resize((shards.width * z, shards.height * z), Image.NEAREST),
                             (heads.width * z + pad * 3, pad))
        tile.alpha_composite(heads, (cw, pad))           # 1x, for the honest read
        tile.alpha_composite(heads.resize((heads.width * 2, heads.height * 2), Image.NEAREST), (cw, pad + 24))
        sheet.paste(tile, (0, r * ch))
    sheet.save(path)


def main():
    heads, shards = bake_heads(), bake_shards()
    heads.save(os.path.join(DST, 'dollhead@4.png'), optimize=True)
    shards.save(os.path.join(DST, 'dollshard@3.png'), optimize=True)
    print('wrote src/sprites/dollhead@4.png', heads.size, 'and src/sprites/dollshard@3.png', shards.size)
    if len(sys.argv) > 1:
        contact_sheet(heads, shards, sys.argv[1])
        print('contact sheet ->', sys.argv[1])


if __name__ == '__main__':
    main()
