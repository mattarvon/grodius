#!/usr/bin/env python3
"""Grodius terrain textures from real open data on the Registry of Open Data on AWS (RODA).

Every terrain surface in the game (the derelict's corridor walls and the four biome terrains) is real biology:
human cancer tissue under the microscope plus macro photos of slime moulds and jelly fungi, made seamless,
shrunk to the game's pixel scale (128 px repeat tiles) and gradient-mapped onto each biome's palette. Dark, mid-
contrast grades so lime enemy bullets, the player and enemies stay readable on top.

  uv run --with numpy,pillow python tools/roda_textures.py fetch     -> assets-raw/textures/{camelyon,inat}/*  (raw, git-ignored)
  uv run --with numpy,pillow python tools/roda_textures.py survey    -> assets-raw/textures/camelyon/overview-*.png (pick regions)
  uv run --with numpy,pillow python tools/roda_textures.py build     -> src/img/tex-*.png + assets-raw/textures/sheet.png

SOURCES (all CC0 / public domain; nothing NC, nothing SA)

1. RODA slug `camelyon` -- CAncer MEtastases in LYmph nOdes challeNge (CAMELYON16), Radboud University Medical
   Center. License: CC0. Bucket s3://camelyon-dataset (us-west-2), read anonymously over HTTPS with Range requests:
     https://camelyon-dataset.s3.amazonaws.com/CAMELYON16/images/tumor_001.tif
     https://camelyon-dataset.s3.amazonaws.com/CAMELYON16/annotations/tumor_001.xml  (where the metastasis is)
   (BigTIFF pyramids of H&E-stained sentinel lymph node sections with breast-cancer metastases; 512 px JPEG tiles.
   We read the IFD chain, then fetch only the handful of tiles we need at pyramid levels 2-3: see CUTS.)
   Litjens et al., "1399 H&E-stained sentinel lymph node sections of breast cancer patients: the CAMELYON dataset",
   GigaScience 7(6) 2018.

2. RODA slug `inaturalist-open-data` -- iNaturalist Licensed Observation Images. Licence varies per photo; we use
   ONLY photos whose license_code is cc0 (checked against api.inaturalist.org at fetch time; fetch aborts otherwise).
   Bucket s3://inaturalist-open-data (us-east-1):
     photos/701579492/large.jpeg  obs 383324913  Fuligo septica (dog-vomit slime mould, grey foam)  by jasonwebb       CC0
     photos/300927385/large.jpeg  obs 173293091  Fuligo septica (yellow plasmodium)                 by cam_boucher     CC0
     photos/126652158/large.jpg   obs 77441896   Leocarpus fragilis (egg-cluster slime mould)       by kent_ozment     CC0
     photos/131259259/large.jpg   obs 80102771   Exidia glandulosa (black witches' butter)          by dimitribrosens  CC0
     photos/460544380/large.jpeg  obs 256815760  Ascocoryne sarcoides (purple jellydisc)            by quillipede      CC0
     photos/598824077/large.jpg   obs 330256534  Didymium spongiosum (white foam slime mould)       by pilmar          CC0

OUTPUT (src/img/tex-*.png, 128x128, opaque RGB, seamless):
  tex-flesh  derelict corridor walls: CAMELYON tumour metastasis x Ascocoryne wrinkles -> raw meat reds
  tex-ice    THE CRYOVAULT: CAMELYON adipose (fat cells = ice crystal lattice) x Didymium foam -> frozen blue, red veins
  tex-acid   THE DIGESTION TANKS: Fuligo grey foam x CAMELYON tumour nuclei -> digested teal/sulfur over rust
  tex-fire   THE FURNACE: Exidia black jelly x CAMELYON -> charred black with ember seams in the creases
  tex-snot   THE SINUS: Leocarpus egg clusters x Fuligo yellow -> pus beads in ochre mucus
"""
import io, json, os, struct, sys, urllib.request
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RAW = os.path.join(ROOT, 'assets-raw', 'textures')
OUT = os.path.join(ROOT, 'src', 'img')
CAM = 'https://camelyon-dataset.s3.amazonaws.com/CAMELYON16/images/{}.tif'
T = 128  # tile size in game pixels

# photo id -> (observation id, extension as served, short name); files: inaturalist-open-data/photos/<id>/large.<ext>
PHOTOS = {
    701579492: (383324913, 'jpeg', 'fuligo-grey'),
    300927385: (173293091, 'jpeg', 'fuligo-yellow'),
    126652158: (77441896, 'jpg', 'leocarpus'),
    131259259: (80102771, 'jpg', 'exidia'),
    460544380: (256815760, 'jpeg', 'ascocoryne'),
    598824077: (330256534, 'jpg', 'didymium'),
}
# CAMELYON cut-outs: name -> (slide, level, x, y, w, h) in that level's pixels (picked from `survey`)
CUTS = {
    'tumour': ('tumor_001', 2, 17400, 30700, 1024, 1024),  # annotated metastasis (CAMELYON16/annotations/tumor_001.xml)
    'tumour3': ('tumor_001', 3, 8600, 15200, 768, 768),    # same metastasis, half the magnification
    'fat': ('tumor_001', 3, 3300, 7900, 1024, 1024),       # adipose: fat cells packed like ice crystals
    'node': ('tumor_001', 3, 7300, 14700, 1024, 1024),     # dense lymph node tissue
}


# ---------------- http ----------------
def get(url, a=None, n=None, tries=4):
    for t in range(tries):
        try:
            h = {'User-Agent': 'grodius-roda-textures/1.0'}
            if a is not None:
                h['Range'] = f'bytes={a}-{a + n - 1}'
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=90) as r:
                return r.read()
        except Exception:
            if t == tries - 1:
                raise


# ---------------- BigTIFF / TIFF pyramid reader (JPEG tiles) ----------------
class Slide:
    def __init__(self, name):
        self.url = CAM.format(name)
        h = get(self.url, 0, 16)
        self.bo = '<' if h[:2] == b'II' else '>'
        self.big = struct.unpack(self.bo + 'H', h[2:4])[0] == 43
        off = struct.unpack(self.bo + ('Q' if self.big else 'I'), h[8:16] if self.big else h[4:8])[0]
        self.levels = []
        while off:
            ifd, off = self._ifd(off)
            if 322 in ifd:
                self.levels.append(ifd)

    def _ifd(self, off):
        bo, big = self.bo, self.big
        n = struct.unpack(bo + ('Q' if big else 'H'), get(self.url, off, 8 if big else 2))[0]
        es = 20 if big else 12
        e = get(self.url, off + (8 if big else 2), n * es + (8 if big else 4))
        size = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 16: 8, 17: 8}
        fmt = {1: 'B', 2: 'B', 3: 'H', 4: 'I', 7: 'B', 16: 'Q', 17: 'q'}
        tags = {}
        for i in range(n):
            b = e[i * es:(i + 1) * es]
            tag, typ, cnt = struct.unpack(bo + ('HHQ' if big else 'HHI'), b[:12 if big else 8])
            val = b[12:20] if big else b[8:12]
            nb = size.get(typ, 1) * cnt
            raw = val[:nb] if nb <= len(val) else get(self.url, struct.unpack(bo + ('Q' if big else 'I'), val)[0], nb)
            if typ in (1, 7, 2) or tag == 347:
                tags[tag] = raw
            else:
                tags[tag] = list(struct.unpack(bo + fmt[typ] * cnt, raw[:size[typ] * cnt])) if typ in fmt else raw
        nxt = struct.unpack(bo + ('Q' if big else 'I'), e[n * es:n * es + (8 if big else 4)])[0]
        return tags, nxt

    def size(self, lv):
        d = self.levels[lv]
        return d[256][0], d[257][0]

    def tile(self, lv, tx, ty):
        d = self.levels[lv]
        tw, th = d[322][0], d[323][0]
        nx = (d[256][0] + tw - 1) // tw
        i = ty * nx + tx
        data = get(self.url, d[324][i], d[325][i])
        jt = d.get(347)
        if jt:
            data = jt[:-2] + data[2:]
        return Image.open(io.BytesIO(data)).convert('RGB')

    def region(self, lv, x, y, w, h):
        d = self.levels[lv]
        tw, th = d[322][0], d[323][0]
        out = Image.new('RGB', (w, h))
        for ty in range(y // th, (y + h - 1) // th + 1):
            for tx in range(x // tw, (x + w - 1) // tw + 1):
                out.paste(self.tile(lv, tx, ty), (tx * tw - x, ty * th - y))
        return out


# ---------------- commands ----------------
def fetch():
    os.makedirs(os.path.join(RAW, 'inat'), exist_ok=True)
    os.makedirs(os.path.join(RAW, 'camelyon'), exist_ok=True)
    for pid, (oid, ext, nm) in PHOTOS.items():
        p = os.path.join(RAW, 'inat', nm + '.jpg')
        if os.path.exists(p):
            continue
        obs = json.loads(get(f'https://api.inaturalist.org/v1/observations/{oid}'))['results'][0]
        ph = [q for q in obs['photos'] if q['id'] == pid]
        if not ph or ph[0]['license_code'] not in ('cc0', 'cc-by'):
            raise SystemExit(f'photo {pid}: license {ph and ph[0]["license_code"]} is not CC0/CC BY, refusing')
        print(nm, pid, ph[0]['license_code'], ph[0]['attribution'])
        data = get(ph[0]['url'].replace('/square.', '/large.'))  # extension as iNat serves it
        open(p, 'wb').write(data)
    for nm, (sl, lv, x, y, w, h) in CUTS.items():
        p = os.path.join(RAW, 'camelyon', nm + '.png')
        if os.path.exists(p):
            continue
        print('camelyon', nm, sl, lv, x, y, w, h)
        Slide(sl).region(lv, x, y, w, h).save(p)


def survey(slides=('tumor_001',), lv=6):
    os.makedirs(os.path.join(RAW, 'camelyon'), exist_ok=True)
    for s in slides:
        S = Slide(s)
        print(s, [S.size(i) for i in range(len(S.levels))])
        w, h = S.size(lv)
        S.region(lv, 0, 0, w, h).save(os.path.join(RAW, 'camelyon', f'overview-{s}-L{lv}.png'))


# ---------------- image ops (float32, 0..1) ----------------
P = int(T * 1.5)  # patches are cut at 1.5x the tile so the wrap can cross-fade


def layer(src, box):
    """crop box (x, y, size) of a raw source -> P x P float RGB"""
    d, n = src.split('/')
    path = os.path.join(RAW, d, n + ('.jpg' if d == 'inat' else '.png'))
    x, y, s = box
    im = Image.open(path).convert('RGB').crop((x, y, x + s, y + s)).resize((P, P), Image.LANCZOS)
    return np.asarray(im, np.float32) / 255


def blur(a, r):
    if r <= 0:
        return a
    n = int(r * 3)
    k = np.exp(-.5 * (np.arange(-n, n + 1) / r) ** 2).astype(np.float32)
    k /= k.sum()
    b = np.pad(a, n, mode='reflect')
    b = np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 1, b)
    return np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 0, b).astype(np.float32)


def lum(a):
    return a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11


def norm(a, lo=2, hi=98):
    a0, a1 = np.percentile(a, [lo, hi])
    return np.clip((a - a0) / max(a1 - a0, 1e-6), 0, 1)


def flatten(a, r=18):
    """kill the photo's lighting gradient, keep surface detail"""
    return a - blur(a, r) + a.mean()


def wrap(a):
    """P x P -> T x T seamless: histogram-preserving cross-fade of the overlap (P - T) on both axes"""
    o = P - T
    m = a.mean()
    w = np.clip(np.arange(o, dtype=np.float32) / (o - 1), 0, 1)
    w = w * w * (3 - 2 * w)
    k = 1 / np.sqrt(w * w + (1 - w) * (1 - w))

    def one(b):  # along axis 1
        out = b[:, :T].copy()
        out[:, :o] = (b[:, :o] * w + b[:, T:T + o] * (1 - w) - m) * k + m
        return out

    return np.clip(one(one(a).T).T, 0, 1)


def ramp(v, stops):
    """gradient-map v (0..1) through [(pos, '#rrggbb'), ...]"""
    xs = np.array([s[0] for s in stops], np.float32)
    cs = np.array([[int(s[1][i:i + 2], 16) for i in (1, 3, 5)] for s in stops], np.float32) / 255
    return np.stack([np.interp(v, xs, cs[:, c]) for c in range(3)], -1)


def mix(a, b, m):
    m = m[..., None] if a.ndim == 3 and m.ndim == 2 else m
    return a * (1 - m) + b * m


def sstep(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def hema(a):
    """haematoxylin-ish density of an H&E crop: nuclei -> 1, pink stroma ~.4, empty fat -> 0"""
    return 1 - lum(a)


# ---------------- the textures ----------------
def tex_flesh():
    # derelict walls grown into meat: metastatic tumour cells (CAMELYON) folded by Ascocoryne's brain-wrinkles
    h = norm(flatten(hema(layer('camelyon/tumour', (0, 0, 768))), 10))
    h = blur(h, .7)
    w = norm(blur(flatten(lum(layer('inat/ascocoryne', (250, 150, 400))), 26), 1.2), 2, 82)  # specular glints clipped
    v = wrap(norm(h * .6 + w * .65))
    c = ramp(v, [(0, '#120204'), (.25, '#36070c'), (.5, '#661317'), (.74, '#962a2b'), (.9, '#bc4c42'), (1, '#de8c6c')])
    fat = wrap(sstep(.75, 1, w) * sstep(.45, .15, h))  # pale fatty glisten where the folds bulge and no nuclei
    return mix(c, np.array([.78, .62, .38], np.float32), fat * .3)


def tex_ice():
    # cryovault: adipose tissue (fat cells = frozen crystal lattice) over Didymium foam; septa read as frozen blood
    f = layer('camelyon/fat', (0, 120, 420))
    e = norm(flatten(lum(f), 12))          # cells bright, membranes dark
    blood = norm(f[..., 0] - f[..., 2], 50, 99.5)  # red cells / eosin-heavy septa
    d = norm(flatten(lum(layer('inat/didymium', (240, 320, 400))), 10))
    v = wrap(norm(e * .7 + d * .35))
    blood = wrap(blood)
    c = ramp(v, [(0, '#060e1a'), (.3, '#183451'), (.6, '#36618a'), (.85, '#6a9cc2'), (1, '#b4dcf2')])
    return mix(c, np.array([.42, .05, .1], np.float32), np.clip(blood * .75 * (1 - v)[..., None] ** .5, 0, .8)[..., 0])


def tex_acid():
    # digestion tanks: Fuligo's half-dissolved grey foam, tumour nuclei as the sediment; pits weep teal, ridges crust sulfur
    g = norm(flatten(lum(layer('inat/fuligo-grey', (60, 20, 480))), 14))
    h = norm(flatten(hema(layer('camelyon/tumour3', (0, 0, 512))), 8))
    v = wrap(norm(g * .8 + h * .35))
    c = ramp(v, [(0, '#060403'), (.25, '#1d120b'), (.5, '#3d2716'), (.72, '#634020'), (.9, '#857030'), (1, '#b0a050')])
    pit = sstep(.32, .08, v)  # the deep holes fill with teal digestive fluid
    return mix(c, np.array([.12, .52, .45], np.float32), pit * .75)


def tex_fire():
    # furnace: Exidia's black glossy jelly = charred, blistered skin; tissue folds glow like embers
    x = layer('inat/exidia', (330, 200, 250))
    s = norm(flatten(lum(x), 22), 2, 99)
    h = norm(flatten(hema(layer('camelyon/node', (0, 0, 768))), 8))
    v = wrap(norm(s * .9 + h * .2))
    c = ramp(v, [(0, '#060202'), (.3, '#22100a'), (.55, '#46200f'), (.8, '#70381e'), (.93, '#a06040'), (1, '#d8a878')])
    crease = wrap(sstep(.3, .1, blur(s, 1.2)))  # the jelly's deep folds = cracks in the char
    seam = crease * wrap(sstep(.45, .8, blur(h, 1)))
    c = mix(c, np.array([.55, .08, .02], np.float32), crease * .45)
    return mix(c, np.array([1, .55, .14], np.float32), np.clip(seam * 1.2, 0, 1))


def tex_snot():
    # sinus: Leocarpus egg-clusters as pus heads packed in Fuligo's yellow plasmodium mucus
    e = layer('inat/leocarpus', (60, 200, 640))
    eg = norm(flatten(lum(e), 14))
    y = norm(flatten(lum(layer('inat/fuligo-yellow', (300, 330, 320))), 8))
    v = wrap(norm(eg * .75 + y * .3))
    c = ramp(v, [(0, '#0e0602'), (.3, '#2c1a0a'), (.55, '#5a3a14'), (.78, '#8a6c26'), (.92, '#b49c50'), (1, '#dccf98')])
    sat = wrap(norm(e[..., 0] - e[..., 2]))  # where the eggs were orange: inflamed red ring under the pus
    return mix(c, np.array([.55, .16, .1], np.float32), sstep(.55, .9, sat) * sstep(.75, .45, v) * .6)


TEX = {'flesh': tex_flesh, 'ice': tex_ice, 'acid': tex_acid, 'fire': tex_fire, 'snot': tex_snot}


def build():
    os.makedirs(OUT, exist_ok=True)
    sheet = Image.new('RGB', (len(TEX) * (T * 3 + 8), T * 3 + 8 + 20), (255, 0, 255))
    for i, (k, fn) in enumerate(TEX.items()):
        a = np.clip(fn(), 0, 1).astype(np.float32)
        im = Image.fromarray((a * 255 + .5).astype(np.uint8), 'RGB')
        p = os.path.join(OUT, f'tex-{k}.png')
        im.save(p, optimize=True)
        print(f'{p}  {os.path.getsize(p)} bytes  mean {a.mean():.3f}')
        for ty in range(3):
            for tx in range(3):
                sheet.paste(im, (i * (T * 3 + 8) + tx * T, ty * T))
        # readability check: an enemy bullet (lime) and a player shot (white-ish) on top
        from PIL import ImageDraw
        d = ImageDraw.Draw(sheet)
        bx = i * (T * 3 + 8) + 60
        for j in range(6):
            d.ellipse((bx + j * 40, 180, bx + j * 40 + 5, 185), fill=(182, 255, 58))
            d.rectangle((bx + j * 40, 260, bx + j * 40 + 8, 261), fill=(255, 240, 200))
        d.text((i * (T * 3 + 8) + 4, T * 3 + 8), k, fill=(0, 0, 0))
    sheet.save(os.path.join(RAW, 'sheet.png'))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if cmd == 'fetch':
        fetch()
    elif cmd == 'survey':
        survey(tuple(sys.argv[2:]) or ('tumor_001',))
    else:
        build()
