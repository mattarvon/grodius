"""THE MAW's engraved teeth: individual teeth cut from Matt's CC0 plate (rawpixel 6266016, 'Vintage teeth illustration',
public domain, id 0e418943-7d15-4e41-bb57-43d7b299420b; credit row in assets-raw/bossart/dl/credits.json).
Each tooth comes back as (ink, mask): ink = the engraving's own line work inside the tooth (0 line .. 1 paper), mask = the
tooth shape, both 'L', the crown pointing UP and the root at the bottom row. The ring painter turns ink into height (lines are
grooves) and regrades it into wet ivory, so the teeth share the disc's light instead of sitting on it as stickers."""
import os
from PIL import Image, ImageFilter, ImageChops
HERE = os.path.dirname(os.path.abspath(__file__))
PLATE = os.path.join(os.path.dirname(os.path.dirname(HERE)), '..', 'assets-raw', 'bossart', 'dl', 'rawpixel_teeth_6266016.jpg')
PLATE = os.path.normpath(PLATE)
SC = 650  # labelled at half the plate's 1300 px: the thick outlines survive, the per-pixel python stays under a second
_cache = None


def _label(mask):
    """4-connected components of a 1-bit 'L' mask (255 = in). Returns list of (bbox, pixel set)"""
    w, h = mask.size; px = mask.load(); seen = bytearray(w * h); out = []
    for y in range(h):
        for x in range(w):
            if px[x, y] < 128 or seen[y * w + x]: continue
            st = [(x, y)]; seen[y * w + x] = 1; pts = []
            while st:
                cx, cy = st.pop(); pts.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny] >= 128:
                        seen[ny * w + nx] = 1; st.append((nx, ny))
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            out.append(((min(xs), min(ys), max(xs) + 1, max(ys) + 1), pts))
    return out


def teeth():
    """every usable tooth on the plate, largest first: list of dict(ink, mask, upper) at the plate's full resolution"""
    global _cache
    if _cache is not None: return _cache
    im = Image.open(PLATE).convert('RGB'); W = im.width; k = W / SC
    sm = im.resize((SC, SC), Image.Resampling.LANCZOS)
    r, g, b = sm.split()
    lum = sm.convert('L')
    # paper (tooth enamel) = light and grey (pink gums have r >> g). Ink = dark; thin hatching is closed off by an opening
    # of the ink so only the thick outlines split teeth apart, then the hatching is restored inside each tooth from the plate
    grey = ImageChops.subtract(r, g).point(lambda v: 255 if v < 28 else 0)
    light = lum.point(lambda v: 255 if v > 150 else 0)
    ink = lum.point(lambda v: 255 if v < 110 else 0)
    thick = ink.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5))
    paper = ImageChops.multiply(ImageChops.multiply(grey, light.filter(ImageFilter.MaxFilter(3))), ImageChops.invert(thick))
    # the teeth live between the gums: rows 26%..72% of the plate, columns 6%..94% (outside is the checkered page)
    band = Image.new('L', (SC, SC), 0); band.paste(255, (int(SC * .06), int(SC * .30), int(SC * .94), int(SC * .72)))
    paper = ImageChops.multiply(paper, band)
    out = []
    for (x0, y0, x1, y1), pts in _label(paper):
        bw, bh = x1 - x0, y1 - y0
        if len(pts) < 120 or bh < 18 or bw < 6 or bh > 140: continue
        m = Image.new('L', (bw, bh), 0); mp = m.load()
        for x, y in pts: mp[x - x0, y - y0] = 255
        # back to plate resolution; the tooth's own hatching from the full-size plate
        box = (int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k))
        M = m.resize((box[2] - box[0], box[3] - box[1]), Image.Resampling.BICUBIC).filter(ImageFilter.MaxFilter(3))
        # close the bites the hatching took out of the edge (lines that ran into the outline), then soften one pixel
        M = M.point(lambda v: 255 if v > 100 else 0).filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.MinFilter(13))
        M = M.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.8))
        I = im.crop(box).convert('L')
        cy = (y0 + y1) / 2 / SC
        upper = cy < .5  # upper row: crown points down on the plate
        if upper: I = I.transpose(Image.Transpose.FLIP_TOP_BOTTOM); M = M.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        out.append(dict(ink=I, mask=M, area=len(pts), upper=upper, ar=bh / bw))
    out.sort(key=lambda d: -d['area'])
    _cache = out
    return out


if __name__ == '__main__':
    import sys
    T = teeth(); print(len(T), 'teeth', [(t['mask'].size, t['upper']) for t in T])
    if len(sys.argv) > 1:
        W = sum(t['mask'].width + 6 for t in T); H = max(t['mask'].height for t in T)
        sheet = Image.new('RGB', (W, H * 2 + 4), (40, 10, 10)); x = 0
        for t in T:
            sheet.paste(t['ink'].convert('RGB'), (x, 0), t['mask']); sheet.paste(t['mask'].convert('RGB'), (x, H + 4)); x += t['mask'].width + 6
        sheet.save(sys.argv[1])
