"""Sprite prep: turns OpenGameArt picks (assets-raw/sprites, see tools/sprite-scout.mjs) into game strips for
src/sprites.ts: frames cut from a sheet / file list / GIF, trimmed to one shared box, scaled to in-game pixels and
graded toward the Grodius palette, saved as src/sprites/<name>@<frames>.png (one horizontal strip).

Import it from a per-feature script:

    import sys; sys.path.insert(0, 'tools'); from sprite_prep import *
    fr = grid('bug/wasp/waspanim1.png', cols=20, rows=1)          # or files([...]) / gif('...') / box(path, (x,y,w,h))
    fr = [grade(f, sat=.6, tint=(170, 190, 60), tint_k=.35, dark=.85) for f in fr]
    save('wasp', fit(fr, h=14))                                    # -> src/sprites/wasp@20.png

Paths are relative to assets-raw/sprites. In-game size: the playfield is 480x270, a regular enemy is ~14-24 px.
"""
import os
import glob as _glob
from PIL import Image, ImageEnhance, ImageFilter, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'assets-raw', 'sprites')
DST = os.path.join(HERE, '..', 'src', 'sprites')


def _open(p):
    return Image.open(p if os.path.isabs(p) else os.path.join(SRC, p))


def grid(path, cols, rows=1, take=None, key=None):
    """frames of an evenly spaced sheet, row by row; take = slice or list of indices; key = RGB colour to make clear"""
    im = _open(path).convert('RGBA')
    w, h = im.width // cols, im.height // rows
    fr = [im.crop((c * w, r * h, c * w + w, r * h + h)) for r in range(rows) for c in range(cols)]
    fr = _take(fr, take)
    return [keyout(f, key) for f in fr] if key else fr


def files(pattern_or_list):
    """one frame per file (a glob pattern, sorted, or a list)"""
    ps = sorted(_glob.glob(os.path.join(SRC, pattern_or_list))) if isinstance(pattern_or_list, str) else pattern_or_list
    return [_open(p).convert('RGBA') for p in ps]


def gif(path, take=None):
    return _take([f.convert('RGBA') for f in ImageSequence.Iterator(_open(path))], take)


def box(path, b):
    """one frame cut from (x, y, w, h)"""
    x, y, w, h = b
    return _open(path).convert('RGBA').crop((x, y, x + w, y + h))


def _take(fr, take):
    if take is None:
        return fr
    return fr[take] if isinstance(take, slice) else [fr[i] for i in take]


def keyout(im, rgb, tol=24):
    """make a flat background colour transparent"""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if abs(r - rgb[0]) <= tol and abs(g - rgb[1]) <= tol and abs(b - rgb[2]) <= tol:
                px[x, y] = (r, g, b, 0)
    return im


def trim(frames, pad=1):
    """crop every frame to the union of their opaque boxes (keeps the animation registered)"""
    bbs = [f.getbbox() for f in frames if f.getbbox()]
    if not bbs:
        return frames
    x0, y0 = min(b[0] for b in bbs), min(b[1] for b in bbs)
    x1, y1 = max(b[2] for b in bbs), max(b[3] for b in bbs)
    return [f.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad)) for f in frames]


def fit(frames, h=None, w=None, sharpen=True, alpha_cut=96):
    """trim, then scale so the frame is h (or w) in-game pixels tall (wide). Big painted art goes down in two steps
    with a light sharpen so it survives 14 px; alpha is hardened (pixel edges, no grey fringe on the dark playfield)."""
    frames = trim(frames)
    fw, fh = frames[0].size
    k = (h / fh) if h else (w / fw)
    tw, th = max(1, round(fw * k)), max(1, round(fh * k))
    out = []
    for f in frames:
        if k < .5:  # two steps: a straight LANCZOS from 500 px to 14 px loses everything
            f = f.resize((tw * 2, th * 2), Image.LANCZOS)
        f = f.resize((tw, th), Image.LANCZOS if k < 1 else Image.NEAREST)
        if sharpen and k < 1:
            f = f.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
        if alpha_cut is not None:
            a = f.getchannel('A').point(lambda v: 255 if v >= alpha_cut else 0)
            f.putalpha(a)
        out.append(f)
    return out


def grade(im, sat=1.0, bright=1.0, contrast=1.0, tint=None, tint_k=0.0, dark=1.0, hue=0):
    """push art toward the game: desaturate (sat), darken (dark/bright), contrast, hue shift (degrees) and a
    multiply-ish tint toward an RGB colour with strength tint_k 0..1. Alpha untouched."""
    a = im.getchannel('A')
    rgb = im.convert('RGB')
    if hue:
        h, s, v = rgb.convert('HSV').split()
        h = h.point(lambda x: (x + int(hue / 360 * 255)) % 256)
        rgb = Image.merge('HSV', (h, s, v)).convert('RGB')
    if sat != 1:
        rgb = ImageEnhance.Color(rgb).enhance(sat)
    if contrast != 1:
        rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    if bright * dark != 1:
        rgb = ImageEnhance.Brightness(rgb).enhance(bright * dark)
    if tint and tint_k:  # multiply each channel by the tint, blended in by tint_k
        r, g, b = rgb.split()
        mult = Image.merge('RGB', [ch.point(lambda v, t=t: v * t // 255) for ch, t in zip((r, g, b), tint)])
        rgb = Image.blend(rgb, mult, tint_k)
    out = rgb.convert('RGBA')
    out.putalpha(a)
    return out


def flip(frames):
    return [f.transpose(Image.FLIP_LEFT_RIGHT) for f in frames]


def rot90(frames, k=1):
    """rotate 90 degrees k times counter-clockwise (top-down art onto a side-view wall)"""
    return [f.rotate(90 * k, expand=True) for f in frames]


def save(name, frames):
    """write src/sprites/<name>@<n>.png (or <name>.png for one frame); removes older strips of the same name"""
    os.makedirs(DST, exist_ok=True)
    for old in _glob.glob(os.path.join(DST, f'{name}@*.png')) + _glob.glob(os.path.join(DST, f'{name}.png')):
        os.remove(old)
    w, h = max(f.width for f in frames), max(f.height for f in frames)
    strip = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * w + (w - f.width) // 2, h - f.height))
    fn = f'{name}@{len(frames)}.png' if len(frames) > 1 else f'{name}.png'
    strip.save(os.path.join(DST, fn), optimize=True)
    print(f'{fn:28s} {w}x{h} x{len(frames)}  {os.path.getsize(os.path.join(DST, fn)) // 1024} KB')
    return fn


def preview(name, scale=6, bg=(12, 8, 9)):
    """assets-raw/upgrade/prep/<name>.png: the strip blown up on the game's background, for eyeballing"""
    p = (_glob.glob(os.path.join(DST, f'{name}@*.png')) + _glob.glob(os.path.join(DST, f'{name}.png')))[0]
    im = Image.open(p)
    out = Image.new('RGBA', im.size, bg + (255,))
    out.alpha_composite(im)
    out = out.resize((im.width * scale, im.height * scale), Image.NEAREST)
    d = os.path.join(HERE, '..', 'assets-raw', 'upgrade', 'prep')
    os.makedirs(d, exist_ok=True)
    out.save(os.path.join(d, name + '.png'))
    return os.path.join(d, name + '.png')
