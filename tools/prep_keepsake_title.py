"""THE KEEPSAKE as the title hero (Matt 2026-11-20: "love the baby doll head on the title"): the head baked at title
resolution from the same photos and the same work canvas as the stage boss (tools/prep_keepsake_boss.py), not the boss
atlas scaled up.

Source: Matt Arvon's own photographs of his own unmarked antique vinyl doll (D7/D53), git-ignored in assets-raw/keepsake;
the fork is the Walker & Hall photo fork (tools/keepsake_fork.py, CC BY 4.0). Without either this prints a message and
exits cleanly: the committed PNGs are the source of truth for the game. Imply-only (D46/D53): a toy and its wound.

The title draws the head on the display canvas at device resolution, as it drew ROT (render/titledoll.ts through the
eye queue), so the layers are baked at PX device px per title px. The head sits on the title at TITLE_S x the boss's
size (titlelayout.ts TITLE.doll.s). Every layer shares one canvas origin (the boss origin, between the eyes) and is
cropped to its own pixels; doll.json holds each crop's offset.

Layers, drawn halo -> face -> eye_<state> -> wound_<rise>:
  - halo: the head's own shadow, a soft dark spread a little past the silhouette, so it sits in the scene (baked small)
  - face: whole (no crack), half-lidded, the seated wound without its fork, sphere-lit vinyl as the boss's face0
  - eye_half / eye_shut / eye_open: the sleep eyes (the idle doze, and the snap open on DESCEND)
  - wound_0 / wound_3 / wound_6 / wound_9: the wound with the photo fork in it, risen 0, 3, 6, 9 boss px (the boss's
    wound_seat is 0, wound_proud 9): the fork working up out of the skull on DESCEND

Run:  python -I tools/prep_keepsake_title.py [preview.png]   -> src/sprites/title/doll_*.png + doll.json
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import prep_keepsake_boss as kb  # noqa: E402  the boss bake: Head, wound, fork_overlay, the hero canvas
import keepsake_fork as kf  # noqa: E402
import prep_keepsake as pk  # noqa: E402

OUT = os.path.join(HERE, '..', 'src', 'sprites', 'title')
TITLE_S = 1.45          # the head on the title, x the boss's size (titlelayout.ts TITLE.doll.s)
PX = 3.5                # device px per title px the layers are baked at (ROT's ball was ~3.7; DK is 2-4)
HALO_PX = .75           # the halo is a blur: baked at under a px per title px, drawn smooth
RISES = [0, 3, 6, 9]    # the fork's rise out of the wound, boss px


def down(hero, k):
    """hero RGBA -> k x its size, premultiplied Lanczos (soft edges kept: the title draws it smooth at device res)"""
    w, h = round(hero.width * k), round(hero.height * k)
    return hero.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')


def crop(im, origin):
    bb = im.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox() or (0, 0, 1, 1)
    return im.crop(bb), [bb[0] - origin[0], bb[1] - origin[1]]


def main():
    d = pk.find_photos()
    fp = kf.find_photo()
    if not d or not fp:
        print('prep_keepsake_title: the doll photos (assets-raw/keepsake) or the fork photo (assets-raw/openverse/image/fork) '
              'are not here (git-ignored); the committed src/sprites/title/doll_* stand. Nothing to do.')
        return 0
    F = kf.Fork(fp)
    head = kb.Head(d)
    im, _ = head.compose(0, 'half')
    face = kb.padw(im)
    seat = kb.padw(kb.wound(False, np.random.default_rng(5)))
    face.alpha_composite(seat)                                  # the boss's face0: the seated wound, its fork drawn above
    eyes = {}
    for e in ('half', 'shut', 'open'):
        ei, _ = head.compose(0, e)
        eyes[e] = kb.padw(kb.mask_im(ei, head.eyemask))
    fork = kf.outline_hero(F.paint(kb.FORK_G[1], kb.S), kb.S)
    wounds = {}
    for r in RISES:
        fo, slot = kb.fork_overlay(fork, r)
        o = seat.copy()
        pool = Image.new('RGBA', o.size, (0, 0, 0, 0))
        from PIL import ImageDraw
        ImageDraw.Draw(pool).ellipse((slot[0] - 3.2 * kb.S, slot[1] - 1.6 * kb.S, slot[0] + 3.2 * kb.S, slot[1] + 1.4 * kb.S), fill=(70, 4, 10, 235))
        o.alpha_composite(pool)
        o.alpha_composite(fo)
        wounds[r] = o
    # the hero canvas is S work px per boss px; the title wants PX device px per title px, TITLE_S title px per boss px
    k = PX * TITLE_S / kb.S
    org = (round(kb.HO * k), round(kb.HO * k))
    lay = {'_doc': 'THE KEEPSAKE title head (tools/prep_keepsake_title.py). off: the crop\'s top-left from the head origin '
                   '(the boss origin, between the eyes), in layer px; px: layer px per title px. Draw halo, face, eye_<state>, '
                   'wound_<rise> at the origin', 'px': PX, 'haloPx': HALO_PX, 'titleS': TITLE_S, 'rises': RISES, 'layers': {}}
    os.makedirs(OUT, exist_ok=True)

    def put(name, hero, kk=k, px=PX):
        o = (round(kb.HO * kk), round(kb.HO * kk))
        img, off = crop(down(hero, kk), o)
        img.save(os.path.join(OUT, f'doll_{name}.png'), optimize=True)
        lay['layers'][name] = {'off': off, 'size': list(img.size), 'px': px}
        return img, off
    face_img, face_off = put('face', face)
    for e, im in eyes.items():
        put('eye_' + e, im)
    for r, im in wounds.items():
        put(f'wound_{r}', im)
    # the halo: the head's silhouette (with the fork, risen), spread and blurred, near-black: a shadow in the scene
    sil = face.getchannel('A')
    sil = Image.fromarray(np.maximum(np.asarray(sil), np.asarray(wounds[9].getchannel('A'))))
    kh = HALO_PX * TITLE_S / kb.S
    small = sil.resize((round(sil.width * kh), round(sil.height * kh)), Image.BOX)
    spread = small.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(4.5))
    a = (np.asarray(spread).astype(np.float32) / 255) ** .8 * .82
    halo = np.zeros((*a.shape, 4), np.uint8)
    halo[..., 0], halo[..., 1], halo[..., 2] = 6, 2, 4
    halo[..., 3] = (a * 255).astype(np.uint8)
    hi = Image.fromarray(halo, 'RGBA')
    ho = (round(kb.HO * kh), round(kb.HO * kh))
    hc, hoff = crop(hi, ho)
    hc.save(os.path.join(OUT, 'doll_halo.png'), optimize=True)
    lay['layers']['halo'] = {'off': hoff, 'size': list(hc.size), 'px': HALO_PX}
    # the head's extent in title px (for titlelayout.ts's keep-out zones): the face's crop, and the fork at its highest
    fx0, fy0 = face_off[0] / PX, face_off[1] / PX
    lay['extent'] = {'face': [round(fx0, 1), round(fy0, 1), round(fx0 + face_img.width / PX, 1), round(fy0 + face_img.height / PX, 1)]}
    w9 = lay['layers']['wound_9']
    lay['extent']['wound9'] = [round(w9['off'][0] / PX, 1), round(w9['off'][1] / PX, 1),
                               round((w9['off'][0] + w9['size'][0]) / PX, 1), round((w9['off'][1] + w9['size'][1]) / PX, 1)]
    with open(os.path.join(OUT, 'doll.json'), 'w') as fh:
        json.dump(lay, fh, indent=1)
    tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'title head: {len(lay["layers"])} layers, {tot // 1024} KB; extent (title px from the origin): {lay["extent"]}')
    if len(sys.argv) > 1:
        sheet = Image.new('RGBA', (face_img.width + 40, face_img.height + 160), (14, 10, 16, 255))
        ox, oy = 20 - face_off[0], 140 - face_off[1]
        big_h = hc.resize((round(hc.width * PX / HALO_PX), round(hc.height * PX / HALO_PX)), Image.BICUBIC)
        sheet.alpha_composite(big_h, (ox + round(hoff[0] * PX / HALO_PX), oy + round(hoff[1] * PX / HALO_PX)))
        for n in ('face', 'eye_half', 'wound_0'):
            L = lay['layers'][n]
            sheet.alpha_composite(Image.open(os.path.join(OUT, f'doll_{n}.png')).convert('RGBA'), (ox + L['off'][0], oy + L['off'][1]))
        sheet.save(sys.argv[1])
        print('preview:', sys.argv[1])
    return 0


if __name__ == '__main__':
    sys.exit(main())
