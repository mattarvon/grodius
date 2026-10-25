#!/usr/bin/env python3
"""Grodius space backgrounds from real telescope data in the Registry of Open Data on AWS (RODA).

Generalises tools/jades_backdrop.py: every source is a calibrated FITS mosaic in the public S3 bucket `stpubdata`
(no credentials). A mosaic can be 5 GB+, so we read the SCI header with one range request and then only the rows we
need (one ranged GET per row, 16 threads). Channels shot at different pixel scales (NIRCam short/long wave) are
registered onto the first channel's pixel grid with the linear WCS (CRPIX/CRVAL/PC/CDELT; plenty at our scale).

  uv run --with numpy,pillow,scipy python tools/roda_sky.py survey NAME [KEY] -> assets-raw/sky/NAME-survey.png (grid every 500 ref px)
  uv run --with numpy,pillow,scipy python tools/roda_sky.py cut NAME      -> src/img/sky-NAME.png (+ raw cutouts cached as .npy)
  uv run --with numpy,pillow,scipy python tools/roda_sky.py all           -> every sky

Total run ~35 s for all three (about 0.4 GB of ranged reads); surveys of other mosaics: `survey NAME KEY`.
(Also surveyed and rejected: jw02739 M16 o001/o009/c1000 fields -- not the iconic pillars, weak as strips.)

SOURCES (bucket https://stpubdata.s3.amazonaws.com/, keys below; cutout = (x0, y0, w, h) in the FIRST channel's
SCI pixels, y counted in FITS order i.e. from the bottom row):

  carina   RODA `mast-jwst` (JWST, public domain). Program 2731 (ERO), NGC 3324 "Cosmic Cliffs" in Carina.
           R jwst/public/jw02731/L3/t/o001/jw02731-o001_t017_nircam_clear-f444w_i2d.fits  (7065x4178, 0.063"/px)
           G jwst/public/jw02731/L3/t/o001/jw02731-o001_t017_nircam_clear-f335m_i2d.fits
           B jwst/public/jw02731/L3/t/o001/jw02731-o001_t017_nircam_clear-f187n_i2d.fits  (14342x8588, 0.031"/px)
           cutout (0, 1900, 7065, 1869) -> sky-carina.png 960x254, 'bruise' grade, Descent 2 + title screen.
  tarantula RODA `mast-jwst` (JWST, public domain). Program 2729 (ERO), 30 Doradus / Tarantula Nebula (LMC).
           R jwst/public/jw02729/L3/t/o001/jw02729-o001_t001_nircam_clear-f444w_i2d.fits  (7063x4172)
           G jwst/public/jw02729/L3/t/o001/jw02729-o001_t001_nircam_clear-f335m_i2d.fits
           B jwst/public/jw02729/L3/t/o001/jw02729-o001_t001_nircam_clear-f187n_i2d.fits
           cutout (800, 800, 6200, 1640) -> sky-tarantula.png 960x254, 'flesh' grade, Descent 3.
  casa     RODA `mast-jwst` (JWST, public domain). Program 1947, MIRI mosaic of supernova remnant Cassiopeia A.
           R/G/B jwst/public/jw01947/L3/t/o001/jw01947-o001_t010_miri_f2550w / f1800w / f1130w _i2d.fits
           cutout (500, 150, 2700, 2700) -> sky-casa.png 256x256 RGBA ('organ' grade); it carries alpha: it is the "gross" layer (a flayed, breathing organ drifting in the sky).
  (deepfield, Descent 1: tools/jades_backdrop.py, RODA `mast-jades`, CC BY 4.0, unchanged.)

Licence check (RODA entry for `mast-jwst`): "Public domain. Attribution required for refereed scientific papers."
We credit NASA/ESA/CSA/STScI anyway. Colour is graded toward the game's bruise/blood/bile palette (see grade() and the BRUISE/FLESH/ORGAN ramps).
"""
import os, sys, concurrent.futures as cf, urllib.request
import numpy as np
from PIL import Image, ImageDraw

S3 = 'https://stpubdata.s3.amazonaws.com/'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RAW = os.path.join(ROOT, 'assets-raw', 'sky')
J = 'jwst/public/'

SKIES = {
    'carina': dict(
        files=[J + 'jw02731/L3/t/o001/jw02731-o001_t017_nircam_clear-f444w_i2d.fits',
               J + 'jw02731/L3/t/o001/jw02731-o001_t017_nircam_clear-f335m_i2d.fits',
               J + 'jw02731/L3/t/o001/jw02731-o001_t017_nircam_clear-f187n_i2d.fits'],
        cut=(0, 1900, 7065, 1869), out=(960, 254), grade='bruise', hi=99.0, soft=24),
    'tarantula': dict(
        files=[J + 'jw02729/L3/t/o001/jw02729-o001_t001_nircam_clear-f444w_i2d.fits',
               J + 'jw02729/L3/t/o001/jw02729-o001_t001_nircam_clear-f335m_i2d.fits',
               J + 'jw02729/L3/t/o001/jw02729-o001_t001_nircam_clear-f187n_i2d.fits'],
        cut=(800, 800, 6200, 1640), out=(960, 254), grade='flesh'),
    'casa': dict(
        files=[J + 'jw01947/L3/t/o001/jw01947-o001_t010_miri_f2550w_i2d.fits',
               J + 'jw01947/L3/t/o001/jw01947-o001_t010_miri_f1800w_i2d.fits',
               J + 'jw01947/L3/t/o001/jw01947-o001_t010_miri_f1130w_i2d.fits'],
        cut=(500, 150, 2700, 2700), out=(256, 256), grade='organ', hi=99.3, soft=30),
}


def rng(key, a, b):
    for tries in range(5):
        try:
            req = urllib.request.Request(S3 + key, headers={'Range': f'bytes={a}-{b - 1}'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception:
            if tries == 4:
                raise


def sci(key):
    """header dict + data offset of the SCI extension"""
    head = rng(key, 0, 2880 * 40)
    cards = [head[i:i + 80].decode('ascii', 'replace') for i in range(0, len(head), 80)]
    h, in_sci = {}, False
    for i, c in enumerate(cards):
        k = c[:8].strip()
        if k == 'XTENSION':
            h = {}
        if k == 'EXTNAME' and 'SCI' in c:
            in_sci = True
        if c[8:10] == '= ':
            v = c[10:].split('/')[0].strip()
            try:
                h[k] = float(v)
            except ValueError:
                h[k] = v.strip("'").strip()
        if k == 'END' and in_sci:
            h['OFF'] = ((i + 1) * 80 + 2879) // 2880 * 2880
            h['N1'], h['N2'] = int(h['NAXIS1']), int(h['NAXIS2'])
            return h
    raise SystemExit(f'no SCI extension in the first 115 KB of {key}')


def cd(h):
    return np.array([[h.get('PC1_1', 1), h.get('PC1_2', 0)], [h.get('PC2_1', 0), h.get('PC2_2', 1)]]) * \
        np.array([[h['CDELT1']], [h['CDELT2']]])


def pix2pix(href, h):
    """affine (A, b): channel pixel = A @ ref pixel + b (0-based), via each header's linear WCS on a tangent plane"""
    dec0 = np.radians(href['CRVAL2'])
    # offset of the channel's reference point from the ref's, in tangent-plane degrees
    d = np.array([(h['CRVAL1'] - href['CRVAL1']) * np.cos(dec0), h['CRVAL2'] - href['CRVAL2']])
    Cr, Ch = cd(href), cd(h)
    # world = Cr (p - crp_r);   p_h = crp_h + Ch^-1 (world - d)  (RA flips sign identically in both, so it cancels)
    flip = np.array([[-1, 0], [0, 1]])
    A = np.linalg.inv(Ch) @ Cr
    crp_r = np.array([href['CRPIX1'] - 1, href['CRPIX2'] - 1])
    crp_h = np.array([h['CRPIX1'] - 1, h['CRPIX2'] - 1])
    b = crp_h - A @ crp_r - np.linalg.inv(Ch) @ (flip @ d)
    return A, b


def rows(key, h, ys, x0, w):
    def one(y):
        a = h['OFF'] + (y * h['N1'] + x0) * 4
        return y, np.frombuffer(rng(key, a, a + w * 4), dtype='>f4').astype(np.float32)
    out = {}
    with cf.ThreadPoolExecutor(16) as ex:
        for y, r in ex.map(one, ys):
            out[y] = r
    return np.stack([out[y] for y in ys])


def survey(name, key=None):
    key = key or SKIES[name]['files'][0]
    h = sci(key)
    step = max(1, h['N1'] // 900)
    ys = list(range(0, h['N2'], step))
    print(f'{name}: {h["N1"]}x{h["N2"]}, {len(ys)} rows (~{len(ys) * h["N1"] * 4 / 1e6:.0f} MB)')
    a = np.nan_to_num(rows(key, h, ys, 0, h['N1'])[:, ::step])
    a = a - np.median(a)
    v = np.clip(np.arcsinh(a / max(np.percentile(a, 90), 1e-6)) / np.arcsinh(np.percentile(a, 99.8) / max(np.percentile(a, 90), 1e-6)), 0, 1)
    im = Image.fromarray((v * 255).astype(np.uint8)[::-1]).convert('RGB')
    dr = ImageDraw.Draw(im)
    for g in range(0, max(h['N1'], h['N2']), 500):
        dr.line([(g / step, 0), (g / step, im.height)], fill=(0, 90, 0))
        dr.line([(0, im.height - g / step), (im.width, im.height - g / step)], fill=(0, 90, 0))
        dr.text((g / step + 2, 2), str(g), fill=(0, 255, 0))
        dr.text((2, im.height - g / step - 10), str(g), fill=(0, 255, 0))
    os.makedirs(RAW, exist_ok=True)
    p = os.path.join(RAW, f'{name}-survey.png')
    im.save(p)
    print(f'-> {p} (1 px = {step} ref px; FITS y counts up from the bottom, image drawn north-of-array up)')


def channel(name, ci, href, box, f):
    """channel ci resampled onto the ref grid's cutout box, binned by f -> (h/f, w/f)"""
    key = SKIES[name]['files'][ci]
    x0, y0, w, h0 = box
    p = os.path.join(RAW, f'{name}-c{ci}-{x0}-{y0}-{w}x{h0}-f{f}.npy')
    if os.path.exists(p):
        return np.load(p)
    hh = sci(key) if ci else href
    A, b = pix2pix(href, hh) if ci else (np.eye(2), np.zeros(2))
    s = abs(np.linalg.det(A)) ** .5  # channel px per ref px
    corners = np.array([[x0, y0], [x0 + w, y0], [x0, y0 + h0], [x0 + w, y0 + h0]]).T
    cc = A @ corners + b[:, None]
    cx0, cy0 = np.floor(cc.min(1)).astype(int) - 2
    cx1, cy1 = np.ceil(cc.max(1)).astype(int) + 2
    cx0, cy0 = max(cx0, 0), max(cy0, 0)
    cx1, cy1 = min(cx1, hh['N1']), min(cy1, hh['N2'])
    print(f'{name} c{ci}: {key.split("/")[-1]} scale {s:.2f}, rows {cy0}-{cy1} x {cx0}-{cx1}')
    d = np.nan_to_num(rows(key, hh, list(range(cy0, cy1)), cx0, cx1 - cx0))
    # bin the channel to roughly the output scale first (k channel px), then sample at output pixel centres
    k = max(1, int(round(f * s)))
    H2, W2 = d.shape[0] // k * k, d.shape[1] // k * k
    d = d[:H2, :W2].reshape(H2 // k, k, W2 // k, k).mean((1, 3))
    from scipy.ndimage import map_coordinates
    oh, ow = h0 // f, w // f
    u, v = np.meshgrid(x0 + (np.arange(ow) + .5) * f - .5, y0 + (np.arange(oh) + .5) * f - .5)
    q = np.tensordot(A, np.stack([u, v]), 1) + b[:, None, None]
    qx, qy = (q[0] - cx0 + .5) / k - .5, (q[1] - cy0 + .5) / k - .5
    out = map_coordinates(d, [qy, qx], order=1, mode='nearest').astype(np.float32)
    os.makedirs(RAW, exist_ok=True)
    np.save(p, out)
    return out


def stretch(a, lo=50, hi=99.85, soft=8):
    a = a - np.percentile(a, lo)
    a = a / max(np.percentile(a, hi), 1e-6)
    return np.clip(np.arcsinh(np.clip(a, 0, None) * soft) / np.arcsinh(soft), 0, 1)


def ramp(t, stops):
    """piecewise-linear colour ramp: stops = [(t, (r,g,b)), ...] in 0..1"""
    xs = [s[0] for s in stops]
    return np.stack([np.interp(t, xs, [s[1][c] / 255 for s in stops]) for c in range(3)], -1)


# palette ramps (shadow -> highlight)
BRUISE = [(0, (2, 2, 6)), (.25, (24, 6, 34)), (.5, (78, 12, 48)), (.72, (142, 24, 42)), (.88, (196, 96, 92)), (1, (236, 204, 170))]
FLESH = [(0, (3, 1, 3)), (.3, (34, 6, 12)), (.55, (96, 18, 22)), (.78, (168, 72, 64)), (.92, (214, 160, 120)), (1, (240, 226, 170))]
ORGAN = [(0, (0, 0, 0)), (.3, (60, 4, 14)), (.6, (150, 30, 34)), (.82, (200, 120, 70)), (1, (230, 220, 120))]


def grade(name, ch):
    sk = SKIES[name]
    r, g, b = [stretch(c, hi=sk.get('hi', 99.85), soft=sk.get('soft', 8)) for c in ch]
    lum = np.clip(.45 * r + .35 * g + .2 * b, 0, 1)
    kind = SKIES[name]['grade']
    if kind == 'organ':
        # hot dust (long wave) = meat, short-wave filaments = bile-yellow veins
        base = ramp(lum, ORGAN)
        vein = np.clip(b - .6 * r, 0, 1)[..., None] * np.array([.55, .6, .15])
        rgb = np.clip(base + vein * .8, 0, 1)
        return rgb, lum
    pal = ramp(lum, BRUISE if kind == 'bruise' else FLESH)
    # keep a little of the real colour separation so stars and ionisation fronts still read as data
    real = np.stack([r, g * .8, b], -1)
    rgb = np.clip(pal * .78 + real * pal.max(-1, keepdims=True) * .3, 0, 1)
    return rgb, lum


def cut(name):
    sk = SKIES[name]
    x0, y0, w, h = sk['cut']
    ow, oh = sk['out']
    f = max(1, int(round(min(w / ow, h / oh))))
    href = sci(sk['files'][0])
    ch = [channel(name, ci, href, sk['cut'], f)[::-1] for ci in range(3)]  # FITS rows run bottom-up
    rgb, lum = grade(name, ch)
    im = Image.fromarray((rgb * 255).astype(np.uint8))
    if sk['grade'] == 'organ':
        # alpha from brightness with a soft circular vignette, so it floats over the sky as one body
        yy, xx = np.mgrid[0:lum.shape[0], 0:lum.shape[1]]
        rr = np.hypot((xx - lum.shape[1] / 2) / (lum.shape[1] / 2), (yy - lum.shape[0] / 2) / (lum.shape[0] / 2))
        al = np.clip(lum * 1.6, 0, 1) * np.clip((1 - rr) * 3, 0, 1)
        im.putalpha(Image.fromarray((al * 255).astype(np.uint8)))
    im = im.resize((ow, oh), Image.LANCZOS)
    dest = os.path.join(ROOT, 'src', 'img', f'sky-{name}.png')
    im.save(dest, optimize=True)
    pv = Image.new('RGB', im.size, (0, 0, 0))
    pv.paste(im, (0, 0), im if im.mode == 'RGBA' else None)
    pv.save(os.path.join(RAW, f'sky-{name}-preview.png'))
    print(f'-> {dest} {im.size} {os.path.getsize(dest) // 1024} KB')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'survey':
        survey(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    elif cmd == 'cut':
        cut(sys.argv[2])
    elif cmd == 'all':
        for n in SKIES:
            cut(n)
    else:
        print(__doc__)
