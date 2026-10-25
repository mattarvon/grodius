#!/usr/bin/env python3
"""Open Orbit's deep-field backdrop from real JWST data: the JADES GOODS-S NIRCam mosaics (CC BY 4.0, MAST HLSP,
public S3 bucket stpubdata, found via the Registry of Open Data on AWS). Each filter is an 11 GB FITS file, so this
reads the SCI header with one range request and then only the rows of the cutout (one ranged GET per row, threaded).

  uv run --with numpy,pillow python tools/jades_backdrop.py survey            -> assets-raw/jades/coverage.png (pick x,y)
  uv run --with numpy,pillow python tools/jades_backdrop.py cut X Y [W H]     -> assets-raw/jades/cut-*.npy + src/img/deepfield.png

The cutout (default 2400x636 px at 0.03"/px) is composited F444W/F200W/F090W -> R/G/B with an asinh stretch and
downsampled 2.5x to 960x254, the Open Orbit play-field height.
"""
import os, sys, struct, concurrent.futures as cf, urllib.request
import numpy as np
from PIL import Image

BASE = 'https://stpubdata.s3.amazonaws.com/mast/hlsp/jades/dr2/goods-s/images/hlsp_jades_jwst_nircam_goods-s-deep_{}_v2.0_drz.fits'
FILTERS = {'r': 'f444w', 'g': 'f200w', 'b': 'f090w'}
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RAW = os.path.join(ROOT, 'assets-raw', 'jades')


def rng(url, a, b):
    for tries in range(4):
        try:
            req = urllib.request.Request(url, headers={'Range': f'bytes={a}-{b - 1}'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception:
            if tries == 3:
                raise


def sci_layout(url):
    """(data offset, NAXIS1, NAXIS2) of the SCI extension"""
    head = rng(url, 0, 2880 * 40)
    cards = [head[i:i + 80].decode('ascii', 'replace') for i in range(0, len(head), 80)]
    in_sci, n1, n2 = False, None, None
    for i, c in enumerate(cards):
        k = c[:8].strip()
        if k == 'EXTNAME' and 'SCI' in c:
            in_sci = True
        if k == 'NAXIS1':
            n1 = int(c[10:30])
        if k == 'NAXIS2':
            n2 = int(c[10:30])
        if in_sci and k == 'END':
            end = (i + 1) * 80
            return (end + 2879) // 2880 * 2880, n1, n2
    raise SystemExit('no SCI extension in the first 115 KB')


def rows(url, off, n1, ys, x0, w):
    def one(y):
        a = off + (y * n1 + x0) * 4
        return y, np.frombuffer(rng(url, a, a + w * 4), dtype='>f4').astype(np.float32)
    out = {}
    with cf.ThreadPoolExecutor(16) as ex:
        for y, r in ex.map(one, ys):
            out[y] = r
    return np.stack([out[y] for y in ys])


def survey():
    url = BASE.format('f200w')
    off, n1, n2 = sci_layout(url)
    step = 100
    ys = list(range(0, n2, step))
    print(f'{n1}x{n2}, reading {len(ys)} full rows (~{len(ys) * n1 * 4 / 1e6:.0f} MB)')
    a = rows(url, off, n1, ys, 0, n1)[:, ::step]
    a = np.nan_to_num(a)
    v = np.clip(np.arcsinh(a / .02) / np.arcsinh(5 / .02), 0, 1)
    os.makedirs(RAW, exist_ok=True)
    Image.fromarray((v * 255).astype(np.uint8)[::-1]).resize((v.shape[1] * 2, v.shape[0] * 2), Image.NEAREST).save(os.path.join(RAW, 'coverage.png'))
    np.save(os.path.join(RAW, 'coverage.npy'), a)
    print(f'coverage.png: 1 px = {step}x{step} source px, image flipped so north is up (y in the file counts up from the bottom)')


def cut(x0, y0, w=2400, h=636):
    os.makedirs(RAW, exist_ok=True)
    ch = {}
    for c, f in FILTERS.items():
        p = os.path.join(RAW, f'cut-{f}-{x0}-{y0}-{w}x{h}.npy')
        if not os.path.exists(p):
            url = BASE.format(f)
            off, n1, n2 = sci_layout(url)
            print(f'{f}: {h} rows x {w} px from ({x0},{y0})')
            np.save(p, rows(url, off, n1, list(range(y0, y0 + h)), x0, w))
        ch[c] = np.nan_to_num(np.load(p))[::-1]  # FITS rows run bottom-up
    # per-channel sky subtraction + scale to the channel's 99.7th percentile, then a shared asinh stretch
    out = []
    for c in 'rgb':
        a = ch[c] - np.median(ch[c])
        a = a / max(np.percentile(a, 99.7), 1e-6)
        out.append(a)
    rgb = np.stack(out, -1)
    rgb = np.arcsinh(rgb * 6) / np.arcsinh(6 * 4)
    rgb = np.clip(rgb, 0, 1)
    im = Image.fromarray((rgb * 255).astype(np.uint8)).resize((round(w / 2.5), round(h / 2.5)), Image.LANCZOS)
    dest = os.path.join(ROOT, 'src', 'img', 'deepfield.png')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    im.save(dest, optimize=True)
    im.save(os.path.join(RAW, f'deepfield-{x0}-{y0}.png'))
    print(f'-> {dest} {im.size}')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'survey':
        survey()
    elif cmd == 'cut':
        cut(*map(int, sys.argv[2:6]))
    else:
        print(__doc__)
