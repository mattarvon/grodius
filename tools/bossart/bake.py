#!/usr/bin/env python3
"""LS2-bossart bake kit: painted hero views -> one PNG8 atlas + layout JSON per boss, read by src/render/gross/baked.ts.
Run bakes with `python3 -I`. A boss script paints RGBA hero views, optionally bends them for motion, then adds them as named
frame lists. Every frame in an atlas shares one palette, so a held surface does not shimmer between frames."""
import hashlib, json, math, os
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None
BIC = Image.Resampling.BICUBIC; LAN = Image.Resampling.LANCZOS
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'src', 'sprites', 'boss')


def bend(im, fn, n=28):
    """warp an RGBA hero with a smooth displacement: fn(x, y) -> (dx, dy) in hero px, the pixel at (x, y) shows what was at
    (x - dx, y - dy). PIL premultiplies RGBA for the resample, so edges do not fringe"""
    w, h = im.size; cw = w / n; ch = h / n; mesh = []
    def src(x, y):
        dx, dy = fn(x, y); return (x - dx, y - dy)
    for i in range(n):
        for j in range(n):
            x0, y0, x1, y1 = i * cw, j * ch, (i + 1) * cw, (j + 1) * ch
            mesh.append(((int(x0), int(y0), int(x1), int(y1)), src(x0, y0) + src(x0, y1) + src(x1, y1) + src(x1, y0)))
    return im.transform(im.size, Image.Transform.MESH, mesh, BIC)


def pad(im, size, at):
    """paste a hero on a bigger clear canvas: swell, slump and sway need room past the painted footprint"""
    o = Image.new('RGBA', size, (0, 0, 0, 0)); o.paste(im, at); return o


def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)


class Baker:
    """key: file name. hero_size: painted canvas. game_size: its size in game px. origin: boss (0,0) in hero px"""

    def __init__(s, key, hero_size, game_size, origin, colors=220, alpha_cut=96, unsharp=70):
        s.key, s.hero, s.game, s.colors, s.cut, s.unsharp = key, hero_size, game_size, colors, alpha_cut, unsharp
        s.kx, s.ky = game_size[0] / hero_size[0], game_size[1] / hero_size[1]
        s.ox, s.oy = origin[0] * s.kx, origin[1] * s.ky
        s.frames = {}; s.names = []

    def sprite(s, hero):
        """hero -> crisp game-size RGBA: premultiplied Lanczos, a little unsharp, a hard alpha edge. No colour limit yet"""
        p = hero.convert('RGBa').resize(s.game, LAN).convert('RGBA'); r, g, b, a = p.split()
        rgb = Image.merge('RGB', (r, g, b))
        if s.unsharp: rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=s.unsharp, threshold=2))
        rgb.putalpha(a.point(lambda v: 255 if v >= s.cut else 0)); return rgb

    def add(s, name, hero):
        """append one frame to list `name`. hero is an RGBA view of the same size as hero_size"""
        assert hero.size == s.hero, (hero.size, s.hero)
        sp = s.sprite(hero); bb = sp.getchannel('A').getbbox() or (0, 0, 1, 1); sp = sp.crop(bb)
        if name not in s.frames: s.frames[name] = []; s.names.append(name)
        s.frames[name].append((sp, bb[0] - round(s.ox), bb[1] - round(s.oy)))

    def save(s, width=1024):
        """shelf-pack, quantise the whole sheet once, write src/sprites/boss/<key>.png + .json. Identical frames share a cell"""
        cells = {}; order = []
        for n in s.names:
            for sp, _, _ in s.frames[n]:
                h = hashlib.sha1(sp.tobytes() + bytes(str(sp.size), 'ascii')).hexdigest()
                if h not in cells: cells[h] = None; order.append((h, sp))
        order.sort(key=lambda q: -q[1].height)
        x = y = shelf = 0; W = H = 0
        for h, sp in order:
            if x + sp.width > width: x = 0; y += shelf + 1; shelf = 0
            cells[h] = (x, y); x += sp.width + 1; shelf = max(shelf, sp.height); W = max(W, x); H = max(H, y + shelf)
        sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for h, sp in order: sheet.paste(sp, cells[h])
        alpha = sheet.getchannel('A'); rgb = sheet.convert('RGB')
        q = rgb.quantize(colors=s.colors - 1, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        pal = q.getpalette()[:3 * (s.colors - 1)]; pal += [0] * (3 * (s.colors - 1) - len(pal)); q.putpalette(pal + [0, 0, 0])
        q.paste(s.colors - 1, mask=alpha.point(lambda v: 255 if v == 0 else 0))
        os.makedirs(OUT, exist_ok=True)
        q.save(os.path.join(OUT, s.key + '.png'), transparency=s.colors - 1, optimize=True)
        lay = dict(w=W, h=H, f={})
        for n in s.names:
            rows = []
            for sp, ox, oy in s.frames[n]:
                h = hashlib.sha1(sp.tobytes() + bytes(str(sp.size), 'ascii')).hexdigest(); cx, cy = cells[h]
                rows.append([cx, cy, sp.width, sp.height, ox, oy])
            lay['f'][n] = rows
        json.dump(lay, open(os.path.join(OUT, s.key + '.json'), 'w'), separators=(',', ':'))
        kb = os.path.getsize(os.path.join(OUT, s.key + '.png')) // 1024
        print(f'{s.key}: {W}x{H} atlas, {len(order)} cells, {sum(len(v) for v in s.frames.values())} frames, {kb} KB')
        return lay
