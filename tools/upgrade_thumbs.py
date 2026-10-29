"""Upgrade-picker thumbnails: one clean frame (or crop) per downloaded sprite pick, so the picker cards show the
creature, not a whole sheet. Pixel art is upscaled by whole steps (crisp); painted art is downscaled.
Usage: python tools/upgrade_thumbs.py   -> assets-raw/upgrade/thumbs/<id>.png (ids match tools/upgrade-picker.mjs)"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets-raw')
SP = os.path.join(ROOT, 'sprites')
OUT = os.path.join(ROOT, 'upgrade', 'thumbs')
AB = 'tentacle/alien-boss-set/Alien Bosses'
ZF = 'zombie/zombie-fully-animated/zombie_-_fully_animated/Zombie - Fully Animated'

# id: (file relative to assets-raw/sprites, crop) where crop is a box, ('grid', cols, rows) = first cell, or None
PICKS = {
    'wasp': ('bug/wasp/WASP_FRAMES/wasp1_00003.png', None),
    'eyeball-float': ('eye/floating-eyeball-0/eyeball.png', ('grid', 4, 1)),
    'eyeballs-real': ('eye/eyeballs/eyeballs_0/eye_display_all.png', None),
    'earwig': ('bug/earwig-top-down/earwig_animation/Earwig animation/Earwig.png', None),
    'tentacle-eye': ('tentacle/top-down-tentacle-creature/monster_flesh_eye_sheet.png', ('grid', 3, 3)),
    'tentacle-teeth': ('tentacle/top-down-tentacle-creature/monster_flesh_teeth_sheet.png', ('grid', 3, 3)),
    'blob': ('blob/blob-sprite/blob idle.png', ('grid', 8, 1)),
    'sparks': ('zombie/sparks-fire-ice-blood/sparks.png', None),
    'space-sprites': ('alien/space-sprites-0/Sprites_0.png', (0, 540, 320, 640)),
    'planet-t': ('alien/planet-t-0/1368635432912_0.jpg', None),
    'scifi-tiles': ('shmup/enemy-sprite/scifi_bg_chip2_0.png', None),
    'magic-fence': ('tentacle/magic-fence/MagicFence.png', (0, 0, 360, 1024)),
    'creepy-thing': ('blob/creepy-thing/creeperNom_0.png', None),
    'creepy-anim': ('demon/animated-creepy-thing/Creep.gif', None),
    'reticulan': ('alien/modular-reticulan-portraits/reticulan_portraits.png', (0, 440, 256, 640)),
    'humanflesh': ('eye/zombie-take-away/pixel ZOMBIE VERY BIGgif.gif', None),
    'zombie-anim': (ZF, 'zombie'),
    'zombie-pack': ('zombie/zombie-character-pack/Zombie4CharPack/ZombieCopSheet.png', ('grid', 8, 2)),
    'pixel-zombie': ('zombie/pixel-zombie/zombie_0/1.png', None),
    'mech-pod-c': ('shmup/enemy-sprite/enemy_type_c_spritesheet_64x64x16.png', ('grid', 8, 2)),
    'mech-pod-d': ('shmup/enemy-sprite/enemy_type_d_spritesheet_64x64x8.png', ('grid', 8, 1)),
    'ship-tm3': ('shmup/space-ships-side-scroller/space_ships/space_ships/TM_3.png', None),
    'ship-tm6': ('shmup/space-ships-side-scroller/space_ships/space_ships/TM_6.png', None),
    'boss-eyeball': (f'{AB}/Green Eyeball Boss/EyeBoss_1.png', ('grid', 2, 3)),
    'boss-ufo': (f'{AB}/Infested UFO Boss/InfUFO_1.png', ('grid', 2, 8)),
    'boss-mouth': (f'{AB}/Red Mouth Boss/MouthBoss_Opening.png', ('grid', 4, 4)),
    'boss-tentacle': (f'{AB}/Yellow Tentacle Boss/Tentacle_1.png', None),
    'boss-final': (f'{AB}/Final Alien Boss/RedEye.png', ('grid', 2, 3)),
}
MAX = 192


def frame(spec):
    f, crop = spec
    if crop == 'zombie':  # 8192-wide sheets: take the first non-empty cell of the walk cycle
        f = os.path.join(f, next(n for n in sorted(os.listdir(os.path.join(SP, f))) if 'Walk' in n))
    im = Image.open(os.path.join(SP, f))
    im.seek(0)
    im = im.convert('RGBA')
    if crop == 'zombie':
        im = im.crop((0, 0, 341, 341))  # 24 x 12 grid of 341 px cells
    elif isinstance(crop, tuple) and crop[0] == 'grid':
        w, h = im.width // crop[1], im.height // crop[2]
        im = im.crop((0, 0, w, h))
    elif crop:
        im = im.crop(crop)
    bb = im.getbbox()
    return im.crop(bb) if bb else im


os.makedirs(OUT, exist_ok=True)
for k, spec in PICKS.items():
    im = frame(spec)
    s = max(im.size)
    if s * 2 <= MAX:
        n = MAX // s
        im = im.resize((im.width * n, im.height * n), Image.NEAREST)
    else:
        im.thumbnail((MAX, MAX), Image.LANCZOS)
    im.save(os.path.join(OUT, k + '.png'))
    print(f'{k:16s} {im.size}')
