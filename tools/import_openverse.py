#!/usr/bin/env python3
"""Turn the Openverse picks in assets-raw/openverse/ (see tools/openverse.mjs) into game assets.

  uv run --with numpy,pillow,imageio-ffmpeg python tools/import_openverse.py [sfx] [music] [img]

sfx:   Freesound clips are long takes with many hits. Each is cut at its transients into one-shots, trimmed, faded,
       RMS-matched to the median of the bank it joins, and encoded Ogg Vorbis q4 mono as src/sfx/<bank>/ov-*.ogg.
music: silence trimmed, loudness-normalized to -16 LUFS (like the Void tracks), Ogg Vorbis q3 -> src/music/ov-*.ogg.
img:   Neptune sprites, backdrops and Infirmary x-rays -> src/img/*.png at game resolution.
Re-running replaces the ov-* files it made. Credits for every source file are in CREDITS.md.
"""
import glob, os, re, subprocess, sys
import numpy as np
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter, ImageOps

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OV = os.path.join(ROOT, 'assets-raw', 'openverse')
SR = 44100


def decode(path, ch=1):
    raw = subprocess.run([FF, '-loglevel', 'error', '-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch) if ch > 1 else np.frombuffer(raw, np.float32)


def encode(x, path, q=4, ch=1):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run([FF, '-loglevel', 'error', '-y', '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-i', '-',
                    '-c:a', 'libvorbis', '-q:a', str(q), path], input=np.ascontiguousarray(x, np.float32).tobytes(), check=True)


def rms(x):
    return float(np.sqrt(np.mean(np.square(x)) + 1e-12))


def bank_rms(bank):
    """median RMS of the clips already in a bank (ignoring our own), so new clips sit at the same level"""
    vals = [rms(decode(f)) for f in glob.glob(os.path.join(ROOT, 'src', 'sfx', bank, '*.ogg')) if not os.path.basename(f).startswith('ov-')]
    return float(np.median(vals)) if vals else None


def slices(x, lo, hi, n):
    """up to n transient-led one-shots between lo and hi seconds, loudest first, in time order"""
    hop = 441  # 10 ms
    env = np.sqrt(np.convolve(np.square(x), np.ones(hop) / hop, 'same'))[::hop]
    peak = env.max()
    if peak <= 0:
        return []
    thr = min(max(peak * 10 ** (-30 / 20), np.percentile(env, 30) * 3), peak * .5)  # cap: a steady siren has no quiet floor
    on = env > thr
    segs, i = [], 0
    while i < len(on):
        if not on[i]:
            i += 1
            continue
        j = i
        quiet = 0
        while j < len(on) and quiet < 12:  # a region ends after 120 ms under the threshold
            quiet = quiet + 1 if not on[j] else 0
            j += 1
        a, b = max(0, i - 1), j - quiet + 4  # 10 ms of lead-in, 40 ms of tail past the last loud frame
        dur = (b - a) * hop / SR
        if dur >= lo:
            b = min(b, a + int(hi * SR / hop))
            segs.append((env[a:b].max(), a * hop, b * hop))
        i = j
    segs.sort(key=lambda s: -s[0])
    return sorted(segs[:n], key=lambda s: s[1])


def shape(seg, fade_in=.003, fade_out=.04):
    seg = seg.copy()
    fi, fo = int(fade_in * SR), min(int(fade_out * SR), len(seg) // 3)
    seg[:fi] *= np.linspace(0, 1, fi)
    seg[-fo:] *= np.linspace(1, 0, fo) ** 2
    return seg


# raw tag (assets-raw/openverse/sfx/<tag>/) -> (min s, max s, slices per file, bank chooser by slice length)
SFX = {
    'splat': (.12, 1.0, 6, lambda d: 'splat_s' if d < .3 else 'splat_m' if d < .6 else 'splat_l'),
    'bone': (.08, .5, 6, lambda d: 'bone'),
    'explode': (.25, 2.2, 2,lambda d: 'explode_s' if d < .9 else 'explode_l'),
    'monster': (.5, 2.4, 3, lambda d: 'monster'),
    'snot': (.1, .6, 6, lambda d: 'snot'),
    'warning': (1.0, 2.6, 1, lambda d: 'warning'),
}
# whole clips used as one-shot stingers: raw music file stem prefix -> (bank, max s)
STINGERS = {'ov-scaryviolins': ('stinger', 4.5), 'ov-deep-01-loading': ('forkopen', 1.9)}
# full music tracks: raw stem prefix -> src/music/ name
MUSIC = {
    'ov-circuit-synthwave-486c6d': 'ov-circuit-synthwave',
    'ov-circuit-synthwave-alt': 'ov-circuit-synthwave-alt',
    'ov-2020-03-18-synthwave-doctor-dreamchip': 'ov-dreamchip-synthwave',
    'ov-film-movie-synthwave-electropop': 'ov-synthwave-electropop',
    'ov-dx7-synthwave-chords': 'ov-dx7-chords',
    'ov-action-music-loop-with-dark-ambient': 'ov-dark-drone-loop',
    'ov-drone-space-wind-scifi': 'ov-space-wind',
    'ov-horror-ambience-16': 'ov-horror-ambience',
    'ov-cyberpunk-beat': 'ov-cyberpunk-beat',
    'ov-cyberpunk-24042017-snippet': 'ov-cyberpunk-snippet',
}


def clear(pattern):
    for f in glob.glob(pattern):
        os.remove(f)


def do_sfx():
    clear(os.path.join(ROOT, 'src', 'sfx', '*', 'ov-*.ogg'))
    levels = {}
    for tag, (lo, hi, n, pick) in SFX.items():
        for src in sorted(glob.glob(os.path.join(OV, 'sfx', tag, '*.mp3'))):
            x = decode(src)
            stem = re.sub(r'-[0-9a-f]{6}$', '', os.path.splitext(os.path.basename(src))[0])[:28].rstrip('-')
            for k, (_, a, b) in enumerate(slices(x, lo, hi, n)):
                seg = shape(x[a:b])
                bank = pick(len(seg) / SR)
                if bank not in levels:
                    levels[bank] = bank_rms(bank) or .12
                seg = seg * (levels[bank] / rms(seg))
                seg = seg / max(1, np.abs(seg).max() / .97)
                out = os.path.join(ROOT, 'src', 'sfx', bank, f'{stem}-{k + 1:02d}.ogg')
                encode(seg, out)
                print(f'{bank:10s} {len(seg) / SR:4.2f}s  {os.path.relpath(out, ROOT)}')
    for pre, (bank, mx) in STINGERS.items():
        src = glob.glob(os.path.join(OV, 'music', 'music', pre + '*.mp3'))[0]
        x = decode(src)
        nz = np.nonzero(np.abs(x) > .01)[0]
        seg = shape(x[nz[0]:min(nz[-1], nz[0] + int(mx * SR))], fade_out=.4)
        seg = seg * (.12 / rms(seg))
        seg = seg / max(1, np.abs(seg).max() / .97)
        out = os.path.join(ROOT, 'src', 'sfx', bank, f'{pre}.ogg')
        encode(seg, out)
        print(f'{bank:10s} {len(seg) / SR:4.2f}s  {os.path.relpath(out, ROOT)}')


def do_music():
    clear(os.path.join(ROOT, 'src', 'music', 'ov-*.ogg'))
    for pre, name in MUSIC.items():
        src = glob.glob(os.path.join(OV, 'music', 'music', pre + '*.mp3'))[0]
        x = decode(src, 2)
        m = np.abs(x).max(1)
        nz = np.nonzero(m > .003)[0]
        x = x[nz[0]:nz[-1]].copy()
        f = int(.02 * SR)
        x[:f] *= np.linspace(0, 1, f)[:, None]
        x[-f:] *= np.linspace(1, 0, f)[:, None]
        tmp = os.path.join(OV, f'{name}.f32')
        x.astype(np.float32).tofile(tmp)
        out = os.path.join(ROOT, 'src', 'music', f'{name}.ogg')
        subprocess.run([FF, '-loglevel', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', tmp,
                        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', str(SR), '-c:a', 'libvorbis', '-q:a', '3', out], check=True)
        os.remove(tmp)
        print(f'music {len(x) / SR:6.1f}s  {os.path.relpath(out, ROOT)}  {os.path.getsize(out) / 1e6:.1f} MB')


def img(name):
    return Image.open(glob.glob(os.path.join(OV, 'image', '*', name + '*.jpg'))[0]).convert('RGB')


def lum_alpha(im, lo=6, hi=40):
    """black space -> transparent, so the sprite sits on the starfield"""
    a = np.asarray(im.convert('L'), np.float32)
    a = np.clip((a - lo) / (hi - lo), 0, 1) * 255
    out = im.convert('RGBA')
    out.putalpha(Image.fromarray(a.astype(np.uint8)))
    return out


def bbox_of(im, thr=18):
    a = np.asarray(im.convert('L')) > thr
    ys, xs = np.nonzero(a)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def save(im, name):
    p = os.path.join(ROOT, 'src', 'img', name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, optimize=True)
    print(f'img {im.size}  {os.path.relpath(p, ROOT)}  {os.path.getsize(p) / 1e3:.0f} KB')


def do_img():
    # Neptune, Voyager 2 (Descent 1): 96 px disc, like the old drawn r=48 planet
    v = img('ov-neptune-nasa-s-voyager-2-1989')
    x0, y0, x1, y1 = bbox_of(v)  # the night-side limb is black on black: size the disc from the lit top/bottom/right edges
    r = (y1 - y0) / 2
    cx, cy = x1 - r, (y0 + y1) / 2
    v = v.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r))).resize((96, 96), Image.LANCZOS)
    mask = Image.new('L', (384, 384), 0)
    ImageDraw.Draw(mask).ellipse((2, 2, 382, 382), fill=255)
    v = v.convert('RGBA')
    v.putalpha(mask.resize((96, 96), Image.LANCZOS))
    save(v, 'neptune-voyager.png')
    # Neptune, Webb (Descent 2+): the ringed planet from the right panel of "Neptune Through the Years"
    t = img('ov-neptune-through-the-years')
    w, h = t.size
    panel = t.crop((int(w * .6), int(h * .12), w, int(h * .9)))
    x0, y0, x1, y1 = bbox_of(panel, 60)
    cx, cy, half = (x0 + x1) // 2, (y0 + y1) // 2, int((x1 - x0) * .62)
    ring = panel.crop((cx - half, cy - int(half * .62), cx + half, cy + int(half * .62)))
    ring = ImageOps.autocontrast(ring, cutoff=.5).resize((176, 109), Image.LANCZOS)
    # Webb's infrared disc is near-white; pull it down to an icy blue-grey so it sits behind the nebula skies
    a = np.asarray(ring, np.float32) / 255
    a = (a ** 1.6) * np.array([.62, .74, .86])
    ring = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    save(lum_alpha(ring, 10, 60), 'neptune-webb.png')
    # (the Milky Way core backdrop was replaced by RODA JWST skies: tools/roda_sky.py)
    # Perseus cluster "x-ray skull" (behind the Gravity Drive): a 200 px ghost, alpha from brightness
    p = img('ov-the-perseus-cluster-s-x-ray-skull').resize((200, 195), Image.LANCZOS)
    save(lum_alpha(p, 30, 200), 'perseus-skull.png')
    # Infirmary lightbox x-rays: greyscale, contrast up, film-sized
    s = ImageOps.autocontrast(img('ov-x-ray-skull').convert('L'), cutoff=1)
    s = s.crop((int(s.width * .24), int(s.height * .06), s.width, s.height)).resize((120, 108), Image.LANCZOS)
    save(s, 'xray-skull.png')
    d = ImageOps.autocontrast(img('ov-dental-x-ray').convert('L'), cutoff=1).resize((150, 79), Image.LANCZOS)
    save(d, 'xray-teeth.png')


if __name__ == '__main__':
    want = set(sys.argv[1:]) or {'sfx', 'music', 'img'}
    if 'sfx' in want:
        do_sfx()
    if 'music' in want:
        do_music()
    if 'img' in want:
        do_img()
